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

import com.google.common.base.Strings;
import javax.annotation.Priority;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.core.MultivaluedMap;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.security.auth.CatalogSecurityContext;

@Slf4j
@Priority(100)
public class CatalogOpenIdAuthorizationRequestFilter implements ContainerRequestFilter {
  public static final String X_AUTH_PARAMS_EMAIL_HEADER = "X-Auth-Params-Email";
  public static final String EMAIL_ADDRESS = "emailAddress";
  private static final String HEALTH_END_POINT = "health";

  @SuppressWarnings("unused")
  private CatalogOpenIdAuthorizationRequestFilter() {}

  public CatalogOpenIdAuthorizationRequestFilter(AuthenticationConfiguration config) {}

  public void filter(ContainerRequestContext containerRequestContext) {
    if (isHealthEndpoint(containerRequestContext)) {
      LOG.debug("Caller is health-agent, no authorization needed.");
      return;
    }
    MultivaluedMap<String, String> headers = containerRequestContext.getHeaders();
    String principal = extractAuthorizedUserName(headers);
    LOG.debug("AuthorizedUserName:{}", principal);
    CatalogPrincipal catalogPrincipal = new CatalogPrincipal(principal);
    String scheme = containerRequestContext.getUriInfo().getRequestUri().getScheme();
    CatalogSecurityContext catalogSecurityContext =
        new CatalogSecurityContext(catalogPrincipal, scheme, CatalogSecurityContext.OPENID_AUTH);
    LOG.debug("SecurityContext {}", catalogSecurityContext);
    containerRequestContext.setSecurityContext(catalogSecurityContext);
  }

  protected boolean isHealthEndpoint(ContainerRequestContext containerRequestContext) {
    UriInfo uriInfo = containerRequestContext.getUriInfo();
    return uriInfo.getPath().equalsIgnoreCase(HEALTH_END_POINT);
  }

  protected String extractAuthorizedUserName(MultivaluedMap<String, String> headers) {
    LOG.debug("Request Headers:{}", headers);

    String openIdEmail = headers.getFirst(X_AUTH_PARAMS_EMAIL_HEADER);
    if (Strings.isNullOrEmpty(openIdEmail)) {
      throw new AuthenticationException("Not authorized; User's Email is not present");
    }
    String[] openIdEmailParts = openIdEmail.split("@");
    return openIdEmailParts[0];
  }

  protected String extractAuthorizedEmailAddress(MultivaluedMap<String, String> headers) {
    LOG.debug("Request Headers:{}", headers);
    String openIdEmail = headers.getFirst(X_AUTH_PARAMS_EMAIL_HEADER);
    if (Strings.isNullOrEmpty(openIdEmail)) {
      throw new AuthenticationException("Not authorized; User's Email is not present");
    }
    return openIdEmail;
  }
}
