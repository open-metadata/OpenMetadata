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

package org.openmetadata.catalog.resources.config;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.security.AuthenticationConfiguration;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;

@Path("/v1/config")
@Api(value = "Get configuration")
@Produces(MediaType.APPLICATION_JSON)
public class ConfigResource {
  private final CatalogApplicationConfig catalogApplicationConfig;

  public ConfigResource(CatalogApplicationConfig catalogApplicationConfig) {
      this.catalogApplicationConfig = catalogApplicationConfig;
  }


  @GET
  @Path(("/auth"))
  @Operation(summary = "Get auth configuration")
  public AuthenticationConfiguration getAuthConfig(@Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    AuthenticationConfiguration authenticationConfiguration = new AuthenticationConfiguration();
    if (catalogApplicationConfig.getAuthenticationConfiguration() != null) {
      authenticationConfiguration = catalogApplicationConfig.getAuthenticationConfiguration();
    }
    return authenticationConfiguration;
  }
}
