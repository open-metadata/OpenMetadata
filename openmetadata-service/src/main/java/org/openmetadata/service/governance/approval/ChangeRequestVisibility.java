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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRevision;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Read authorization for change requests. The caller must be able to view the entity; admins and
 * the entity's owners and reviewers then see every request on it, and anyone else sees only the
 * requests they made.
 */
public final class ChangeRequestVisibility {
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
        .map(request -> request.withActiveRevision(revisions.get(request.getActiveRevisionId())))
        .toList();
  }

  public static void requireVisible(
      Authorizer authorizer, SecurityContext securityContext, ChangeRequest request) {
    ResourceContext<?> entity = authorizeEntityView(authorizer, securityContext, request);
    String caller = securityContext.getUserPrincipal().getName();
    if (!caller.equals(request.getRequestedBy()) && !seesAll(caller, entity)) {
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
      visible =
          seesAll(caller, entity)
              ? all
              : all.stream().filter(r -> caller.equals(r.getRequestedBy())).toList();
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

  private static boolean seesAll(String caller, ResourceContext<?> entity) {
    SubjectContext subject = SubjectContext.getSubjectContext(caller);
    return subject.isAdmin()
        || subject.isOwner(entity.getOwners())
        || subject.isReviewer(entity.getEntity().getReviewers());
  }
}
