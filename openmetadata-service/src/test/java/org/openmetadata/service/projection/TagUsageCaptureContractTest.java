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
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class TagUsageCaptureContractTest {
  private final Jdbi jdbi = Jdbi.create("jdbc:unused");
  private final TagUsageSnapshotStore snapshots =
      new TagUsageSnapshotStore(
          jdbi, new ProjectionJournal(jdbi, Clock.systemUTC(), Set.of(ProjectionTarget.SEARCH)));

  @Test
  void unknownFactVersionsCannotBeClaimed() {
    assertThrows(IllegalArgumentException.class, () -> new TagUsageMutation(2));
    assertEquals(MutationFacts.Kind.TAG_USAGE, new TagUsageMutation(1).kind());
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
        () -> TagUsageMutationSql.selection("TRUNCATE TABLE tag_usage"));
    assertThrows(
        IllegalArgumentException.class,
        () -> TagUsageMutationSql.selection("UPDATE tag_usage SET state = 0 WHERE source = 1"));
  }

  @Test
  void prefixExpressionsRetainBeforeAndAfterLocatorsWithoutSplittingFunctionArguments() {
    final var selection =
        TagUsageMutationSql.selection(
            "UPDATE tag_usage SET tagFQN = REPLACE(tagFQN, CONCAT(:oldPrefix, '.'), CONCAT(:newPrefix, '.')), "
                + "tagFQNHash = REPLACE(tagFQNHash, CONCAT(:oldHash, '.'), CONCAT(:newHash, '.')) "
                + "WHERE source = :source AND tagFQNHash LIKE :pattern");
    assertEquals(
        "FROM tag_usage WHERE source = :source AND tagFQNHash LIKE :pattern",
        selection.selection());
    assertEquals(
        "source, REPLACE(tagFQN, CONCAT(:oldPrefix, '.'), CONCAT(:newPrefix, '.')), "
            + "REPLACE(tagFQNHash, CONCAT(:oldHash, '.'), CONCAT(:newHash, '.')), targetFQNHash",
        selection.updatedColumns());
  }
}
