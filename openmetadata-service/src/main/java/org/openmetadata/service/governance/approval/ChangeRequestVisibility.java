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

package org.openmetadata.service.governance.approval;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.governance.workflows.util.ChangePreviewUtils.CHANGE_REQUEST_ID_KEY;
import static org.openmetadata.service.governance.workflows.util.ChangePreviewUtils.CHANGE_REQUEST_REVISION_KEY;
import static org.openmetadata.service.governance.workflows.util.ChangePreviewUtils.PROPOSED_CHANGES_KEY;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.SecurityContext;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRevision;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Read authorization for change requests. The caller must be able to view the entity; admins and
 * the entity's owners and reviewers then see every request on it, and anyone else sees the requests
 * they made and the requests whose review task they may resolve. The review task of a request
 * follows the same rule for the fields it carries from the request.
 */
@Slf4j
public final class ChangeRequestVisibility {
  private static final String TASK_FIELDS = "assignees,reviewers,about,createdBy";
  private static final List<String> REQUEST_PAYLOAD_KEYS =
      List.of(CHANGE_REQUEST_ID_KEY, CHANGE_REQUEST_REVISION_KEY, PROPOSED_CHANGES_KEY);

  private ChangeRequestVisibility() {}

  public static List<ChangeRequest> list(
      Authorizer authorizer,
      SecurityContext securityContext,
      UUID entityId,
      String requestedBy,
      int limit) {
    String caller = securityContext.getUserPrincipal().getName();
    List<ChangeRequest> visible;
    if (entityId != null) {
      visible = listForEntity(authorizer, securityContext, entityId, caller, limit);
    } else if (requestedBy != null) {
      visible = listForRequester(caller, requestedBy, limit);
    } else {
      throw new BadRequestException("Filter change requests by entityId or requestedBy");
    }
    Map<UUID, ChangeRevision> revisions = ChangeRequestService.activeRevisions(visible);
    return visible.stream()
        .map(
            request ->
                request.withActiveRevision(
                    ChangeRequestService.reportedRevision(
                        request, revisions.get(request.getActiveRevisionId()))))
        .toList();
  }

  public static void requireVisible(
      Authorizer authorizer, SecurityContext securityContext, ChangeRequest request) {
    ResourceContext<?> entity = authorizeEntityView(authorizer, securityContext, request);
    String caller = securityContext.getUserPrincipal().getName();
    if (!isVisible(authorizer, securityContext, request, () -> seesAll(caller, entity))) {
      throw new ForbiddenException(
          "You cannot view change requests made by other users on this asset");
    }
  }

  /**
   * The task as the caller may read it; see {@link #redactTasks}. The caller's view of the entity
   * the task is about is authorized by the task read itself.
   */
  public static Task redactTask(Authorizer authorizer, SecurityContext securityContext, Task task) {
    redactTasks(authorizer, securityContext, List.of(task));
    return task;
  }

  /**
   * Removes, from each task that reviews a change request the caller may not view, the request's
   * fields from the payload and the payload from the change history. The task itself stays. A page
   * of tasks reads its requests in one query and their review tasks in one batch.
   */
  public static void redactTasks(
      Authorizer authorizer, SecurityContext securityContext, List<Task> tasks) {
    String caller = securityContext.getUserPrincipal().getName();
    List<Task> reviews =
        listOrEmpty(tasks).stream().filter(ChangeRequestTasks::reviewsChangeRequest).toList();
    if (!reviews.isEmpty() && !SubjectContext.getSubjectContext(caller).isAdmin()) {
      Map<UUID, UUID> requestIdByTask = requestIdsOf(reviews);
      Set<UUID> visible =
          visibleRequestIds(
              authorizer, securityContext, requestsById(requestIdByTask.values()).values());
      reviews.stream()
          .filter(task -> !visible.contains(requestIdByTask.get(task.getId())))
          .forEach(ChangeRequestVisibility::redact);
    }
  }

  // Only the requests the caller neither made nor sees as owner or reviewer need their review
  // task loaded, and those tasks are loaded together.
  private static Set<UUID> visibleRequestIds(
      Authorizer authorizer, SecurityContext securityContext, Collection<ChangeRequest> requests) {
    String caller = securityContext.getUserPrincipal().getName();
    Map<UUID, Boolean> seesAllByEntity = new HashMap<>();
    Map<Boolean, List<ChangeRequest>> byDirectView =
        requests.stream()
            .collect(
                Collectors.partitioningBy(
                    request ->
                        caller.equals(request.getRequestedBy())
                            || seesAllByEntity.computeIfAbsent(
                                request.getEntityId(),
                                id -> seesAll(caller, entityContext(request)))));
    Set<UUID> reviewable = reviewableTasks(authorizer, securityContext, byDirectView.get(false));
    Set<UUID> visible = new HashSet<>();
    byDirectView.get(true).forEach(request -> visible.add(request.getId()));
    byDirectView.get(false).stream()
        .filter(request -> reviewable.contains(request.getTaskId()))
        .forEach(request -> visible.add(request.getId()));
    return visible;
  }

  private static boolean isVisible(
      Authorizer authorizer,
      SecurityContext securityContext,
      ChangeRequest request,
      BooleanSupplier callerSeesAll) {
    String caller = securityContext.getUserPrincipal().getName();
    return caller.equals(request.getRequestedBy())
        || callerSeesAll.getAsBoolean()
        || reviewableTasks(authorizer, securityContext, List.of(request))
            .contains(request.getTaskId());
  }

  private static Map<UUID, UUID> requestIdsOf(List<Task> reviews) {
    Map<UUID, UUID> requestIdByTask = new HashMap<>();
    for (Task task : reviews) {
      Object requestId = JsonUtils.getMap(task.getPayload()).get(CHANGE_REQUEST_ID_KEY);
      try {
        requestIdByTask.put(task.getId(), UUID.fromString(String.valueOf(requestId)));
      } catch (IllegalArgumentException malformed) {
        LOG.warn("[ChangeRequest] Task {} names no valid change request", task.getId());
      }
    }
    return requestIdByTask;
  }

  private static Map<UUID, ChangeRequest> requestsById(Collection<UUID> ids) {
    Map<UUID, ChangeRequest> requests = new HashMap<>();
    if (!ids.isEmpty()) {
      List<String> distinct = ids.stream().distinct().map(UUID::toString).toList();
      ChangeRequestService.dao()
          .changeRequestDAO()
          .findByIds(distinct)
          .forEach(request -> requests.put(request.getId(), request));
    }
    return requests;
  }

  private static void redact(Task task) {
    // The task payload is free-form JSON shared by every task type, so it is edited as a map.
    Map<String, Object> payload = JsonUtils.getMap(task.getPayload());
    REQUEST_PAYLOAD_KEYS.forEach(payload::remove);
    task.setPayload(payload);
    if (task.getChangeDescription() != null) {
      task.setChangeDescription(withoutPayloadChanges(task.getChangeDescription()));
    }
  }

  private static ChangeDescription withoutPayloadChanges(ChangeDescription change) {
    ChangeDescription copy = JsonUtils.deepCopy(change, ChangeDescription.class);
    copy.setFieldsAdded(withoutPayload(copy.getFieldsAdded()));
    copy.setFieldsUpdated(withoutPayload(copy.getFieldsUpdated()));
    copy.setFieldsDeleted(withoutPayload(copy.getFieldsDeleted()));
    return copy;
  }

  private static List<FieldChange> withoutPayload(List<FieldChange> changes) {
    return listOrEmpty(changes).stream()
        .filter(change -> !TaskRepository.FIELD_PAYLOAD.equals(change.getName()))
        .toList();
  }

  private static List<ChangeRequest> listForEntity(
      Authorizer authorizer,
      SecurityContext securityContext,
      UUID entityId,
      String caller,
      int limit) {
    List<ChangeRequest> all =
        ChangeRequestService.dao().changeRequestDAO().listByEntity(entityId, limit);
    List<ChangeRequest> visible = all;
    if (!all.isEmpty()) {
      ResourceContext<?> entity = authorizeEntityView(authorizer, securityContext, all.get(0));
      if (!seesAll(caller, entity)) {
        Set<UUID> reviewable = reviewableTasks(authorizer, securityContext, all);
        visible =
            all.stream()
                .filter(
                    r -> caller.equals(r.getRequestedBy()) || reviewable.contains(r.getTaskId()))
                .toList();
      }
    }
    return visible;
  }

  private static List<ChangeRequest> listForRequester(
      String caller, String requestedBy, int limit) {
    if (!caller.equals(requestedBy) && !SubjectContext.getSubjectContext(caller).isAdmin()) {
      throw new ForbiddenException("You can only list your own change requests");
    }
    return ChangeRequestService.dao().changeRequestDAO().listByRequester(requestedBy, limit);
  }

  private static ResourceContext<?> entityContext(ChangeRequest request) {
    return new ResourceContext<>(request.getEntityType(), request.getEntityId(), null);
  }

  private static ResourceContext<?> authorizeEntityView(
      Authorizer authorizer, SecurityContext securityContext, ChangeRequest request) {
    ResourceContext<?> entity = entityContext(request);
    authorizer.authorize(
        securityContext,
        new OperationContext(request.getEntityType(), MetadataOperation.VIEW_BASIC),
        entity);
    return entity;
  }

  // A review workflow can assign its task to users who neither own nor review the entity; whoever
  // the task-resolve rule lets act on a request's task reads that request. The tasks of other
  // users' requests are read in one batch.
  private static Set<UUID> reviewableTasks(
      Authorizer authorizer, SecurityContext securityContext, List<ChangeRequest> requests) {
    String caller = securityContext.getUserPrincipal().getName();
    List<EntityReference> tasks =
        requests.stream()
            .filter(r -> r.getTaskId() != null && !caller.equals(r.getRequestedBy()))
            .map(r -> new EntityReference().withId(r.getTaskId()).withType(Entity.TASK))
            .toList();
    Set<UUID> reviewable = new HashSet<>();
    if (!tasks.isEmpty()) {
      TaskRepository repository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
      List<Task> loaded = Entity.getEntities(tasks, TASK_FIELDS, Include.ALL);
      for (Task task : loaded) {
        if (mayResolve(repository, authorizer, securityContext, task)) {
          reviewable.add(task.getId());
        }
      }
    }
    return reviewable;
  }

  private static boolean mayResolve(
      TaskRepository repository,
      Authorizer authorizer,
      SecurityContext securityContext,
      Task task) {
    boolean allowed = true;
    try {
      repository.checkPermissionsForResolveTask(authorizer, task, false, securityContext);
    } catch (AuthorizationException denied) {
      allowed = false;
    }
    return allowed;
  }

  private static boolean seesAll(String caller, ResourceContext<?> entity) {
    SubjectContext subject = SubjectContext.getSubjectContext(caller);
    return subject.isAdmin()
        || subject.isOwner(entity.getOwners())
        || subject.isReviewer(entity.getEntity().getReviewers());
  }
}
