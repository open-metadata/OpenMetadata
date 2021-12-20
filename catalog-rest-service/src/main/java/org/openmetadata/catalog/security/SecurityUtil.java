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

package org.openmetadata.catalog.security;

import java.security.Principal;
import java.util.HashMap;
import java.util.Map;
import javax.ws.rs.client.Invocation;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.SecurityContext;
import org.openmetadata.catalog.type.EntityReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class SecurityUtil {
  private static final Logger LOG = LoggerFactory.getLogger(SecurityUtil.class);

  private SecurityUtil() {}

  public static void checkAdminRole(CatalogAuthorizer authorizer, SecurityContext securityContext) {
    Principal principal = securityContext.getUserPrincipal();
    AuthenticationContext authenticationCtx = SecurityUtil.getAuthenticationContext(principal);
    if (!authorizer.isAdmin(authenticationCtx)) {
      throw new AuthorizationException("Principal: " + principal + " is not admin");
    }
  }

  public static void checkAdminOrBotRole(CatalogAuthorizer authorizer, SecurityContext securityContext) {
    Principal principal = securityContext.getUserPrincipal();
    AuthenticationContext authenticationCtx = SecurityUtil.getAuthenticationContext(principal);
    if (!authorizer.isAdmin(authenticationCtx) && !authorizer.isBot(authenticationCtx)) {
      throw new AuthorizationException("Principal: " + principal + " is not admin");
    }
  }

  public static void checkAdminRoleOrPermissions(
      CatalogAuthorizer authorizer, SecurityContext securityContext, EntityReference entityReference) {
    Principal principal = securityContext.getUserPrincipal();
    AuthenticationContext authenticationCtx = SecurityUtil.getAuthenticationContext(principal);
    if (!authorizer.isAdmin(authenticationCtx)
        && !authorizer.isBot(authenticationCtx)
        && !authorizer.hasPermissions(authenticationCtx, entityReference)) {
      throw new AuthorizationException("Principal: " + principal + " does not have permissions");
    }
  }

  public static String getUserName(String principalName) {
    return principalName == null ? null : principalName.split("[/@]")[0];
  }

  public static String getUserName(AuthenticationContext context) {
    return context.getPrincipal() == null ? null : context.getPrincipal().getName();
  }

  private static AuthenticationContext getAuthenticationContext(Principal principal) {
    AuthenticationContext context = new AuthenticationContext();
    context.setPrincipal(principal);
    return context;
  }

  public static Map<String, String> authHeaders(String username) {
    Map<String, String> headers = new HashMap<>();
    if (username != null) {
      headers.put(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER, username);
    }
    return headers;
  }

  public static Invocation.Builder addHeaders(WebTarget target, Map<String, String> headers) {
    if (headers != null) {
      return target
          .request()
          .header(
              CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER,
              headers.get(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER));
    }
    return target.request();
  }
}
