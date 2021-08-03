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

package org.openmetadata.catalog.security.auth;

import org.openmetadata.catalog.security.AuthenticationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.ext.Provider;
import java.security.Principal;

@Provider
public class CatalogSecurityContextRequestFilter implements ContainerRequestFilter {
  private static final Logger LOG = LoggerFactory.getLogger(CatalogSecurityContextRequestFilter.class);

  @Context
  private HttpServletRequest httpRequest;

  @Override
  public void filter(ContainerRequestContext requestContext) {
    Principal principal = httpRequest.getUserPrincipal();
    String scheme = requestContext.getUriInfo().getRequestUri().getScheme();

    LOG.debug("Method: {}, AuthType: {}, RemoteUser: {}, UserPrincipal: {}, Scheme: {}",
            httpRequest.getMethod(), httpRequest.getAuthType(),
            httpRequest.getRemoteUser(), principal, scheme);

    if (principal == null) {
      throw new AuthenticationException("Not authorized. Principal is not available");
    }

    SecurityContext securityContext = new CatalogSecurityContext(principal, scheme, httpRequest.getAuthType());
    LOG.debug("SecurityContext {}", securityContext);
    requestContext.setSecurityContext(securityContext);
  }
}
