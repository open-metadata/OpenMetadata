/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.events.lifecycle.handlers;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.tests.type.Assigned;
import org.openmetadata.schema.tests.type.Resolved;
import org.openmetadata.schema.tests.type.TestCaseFailureReasonType;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TestCaseResolutionStatusRepository;
import org.openmetadata.service.util.EntityUtil;

/**
 * Mirrors task-first incident lifecycle events into the legacy {@code
 * test_case_resolution_status_time_series} table.
 *
 * <p>In task-first mode the {@link Task} entity is the source of truth for an incident's
 * workflow stage (new → ack → assigned → resolved). But many downstream consumers — the
 * profiler data-quality page's "Incidents" badge, search aggregations, dashboards, and
 * external metrics exporters — still read from the TCRS time series. This handler keeps
 * those consumers fed by writing one TCRS record per workflow stage transition.
 *
 * <p>Key design choices:
 *
 * <ul>
 *   <li><b>{@code stateId = task.id}</b>. In task-first mode one incident equals one Task,
 *       so the Task's UUID is a stable, natural grouping key across the lifecycle. This
 *       also means {@code testCaseResult.incidentId} (already set to the Task ID) equals
 *       the TCRS {@code stateId}, making the TCRS↔Task↔TestCaseResult relationship
 *       fully traceable.
 *   <li><b>Hardcoded stage mapping</b>. The stage → TCRS status map lives in this file as
 *       a static {@code Map.of(...)} rather than being derived from the workflow
 *       definition. Keeps the dependency simple; costs a code edit if a new workflow stage
 *       is ever added.
 *   <li><b>Fires on stage transition only</b>. Assignee-only PATCHes, comment adds, watcher
 *       changes, etc. don't write TCRS records — only {@code workflowStageId} changes
 *       (plus initial task creation) count.
 *   <li><b>Idempotent</b>. If the latest TCRS record for this {@code stateId} already has
 *       the target status, the handler skips. This protects against duplicate inserts from
 *       repeated updates.
 *   <li><b>Best-effort</b>. A TCRS write failure must never roll back a task update. All
 *       work is wrapped in try/catch and errors are logged at WARN level.
 * </ul>
 *
 * <p><b>Limitation:</b> Historical TCRS records (pre-migration) have random UUIDs as their
 * {@code stateId} that don't correspond to any Task. No backfill is performed; old and new
 * records coexist in the time series without interfering.
 */
@Slf4j
public final class IncidentTcrsSyncHandler {

  private static final Map<String, TestCaseResolutionStatusTypes> STAGE_TO_TCRS_STATUS =
      Map.of(
          "new", TestCaseResolutionStatusTypes.New,
          "ack", TestCaseResolutionStatusTypes.Ack,
          "assigned", TestCaseResolutionStatusTypes.Assigned,
          "resolved", TestCaseResolutionStatusTypes.Resolved);

  private static final String TEST_CASE_TYPE = "testCase";

  private IncidentTcrsSyncHandler() {}

  /** Invoked from {@code TaskRepository.postCreate} after a task row is first persisted. */
  public static void handleTaskCreate(Task task) {
    if (!isIncidentTask(task)) {
      return;
    }
    syncStage(task);
  }

  /**
   * Invoked from {@code TaskRepository.postUpdate}. Only fires a TCRS write when the task's
   * {@code workflowStageId} actually changed between {@code original} and {@code updated}.
   */
  public static void handleTaskUpdate(Task original, Task updated) {
    if (!isIncidentTask(updated)) {
      return;
    }
    String originalStage = original != null ? original.getWorkflowStageId() : null;
    String updatedStage = updated.getWorkflowStageId();
    if (Objects.equals(originalStage, updatedStage)) {
      return;
    }
    syncStage(updated);
  }

  private static boolean isIncidentTask(Task task) {
    return task != null
        && task.getCategory() == TaskCategory.Incident
        && task.getType() == TaskEntityType.TestCaseResolution
        && task.getWorkflowInstanceId() != null
        && task.getAbout() != null
        && TEST_CASE_TYPE.equals(task.getAbout().getType());
  }

  private static void syncStage(Task task) {
    try {
      String stageId = task.getWorkflowStageId();
      TestCaseResolutionStatusTypes tcrsType = STAGE_TO_TCRS_STATUS.get(stageId);
      if (tcrsType == null) {
        LOG.debug(
            "[TCRS Sync] Task {} workflowStageId='{}' has no TCRS mapping; skipping",
            task.getId(),
            stageId);
        return;
      }

      TestCaseResolutionStatusRepository repo =
          (TestCaseResolutionStatusRepository)
              Entity.getEntityTimeSeriesRepository(Entity.TEST_CASE_RESOLUTION_STATUS);

      UUID stateId = task.getId();

      // Idempotency: skip if the latest record for this stateId already has the target status
      TestCaseResolutionStatus latest = repo.getLatestRecordForStateId(stateId);
      if (latest != null && latest.getTestCaseResolutionStatusType() == tcrsType) {
        LOG.debug(
            "[TCRS Sync] Task {} already at status {} for stateId {}; skipping",
            task.getId(),
            tcrsType,
            stateId);
        return;
      }

      TestCaseResolutionStatus record =
          new TestCaseResolutionStatus()
              .withId(UUID.randomUUID())
              .withStateId(stateId)
              .withTestCaseResolutionStatusType(tcrsType)
              .withTestCaseResolutionStatusDetails(buildDetailsForStage(tcrsType, task))
              .withTestCaseReference(task.getAbout())
              .withTimestamp(task.getUpdatedAt())
              .withUpdatedAt(task.getUpdatedAt())
              .withUpdatedBy(
                  task.getUpdatedBy() != null
                      ? EntityUtil.getEntityReference(Entity.USER, task.getUpdatedBy())
                      : null);

      String testCaseFqn = task.getAbout().getFullyQualifiedName();
      repo.syncFromTask(record, testCaseFqn);

      LOG.debug(
          "[TCRS Sync] Wrote {} record for task {} (stateId={})", tcrsType, task.getId(), stateId);
    } catch (Exception e) {
      // Never let a TCRS sync failure roll back a task update — the Task is the source of
      // truth, TCRS is a best-effort mirror for legacy consumers.
      LOG.warn(
          "[TCRS Sync] Failed to sync TCRS for task {}: {}",
          task != null ? task.getId() : "null",
          e.getMessage(),
          e);
    }
  }

  private static Object buildDetailsForStage(TestCaseResolutionStatusTypes type, Task task) {
    return switch (type) {
      case Assigned -> {
        List<EntityReference> assignees = task.getAssignees();
        if (!nullOrEmpty(assignees)) {
          yield new Assigned().withAssignee(assignees.get(0));
        }
        yield null;
      }
      case Resolved -> buildResolvedDetails(task);
      default -> null;
    };
  }

  @SuppressWarnings("unchecked")
  private static Resolved buildResolvedDetails(Task task) {
    TaskResolution resolution = task.getResolution();
    if (resolution == null) {
      return new Resolved();
    }

    Resolved resolved = new Resolved();

    if (resolution.getResolvedBy() != null) {
      resolved.withResolvedBy(resolution.getResolvedBy());
    }

    if (resolution.getComment() != null) {
      resolved.withTestCaseFailureComment(resolution.getComment());
    }

    Map<String, Object> payloadMap = extractPayloadMap(resolution.getPayload());
    if (payloadMap != null) {
      Object reason = payloadMap.get("testCaseFailureReason");
      if (reason instanceof String reasonStr) {
        resolved.withTestCaseFailureReason(parseFailureReason(reasonStr));
      }
    }

    return resolved;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> extractPayloadMap(Object payload) {
    if (payload == null) {
      return null;
    }
    if (payload instanceof Map<?, ?> map) {
      return (Map<String, Object>) map;
    }
    // Generated Payload classes store dynamic fields in additionalProperties
    return JsonUtils.convertValue(
        payload, new com.fasterxml.jackson.core.type.TypeReference<>() {});
  }

  private static TestCaseFailureReasonType parseFailureReason(String value) {
    try {
      return TestCaseFailureReasonType.fromValue(value);
    } catch (IllegalArgumentException e) {
      LOG.debug("[TCRS Sync] Unknown failure reason '{}', mapping to Other", value);
      return TestCaseFailureReasonType.Other;
    }
  }
}
