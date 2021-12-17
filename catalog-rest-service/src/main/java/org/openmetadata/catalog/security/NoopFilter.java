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

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.UriInfo;
import org.openmetadata.catalog.security.auth.CatalogSecurityContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class NoopFilter implements ContainerRequestFilter {
  @Context private UriInfo uriInfo;

  private static final Logger LOG = LoggerFactory.getLogger(NoopFilter.class);

  public void filter(ContainerRequestContext containerRequestContext) {
    CatalogPrincipal catalogPrincipal = new CatalogPrincipal("anonymous");
    String scheme = containerRequestContext.getUriInfo().getRequestUri().getScheme();
    CatalogSecurityContext catalogSecurityContext =
        new CatalogSecurityContext(catalogPrincipal, scheme, CatalogSecurityContext.BASIC_AUTH);
    LOG.debug("SecurityContext {}", catalogSecurityContext);
    containerRequestContext.setSecurityContext(catalogSecurityContext);
  }
}
