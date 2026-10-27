/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.security;

import jakarta.annotation.Priority;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ResourceInfo;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/**
 * Bounds what an impersonated session may do, as opposed to {@link ImpersonationAuthorizer}, which
 * decides whether the bot may impersonate the target at all.
 *
 * <p>Once {@link JwtFilter} swaps the principal, every ad-hoc self-check in the codebase quietly
 * changes meaning from "is this me?" to "is this the person I am pretending to be?". For the
 * identity-affecting endpoints - mint a token, revoke tokens, change a password, log out - that
 * turns a request-scoped, revocable grant into a standalone credential that outlives it. Those
 * endpoints deliberately call no authorizer, so they opt in with {@link IdentityEndpoint} instead.
 *
 * <p>Name-bound rather than matched on the request path: Jersey runs this filter only for methods
 * it has already routed to, so no spelling of the URL can reach the method without passing here.
 *
 * <p>Keyed off {@link CatalogSecurityContext#impersonatedUser()} rather than {@link
 * ImpersonationContext}: that ThreadLocal is audit attribution, and the MCP server sets it to its
 * own bot on every tool call, which has nothing to do with an {@code X-Impersonate-User} request.
 */
@Slf4j
@Provider
@IdentityEndpoint
@Priority(Priorities.AUTHORIZATION)
public class ImpersonationRestrictionFilter implements ContainerRequestFilter {

  @Context private ResourceInfo resourceInfo;

  @Override
  public void filter(ContainerRequestContext requestContext) {
    String impersonatingBot = impersonatingBot(requestContext.getSecurityContext());
    if (impersonatingBot == null) {
      return;
    }
    String endpoint = endpointName();
    LOG.warn(
        "Impersonation denied: bot={} attempted to reach identity endpoint {} as user={}",
        impersonatingBot,
        endpoint,
        requestContext.getSecurityContext().getUserPrincipal().getName());
    throw new AuthorizationException(
        "Impersonated requests cannot access identity endpoint " + endpoint);
  }

  private String endpointName() {
    return resourceInfo.getResourceClass().getSimpleName()
        + "."
        + resourceInfo.getResourceMethod().getName();
  }

  private static String impersonatingBot(SecurityContext securityContext) {
    return securityContext instanceof CatalogSecurityContext catalogSecurityContext
        ? catalogSecurityContext.impersonatedUser()
        : null;
  }
}
