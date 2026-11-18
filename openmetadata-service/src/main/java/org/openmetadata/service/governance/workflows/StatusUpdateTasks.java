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

package org.openmetadata.service.governance.workflows;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.workflows.LifecycleApproverGroup;
import org.openmetadata.schema.governance.workflows.LifecycleTransition;
import org.openmetadata.schema.governance.workflows.LifecycleTransitionApproval;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.util.EntityUtil;

/**
 * A status update task asks to move an asset along one of its lifecycle's on-request transitions,
 * such as In Review to Rejected or any stage to Deprecated. The task framework carries the request
 * and applies the move once it is approved; the asset's lifecycle decides which moves can be
 * requested from the stage the asset is in, and who approves them.
 * ADR:2026-11-16-a-lifecycle-request-triggers-only-lifecycle-playbooks
 */
public final class StatusUpdateTasks {
  static final String NEW_STATUS = "newStatus";
  static final String CURRENT_STATUS = "currentStatus";
  private static final int ADMIN_PAGE_SIZE = 100;
  private static final LifecycleTransitionApproval OWNERS_APPROVE =
      new LifecycleTransitionApproval().withAssignees(Set.of(LifecycleApproverGroup.OWNERS));

  private StatusUpdateTasks() {}

  /** Checks a new request against the asset's lifecycle and assigns it to the exit's approvers. */
  public static void prepare(Task task, boolean update) {
    if (!update && task.getType() == TaskEntityType.StatusUpdate) {
      EntityInterface<?> entity = approvalTarget(task);
      String stage = requestedStage(task);
      requireOffered(entity, stage);
      requireNoOpenRequest(entity);
      task.setPayload(withCurrentStatus(task.getPayload(), entity));
      task.setAssignees(approvers(entity, stage, task.getUpdatedBy()));
    }
  }

  /** The asset's open status update task, if a request is pending. */
  public static Optional<Task> pendingRequest(EntityInterface<?> entity) {
    TaskRepository tasks = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    return tasks
        .listOpenTasksByEntityAndType(
            entity.getFullyQualifiedName(), TaskEntityType.StatusUpdate, 1)
        .stream()
        .findFirst();
  }

  /** The stage a status update task asks for. */
  public static String requestedStage(Task task) {
    Object stage = JsonUtils.getMap(task.getPayload()).get(NEW_STATUS);
    if (!(stage instanceof String requested) || requested.isBlank()) {
      throw new BadRequestException("A status update task names the status it requests");
    }
    return requested;
  }

  /** The status a request names is the one decided: a resolution cannot change it. */
  public static void requireUnchangedRequest(Task task, Object resolvedPayload) {
    if (task.getType() == TaskEntityType.StatusUpdate && resolvedPayload != null) {
      Object resolved = JsonUtils.getMap(resolvedPayload).get(NEW_STATUS);
      if (resolved != null && !resolved.equals(requestedStage(task))) {
        throw new BadRequestException(
            "A status request is decided as requested; raise a new request for %s"
                .formatted(resolved));
      }
    }
  }

  /**
   * A raised request keeps its asset, the stage it asks for and the stage it was raised from until
   * it is decided: its approvers were chosen for that move.
   */
  public static void requireUneditedRequest(Task original, Task patched) {
    if (original.getType() == TaskEntityType.StatusUpdate
        && (!Objects.equals(original.getAbout(), patched.getAbout())
            || !RequestedMove.of(original).equals(RequestedMove.of(patched)))) {
      throw new BadRequestException(
          "A status request cannot be edited once raised; withdraw it and raise a new request");
    }
  }

  private record RequestedMove(Object newStatus, Object currentStatus) {
    static RequestedMove of(Task task) {
      Map<String, Object> payload = JsonUtils.getMap(task.getPayload());
      return new RequestedMove(payload.get(NEW_STATUS), payload.get(CURRENT_STATUS));
    }
  }

  /**
   * Approving requires the asset to still be in the stage the request was raised from, so the
   * request's approvers are those of the transition it asked for, and the lifecycle to still offer
   * that move.
   */
  public static void requireStillOffered(Task task) {
    if (task.getType() == TaskEntityType.StatusUpdate) {
      EntityInterface<?> entity = approvalTarget(task);
      Object raisedFrom = JsonUtils.getMap(task.getPayload()).get(CURRENT_STATUS);
      if (raisedFrom != null && !raisedFrom.equals(stageOf(entity))) {
        throw new BadRequestException(
            "%s '%s' has moved from %s to %s since this request; raise a new request"
                .formatted(
                    entityType(entity),
                    entity.getFullyQualifiedName(),
                    raisedFrom,
                    stageOf(entity)));
      }
      requireOffered(entity, requestedStage(task));
    }
  }

  // Reviewers are read only for asset types that have them; a domain has owners only.
  private static EntityInterface<?> approvalTarget(Task task) {
    EntityRepository<?> repository = Entity.getEntityRepository(task.getAbout().getType());
    String fields = repository.isSupportsReviewers() ? "owners,reviewers" : "owners";
    return Entity.getEntity(task.getAbout(), fields, Include.NON_DELETED);
  }

  private static void requireOffered(EntityInterface<?> entity, String stage) {
    EntityRepository<?> repository = Entity.getEntityRepository(entityType(entity));
    if (!repository.getRequestableStages(entity.getId()).contains(stage)) {
      String message =
          owningPlaybook(entity)
                  .filter(
                      playbook ->
                          EntityStatusWorkflows.offersOnRequest(playbook, stageOf(entity), stage))
                  .isPresent()
              ? "%s '%s' does not meet the conditions its lifecycle sets for moving to %s"
                  .formatted(entityType(entity), entity.getFullyQualifiedName(), stage)
              : "The lifecycle of %s '%s' does not offer %s on request from %s"
                  .formatted(
                      entityType(entity), entity.getFullyQualifiedName(), stage, stageOf(entity));
      throw new BadRequestException(message);
    }
  }

  private static void requireNoOpenRequest(EntityInterface<?> entity) {
    pendingRequest(entity)
        .ifPresent(
            open -> {
              throw new BadRequestException(
                  "%s '%s' already has an open status request"
                      .formatted(entityType(entity), entity.getFullyQualifiedName()));
            });
  }

  private static Object withCurrentStatus(Object payload, EntityInterface<?> entity) {
    // The task payload is free-form JSON shared by every task type, so it is edited as a map.
    Map<String, Object> updated = new LinkedHashMap<>(JsonUtils.getMap(payload));
    updated.put(CURRENT_STATUS, stageOf(entity));
    return updated;
  }

  // The transition's approvers other than the requester; with none left, the admins decide.
  private static List<EntityReference> approvers(
      EntityInterface<?> entity, String stage, String requester) {
    LifecycleTransitionApproval approval =
        onRequestTransition(entity, stage)
            .map(LifecycleTransition::getApproval)
            .orElse(OWNERS_APPROVE);
    List<EntityReference> others = selectApprovers(approval, entity, requester);
    if (others.isEmpty()) {
      others = withoutRequester(admins(), requester);
    }
    if (others.isEmpty()) {
      throw new BadRequestException(
          "No one other than the requester can approve moving %s '%s' to %s"
              .formatted(entityType(entity), entity.getFullyQualifiedName(), stage));
    }
    return EntityUtil.populateEntityReferences(others);
  }

  /** The users and teams a transition's approval names on this asset, without the requester. */
  static List<EntityReference> selectApprovers(
      LifecycleTransitionApproval approval, EntityInterface<?> entity, String requester) {
    Set<LifecycleApproverGroup> groups =
        Optional.ofNullable(approval.getAssignees()).orElse(Set.of());
    List<EntityReference> approvers = new ArrayList<>();
    if (groups.contains(LifecycleApproverGroup.OWNERS)) {
      approvers.addAll(listOrEmpty(entity.getOwners()));
    }
    if (groups.contains(LifecycleApproverGroup.REVIEWERS)) {
      approvers.addAll(listOrEmpty(entity.getReviewers()));
    }
    approvers.addAll(listOrEmpty(approval.getCandidates()));
    return withoutRequester(approvers, requester);
  }

  private static Optional<LifecycleTransition> onRequestTransition(
      EntityInterface<?> entity, String stage) {
    return owningPlaybook(entity)
        .flatMap(
            playbook ->
                EntityStatusWorkflows.onRequestTransition(playbook, stageOf(entity), stage));
  }

  // Read with every field, as the offer is (EntityRepository.getRequestableStages), so a lifecycle
  // whose trigger filter reads tags or domains resolves the same playbook for both.
  private static Optional<WorkflowDefinition> owningPlaybook(EntityInterface<?> entity) {
    EntityInterface<?> full =
        Entity.getEntity(entity.getEntityReference(), "*", Include.NON_DELETED);
    return EntityStatusWorkflows.ACTIVE
        .owningStageOf(entityType(full), full)
        .flatMap(EntityStatusWorkflows::playbookWithTransitions);
  }

  private static String stageOf(EntityInterface<?> entity) {
    // The generated status enums print their value.
    Object stage = entity.getEntityStatus();
    return stage == null ? null : stage.toString();
  }

  private static List<EntityReference> withoutRequester(
      List<EntityReference> approvers, String requester) {
    return approvers.stream()
        .filter(
            approver ->
                !(Entity.USER.equals(approver.getType())
                    && requester != null
                    && requester.equals(approver.getName())))
        .distinct()
        .toList();
  }

  private static List<EntityReference> admins() {
    UserRepository users = (UserRepository) Entity.getEntityRepository(Entity.USER);
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    filter.addQueryParam("isAdmin", "true");
    ResultList<User> page =
        users.listAfter(null, EntityUtil.Fields.EMPTY_FIELDS, filter, ADMIN_PAGE_SIZE, null);
    return page.getData().stream().map(User::getEntityReference).toList();
  }

  private static String entityType(EntityInterface<?> entity) {
    return entity.getEntityReference().getType();
  }
}
