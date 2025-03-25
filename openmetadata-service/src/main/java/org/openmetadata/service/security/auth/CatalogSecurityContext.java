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

package org.openmetadata.service.security.auth;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.HashSet;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;

/** Holds authenticated principal and security context which is passed to the JAX-RS request methods */
@Slf4j
public record CatalogSecurityContext(
    Principal principal, String scheme, String authenticationScheme, Set<String> userRoles)
    implements SecurityContext {
  public static final String OPENID_AUTH = "openid";

  @Override
  public Principal getUserPrincipal() {
    return principal;
  }

  public Set<String> getUserRoles() {
    if (nullOrEmpty(userRoles)) {
      return new HashSet<>();
    }
    return userRoles;
  }

  @Override
  public boolean isUserInRole(String role) {
    LOG.debug("isUserInRole user: {}, role: {}", principal, role);
    return false;
  }

  @Override
  public boolean isSecure() {
    return "https".equals(this.scheme);
  }

  @Override
  public String getAuthenticationScheme() {
    return authenticationScheme;
  }

  @Override
  public String toString() {
    return String.format(
        "catalogSecurityContext{principal=%s, scheme='%s', authenticationSchema='%s', isSecure=%s}",
        principal, scheme, authenticationScheme, isSecure());
  }
}
