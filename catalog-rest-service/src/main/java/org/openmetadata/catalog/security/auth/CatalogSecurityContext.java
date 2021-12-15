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

package org.openmetadata.catalog.security.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.core.SecurityContext;
import java.security.Principal;

/**
 * Holds authenticated principal and security context which is passed to the JAX-RS request methods
 */
public class CatalogSecurityContext implements SecurityContext {
  private static final Logger LOG = LoggerFactory.getLogger(CatalogSecurityContext.class);

  private final Principal principal;
  private final String scheme;
  private final String authenticationScheme;

  public static final String OPENID_AUTH = "openid";
  public static final String JWT_AUTH = "jwt";

  public CatalogSecurityContext(Principal principal, String scheme) {
    this(principal, scheme, SecurityContext.DIGEST_AUTH);
  }

  public CatalogSecurityContext(Principal principal, String scheme, String authenticationScheme) {
    this.principal = principal;
    this.scheme = scheme;
    this.authenticationScheme = authenticationScheme;
  }

  @Override
  public Principal getUserPrincipal() {
    return principal;
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
    return "catalogSecurityContext{" +
            "principal=" + principal +
            ", scheme='" + scheme + '\'' +
            ", authenticationScheme='" + authenticationScheme + '\'' +
            ", isSecure=" + isSecure() +
            '}';
  }
}