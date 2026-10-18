/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.sql.Savepoint;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.tests.EntityCaptureFixture.CaptureDAO;
import org.openmetadata.it.tests.EntityCaptureFixture.CaptureRoot;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Chart;

@Execution(ExecutionMode.SAME_THREAD)
class ProjectionCaptureTransactionIT {
  private static final Map<RdfTestDatabase.Backend, EntityCaptureFixture> DATABASES =
      new EnumMap<>(RdfTestDatabase.Backend.class);

  @BeforeAll
  static void startDatabases() {
    RdfTestDatabase.backends()
        .forEach(backend -> DATABASES.put(backend, new EntityCaptureFixture(backend)));
  }

  @AfterAll
  static void closeDatabases() {
    DATABASES.values().forEach(EntityCaptureFixture::close);
    DATABASES.clear();
  }

  @BeforeEach
  void clearRows() {
    DATABASES
        .values()
        .forEach(
            fixture ->
                fixture
                    .jdbi()
                    .useHandle(
                        handle -> {
                          handle.execute("DELETE FROM metadata_projection_consumer");
                          handle.execute("DELETE FROM metadata_projection_mutation");
                          handle.execute("DELETE FROM projection_test_entity");
                        }));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void wideLocatorsSpillBeforeTheCountLimit(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final List<EntityInterface<?>> wide =
        IntStream.range(0, 20)
            .<EntityInterface<?>>mapToObj(
                index ->
                    chart().withFullyQualifiedName("service." + index + "." + "x".repeat(50_000)))
            .toList();
    jdbi.useTransaction(
        handle -> {
          handle.attach(CaptureDAO.class).insertMany(wide);
          assertEquals(10, count(handle, "metadata_projection_mutation"));
        });
    assertCommitted(jdbi, 20);
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void separateSqlObjectCallsShareOneCommitBatch(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final AtomicInteger facts = new AtomicInteger();
    final AtomicInteger consumers = new AtomicInteger();
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logAfterExecution(final StatementContext context) {
            if (context.getRenderedSql().startsWith("INSERT INTO metadata_projection_mutation")) {
              facts.incrementAndGet();
            }
            if (context.getRenderedSql().startsWith("INSERT INTO metadata_projection_consumer")) {
              consumers.incrementAndGet();
            }
          }
        });
    try {
      jdbi.onDemand(CaptureRoot.class)
          .useTransaction(
              root -> {
                for (int index = 0; index < 20; index++) {
                  insert(root.charts());
                }
                assertEquals(0, facts.get());
              });
    } finally {
      jdbi.setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertEquals(1, facts.get());
    assertEquals(1, consumers.get());
    assertCommitted(jdbi, 20);
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void savepointRollbackRestoresFactsFlushedAfterTheSavepoint(final RdfTestDatabase.Backend backend)
      throws Exception {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    jdbi.useTransaction(
        handle -> {
          final CaptureDAO dao = handle.attach(CaptureDAO.class);
          insert(dao);
          final Savepoint keep = handle.getConnection().setSavepoint("keep");
          dao.insertMany(charts(1005));
          assertEquals(1000, count(handle, "metadata_projection_mutation"));
          handle.getConnection().rollback(keep);
          handle.getConnection().releaseSavepoint(keep);
          assertEquals(1, count(handle, "projection_test_entity"));
          assertEquals(0, count(handle, "metadata_projection_mutation"));
          insert(dao);
        });
    assertCommitted(jdbi, 2);
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void caughtSpillFailurePreservesEarlierBufferedFacts(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final AtomicBoolean fail = new AtomicBoolean(true);
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logBeforeExecution(final StatementContext context) {
            if (context.getRenderedSql().startsWith("INSERT INTO metadata_projection_consumer")
                && fail.getAndSet(false)) {
              throw new IllegalStateException("consumer insert unavailable");
            }
          }
        });
    try {
      jdbi.useTransaction(
          handle -> {
            final CaptureDAO dao = handle.attach(CaptureDAO.class);
            insert(dao);
            assertThrows(IllegalStateException.class, () -> dao.insertMany(charts(1005)));
            assertEquals(1, count(handle, "projection_test_entity"));
            assertEquals(0, count(handle, "metadata_projection_mutation"));
            insert(dao);
          });
    } finally {
      jdbi.setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertCommitted(jdbi, 2);
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void differentConnectionsOnTheSameThreadHaveIndependentBuffers(
      final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    try (Handle first = jdbi.open();
        Handle second = jdbi.open()) {
      first.begin();
      second.begin();
      insert(first.attach(CaptureDAO.class));
      insert(second.attach(CaptureDAO.class));
      first.commit();
      second.rollback();
    }
    assertCommitted(jdbi, 1);
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void jdbcImplicitCommitAlsoFlushesCapture(final RdfTestDatabase.Backend backend)
      throws Exception {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    try (Handle handle = jdbi.open()) {
      handle.begin();
      insert(handle.attach(CaptureDAO.class));
      handle.getConnection().setAutoCommit(true);
    }
    assertCommitted(jdbi, 1);
  }

  private static void assertCommitted(final Jdbi jdbi, final int entities) {
    jdbi.useHandle(
        handle -> {
          assertEquals(entities, count(handle, "projection_test_entity"));
          assertEquals(entities, count(handle, "metadata_projection_mutation"));
          assertEquals(entities * 2, count(handle, "metadata_projection_consumer"));
        });
  }

  private static long count(final Handle handle, final String table) {
    return handle.createQuery("SELECT COUNT(*) FROM " + table).mapTo(Long.class).one();
  }

  private static void insert(final CaptureDAO dao) {
    final Chart chart = chart();
    dao.insert(chart, chart.getFullyQualifiedName());
  }

  private static List<EntityInterface<?>> charts(final int size) {
    return IntStream.range(0, size).<EntityInterface<?>>mapToObj(index -> chart()).toList();
  }

  private static Chart chart() {
    final UUID id = UUID.randomUUID();
    return new Chart()
        .withId(id)
        .withName(id.toString())
        .withFullyQualifiedName("service." + id)
        .withVersion(1.0);
  }
}
