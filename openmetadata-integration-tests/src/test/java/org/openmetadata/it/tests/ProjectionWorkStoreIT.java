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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.util.MutableClock;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.EntityMutation;
import org.openmetadata.service.projection.ProjectionJournal;
import org.openmetadata.service.projection.ProjectionTarget;
import org.openmetadata.service.projection.ProjectionWorkStore;
import org.openmetadata.service.projection.ProjectionWorkStore.Key;

@Execution(ExecutionMode.SAME_THREAD)
class ProjectionWorkStoreIT {
  private static final Map<RdfTestDatabase.Backend, RdfTestDatabase> DATABASES =
      new EnumMap<>(RdfTestDatabase.Backend.class);
  private static final String GENERATION = "search-generation-1";
  private final MutableClock clock = new MutableClock();

  @BeforeAll
  static void startDatabases() {
    for (final RdfTestDatabase.Backend backend : RdfTestDatabase.backends().toList()) {
      final RdfTestDatabase database = new RdfTestDatabase(backend);
      database.applyProjectionMigrations();
      database.applyProjectionMigrations();
      DATABASES.put(backend, database);
    }
  }

  @AfterAll
  static void stopDatabases() {
    DATABASES.values().forEach(RdfTestDatabase::close);
    DATABASES.clear();
  }

  @BeforeEach
  void clearWork() {
    DATABASES
        .values()
        .forEach(
            database ->
                database
                    .jdbi()
                    .useHandle(
                        handle -> {
                          handle.execute("DELETE FROM metadata_projection_consumer");
                          handle.execute("DELETE FROM metadata_projection_mutation");
                          handle.execute("DELETE FROM metadata_projection_work");
                        }));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void invalidationsCoalesceWithoutAllocatingWriteRevisions(final RdfTestDatabase.Backend backend) {
    final ProjectionWorkStore store = store(backend);
    final Key key = key();
    dirty(backend, store, key);
    dirty(backend, store, key);
    final var claim = claim(store);
    assertEquals(2, claim.epoch());
    assertEquals(1, claim.revision());
    assertTrue(store.complete(claim));
    assertEquals(0, store.pending(ProjectionTarget.SEARCH, GENERATION));
    dirty(backend, store, key);
    final var next = claim(store);
    assertEquals(3, next.epoch());
    assertEquals(2, next.revision());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void invalidationDuringDeliverySurvivesAcknowledgment(final RdfTestDatabase.Backend backend) {
    final ProjectionWorkStore store = store(backend);
    final Key key = key();
    dirty(backend, store, key);
    final var old = claim(store);
    dirty(backend, store, key);
    assertTrue(store.complete(old));
    assertEquals(1, store.pending(ProjectionTarget.SEARCH, GENERATION));
    final var latest = claim(store);
    assertEquals(2, latest.epoch());
    assertEquals(2, latest.revision());
    assertTrue(store.complete(latest));
    assertEquals(0, store.pending(ProjectionTarget.SEARCH, GENERATION));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void restartAllocatesFreshRevisionAndRejectsOldWorker(final RdfTestDatabase.Backend backend) {
    final ProjectionWorkStore first = store(backend);
    dirty(backend, first, key());
    final var old = claim(first);
    assertTrue(
        first.claim(ProjectionTarget.SEARCH, GENERATION, 1, Duration.ofSeconds(30)).isEmpty());
    clock.advance(Duration.ofMinutes(1));
    final ProjectionWorkStore restarted = store(backend);
    final var current = claim(restarted);
    assertEquals(old.epoch(), current.epoch());
    assertEquals(old.revision() + 1, current.revision());
    assertFalse(first.complete(old));
    assertFalse(first.retry(old, "expired", Duration.ofSeconds(1), true));
    assertTrue(restarted.complete(current));
    assertFalse(restarted.complete(current));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void unknownOutcomeRemainsPendingAndDoesNotReuseRevision(final RdfTestDatabase.Backend backend) {
    final ProjectionWorkStore store = store(backend);
    dirty(backend, store, key());
    for (int failure = 0; failure < 12; failure++) {
      final var claim = claim(store);
      assertEquals(failure + 1, claim.revision());
      assertTrue(store.retry(claim, "response lost", Duration.ofSeconds(1), true));
      assertEquals(1, store.pending(ProjectionTarget.SEARCH, GENERATION));
      assertEquals(1, store.uncertain(ProjectionTarget.SEARCH, GENERATION));
      assertTrue(
          store.claim(ProjectionTarget.SEARCH, GENERATION, 1, Duration.ofSeconds(30)).isEmpty());
      clock.advance(Duration.ofSeconds(1));
    }
    assertTrue(store.complete(claim(store)));
    assertEquals(0, store.uncertain(ProjectionTarget.SEARCH, GENERATION));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void targetsAndGenerationsProgressIndependently(final RdfTestDatabase.Backend backend) {
    final ProjectionWorkStore store = store(backend);
    final Key search = key();
    final Key rdf =
        new Key(ProjectionTarget.RDF, "dataset-1", search.entityType(), search.entityId());
    final Key staged =
        new Key(
            ProjectionTarget.SEARCH, "search-generation-2", search.entityType(), search.entityId());
    DATABASES
        .get(backend)
        .jdbi()
        .useTransaction(handle -> store.invalidate(handle, List.of(search, rdf, staged)));
    assertTrue(store.complete(claim(store)));
    assertEquals(0, store.pending(ProjectionTarget.SEARCH, GENERATION));
    assertEquals(1, store.pending(ProjectionTarget.RDF, "dataset-1"));
    assertEquals(1, store.pending(ProjectionTarget.SEARCH, "search-generation-2"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void dependencyPageAndDirtyWorkCommitTogether(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final ProjectionJournal journal =
        new ProjectionJournal(jdbi, clock, EnumSet.allOf(ProjectionTarget.class));
    final ProjectionWorkStore store = store(backend);
    final Key key = key();
    jdbi.useTransaction(
        handle ->
            journal.capture(
                handle,
                new EntityMutation(
                    1,
                    key.entityType(),
                    key.entityId(),
                    EntityMutation.Operation.UPSERT,
                    null,
                    null)));
    final var expansion =
        journal.claim(ProjectionTarget.SEARCH, 1, Duration.ofSeconds(30)).getFirst();
    assertThrows(
        IllegalStateException.class,
        () ->
            journal.advance(
                expansion,
                "next",
                false,
                handle -> {
                  store.invalidate(handle, List.of(key));
                  throw new IllegalStateException("crash before cursor commit");
                }));
    assertEquals(0, store.pending(ProjectionTarget.SEARCH, GENERATION));
    assertTrue(
        journal.advance(
            expansion, "next", false, handle -> store.invalidate(handle, List.of(key))));
    assertEquals(1, store.pending(ProjectionTarget.SEARCH, GENERATION));
    assertEquals(
        "next",
        journal.claim(ProjectionTarget.SEARCH, 1, Duration.ofSeconds(30)).getFirst().cursor());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void newDataDoesNotWaitForOldFailureBackoff(final RdfTestDatabase.Backend backend) {
    final ProjectionWorkStore store = store(backend);
    final Key key = key();
    dirty(backend, store, key);
    final var old = claim(store);
    dirty(backend, store, key);
    assertTrue(store.retry(old, "old input failed", Duration.ofMinutes(10), false));
    assertEquals(2, claim(store).epoch());
  }

  private ProjectionWorkStore store(final RdfTestDatabase.Backend backend) {
    return new ProjectionWorkStore(
        DATABASES.get(backend).jdbi(),
        clock,
        backend == RdfTestDatabase.Backend.MYSQL ? ConnectionType.MYSQL : ConnectionType.POSTGRES);
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void distinctGenerationIdentifiersCannotShareProgress(final RdfTestDatabase.Backend backend) {
    final ProjectionWorkStore store = store(backend);
    final UUID entityId = UUID.randomUUID();
    final Key first = new Key(ProjectionTarget.RDF, "Dataset", "table", entityId);
    final Key second = new Key(ProjectionTarget.RDF, "dataset", "table", entityId);
    DATABASES
        .get(backend)
        .jdbi()
        .useTransaction(handle -> store.invalidate(handle, List.of(first, second)));
    final var claim =
        store.claim(ProjectionTarget.RDF, first.generation(), 1, Duration.ofSeconds(30)).getFirst();
    assertTrue(store.complete(claim));
    assertEquals(1, store.pending(ProjectionTarget.RDF, second.generation()));
  }

  private static void dirty(
      final RdfTestDatabase.Backend backend, final ProjectionWorkStore store, final Key key) {
    DATABASES.get(backend).jdbi().useTransaction(handle -> store.invalidate(handle, List.of(key)));
  }

  private static Key key() {
    return new Key(ProjectionTarget.SEARCH, GENERATION, "table", UUID.randomUUID());
  }

  private static ProjectionWorkStore.Claim claim(final ProjectionWorkStore store) {
    return store.claim(ProjectionTarget.SEARCH, GENERATION, 1, Duration.ofSeconds(30)).getFirst();
  }
}
