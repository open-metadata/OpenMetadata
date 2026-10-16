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

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.SecurityContext;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRevision;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
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
        && !reviewableTasks(authorizer, securityContext, List.of(request))
            .contains(request.getTaskId())) {
      throw new ForbiddenException(
          "You cannot view change requests made by other users on this asset");
    }
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
