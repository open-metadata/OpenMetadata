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
package org.openmetadata.service.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import org.jdbi.v3.core.ConnectionException;
import org.junit.jupiter.api.Test;

class RepairByEntityTypeTest {
  private final RepairByEntityType byType = new RepairByEntityType("Test repair");
  private final List<String> repaired = new ArrayList<>();

  @Test
  void aFailingTypeIsThrownAfterTheOthersRan() {
    final IllegalStateException outage = new IllegalStateException("search is down");

    final Exception failure =
        assertThrows(
            Exception.class,
            () ->
                byType.run(List.of("table", "topic"), type -> repairOrFail(type, "table", outage)));

    assertSame(outage, failure);
    assertEquals(List.of("topic"), repaired);
  }

  @Test
  void aTypeWithoutUpdatedAtIsSetAsideForLaterPasses() throws Exception {
    final ConnectionException noColumn =
        new ConnectionException(new SQLException("Unknown column 'updatedAt'", "42S22"));

    assertEquals(
        1,
        byType.run(
            List.of("eventsubscription", "topic"),
            type -> repairOrFail(type, "eventsubscription", noColumn)));
    assertEquals(
        1,
        byType.run(
            List.of("eventsubscription", "topic"),
            type -> repairOrFail(type, "eventsubscription", noColumn)));

    assertEquals(List.of("topic", "topic"), repaired);
  }

  @Test
  void onlyAnUndefinedColumnMeansTheTableHasNoChangeTime() {
    assertTrue(RepairByEntityType.lacksChangeTime(new SQLException("no column", "42703")));
    assertTrue(RepairByEntityType.lacksChangeTime(new SQLException("no column", "42S22")));
    assertFalse(RepairByEntityType.lacksChangeTime(new SQLException("refused")));
    assertFalse(RepairByEntityType.lacksChangeTime(new SQLException("deadlock", "40001")));
  }

  private int repairOrFail(final String type, final String failingType, final Exception failure)
      throws Exception {
    if (type.equals(failingType)) {
      throw failure;
    }
    repaired.add(type);
    return 1;
  }
}
