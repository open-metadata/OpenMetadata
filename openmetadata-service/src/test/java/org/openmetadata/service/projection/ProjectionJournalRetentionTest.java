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

import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Clock;
import java.time.Duration;
import java.util.List;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;

class ProjectionJournalRetentionTest {
  private final ProjectionJournalRetention retention =
      new ProjectionJournalRetention(
          Jdbi.create(
              () -> {
                throw new AssertionError("Invalid retention must not connect to SQL");
              }),
          Clock.systemUTC());

  @Test
  void requiresAPositiveAge() {
    assertThrows(IllegalArgumentException.class, () -> retention.purgePage(null, 0, 100));
    assertThrows(IllegalArgumentException.class, () -> retention.purgePage(Duration.ZERO, 0, 100));
    assertThrows(
        IllegalArgumentException.class, () -> retention.purgePage(Duration.ofSeconds(-1), 0, 100));
  }

  @Test
  void rejectsInvalidCursorsAndBudgets() {
    assertThrows(
        IllegalArgumentException.class, () -> retention.purgePage(Duration.ofDays(1), -1, 100));
    for (final int budget : List.of(-1, 0, 1, 2, 3, 1001, Integer.MAX_VALUE)) {
      assertThrows(
          IllegalArgumentException.class, () -> retention.purgePage(Duration.ofDays(1), 0, budget));
    }
  }
}
