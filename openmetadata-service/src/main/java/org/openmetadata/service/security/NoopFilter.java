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

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.HashSet;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

@Slf4j
public class NoopFilter implements ContainerRequestFilter {
  @Context private UriInfo uriInfo;

  public NoopFilter(
      AuthenticationConfiguration authenticationConfiguration,
      AuthorizerConfiguration authorizerConfiguration) {}

  public void filter(ContainerRequestContext containerRequestContext) {
    CatalogPrincipal catalogPrincipal =
        new CatalogPrincipal("anonymous", "anonymous@openmetadata.org");
    String scheme = containerRequestContext.getUriInfo().getRequestUri().getScheme();
    CatalogSecurityContext catalogSecurityContext =
        new CatalogSecurityContext(
            catalogPrincipal, scheme, SecurityContext.BASIC_AUTH, new HashSet<>());
    LOG.debug("SecurityContext {}", catalogSecurityContext);
    containerRequestContext.setSecurityContext(catalogSecurityContext);
  }
}
