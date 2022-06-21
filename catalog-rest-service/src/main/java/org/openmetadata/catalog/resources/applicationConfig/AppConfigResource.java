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

package org.openmetadata.catalog.resources.applicationConfig;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.util.Map;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import org.openmetadata.catalog.config.ConfigDAO;
import org.openmetadata.catalog.jdbi3.AppConfigRepository;
import org.openmetadata.catalog.security.AuthenticationConfiguration;

@Path("/v1/appconfig")
@Api(value = "Get Application configuration")
@Produces(MediaType.APPLICATION_JSON)
public class AppConfigResource extends AppConfigRepository {

  public AppConfigResource(ConfigDAO configDAO) {
    super(configDAO);
  }

  @GET
  @Operation(
      operationId = "List all available Configuration",
      summary = "Get Application configurations",
      tags = "appconfig",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Auth configuration",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AuthenticationConfiguration.class)))
      })
  public Map<String, String> listAppConfigs(@Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    return listAllConfigs();
  }

  @GET
  @Path("/{configKey}")
  @Operation(
      operationId = "getConfigByKey",
      summary = "Get a Configuration by Key",
      tags = "appconfig",
      description = "Get a configuration by Key",
      responses = {
        @ApiResponse(responseCode = "200", description = "Succesfully Fetched Configuration"),
        @ApiResponse(responseCode = "404", description = "Configuration with given Key Not Found")
      })
  public Map<String, String> get(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @PathParam("configKey") String configKey)
      throws IOException {
    return getConfigWithKey(configKey);
  }
}
