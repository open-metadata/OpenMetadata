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
package org.openmetadata.service.projection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Clock;
import java.util.Set;
import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class RelationshipCaptureContractTest {
  private final Jdbi jdbi = Jdbi.create("jdbc:unused");
  private final RelationshipSnapshotStore snapshots =
      new RelationshipSnapshotStore(
          jdbi,
          new ProjectionJournal(jdbi, Clock.systemUTC(), Set.of(ProjectionTarget.SEARCH)),
          ConnectionType.POSTGRES);

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {" ", "\t"})
  void endpointsRequireTheEntityType(final String type) {
    assertThrows(
        IllegalArgumentException.class,
        () -> new RelationshipSnapshot.Endpoint(UUID.randomUUID(), type));
  }

  @Test
  void endpointAndSubtypeLimitsMatchTheStorageContract() {
    assertThrows(
        NullPointerException.class, () -> new RelationshipSnapshot.Endpoint(null, "table"));
    assertThrows(
        IllegalArgumentException.class,
        () -> new RelationshipSnapshot.Endpoint(UUID.randomUUID(), "x".repeat(257)));
    assertEquals(
        256, new RelationshipSnapshot.Endpoint(UUID.randomUUID(), "x".repeat(256)).type().length());
    assertThrows(IllegalArgumentException.class, () -> new RelationshipSnapshot.Relation(-1, ""));
    assertThrows(IllegalArgumentException.class, () -> new RelationshipSnapshot.Relation(1, null));
    assertThrows(
        IllegalArgumentException.class,
        () -> new RelationshipSnapshot.Relation(1, "x".repeat(257)));
    assertEquals("", new RelationshipSnapshot.Relation(1, "").type());
  }

  @Test
  void unknownFactVersionsCannotBeCaptured() {
    assertThrows(IllegalArgumentException.class, () -> new RelationshipMutation(2));
    assertEquals(MutationFacts.Kind.RELATIONSHIPS, new RelationshipMutation(1).kind());
  }

  @ParameterizedTest
  @ValueSource(ints = {-1, 0, 1001})
  void unboundedOrInvalidPagesFailBeforeOpeningAConnection(final int limit) {
    assertThrows(IllegalArgumentException.class, () -> snapshots.page(1, 0, limit));
  }

  @Test
  void pageCursorsMustReferToPersistedMembership() {
    assertThrows(IllegalArgumentException.class, () -> snapshots.page(0, 0, 10));
    assertThrows(IllegalArgumentException.class, () -> snapshots.page(1, -1, 10));
  }

  @Test
  void unknownMutationShapesCannotSilentlyBypassCapture() {
    assertThrows(
        IllegalArgumentException.class,
        () -> RelationshipMutationSql.repoint("UPDATE entity_relationship SET deleted = TRUE"));
    assertThrows(
        IllegalArgumentException.class,
        () -> RelationshipMutationSql.deletion("TRUNCATE TABLE entity_relationship"));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            RelationshipMutationSql.insertion(
                "INSERT INTO entity_relationship DEFAULT VALUES", false));
  }
}
