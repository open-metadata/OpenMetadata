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

import static org.openmetadata.service.governance.workflows.Workflow.CHANGE_REQUEST_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;

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
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRevision;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Read authorization for change requests. The caller must be able to view the entity; admins and
 * the entity's owners and reviewers then see every request on it, and anyone else sees the requests
 * they made and the requests whose review task they may resolve.
 */
public final class ChangeRequestVisibility {
  private static final String TASK_FIELDS = "assignees,reviewers,about,createdBy";

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
    if (!caller.equals(request.getRequestedBy())
        && !seesAll(caller, entity)
        && !mayResolveTask(authorizer, securityContext, request.getTaskId())) {
      throw new ForbiddenException(
          "You cannot view change requests made by other users on this asset");
    }
  }

  /**
   * Throws unless the caller may read the change request the task reviews. A task that reviews no
   * change request is left to the task's own checks.
   */
  public static void requireTaskVisible(
      Authorizer authorizer, SecurityContext securityContext, UUID taskId) {
    Task task = Entity.getEntity(Entity.TASK, taskId, TASK_FIELDS, Include.ALL);
    requireTaskVisible(authorizer, securityContext, task);
  }

  /**
   * As {@link #requireTaskVisible(Authorizer, SecurityContext, UUID)}, for a task the caller already
   * loaded with its assignees, reviewers, target and creator. A route that writes the task passes
   * the copy it read from the database: reading the task again through the entity cache before
   * the write would cache the copy the write replaces.
   */
  public static void requireTaskVisible(
      Authorizer authorizer, SecurityContext securityContext, Task task) {
    ChangeRequest request = requestsOf(List.of(task)).get(task.getId());
    if (request != null && !mayRead(authorizer, securityContext, request, task)) {
      throw new ForbiddenException(
          "You cannot view change requests made by other users on this asset");
    }
  }

  /**
   * Removes the proposed values from the review tasks of change requests the caller may not read.
   * The tasks stay listed, as they are to every viewer of the entity, so pages and counts do not
   * change; only the values follow the request's rule.
   */
  public static void withoutUnreadableValues(
      Authorizer authorizer, SecurityContext securityContext, List<Task> tasks) {
    String caller = securityContext.getUserPrincipal().getName();
    if (!tasks.isEmpty() && !SubjectContext.getSubjectContext(caller).isAdmin()) {
      Map<UUID, ChangeRequest> requests = requestsOf(tasks);
      Map<UUID, Boolean> seesAllByEntity = new HashMap<>();
      Set<UUID> undecided =
          tasks.stream()
              .map(Task::getId)
              .filter(
                  id -> {
                    ChangeRequest request = requests.get(id);
                    return request != null
                        && !caller.equals(request.getRequestedBy())
                        && !seesAllByEntity.computeIfAbsent(
                            request.getEntityId(), entityId -> seesAllOn(caller, request));
                  })
              .collect(Collectors.toSet());
      Set<UUID> resolvable = resolvableTasks(authorizer, securityContext, List.copyOf(undecided));
      tasks.stream()
          .filter(task -> undecided.contains(task.getId()) && !resolvable.contains(task.getId()))
          .forEach(task -> task.setPayload(null));
    }
  }

  private static boolean mayRead(
      Authorizer authorizer, SecurityContext securityContext, ChangeRequest request, Task task) {
    ResourceContext<?> entity = authorizeEntityView(authorizer, securityContext, request);
    String caller = securityContext.getUserPrincipal().getName();
    return caller.equals(request.getRequestedBy())
        || seesAll(caller, entity)
        || mayResolve(
            (TaskRepository) Entity.getEntityRepository(Entity.TASK),
            authorizer,
            securityContext,
            task);
  }

  // An entity that can no longer be read has no owners or reviewers to grant the view.
  private static boolean seesAllOn(String caller, ChangeRequest request) {
    boolean seesAll;
    try {
      seesAll =
          seesAll(
              caller, new ResourceContext<>(request.getEntityType(), request.getEntityId(), null));
    } catch (EntityNotFoundException missing) {
      seesAll = false;
    }
    return seesAll;
  }

  // A request links only its current review task. Revising the request closes the earlier task and
  // unlinks it; the workflow run that created that task records the request it reviewed. A page's
  // links, runs and requests are each read in one query.
  private static Map<UUID, ChangeRequest> requestsOf(List<Task> tasks) {
    Map<UUID, ChangeRequest> byTask = new HashMap<>();
    ChangeRequestService.dao()
        .changeRequestDAO()
        .listByTaskIds(tasks.stream().map(task -> task.getId().toString()).toList())
        .forEach(request -> byTask.put(request.getTaskId(), request));
    Map<UUID, UUID> runByTask = new HashMap<>();
    for (Task task : tasks) {
      if (!byTask.containsKey(task.getId()) && task.getWorkflowInstanceId() != null) {
        runByTask.put(task.getId(), task.getWorkflowInstanceId());
      }
    }
    if (!runByTask.isEmpty()) {
      Map<UUID, UUID> requestByRun = requestIdsOfRuns(runByTask.values());
      Map<UUID, ChangeRequest> requests = new HashMap<>();
      if (!requestByRun.isEmpty()) {
        ChangeRequestService.dao()
            .changeRequestDAO()
            .listByIds(requestByRun.values().stream().map(UUID::toString).distinct().toList())
            .forEach(request -> requests.put(request.getId(), request));
      }
      runByTask.forEach(
          (taskId, runId) -> {
            ChangeRequest request = requests.get(requestByRun.get(runId));
            if (request != null) {
              byTask.put(taskId, request);
            }
          });
    }
    return byTask;
  }

  private static Map<UUID, UUID> requestIdsOfRuns(Collection<UUID> runIds) {
    String variable =
        WorkflowVariableHandler.getNamespacedVariableName(
            GLOBAL_NAMESPACE, CHANGE_REQUEST_ID_VARIABLE);
    Map<UUID, UUID> requestByRun = new HashMap<>();
    Entity.getCollectionDAO()
        .workflowInstanceTimeSeriesDAO()
        .listRunRequests(runIds.stream().map(UUID::toString).distinct().toList(), variable)
        .forEach(
            run ->
                requestByRun.put(
                    UUID.fromString(run.runId()), UUID.fromString(run.changeRequestId())));
    return requestByRun;
  }

  private static boolean mayResolveTask(
      Authorizer authorizer, SecurityContext securityContext, UUID taskId) {
    boolean allowed = false;
    if (taskId != null) {
      TaskRepository repository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
      Task task = Entity.getEntity(Entity.TASK, taskId, TASK_FIELDS, Include.ALL);
      allowed = mayResolve(repository, authorizer, securityContext, task);
    }
    return allowed;
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

  private static ResourceContext<?> authorizeEntityView(
      Authorizer authorizer, SecurityContext securityContext, ChangeRequest request) {
    ResourceContext<?> entity =
        new ResourceContext<>(request.getEntityType(), request.getEntityId(), null);
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
    return resolvableTasks(
        authorizer,
        securityContext,
        requests.stream()
            .filter(r -> r.getTaskId() != null && !caller.equals(r.getRequestedBy()))
            .map(ChangeRequest::getTaskId)
            .toList());
  }

  // The tasks the caller may resolve, loaded in one batch.
  private static Set<UUID> resolvableTasks(
      Authorizer authorizer, SecurityContext securityContext, List<UUID> taskIds) {
    Set<UUID> resolvable = new HashSet<>();
    if (!taskIds.isEmpty()) {
      TaskRepository repository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
      List<EntityReference> references =
          taskIds.stream()
              .map(id -> new EntityReference().withId(id).withType(Entity.TASK))
              .toList();
      List<Task> loaded = Entity.getEntities(references, TASK_FIELDS, Include.ALL);
      for (Task task : loaded) {
        if (mayResolve(repository, authorizer, securityContext, task)) {
          resolvable.add(task.getId());
        }
      }
    }
    return resolvable;
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
