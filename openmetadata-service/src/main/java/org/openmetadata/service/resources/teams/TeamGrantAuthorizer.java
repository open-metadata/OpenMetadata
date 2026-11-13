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

package org.openmetadata.service.resources.teams;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.ORGANIZATION_NAME;
import static org.openmetadata.service.Entity.TEAM;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/**
 * Members inherit a team's roles and policies, and those of every team above it, so adding either
 * grants access the way assigning a role to a user does: only an admin may add them, and never in
 * an impersonated request. Placing a team under another one changes that team as well, so it needs
 * the same permission as editing it directly. The organization is skipped as every user already
 * belongs to it. Shared by {@link TeamResource} and the MCP {@code create_entity} tool so both
 * refuse the same grants. ADR:2026-10-30-only-admins-add-roles-or-policies-to-a-team
 */
public final class TeamGrantAuthorizer {

  private TeamGrantAuthorizer() {}

  public static void authorize(
      Authorizer authorizer, SecurityContext securityContext, Team stored, Team updated) {
    if (addsRoleOrPolicy(stored, updated)) {
      rejectImpersonated(securityContext);
      authorizer.authorizeAdmin(securityContext);
    }
    for (UUID parentId : addedIds(stored.getParents(), updated.getParents())) {
      authorizeParentEdit(authorizer, securityContext, parentId);
    }
  }

  private static boolean addsRoleOrPolicy(Team stored, Team updated) {
    return !addedIds(stored.getDefaultRoles(), updated.getDefaultRoles()).isEmpty()
        || !addedIds(stored.getPolicies(), updated.getPolicies()).isEmpty();
  }

  /**
   * Keyed off the request's impersonated user rather than {@code ImpersonationContext}, which the
   * MCP server sets on every tool call. On REST the two are set together.
   */
  private static void rejectImpersonated(SecurityContext securityContext) {
    if (SecurityUtil.isImpersonated(securityContext)) {
      throw new AuthorizationException(
          "Impersonated requests cannot add roles or policies to a team");
    }
  }

  private static void authorizeParentEdit(
      Authorizer authorizer, SecurityContext securityContext, UUID parentId) {
    if (!ORGANIZATION_NAME.equals(Entity.getEntityReferenceById(TEAM, parentId, ALL).getName())) {
      authorizer.authorize(
          securityContext,
          new OperationContext(TEAM, MetadataOperation.EDIT_ALL),
          new ResourceContext<>(TEAM, parentId, null));
    }
  }

  private static Set<UUID> addedIds(List<EntityReference> stored, List<EntityReference> updated) {
    Set<UUID> added =
        listOrEmpty(updated).stream().map(EntityReference::getId).collect(Collectors.toSet());
    listOrEmpty(stored).forEach(ref -> added.remove(ref.getId()));
    return added;
  }
}
