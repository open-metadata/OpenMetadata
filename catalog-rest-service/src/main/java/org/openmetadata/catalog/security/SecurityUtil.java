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

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.noPermission;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.notAdmin;

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
  public static final int ADMIN = 1;
  public static final int BOT = 2;
  public static final int OWNER = 4;
  public static final int PERMISSIONS = 8;

  private SecurityUtil() {}

  public static void authorizeAdmin(Authorizer authorizer, SecurityContext securityContext, int checkFlags) {
    if (checkOwner(checkFlags) || checkPermissions(checkFlags)) {
      throw new IllegalArgumentException("Only ADMIN or BOT authorization is allowed");
    }
    AuthenticationContext authenticationCtx = SecurityUtil.getAuthenticationContext(securityContext);
    if (authorizer.isAdmin(authenticationCtx)) {
      return;
    }
    if (checkBot(checkFlags) && authorizer.isBot(authenticationCtx)) {
      return;
    }
    throw new AuthorizationException(notAdmin(authenticationCtx.getPrincipal()));
  }

  public static void authorize(
      Authorizer authorizer,
      SecurityContext securityContext,
      EntityReference entity,
      EntityReference owner,
      int checkFlags) {
    AuthenticationContext authenticationCtx = SecurityUtil.getAuthenticationContext(securityContext);
    if (authorizer.isAdmin(authenticationCtx)) {
      return;
    }
    if (checkFlags == 0) {
      throw new AuthorizationException(notAdmin(authenticationCtx.getPrincipal()));
    }
    if ((checkFlags | BOT) > 0 && authorizer.isBot(authenticationCtx)) {
      return;
    }
    if ((checkFlags | OWNER) > 0 && authorizer.isOwner(authenticationCtx, owner)) {
      return;
    }
    if ((checkFlags | PERMISSIONS) > 0 && authorizer.hasPermissions(authenticationCtx, entity)) {
      return;
    }
    throw new AuthorizationException(noPermission(authenticationCtx.getPrincipal()));
  }

  /** This helper function checks if user has permission to perform the given metadata operation. */
  public static void checkAdminRoleOrPermissions(
      Authorizer authorizer,
      SecurityContext securityContext,
      EntityReference entityReference,
      MetadataOperation metadataOperation) {
    AuthenticationContext authenticationCtx = SecurityUtil.getAuthenticationContext(securityContext);

    if (authorizer.isAdmin(authenticationCtx) || authorizer.isBot(authenticationCtx)) {
      return;
    }

    if (!authorizer.hasPermissions(authenticationCtx, entityReference, metadataOperation)) {
      throw new AuthorizationException(noPermission(authenticationCtx.getPrincipal(), metadataOperation.value()));
    }
  }

  /**
   * Most REST API requests should yield a single metadata operation. There are cases where the JSON patch request may
   * yield multiple metadata operations. This helper function checks if user has permission to perform the given set of
   * metadata operations that can be derived from JSON patch.
   */
  public static void checkAdminRoleOrPermissions(
      Authorizer authorizer,
      SecurityContext securityContext,
      EntityReference entityReference,
      EntityReference ownerReference,
      JsonPatch patch) {
    AuthenticationContext authenticationCtx = SecurityUtil.getAuthenticationContext(securityContext);

    if (authorizer.isAdmin(authenticationCtx)
        || authorizer.isBot(authenticationCtx)
        || authorizer.hasPermissions(authenticationCtx, ownerReference)) {
      return;
    }

    List<MetadataOperation> metadataOperations = JsonPatchUtils.getMetadataOperations(patch);

    // If there are no specific metadata operations that can be determined from the JSON Patch, deny the changes.
    if (metadataOperations.isEmpty()) {
      throw new AuthorizationException(noPermission(authenticationCtx.getPrincipal()));
    }
    for (MetadataOperation metadataOperation : metadataOperations) {
      if (!authorizer.hasPermissions(authenticationCtx, entityReference, metadataOperation)) {
        throw new AuthorizationException(noPermission(authenticationCtx.getPrincipal(), metadataOperation.value()));
      }
    }
  }

  public static String getUserName(AuthenticationContext context) {
    return context.getPrincipal() == null ? null : context.getPrincipal().getName().split("[/@]")[0];
  }

  public static AuthenticationContext getAuthenticationContext(SecurityContext securityContext) {
    Principal principal = securityContext.getUserPrincipal();
    return new AuthenticationContext(principal);
  }

  public static Map<String, String> authHeaders(String username) {
    Builder<String, String> builder = ImmutableMap.builder();
    if (username != null) {
      builder.put(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER, username);
    }
    return builder.build();
  }

  public static String getPrincipalName(Map<String, String> authHeaders) {
    // Get username from the email address
    if (authHeaders == null) {
      return null;
    }
    String principal = authHeaders.get(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER);
    return principal == null ? null : principal.split("@")[0];
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

  public static boolean checkBot(int checkFlags) {
    return (checkFlags & BOT) > 0;
  }

  public static boolean checkOwner(int checkFlags) {
    return (checkFlags & OWNER) > 0;
  }

  public static boolean checkPermissions(int checkFlags) {
    return (checkFlags & PERMISSIONS) > 0;
  }
}
