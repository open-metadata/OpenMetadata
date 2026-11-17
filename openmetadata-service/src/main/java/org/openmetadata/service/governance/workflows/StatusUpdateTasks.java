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
import java.util.Optional;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.workflows.LifecycleApproverGroup;
import org.openmetadata.schema.governance.workflows.LifecycleExit;
import org.openmetadata.schema.governance.workflows.LifecycleExitApproval;
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
 * A status update task asks to move an asset to a stage its lifecycle offers on request, such as
 * Deprecated. The task framework carries the request and applies the move once it is approved; the
 * asset's lifecycle decides which stages can be requested and who approves.
 * ADR:2026-11-16-a-lifecycle-request-triggers-only-lifecycle-playbooks
 */
public final class StatusUpdateTasks {
  static final String NEW_STATUS = "newStatus";
  static final String CURRENT_STATUS = "currentStatus";
  private static final int ADMIN_PAGE_SIZE = 100;

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

  /** Approving still requires the lifecycle to offer the stage, as it did when it was requested. */
  public static void requireStillOffered(Task task) {
    if (task.getType() == TaskEntityType.StatusUpdate) {
      requireOffered(approvalTarget(task), requestedStage(task));
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
      throw new BadRequestException(
          "The lifecycle of %s '%s' does not offer %s on request"
              .formatted(entityType(entity), entity.getFullyQualifiedName(), stage));
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
    Object current = entity.getEntityStatus();
    updated.put(CURRENT_STATUS, current == null ? null : current.toString());
    return updated;
  }

  // The exit's approvers other than the requester; with none left, the admins decide.
  private static List<EntityReference> approvers(
      EntityInterface<?> entity, String stage, String requester) {
    LifecycleExitApproval approval =
        onRequestExit(entity, stage)
            .map(LifecycleExit::getApproval)
            .orElse(
                new LifecycleExitApproval().withAssignees(Set.of(LifecycleApproverGroup.OWNERS)));
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
    List<EntityReference> others = withoutRequester(approvers, requester);
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

  private static Optional<LifecycleExit> onRequestExit(EntityInterface<?> entity, String stage) {
    return EntityStatusWorkflows.ACTIVE
        .owningStageOf(entityType(entity), entity)
        .flatMap(EntityStatusWorkflows::playbookWithExits)
        .flatMap(playbook -> EntityStatusWorkflows.onRequestExit(playbook, stage));
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
