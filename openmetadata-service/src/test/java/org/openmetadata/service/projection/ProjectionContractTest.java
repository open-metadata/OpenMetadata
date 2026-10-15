/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 */

package org.openmetadata.service.projection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Clock;
import java.time.Duration;
import java.util.Set;
import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class ProjectionContractTest {
  private final ProjectionJournal journal =
      new ProjectionJournal(
          Jdbi.create("jdbc:unused"), Clock.systemUTC(), Set.of(ProjectionTarget.SEARCH));

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {" ", "\t"})
  void factsAndWorkRejectMissingIdentifiers(final String identifier) {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            new EntityMutation(
                1, identifier, UUID.randomUUID(), EntityMutation.Operation.UPSERT, null, null));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            new ProjectionWorkStore.Key(
                ProjectionTarget.SEARCH, identifier, "table", UUID.randomUUID()));
  }

  @Test
  void oversizedIdentifiersAndUnknownFactVersionsCannotEnterTheProtocol() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            new EntityMutation(
                2, "table", UUID.randomUUID(), EntityMutation.Operation.UPSERT, null, null));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            new EntityMutation(
                1,
                "x".repeat(129),
                UUID.randomUUID(),
                EntityMutation.Operation.UPSERT,
                null,
                null));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            new ProjectionWorkStore.Key(
                ProjectionTarget.RDF, "dataset", "x".repeat(129), UUID.randomUUID()));
    assertThrows(
        IllegalArgumentException.class,
        () -> new ProjectionJournal(Jdbi.create("jdbc:unused"), Clock.systemUTC(), Set.of()));
  }

  @ParameterizedTest
  @ValueSource(ints = {-1, 0, 1001})
  void invalidPageSizesFailBeforeOpeningADatabaseConnection(final int limit) {
    assertThrows(
        IllegalArgumentException.class,
        () -> journal.claim(ProjectionTarget.SEARCH, limit, Duration.ofSeconds(30)));
  }

  @Test
  void zeroAndUnboundedLeasesAndRetriesAreRejected() {
    for (final Duration invalid : new Duration[] {Duration.ZERO, Duration.ofHours(2)}) {
      assertThrows(
          IllegalArgumentException.class, () -> journal.claim(ProjectionTarget.SEARCH, 1, invalid));
      assertThrows(IllegalArgumentException.class, () -> journal.retry(null, "failure", invalid));
    }
  }

  @Test
  void unfinishedExpansionRequiresAResumePosition() {
    for (final String invalid : new String[] {null, "", " ", "x".repeat(2049)}) {
      assertThrows(
          IllegalArgumentException.class,
          () -> journal.advance(null, invalid, false, handle -> {}));
    }
  }

  @Test
  void diagnosticsHaveABoundedStorageCost() {
    assertEquals(8192, ProjectionJournal.truncateError("x".repeat(10000)).length());
  }
}
