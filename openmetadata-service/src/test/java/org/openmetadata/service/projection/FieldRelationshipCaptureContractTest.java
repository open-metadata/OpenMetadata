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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.util.Set;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.FieldRelationshipDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class FieldRelationshipCaptureContractTest {
  private final Jdbi jdbi = Jdbi.create("jdbc:unused");
  private final FieldRelationshipSnapshotStore snapshots =
      new FieldRelationshipSnapshotStore(
          jdbi, new ProjectionJournal(jdbi, Clock.systemUTC(), Set.of(ProjectionTarget.SEARCH)));

  @Test
  void unknownFactVersionsCannotBeClaimed() {
    assertThrows(IllegalArgumentException.class, () -> new FieldRelationshipMutation(2));
    assertEquals(MutationFacts.Kind.FIELD_RELATIONSHIPS, new FieldRelationshipMutation(1).kind());
  }

  @ParameterizedTest
  @ValueSource(ints = {-1, 0, 1001})
  void invalidPagesFailBeforeOpeningAConnection(final int limit) {
    assertThrows(IllegalArgumentException.class, () -> snapshots.page(1, 0, limit));
  }

  @Test
  void cursorsMustReferToPersistedMembership() {
    assertThrows(IllegalArgumentException.class, () -> snapshots.page(0, 0, 10));
    assertThrows(IllegalArgumentException.class, () -> snapshots.page(1, -1, 10));
  }

  @Test
  void unknownWritesCannotSilentlyLoseDependencies() {
    assertThrows(
        IllegalArgumentException.class,
        () -> FieldRelationshipMutationSql.selection("TRUNCATE TABLE field_relationship"));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            FieldRelationshipMutationSql.selection(
                "UPDATE field_relationship SET json = :json WHERE relation = 3"));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            FieldRelationshipMutationSql.upsertGuard(
                "INSERT INTO field_relationship VALUES (:value)", ConnectionType.MYSQL));
  }

  @Test
  void renameExpressionsPreserveAllOtherRetainedColumns() {
    final var selection =
        FieldRelationshipMutationSql.selection(
            "UPDATE field_relationship SET toFQN = CONCAT(:new, SUBSTRING(toFQN, CHAR_LENGTH(:old) + 1)), "
                + "toFQNHash = CONCAT(:newHash, SUBSTRING(toFQNHash, CHAR_LENGTH(:oldHash) + 1)) WHERE relation = 3;");
    assertEquals("FROM field_relationship WHERE relation = 3", selection.selection());
    assertEquals(
        "fromFQNHash, CONCAT(:newHash, SUBSTRING(toFQNHash, CHAR_LENGTH(:oldHash) + 1)), fromFQN, "
            + "CONCAT(:new, SUBSTRING(toFQN, CHAR_LENGTH(:old) + 1)), fromType, toType, relation, jsonSchema, json",
        selection.updatedColumns());
  }

  @ParameterizedTest
  @EnumSource(ConnectionType.class)
  void upsertGuardUsesDeclaredInsertValuesWithoutOverwritingMetadata(final ConnectionType dialect)
      throws NoSuchMethodException {
    final var method =
        FieldRelationshipDAO.class.getMethod(
            "upsert",
            String.class,
            String.class,
            String.class,
            String.class,
            String.class,
            String.class,
            int.class,
            String.class,
            String.class);
    for (final var annotation : method.getAnnotationsByType(ConnectionAwareSqlUpdate.class)) {
      if (annotation.connectionType() == dialect) {
        final String guard = FieldRelationshipMutationSql.upsertGuard(annotation.value(), dialect);
        assertTrue(guard.startsWith(annotation.value().split(" ON ")[0]));
        assertTrue(
            guard.endsWith(
                "UPDATE "
                    + (dialect == ConnectionType.POSTGRES ? "SET " : "")
                    + "fromFQNHash = field_relationship.fromFQNHash"));
      }
    }
  }
}
