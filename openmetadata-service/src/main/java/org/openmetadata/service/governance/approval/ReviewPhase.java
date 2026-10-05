/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.approval;

import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.util.ChangePreviewUtils;
import org.openmetadata.service.jdbi3.TaskRepository;

/**
 * Where an asset stands in the review a hold workflow runs on it. Until its first approval, edits
 * publish and keep one review task up to date; once the asset is Approved, edits are held for
 * approval and the asset keeps serving its approved values. An entity type without a status has no
 * first approval, so its edits are always held.
 */
public final class ReviewPhase {
  private static final String REVIEWED_UP_TO_KEY = "reviewedUpTo";

  private ReviewPhase() {}

  // An entity type with a status always carries one (it starts Unprocessed); one without returns
  // null.
  public static boolean holdsEdits(EntityInterface entity) {
    EntityStatus status = entity.getEntityStatus();
    return status == null || status == EntityStatus.APPROVED;
  }

  /**
   * Whether a change event on {@code entity} starts a review run of the hold workflow. An Approved
   * asset never does: its edits are held as change requests, and applying one publishes an edit that
   * was already reviewed. An asset not yet approved starts one only when the workflow has no review
   * open on it; otherwise the edit joins the open review task, so the asset keeps one task until its
   * first approval.
   */
  public static boolean startsReview(String workflowName, EntityInterface entity) {
    boolean starts = false;
    if (!holdsEdits(entity)) {
      Optional<Task> open = openReviewTask(workflowName, entity);
      open.ifPresent(task -> addEdit(task, entity));
      starts = open.isEmpty();
    }
    return starts;
  }

  private static Optional<Task> openReviewTask(String workflowName, EntityInterface entity) {
    WorkflowDefinition workflow =
        Entity.getEntityByName(Entity.WORKFLOW_DEFINITION, workflowName, "", Include.NON_DELETED);
    return tasks()
        .listNonTerminalTasksByEntityAndCategory(
            entity.getFullyQualifiedName(), TaskCategory.Approval)
        .stream()
        .filter(task -> workflow.getId().equals(task.getWorkflowDefinitionId()))
        .filter(task -> !reviewsChangeRequest(task))
        .findFirst();
  }

  /** A task that reviews a held edit names its change request in the payload. */
  public static boolean reviewsChangeRequest(Task task) {
    return task.getPayload() != null
        && JsonUtils.getMap(task.getPayload()).get(ChangePreviewUtils.CHANGE_REQUEST_ID_KEY)
            != null;
  }

  // Change events are processed after the fact and the entity is read as it is now, so two quick
  // edits can both see only the latest. Every version saved since the task last caught up is
  // folded in instead, oldest first; the workflow's own writes are not proposals.
  private static void addEdit(Task task, EntityInterface entity) {
    long since = reviewedUpTo(task);
    List<EntityInterface> edits = editsSince(entity, since);
    if (!edits.isEmpty()) {
      Object payload = task.getPayload();
      for (EntityInterface edit : edits) {
        payload = ChangePreviewUtils.buildProposedChangesPayload(edit, payload);
      }
      Map<String, Object> marked = new LinkedHashMap<>(JsonUtils.getMap(payload));
      marked.put(REVIEWED_UP_TO_KEY, edits.get(edits.size() - 1).getUpdatedAt());
      Task desired = JsonUtils.deepCopy(task, Task.class);
      desired.setPayload(marked);
      tasks().updateWorkflowStage(task, desired, entity.getUpdatedBy());
    }
  }

  private static long reviewedUpTo(Task task) {
    Object mark =
        task.getPayload() == null
            ? null
            : JsonUtils.getMap(task.getPayload()).get(REVIEWED_UP_TO_KEY);
    // The mark is stored in the task's JSON payload, which reads numbers back untyped.
    return mark instanceof Number number ? number.longValue() : task.getCreatedAt();
  }

  private static List<EntityInterface> editsSince(EntityInterface entity, long since) {
    String entityType = Entity.getEntityTypeFromObject(entity);
    return Entity.getEntityRepository(entityType)
        .listVersions(entity.getId())
        .getVersions()
        .stream()
        .map(json -> (EntityInterface) JsonUtils.readValue(json.toString(), entity.getClass()))
        .filter(version -> version.getUpdatedAt() > since)
        .filter(version -> !GOVERNANCE_BOT.equals(version.getImpersonatedBy()))
        .sorted(Comparator.comparing(EntityInterface::getUpdatedAt))
        .toList();
  }

  private static TaskRepository tasks() {
    return (TaskRepository) Entity.getEntityRepository(Entity.TASK);
  }
}
