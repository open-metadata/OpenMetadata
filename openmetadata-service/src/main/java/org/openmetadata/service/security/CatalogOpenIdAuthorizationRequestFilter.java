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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.annotation.Priority;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.HashSet;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

@Slf4j
@Priority(100)
public class CatalogOpenIdAuthorizationRequestFilter implements ContainerRequestFilter {
  public static final String X_AUTH_PARAMS_EMAIL_HEADER = "X-Auth-Params-Email";
  private static final String HEALTH_END_POINT = "health";

  @SuppressWarnings("unused")
  private CatalogOpenIdAuthorizationRequestFilter() {}

  public CatalogOpenIdAuthorizationRequestFilter(
      AuthenticationConfiguration config, AuthorizerConfiguration conf) {
    /* Used in test */
  }

  public void filter(ContainerRequestContext containerRequestContext) {
    if (isHealthEndpoint(containerRequestContext)) {
      LOG.debug("Caller is health-agent, no authorization needed.");
      return;
    }
    MultivaluedMap<String, String> headers = containerRequestContext.getHeaders();
    String email = extractAuthorizedEmail(headers);
    String principal = extractAuthorizedUserName(email);
    LOG.debug("AuthorizedUserName:{}", principal);
    CatalogPrincipal catalogPrincipal = new CatalogPrincipal(principal, email);
    setSecurityContext(containerRequestContext, catalogPrincipal);
  }

  protected boolean isHealthEndpoint(ContainerRequestContext containerRequestContext) {
    UriInfo uriInfo = containerRequestContext.getUriInfo();
    return uriInfo.getPath().equalsIgnoreCase(HEALTH_END_POINT);
  }

  protected String extractAuthorizedUserName(String openIdEmail) {
    String[] openIdEmailParts = openIdEmail.split("@");
    return openIdEmailParts[0];
  }

  protected String extractAuthorizedEmail(MultivaluedMap<String, String> headers) {
    LOG.debug("Request Headers:{}", headers);
    String openIdEmail = headers.getFirst(X_AUTH_PARAMS_EMAIL_HEADER);
    if (nullOrEmpty(openIdEmail)) {
      throw new AuthenticationException("Not authorized; User's Email is not present");
    }
    return openIdEmail;
  }

  private void setSecurityContext(
      ContainerRequestContext requestContext, CatalogPrincipal catalogPrincipal) {
    String scheme = requestContext.getUriInfo().getRequestUri().getScheme();
    CatalogSecurityContext catalogSecurityContext =
        new CatalogSecurityContext(
            catalogPrincipal, scheme, SecurityContext.BASIC_AUTH, new HashSet<>());
    requestContext.setSecurityContext(catalogSecurityContext);
  }
}
