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

package org.openmetadata.service.resources.settings;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.util.List;
import java.util.Objects;
import javax.json.JsonPatch;
import javax.validation.Valid;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.PATCH;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.SettingsRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

/**
 * Resource for managing OpenMetadata settings that an admin can change. Example - using APIs here, the conversation
 * thread notification can be changed to include only events that an organization uses.
 */
@Path("/v1/settings")
@Api(value = "Settings Collection", tags = "Settings collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "settings")
@Slf4j
public class SettingsResource {
  private final SettingsRepository settingsRepository;
  private final Authorizer authorizer;

  @SuppressWarnings("unused") // Method used for reflection
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    initSettings();
  }

  private void initSettings() throws IOException {
    List<String> jsonDataFiles = EntityUtil.getJsonDataResources(".*json/data/settings/settingsData.json$");
    if (jsonDataFiles.size() != 1) {
      LOG.warn("Invalid number of jsonDataFiles {}. Only one expected.", jsonDataFiles.size());
      return;
    }
    String jsonDataFile = jsonDataFiles.get(0);
    try {
      String json = CommonUtil.getResourceAsStream(getClass().getClassLoader(), jsonDataFile);
      List<Settings> settings = JsonUtils.readObjects(json, Settings.class);
      settings.forEach(
          (setting) -> {
            try {
              Settings storedSettings = settingsRepository.getConfigWithKey(setting.getConfigType().toString());
              if (storedSettings == null) {
                // Only in case a config doesn't exist in DB we insert it
                settingsRepository.createNewSetting(setting);
              }
            } catch (Exception ex) {
              LOG.debug("Fetching from DB failed ", ex);
            }
          });
    } catch (Exception e) {
      LOG.warn("Failed to initialize the {} from file {}", "filters", jsonDataFile, e);
    }
  }

  public static class SettingsList extends ResultList<Settings> {
    @SuppressWarnings("unused")
    public SettingsList() {
      /* Required for serde */
    }
  }

  public SettingsResource(CollectionDAO dao, Authorizer authorizer) {
    Objects.requireNonNull(dao, "SettingsRepository must not be null");
    this.settingsRepository = new SettingsRepository(dao);
    SettingsCache.initialize(dao);
    this.authorizer = authorizer;
  }

  @GET
  @Operation(
      operationId = "listSettings",
      summary = "List All Settings",
      tags = "settings",
      description = "Get a List of all OpenMetadata Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Settings",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = SettingsList.class)))
      })
  public ResultList<Settings> list(@Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    authorizer.authorizeAdmin(securityContext);
    return settingsRepository.listAllConfigs();
  }

  @GET
  @Path("/{name}")
  @Operation(
      operationId = "getSetting",
      summary = "Get a Setting",
      tags = "settings",
      description = "Get a OpenMetadata Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Settings.class)))
      })
  public Settings getSettingByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the setting", schema = @Schema(type = "string")) @PathParam("name")
          String name) {
    authorizer.authorizeAdmin(securityContext);
    return settingsRepository.getConfigWithKey(name);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdate",
      summary = "Update Setting",
      tags = "settings",
      description = "Update Existing Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Settings.class)))
      })
  public Response createOrUpdateSetting(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid Settings settingName) {
    authorizer.authorizeAdmin(securityContext);
    return settingsRepository.createOrUpdate(settingName);
  }

  @PATCH
  @Path("/{settingName}")
  @Operation(
      operationId = "patchSetting",
      summary = "Patch a Setting",
      tags = "settings",
      description = "Update an existing Setting using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Key of the Setting", schema = @Schema(type = "string")) @PathParam("settingName")
          String settingName,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[" + "{op:remove, path:/a}," + "{op:add, path: /b, value: val}" + "]")
                      }))
          JsonPatch patch) {
    authorizer.authorizeAdmin(securityContext);
    return settingsRepository.patchSetting(settingName, patch);
  }
}
