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

package org.openmetadata.service.resources.system.ui;

import io.dropwizard.jersey.PATCH;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.system.ui.CreateKnowledgePanel;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.system.ui.KnowledgePanel;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.KnowledgePanelRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/system/ui/knowledgePanels")
@Tag(
    name = "KnowledgePanels",
    description = "A `Knowledge Panel` is an information box used for UX customization in OpenMetadata.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "knowledgePanel", order = 2)
public class KnowledgePanelResource extends EntityResource<KnowledgePanel, KnowledgePanelRepository> {
  public static final String COLLECTION_PATH = "/v1/system/ui/knowledgePanels";

  @Override
  public KnowledgePanel addHref(UriInfo uriInfo, KnowledgePanel knowledgePanel) {
    super.addHref(uriInfo, knowledgePanel);
    return knowledgePanel;
  }

  public KnowledgePanelResource(CollectionDAO dao, Authorizer authorizer) {
    super(KnowledgePanel.class, new KnowledgePanelRepository(dao), authorizer);
  }

  public static class KnowledgePanelList extends ResultList<KnowledgePanel> {
    /* Required for serde */
  }

  @GET
  @Valid
  @Operation(
      operationId = "listKnowledgePanels",
      summary = "List KnowledgePanels",
      description =
          "Get a list of Knowledge Panels. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of personas",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = KnowledgePanelList.class)))
      })
  public ResultList<KnowledgePanel> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Limit the number of personas returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of personas before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of personas after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after) {
    return super.listInternal(uriInfo, securityContext, "", new ListFilter(null), limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllPersonaVersion",
      summary = "List Persona versions",
      description = "Get a list of all the versions of a persona identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of persona versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Persona", schema = @Schema(type = "UUID")) @PathParam("id") UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Valid
  @Path("/{id}")
  @Operation(
      summary = "Get a KnowledgePanel by id",
      description = "Get a KnowledgePanel by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The KnowledgePanel",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = KnowledgePanel.class))),
        @ApiResponse(responseCode = "404", description = "Knowledge Panel for instance {id} is not found")
      })
  public KnowledgePanel get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Persona", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return getInternal(uriInfo, securityContext, id, "", include);
  }

  @GET
  @Valid
  @Path("/name/{name}")
  @Operation(
      operationId = "getKnowledgePanelByFQN",
      summary = "Get a KnowledgePanel by name",
      description = "Get a KnowledgePanel by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The KnowledgePanel",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = KnowledgePanel.class))),
        @ApiResponse(responseCode = "404", description = "KnowledgePanel for instance {name} is not found")
      })
  public KnowledgePanel getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Persona", schema = @Schema(type = "string")) @PathParam("name") String name,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return getByNameInternal(uriInfo, securityContext, name, "", include);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificKnowledgePanelVersion",
      summary = "Get a version of the KnowledgePanel",
      description = "Get a version of the KnowledgePanel by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "KnowledgePanel",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = KnowledgePanel.class))),
        @ApiResponse(
            responseCode = "404",
            description = "KnowledgePanel for instance {id} and version {version} is " + "not found")
      })
  public KnowledgePanel getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the KnowledgePanel", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "KnowledgePanel version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createKnowledgePanel",
      summary = "Create a Knowledge Panel",
      description = "Create a new Knowledge Panel.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Knowledge Panel.",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Persona.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateKnowledgePanel ckp) {
    KnowledgePanel knowledgePanel = getKnowledgePanel(ckp, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, knowledgePanel);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdatePersona",
      summary = "Update Persona",
      description = "Create or Update a Persona.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Persona.",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = KnowledgePanel.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateKnowledgePanel ckp) {
    KnowledgePanel kp = getKnowledgePanel(ckp, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, kp);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(
      operationId = "patchKnowledgePanel",
      summary = "Update a KnowledgePanel",
      description = "Update an existing persona with JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the KnowledgePanel", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[" + "{op:remove, path:/a}," + "{op:add, path: /b, value: val}" + "]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteKnowledgePanel",
      summary = "Delete a KnowledgePanel by id",
      description = "Delete a KnowledgePanel by given `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "KnowledgePanel for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the KnowledgePanel", schema = @Schema(type = "UUID")) @PathParam("id") UUID id) {
    return delete(uriInfo, securityContext, id, false, true);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteKnowledgePanelByName",
      summary = "Delete a KnowledgePanel by name",
      description = "Delete a Knowledge Panel by given `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Knowledge Panel for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Knowledge Panel", schema = @Schema(type = "string")) @PathParam("name")
          String name) {
    return deleteByName(uriInfo, securityContext, name, false, true);
  }

  private KnowledgePanel getKnowledgePanel(CreateKnowledgePanel ckp, String user) {
    return copy(new KnowledgePanel(), ckp, user)
        .withSupportedSizes(ckp.getSupportedSizes())
        .withConfiguration(ckp.getConfiguration());
  }
}
