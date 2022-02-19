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

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMap.Builder;
import java.security.Principal;
import java.util.List;
import java.util.Map;
import javax.json.JsonPatch;
import javax.ws.rs.client.Invocation;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.SecurityContext;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.util.JsonPatchUtils;

public final class SecurityUtil {
  private SecurityUtil() {}

  public static void checkAdminRole(Authorizer authorizer, SecurityContext securityContext) {
    Principal principal = securityContext.getUserPrincipal();
    AuthenticationContext authenticationCtx = SecurityUtil.getAuthenticationContext(principal);
    if (!authorizer.isAdmin(authenticationCtx)) {
      throw new AuthorizationException("Principal: " + principal + " is not admin");
    }
  }

  public static Boolean isAdminOrBotRole(Authorizer authorizer, SecurityContext securityContext) {
    try {
      checkAdminOrBotRole(authorizer, securityContext);
      return true;
    } catch (AuthorizationException e) {
      return false;
    }
  }

  public static void checkAdminOrBotRole(Authorizer authorizer, SecurityContext securityContext) {
    Principal principal = securityContext.getUserPrincipal();
    AuthenticationContext authenticationCtx = SecurityUtil.getAuthenticationContext(principal);
    if (!authorizer.isAdmin(authenticationCtx) && !authorizer.isBot(authenticationCtx)) {
      throw new AuthorizationException("Principal: " + principal + " is not admin");
    }
  }

  public static void checkAdminRoleOrPermissions(
      Authorizer authorizer, SecurityContext securityContext, EntityReference entityReference) {
    Principal principal = securityContext.getUserPrincipal();
    AuthenticationContext authenticationCtx = SecurityUtil.getAuthenticationContext(principal);
    if (!authorizer.isAdmin(authenticationCtx)
        && !authorizer.isBot(authenticationCtx)
        && !authorizer.hasPermissions(authenticationCtx, entityReference)) {
      throw new AuthorizationException("Principal: " + principal + " does not have permissions");
    }
  }

  /** This helper function checks if user has permission to perform the given metadata operation. */
  public static void checkAdminRoleOrPermissions(
      Authorizer authorizer,
      SecurityContext securityContext,
      EntityReference entityReference,
      MetadataOperation metadataOperation) {
    Principal principal = securityContext.getUserPrincipal();
    AuthenticationContext authenticationCtx = SecurityUtil.getAuthenticationContext(principal);

    if (authorizer.isAdmin(authenticationCtx) || authorizer.isBot(authenticationCtx)) {
      return;
    }

    if (!authorizer.hasPermissions(authenticationCtx, entityReference, metadataOperation)) {
      throw new AuthorizationException("Principal: " + principal + " does not have permission to " + metadataOperation);
    }
  }

  /**
   * Most REST API requests should yield in a single metadata operation. There are cases where the JSON patch request
   * may yield multiple metadata operations. This helper function checks if user has permission to perform the given set
   * of metadata operations.
   */
  public static void checkAdminRoleOrPermissions(
      Authorizer authorizer, SecurityContext securityContext, EntityReference entityReference, JsonPatch patch) {
    Principal principal = securityContext.getUserPrincipal();
    AuthenticationContext authenticationCtx = SecurityUtil.getAuthenticationContext(principal);

    if (authorizer.isAdmin(authenticationCtx) || authorizer.isBot(authenticationCtx)) {
      return;
    }

    List<MetadataOperation> metadataOperations = JsonPatchUtils.getMetadataOperations(patch);
    for (MetadataOperation metadataOperation : metadataOperations) {
      if (!authorizer.hasPermissions(authenticationCtx, entityReference, metadataOperation)) {
        throw new AuthorizationException(
            "Principal: " + principal + " does not have permission to " + metadataOperation);
      }
    }
  }

  public static String getUserName(AuthenticationContext context) {
    return context.getPrincipal() == null ? null : context.getPrincipal().getName().split("[/@]")[0];
  }

  public static AuthenticationContext getAuthenticationContext(SecurityContext securityContext) {
    Principal principal = securityContext.getUserPrincipal();
    return SecurityUtil.getAuthenticationContext(principal);
  }

  private static AuthenticationContext getAuthenticationContext(Principal principal) {
    AuthenticationContext context = new AuthenticationContext();
    context.setPrincipal(principal);
    return context;
  }

  public static Map<String, String> authHeaders(String username) {
    Builder<String, String> builder = ImmutableMap.builder();
    if (username != null) {
      builder.put(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER, username);
    }
    return builder.build();
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

  /**
   * Returns true if authentication is enabled.
   *
   * @param securityContext security context
   * @return true if jwt filter based authentication is enabled, false otherwise
   */
  public static boolean isSecurityEnabled(SecurityContext securityContext) {
    return !securityContext.getAuthenticationScheme().equals(SecurityContext.BASIC_AUTH);
  }
}
