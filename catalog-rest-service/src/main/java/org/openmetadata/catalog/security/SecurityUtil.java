/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.security;

import org.openmetadata.catalog.type.EntityReference;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.core.SecurityContext;
import java.security.Principal;

public final class SecurityUtil {
  private static final Logger LOG = LoggerFactory.getLogger(SecurityUtil.class);

  private SecurityUtil() {

  }

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

  public static void checkAdminRoleOrPermissions(CatalogAuthorizer authorizer, SecurityContext securityContext,
                                                 EntityReference entityReference) {
    Principal principal = securityContext.getUserPrincipal();
    AuthenticationContext authenticationCtx = SecurityUtil.getAuthenticationContext(principal);
    if (!authorizer.isAdmin(authenticationCtx)  && !authorizer.isBot(authenticationCtx)
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
}
