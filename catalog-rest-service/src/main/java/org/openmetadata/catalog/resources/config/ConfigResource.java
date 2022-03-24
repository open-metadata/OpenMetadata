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

package org.openmetadata.catalog.resources.config;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.resources.Collection;

@Path("/v1/config")
@Api(value = "Get configuration")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "config")
public class ConfigResource {
  private final CatalogApplicationConfig catalogApplicationConfig;

  public ConfigResource(CatalogApplicationConfig catalogApplicationConfig) {
    this.catalogApplicationConfig = new CatalogApplicationConfig();
    // set only required, make sure we never return passwords or any such sensitive information.
    this.catalogApplicationConfig.setAuthenticationConfiguration(
        catalogApplicationConfig.getAuthenticationConfiguration());
    this.catalogApplicationConfig.setAuthorizerConfiguration(catalogApplicationConfig.getAuthorizerConfiguration());
    this.catalogApplicationConfig.setSandboxModeEnable(catalogApplicationConfig.getSandboxModeEnable());
    this.catalogApplicationConfig.setServerFactory(null);
    this.catalogApplicationConfig.setHealthConfiguration(null);
    this.catalogApplicationConfig.setLoggingFactory(null);
    this.catalogApplicationConfig.setAdminFactory(null);
    this.catalogApplicationConfig.setMetricsFactory(null);
  }

  @GET
  @Path(("/"))
  @Operation(
      summary = "Get OpenMetadata Server configuration",
      tags = "general",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Get OpenMetadata Server configuration",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CatalogApplicationConfig.class)))
      })
  public CatalogApplicationConfig getOpenMetadataConfig() {
    return catalogApplicationConfig;
  }
}
