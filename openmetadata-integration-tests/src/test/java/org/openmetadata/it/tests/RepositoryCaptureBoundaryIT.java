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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.transaction.TransactionException;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.tests.EntityCaptureFixture.CaptureCollection;
import org.openmetadata.it.util.TransactionCounter;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ChartRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.PostCommitActionQueue;

/** Runs actual repository boundaries against capture-enabled roots that differ from the global root. */
@Isolated("Temporarily changes Entity's DAO root to verify retained repository ownership")
class RepositoryCaptureBoundaryIT {
  static Stream<Arguments> boundaries() {
    return RdfTestDatabase.backends()
        .flatMap(backend -> Stream.of(Arguments.of(backend, true), Arguments.of(backend, false)));
  }

  @ParameterizedTest
  @MethodSource("boundaries")
  void nestedBoundariesCommitCaptureOnTheRepositoryRoot(
      final RdfTestDatabase.Backend backend, final boolean flush) {
    final CollectionDAO previous = Entity.getCollectionDAO();
    try (var owner = new EntityCaptureFixture(backend);
        var unrelated = new EntityCaptureFixture(backend)) {
      final OwnedChartRepository repository = repository(owner.jdbi());
      Entity.setCollectionDAO(unrelated.jdbi().onDemand(CaptureCollection.class));
      final List<UUID> published = new ArrayList<>();
      try (var transactions = new TransactionCounter(owner.jdbi())) {
        repository.run(
            flush,
            () -> {
              insert(repository);
              repository.run(
                  !flush,
                  () -> {
                    final UUID id = insert(repository);
                    PostCommitActionQueue.runOrDefer(() -> published.add(id));
                  });
              assertTrue(published.isEmpty());
              assertEquals(0, count(owner.jdbi(), "metadata_projection_mutation"));
            });
        assertEquals(1, transactions.commits());
        assertEquals(0, transactions.rollbacks());
      }
      assertEquals(1, published.size());
      assertEquals(2, count(owner.jdbi(), "projection_test_entity"));
      assertEquals(2, count(owner.jdbi(), "metadata_projection_mutation"));
      assertEquals(4, count(owner.jdbi(), "metadata_projection_consumer"));
      assertEquals(0, count(unrelated.jdbi(), "projection_test_entity"));
    } finally {
      Entity.setCollectionDAO(previous);
    }
  }

  @ParameterizedTest
  @MethodSource("boundaries")
  void failedNestedBoundaryDiscardsBufferedFactsAndPublication(
      final RdfTestDatabase.Backend backend, final boolean flush) {
    final CollectionDAO previous = Entity.getCollectionDAO();
    try (var fixture = new EntityCaptureFixture(backend)) {
      final OwnedChartRepository repository = repository(fixture.jdbi());
      final List<UUID> published = new ArrayList<>();
      assertThrows(
          IllegalStateException.class,
          () ->
              repository.run(
                  flush,
                  () -> {
                    final UUID id = insert(repository);
                    repository.run(
                        !flush,
                        () -> {
                          insert(repository);
                          PostCommitActionQueue.runOrDefer(() -> published.add(id));
                        });
                    throw new IllegalStateException("outer mutation failed");
                  }));
      assertTrue(published.isEmpty());
      assertEquals(0, count(fixture.jdbi(), "projection_test_entity"));
      assertEquals(0, count(fixture.jdbi(), "metadata_projection_mutation"));
      repository.run(flush, () -> insert(repository));
      assertEquals(1, count(fixture.jdbi(), "metadata_projection_mutation"));
    } finally {
      Entity.setCollectionDAO(previous);
    }
  }

  @ParameterizedTest
  @MethodSource("boundaries")
  void preCommitDeadlockReplaysEveryCapturedFamilyThroughTheRepository(
      final RdfTestDatabase.Backend backend, final boolean flush) {
    final CollectionDAO previous = Entity.getCollectionDAO();
    try (var fixture = new EntityCaptureFixture(backend)) {
      fixture.captureMembership(backend);
      final OwnedChartRepository repository = repository(fixture.jdbi());
      final AtomicInteger consumerWrites = new AtomicInteger();
      fixture
          .jdbi()
          .setSqlLogger(
              new SqlLogger() {
                @Override
                public void logBeforeExecution(final StatementContext context) {
                  if (context
                          .getRenderedSql()
                          .startsWith("INSERT INTO metadata_projection_consumer")
                      && consumerWrites.incrementAndGet() == 1) {
                    throw new TransactionException(
                        "pre-commit deadlock", new SQLException("deadlock", "40001", 1213));
                  }
                }
              });
      final List<UUID> attempts = new ArrayList<>();
      final List<UUID> published = new ArrayList<>();
      repository.run(
          flush,
          () -> {
            final UUID id = insert(repository);
            attempts.add(id);
            repository.run(
                !flush,
                () -> {
                  insertMembership(repository, id);
                  repository.getDaoCollection().chartDAO().updateFqn("service", "renamed");
                });
            PostCommitActionQueue.runOrDefer(() -> published.add(id));
          });
      assertEquals(2, attempts.size());
      assertEquals(2, consumerWrites.get());
      assertEquals(List.of(attempts.getLast()), published);
      assertEquals(
          List.of(attempts.getLast().toString()),
          fixture
              .jdbi()
              .withHandle(
                  handle ->
                      handle
                          .createQuery(
                              "SELECT entityId FROM metadata_projection_mutation WHERE mutationType = 'ENTITY'")
                          .mapTo(String.class)
                          .list()));
      assertEquals(1, count(fixture.jdbi(), "projection_test_entity"));
      assertEquals(5, count(fixture.jdbi(), "metadata_projection_mutation"));
      assertEquals(10, count(fixture.jdbi(), "metadata_projection_consumer"));
      assertEquals(
          List.of("renamed"),
          fixture
              .jdbi()
              .withHandle(
                  handle ->
                      handle
                          .createQuery(
                              "SELECT afterFqn FROM metadata_projection_mutation "
                                  + "WHERE mutationType = 'ENTITY_PREFIX' AND beforeFqn = 'service'")
                          .mapTo(String.class)
                          .list()));
      assertEquals(
          FullyQualifiedName.buildHash("renamed." + attempts.getLast()),
          fixture
              .jdbi()
              .withHandle(
                  handle ->
                      handle
                          .createQuery("SELECT fqnHash FROM projection_test_entity")
                          .mapTo(String.class)
                          .one()));
      assertMembership(fixture.jdbi(), attempts.getLast());
    } finally {
      Entity.setCollectionDAO(previous);
    }
  }

  private static OwnedChartRepository repository(final Jdbi jdbi) {
    Entity.setCollectionDAO(jdbi.onDemand(CaptureCollection.class));
    return new OwnedChartRepository();
  }

  private static void insertMembership(final OwnedChartRepository repository, final UUID id) {
    final CollectionDAO root = repository.getDaoCollection();
    final String target = "service." + id;
    root.relationshipDAO()
        .insert(
            UUID.randomUUID(),
            id,
            Entity.DOMAIN,
            Entity.CHART,
            Relationship.HAS.ordinal(),
            "",
            null);
    root.tagUsageDAO().applyTag(1, "Glossary.Term", "Glossary.Term", target, 0, 1, null, "admin");
    root.fieldRelationshipDAO()
        .insert(
            "thread",
            target,
            "thread",
            target,
            Entity.THREAD,
            Entity.CHART,
            Relationship.IS_ABOUT.ordinal(),
            null);
  }

  private static void assertMembership(final Jdbi jdbi, final UUID id) {
    for (final String table :
        List.of(
            "entity_relationship",
            "tag_usage",
            "field_relationship",
            "metadata_projection_tag_usage",
            "metadata_projection_field_relationship")) {
      assertEquals(1, count(jdbi, table), table);
    }
    jdbi.useHandle(
        handle -> {
          assertEquals(
              List.of(id.toString()),
              handle
                  .createQuery("SELECT toId FROM metadata_projection_relationship")
                  .mapTo(String.class)
                  .list());
          final String hash = FullyQualifiedName.buildHash("service." + id);
          assertEquals(
              hash,
              handle
                  .createQuery("SELECT targetFQNHash FROM metadata_projection_tag_usage")
                  .mapTo(String.class)
                  .one());
          assertEquals(
              hash,
              handle
                  .createQuery("SELECT toFQNHash FROM metadata_projection_field_relationship")
                  .mapTo(String.class)
                  .one());
        });
  }

  private static UUID insert(final OwnedChartRepository repository) {
    final UUID id = UUID.randomUUID();
    final Chart chart =
        new Chart()
            .withId(id)
            .withName(id.toString())
            .withFullyQualifiedName("service." + id)
            .withVersion(1.0);
    repository.getDaoCollection().chartDAO().insert(chart, chart.getFullyQualifiedName());
    return id;
  }

  private static long count(final Jdbi jdbi, final String table) {
    return jdbi.withHandle(
        handle -> handle.createQuery("SELECT COUNT(*) FROM " + table).mapTo(Long.class).one());
  }

  private static final class OwnedChartRepository extends ChartRepository {
    private OwnedChartRepository() {
      super(false);
    }

    private void run(final boolean flush, final Runnable work) {
      if (flush) {
        flushInOneTransaction(work);
      } else {
        executeInTransaction(
            () -> {
              work.run();
              return null;
            });
      }
    }
  }
}
