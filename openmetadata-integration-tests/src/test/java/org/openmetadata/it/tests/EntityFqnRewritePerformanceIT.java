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
import static org.openmetadata.it.tests.EntityFqnTestData.chart;
import static org.openmetadata.it.tests.EntityFqnTestData.fixture;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.EntityDataDAOs.ChartDAO;
import org.openmetadata.service.util.FullyQualifiedName;

@EnabledIfSystemProperty(named = "projection.capture.benchmark", matches = "true")
class EntityFqnRewritePerformanceIT {
  private static final int MATCHES = 10000;
  private static final int TOTAL_ROWS = 20000;
  private static final int SEED_PAGE = 100;

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void reportLocalBulkRenameCost(final RdfTestDatabase.Backend backend) {
    final Measurement baseline = measure(backend, false);
    final Measurement captured = measure(backend, true);
    System.out.printf(
        "Projection FQN rewrite %s, %d descendants / %d source rows: baseline=%.3fms (%d statements), captured=%.3fms (%d statements)%n",
        backend,
        MATCHES,
        TOTAL_ROWS,
        baseline.nanos() / 1000000.0,
        baseline.statements(),
        captured.nanos() / 1000000.0,
        captured.statements());
    assertEquals(1, baseline.statements());
    assertEquals(
        3, captured.statements(), "Capture adds one fact and its consumers, not per-row work");
  }

  private static Measurement measure(final RdfTestDatabase.Backend backend, final boolean capture) {
    try (final var fixture = fixture(backend, capture)) {
      final Jdbi jdbi = fixture.jdbi();
      seed(jdbi);
      final var statements = new AtomicInteger();
      jdbi.setSqlLogger(
          new SqlLogger() {
            @Override
            public void logAfterExecution(final StatementContext context) {
              statements.incrementAndGet();
            }
          });
      final long started = System.nanoTime();
      try {
        jdbi.onDemand(ChartDAO.class).updateFqn("service.before", "service.after");
      } finally {
        jdbi.setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
      }
      final var result = new Measurement(System.nanoTime() - started, statements.get());
      assertCounts(jdbi, capture);
      return result;
    }
  }

  private static void seed(final Jdbi jdbi) {
    for (int offset = 0; offset < TOTAL_ROWS; offset += SEED_PAGE) {
      final int start = offset;
      jdbi.useTransaction(
          handle -> {
            final String values =
                IntStream.range(0, SEED_PAGE)
                    .mapToObj(index -> "(CAST(:json" + index + " AS JSON), :hash" + index + ")")
                    .collect(Collectors.joining(","));
            final var insert =
                handle.createUpdate("INSERT INTO chart_entity (json, fqnHash) VALUES " + values);
            for (int index = 0; index < SEED_PAGE; index++) {
              final int number = start + index;
              final String fqn =
                  (number < MATCHES ? "service.before.child" : "unrelated.child") + number;
              final var chart =
                  chart(number, fqn)
                      .withId(
                          UUID.nameUUIDFromBytes(
                              Integer.toString(number).getBytes(StandardCharsets.UTF_8)));
              insert
                  .bind("json" + index, JsonUtils.pojoToJson(chart))
                  .bind("hash" + index, FullyQualifiedName.buildHash(fqn));
            }
            insert.execute();
          });
    }
  }

  private static void assertCounts(final Jdbi jdbi, final boolean capture) {
    jdbi.useHandle(
        handle -> {
          assertEquals(
              MATCHES,
              handle
                  .createQuery("SELECT COUNT(*) FROM chart_entity WHERE fqnHash LIKE :prefix")
                  .bind("prefix", FullyQualifiedName.buildHash("service.after") + ".%")
                  .mapTo(Integer.class)
                  .one());
          assertEquals(
              capture ? 1 : 0,
              handle
                  .createQuery("SELECT COUNT(*) FROM metadata_projection_mutation")
                  .mapTo(Integer.class)
                  .one());
          assertEquals(
              capture ? 2 : 0,
              handle
                  .createQuery("SELECT COUNT(*) FROM metadata_projection_consumer")
                  .mapTo(Integer.class)
                  .one());
        });
  }

  private record Measurement(long nanos, int statements) {}
}
