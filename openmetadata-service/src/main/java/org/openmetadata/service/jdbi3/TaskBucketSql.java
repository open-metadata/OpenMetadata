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

/**
 * Compile-time SQL fragments for the task-status bucket predicates used by
 * {@link ListFilter#buildTaskStatusGroupCondition} and
 * {@link CollectionDAO.TaskDAO#getTaskCountSummary}. JDBI {@code @SqlQuery} annotations require
 * compile-time constant strings, so both sites cannot reference the {@code TaskEntityStatus} /
 * {@code TaskEntityType} enum values directly at build time. {@code TaskBucketSqlDriftTest}
 * asserts the constants below stay in sync with the schema-generated enums — an enum rename
 * fails the test before the two SQL sites can drift apart.
 *
 * <p>Bucket definitions ({@code type} is the task-type column):
 *
 * <ul>
 *   <li>{@code open}   = {@code status IN SHARED_OPEN_STATUSES}
 *       OR {@code (type = DataAccessRequest AND status = Approved)}
 *   <li>{@code closed} = {@code status IN SHARED_TERMINAL_STATUSES}
 *       OR {@code (type <> DataAccessRequest AND status = Approved)}
 *       OR {@code (type = DataAccessRequest AND status = Granted)}
 *   <li>{@code active} = {@code status IN ACTIVE_STATUSES} (superset of {@code open}; kept for
 *       DAR-scoped callers that pre-narrow the query — includes Granted and ManualRevoke so the
 *       {@code useDataAccessRequest} live-access lookup still finds granted DAR tasks)
 * </ul>
 *
 * <p>Bucket predicates are row-aware on {@code type} for the two ambiguous statuses:
 *
 * <ul>
 *   <li>{@code Approved}: terminal for non-DAR task types
 *       (Glossary/DescriptionUpdate/etc. — belongs in the Closed tab) and non-terminal for
 *       DataAccessRequest (means "awaiting grant" — belongs in the Open tab).
 *   <li>{@code Granted}: DAR-only in practice — for DAR the requester's / reviewer's work is
 *       done and the task should read as closed (GitHub-issue model — revoke stays available
 *       from the closed task via {@code availableTransitions}, mirroring "reopen a closed
 *       issue"). No non-DAR workflow currently sets Granted, so the closed bucket is the only
 *       branch that routes it. If a future task type ever adopts Granted,
 *       {@code TaskBucketSqlDriftTest#openAndClosedBucketsAreExhaustiveOverAllStatuses}
 *       still passes (Granted is in the type-conditional coverage set) but the runtime
 *       {@code openCount + completedCount = total} invariant will drop those rows —
 *       intentional signal to force the author to route the new type explicitly.
 * </ul>
 */
public final class TaskBucketSql {

  public static final String SHARED_OPEN_STATUSES =
      "'Open', 'InProgress', 'Pending', 'ManualRevoke'";

  public static final String SHARED_TERMINAL_STATUSES =
      "'Rejected', 'Completed', 'Cancelled', 'Failed', 'Revoked', 'Expired'";

  public static final String ACTIVE_STATUSES =
      "'Open', 'InProgress', 'Pending', 'Approved', 'Granted', 'ManualRevoke'";

  public static final String TASK_TYPE_DAR = "DataAccessRequest";

  public static final String STATUS_APPROVED = "Approved";

  public static final String STATUS_IN_PROGRESS = "InProgress";

  public static final String STATUS_GRANTED = "Granted";

  private TaskBucketSql() {}
}
