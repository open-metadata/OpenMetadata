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

import com.google.common.annotations.VisibleForTesting;
import jakarta.annotation.Priority;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.ext.Provider;
import java.util.Locale;
import java.util.Set;
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
 * endpoints deliberately call no authorizer, so there is no funnel to hook; a denylist checked once
 * per request is the cheapest thing that generalises. Adding an endpoint is a one-line review.
 *
 * <p>Keyed off {@link CatalogSecurityContext#impersonatedUser()} rather than {@link
 * ImpersonationContext}: that ThreadLocal is audit attribution, and the MCP server sets it to its
 * own bot on every tool call, which has nothing to do with an {@code X-Impersonate-User} request.
 */
@Slf4j
@Provider
@Priority(Priorities.AUTHORIZATION)
public class ImpersonationRestrictionFilter implements ContainerRequestFilter {

  /**
   * Lower-case, matched against a lower-cased {@code UriInfo.getPath()}. A trailing {@code /} marks
   * a path-parameterised family such as {@code generateToken/{id}}.
   */
  private static final Set<String> IDENTITY_ENDPOINTS =
      Set.of(
          "v1/users/security/token",
          "v1/users/security/token/",
          "v1/users/generatetoken",
          "v1/users/generatetoken/",
          "v1/users/revoketoken",
          "v1/users/revoketoken/",
          "v1/users/token/",
          "v1/users/auth-mechanism/",
          "v1/users/changepassword",
          "v1/users/generaterandompwd",
          "v1/users/logout");

  @Override
  public void filter(ContainerRequestContext requestContext) {
    String impersonatingBot = impersonatingBot(requestContext.getSecurityContext());
    String path = requestContext.getUriInfo().getPath();
    if (impersonatingBot == null || !isIdentityEndpoint(path)) {
      return;
    }
    LOG.warn(
        "Impersonation denied: bot={} attempted to reach identity endpoint {} as user={}",
        impersonatingBot,
        path,
        requestContext.getSecurityContext().getUserPrincipal().getName());
    throw new AuthorizationException(
        "Impersonated requests cannot access identity endpoint " + path);
  }

  private static String impersonatingBot(SecurityContext securityContext) {
    return securityContext instanceof CatalogSecurityContext catalogSecurityContext
        ? catalogSecurityContext.impersonatedUser()
        : null;
  }

  @VisibleForTesting
  static boolean isIdentityEndpoint(String requestPath) {
    String path = requestPath.toLowerCase(Locale.ROOT);
    return IDENTITY_ENDPOINTS.stream()
        .anyMatch(
            endpoint -> endpoint.endsWith("/") ? path.startsWith(endpoint) : path.equals(endpoint));
  }
}
