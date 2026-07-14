/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 *  or implied. See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;

/**
 * JDBI {@code @SqlQuery} annotations require compile-time constant strings, so both
 * {@link CollectionDAO.TaskDAO#getTaskCountSummary} and {@link ListFilter} reference the SQL
 * fragments in {@link TaskBucketSql} instead of computing them at runtime from
 * {@link TaskEntityStatus}/{@link TaskEntityType} enum values. This test regenerates each
 * fragment from the enums and asserts it equals the compile-time constant — an enum rename
 * fails here before the two SQL sites can drift apart.
 */
class TaskBucketSqlDriftTest {

  private static final Set<TaskEntityStatus> SHARED_OPEN =
      EnumSet.of(
          TaskEntityStatus.Open,
          TaskEntityStatus.InProgress,
          TaskEntityStatus.Pending,
          TaskEntityStatus.Granted,
          TaskEntityStatus.ManualRevoke);

  private static final Set<TaskEntityStatus> SHARED_TERMINAL =
      EnumSet.of(
          TaskEntityStatus.Rejected,
          TaskEntityStatus.Completed,
          TaskEntityStatus.Cancelled,
          TaskEntityStatus.Failed,
          TaskEntityStatus.Revoked,
          TaskEntityStatus.Expired);

  private static final Set<TaskEntityStatus> ACTIVE =
      EnumSet.of(
          TaskEntityStatus.Open,
          TaskEntityStatus.InProgress,
          TaskEntityStatus.Pending,
          TaskEntityStatus.Approved,
          TaskEntityStatus.Granted,
          TaskEntityStatus.ManualRevoke);

  @Test
  void sharedOpenStatusesMatchEnumValues() {
    assertEquals(csv(SHARED_OPEN), TaskBucketSql.SHARED_OPEN_STATUSES);
  }

  @Test
  void sharedTerminalStatusesMatchEnumValues() {
    assertEquals(csv(SHARED_TERMINAL), TaskBucketSql.SHARED_TERMINAL_STATUSES);
  }

  @Test
  void activeStatusesMatchEnumValues() {
    assertEquals(csv(ACTIVE), TaskBucketSql.ACTIVE_STATUSES);
  }

  @Test
  void openAndClosedBucketsAreExhaustiveOverAllStatuses() {
    // Every TaskEntityStatus value must land in the open or closed bucket for at least one
    // (type, status) combination — otherwise a row in that status would be dropped from the
    // openCount + completedCount reconciliation.
    Set<TaskEntityStatus> covered = EnumSet.copyOf(SHARED_OPEN);
    covered.addAll(SHARED_TERMINAL);
    covered.add(TaskEntityStatus.Approved);
    Set<TaskEntityStatus> uncovered = EnumSet.allOf(TaskEntityStatus.class);
    uncovered.removeAll(covered);
    assertEquals(
        EnumSet.noneOf(TaskEntityStatus.class),
        uncovered,
        "Every TaskEntityStatus must be assigned to open, closed, or the type-conditional Approved"
            + " bucket. Uncovered statuses would break openCount + completedCount = total.");
  }

  @Test
  void taskTypeDarLiteralMatchesEnumValue() {
    assertEquals(TaskEntityType.DataAccessRequest.value(), TaskBucketSql.TASK_TYPE_DAR);
  }

  @Test
  void statusApprovedLiteralMatchesEnumValue() {
    assertEquals(TaskEntityStatus.Approved.value(), TaskBucketSql.STATUS_APPROVED);
  }

  @Test
  void statusInProgressLiteralMatchesEnumValue() {
    assertEquals(TaskEntityStatus.InProgress.value(), TaskBucketSql.STATUS_IN_PROGRESS);
  }

  @Test
  void statusGrantedLiteralMatchesEnumValue() {
    assertEquals(TaskEntityStatus.Granted.value(), TaskBucketSql.STATUS_GRANTED);
  }

  private static String csv(Set<TaskEntityStatus> statuses) {
    List<TaskEntityStatus> ordered =
        statuses.stream().sorted(java.util.Comparator.comparingInt(Enum::ordinal)).toList();
    return ordered.stream()
        .map(status -> "'" + status.value() + "'")
        .collect(Collectors.joining(", "));
  }
}
