package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.migrate;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.withDatabase;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class OntologyWorkingStateTest {
  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void creatingDifferentOntologiesDoesNotLockTheSameMissingKeyRange(ConnectionType dialect) {
    withDatabase(
        dialect,
        handle -> {
          migrate(handle, dialect);
          final var ready = new CountDownLatch(2);
          assertDoesNotThrow(
              () -> {
                try (var writers = Executors.newFixedThreadPool(2)) {
                  final List<Future<?>> results = new ArrayList<>();
                  for (int index = 0; index < 2; index++) {
                    results.add(
                        writers.submit(
                            () -> {
                              try (var connection = handle.getJdbi().open()) {
                                final var dao = connection.attach(CollectionDAO.class);
                                final var ontology = definition();
                                dao.inTransaction(
                                    transaction ->
                                        new OntologyWorkingState(transaction)
                                            .mutate(
                                                transaction.ontologyEntityDAO(),
                                                List.of(ontology),
                                                () -> {
                                                  ready.countDown();
                                                  assertDoesNotThrow(
                                                      () ->
                                                          assertTrue(
                                                              ready.await(10, TimeUnit.SECONDS)));
                                                  transaction
                                                      .ontologyEntityDAO()
                                                      .insert(
                                                          ontology,
                                                          ontology.getFullyQualifiedName());
                                                  return null;
                                                }));
                              }
                            }));
                  }
                  for (final var result : results) {
                    result.get(30, TimeUnit.SECONDS);
                  }
                }
              });
          assertEquals(
              2,
              handle
                  .createQuery("SELECT COUNT(*) FROM ontology_entity")
                  .mapTo(Integer.class)
                  .one());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void concurrentWritersInitializeAndLockWithoutDeadlocking(ConnectionType dialect) {
    withDatabase(
        dialect,
        handle -> {
          migrate(handle, dialect);
          UUID ontologyId = UUID.randomUUID();
          handle.attach(OntologyStateDAO.class).initialize(ontologyId);
          assertDoesNotThrow(
              () -> {
                try (var workers = Executors.newFixedThreadPool(8)) {
                  CountDownLatch ready = new CountDownLatch(8);
                  CountDownLatch start = new CountDownLatch(1);
                  List<Future<?>> writes = new ArrayList<>();
                  for (int writer = 0; writer < 8; writer++) {
                    writes.add(
                        workers.submit(
                            () -> {
                              try (var connection = handle.getJdbi().open()) {
                                OntologyStateDAO state = connection.attach(OntologyStateDAO.class);
                                ready.countDown();
                                assertTrue(start.await(10, TimeUnit.SECONDS));
                                for (int edit = 0; edit < 20; edit++) {
                                  connection.useTransaction(
                                      transaction -> {
                                        state.initialize(ontologyId);
                                        state.lock(ontologyId);
                                        state.advanceWorkingRevision(ontologyId);
                                      });
                                }
                              }
                              return null;
                            }));
                  }
                  assertTrue(ready.await(10, TimeUnit.SECONDS));
                  start.countDown();
                  for (Future<?> write : writes) {
                    write.get(30, TimeUnit.SECONDS);
                  }
                }
              });
          assertEquals(
              160L, handle.attach(OntologyStateDAO.class).get(ontologyId).getWorkingRevision());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void staleBulkSnapshotsCannotOverwriteNewerWorkingContent(ConnectionType dialect) {
    withDatabase(
        dialect,
        handle -> {
          migrate(handle, dialect);
          CollectionDAO dao = handle.attach(CollectionDAO.class);
          for (double version : List.of(0.1, 0.2)) {
            Ontology original = definition();
            Ontology current =
                JsonUtils.deepCopy(original, Ontology.class)
                    .withDescription("A newer working edit")
                    .withVersion(version)
                    .withUpdatedAt(2L);
            dao.ontologyEntityDAO().insert(current, current.getFullyQualifiedName());
            dao.ontologyStateDAO().initialize(current.getId());
            dao.ontologyStateDAO().advanceWorkingRevision(current.getId());
            OntologyWorkingState state = new OntologyWorkingState(dao);
            assertThrows(
                PreconditionFailedException.class,
                () ->
                    dao.inTransaction(
                        ignored ->
                            state.mutate(
                                dao.ontologyEntityDAO(),
                                List.of(original),
                                () -> {
                                  dao.ontologyEntityDAO().update(original.withDeleted(true));
                                  return null;
                                })));
            assertEquals(current, dao.ontologyEntityDAO().findEntityById(current.getId()));
            assertEquals(1L, dao.ontologyStateDAO().get(current.getId()).getWorkingRevision());
          }
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void aFinalizerThatKeepsWritingFailsTheMutationInsteadOfLooping(ConnectionType dialect) {
    withDatabase(
        dialect,
        handle -> {
          migrate(handle, dialect);
          CollectionDAO dao = handle.attach(CollectionDAO.class);
          Ontology ontology = definition();
          OntologyWorkingState state = new OntologyWorkingState(dao);
          List<Integer> passes = new ArrayList<>();
          IllegalStateException error =
              assertThrows(
                  IllegalStateException.class,
                  () ->
                      dao.inTransaction(
                          ignored ->
                              state.mutate(
                                  dao.ontologyEntityDAO(),
                                  List.of(ontology),
                                  () -> {
                                    dao.ontologyEntityDAO()
                                        .insert(ontology, ontology.getFullyQualifiedName());
                                    state.beforeValidation(
                                        "restless",
                                        (ontologyId, changes) -> {
                                          passes.add(changes.size());
                                          Ontology stored =
                                              dao.ontologyEntityDAO()
                                                  .findEntityById(ontology.getId());
                                          state.mutate(
                                              dao.ontologyEntityDAO(),
                                              List.of(stored),
                                              () -> {
                                                dao.ontologyEntityDAO()
                                                    .update(
                                                        stored.withDescription(
                                                            "pass " + passes.size()));
                                                return null;
                                              });
                                        });
                                    return null;
                                  })));
          assertEquals("Ontology writes did not settle within 8 passes", error.getMessage());
          assertEquals(List.of(1, 1, 1, 1, 1, 1, 1, 1), passes);
          assertEquals(
              0,
              handle
                  .createQuery("SELECT COUNT(*) FROM ontology_entity WHERE id = :id")
                  .bind("id", ontology.getId().toString())
                  .mapTo(Integer.class)
                  .one());
        });
  }

  private static Ontology definition() {
    String name = "Concurrent" + UUID.randomUUID();
    return new Ontology()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withIri(URI.create("urn:ontology:" + name))
        .withNamespace(URI.create("urn:concept:"))
        .withVersion(0.1)
        .withUpdatedAt(1L)
        .withUpdatedBy("admin");
  }
}
