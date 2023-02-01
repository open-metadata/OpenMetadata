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

package org.openmetadata.service.resources.alerts;

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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.PATCH;
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
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.events.CreateAlertAction;
import org.openmetadata.schema.entity.alerts.AlertAction;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.alerts.AlertsPublisherManager;
import org.openmetadata.service.jdbi3.AlertActionRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.resources.policies.PolicyResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/alertAction")
@Api(value = "Alerts collection", tags = "Alerts collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "alertAction", order = 7) // init before Alert Resource Init
public class AlertActionResource extends EntityResource<AlertAction, AlertActionRepository> {
  public static final String COLLECTION_PATH = "v1/alertAction/";

  public static final String FIELDS = "owner";

  @Override
  public AlertAction addHref(UriInfo uriInfo, AlertAction entity) {
    Entity.withHref(uriInfo, entity.getOwner());
    return entity;
  }

  public AlertActionResource(CollectionDAO dao, Authorizer authorizer) {
    super(AlertAction.class, new AlertActionRepository(dao), authorizer);
    // Initialize the Alerts Publisher Manager
    AlertsPublisherManager.initialize(dao);
  }

  public static class AlertActionList extends ResultList<AlertAction> {

    @SuppressWarnings("unused") /* Required for tests */
    public AlertActionList() {}
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    initDefaultAlertActions();
  }

  private void initDefaultAlertActions() throws IOException {
    List<String> jsonDataFiles = EntityUtil.getJsonDataResources(".*json/data/alerts/alertsActionData.json$");
    if (jsonDataFiles.size() != 1) {
      LOG.warn("Invalid number of jsonDataFiles {}. Only one expected.", jsonDataFiles.size());
      return;
    }
    String jsonDataFile = jsonDataFiles.get(0);
    try {
      String json = CommonUtil.getResourceAsStream(PolicyResource.class.getClassLoader(), jsonDataFile);
      // Assumes to have 1 entry currently
      AlertAction alertActions = JsonUtils.readObjects(json, AlertAction.class).get(0);
      alertActions.setId(UUID.randomUUID());
      dao.initializeEntity(alertActions);
    } catch (Exception e) {
      LOG.warn("Failed to initialize the resource descriptors from file {}", jsonDataFile, e);
    }
  }

  @GET
  @Operation(
      operationId = "listAlertActions",
      summary = "List all alerts actions",
      tags = "alertAction",
      description = "Get a list of all alert actions",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of alerts action subscription",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = AlertActionList.class)))
      })
  public ResultList<AlertAction> listAlertAction(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter alerts action by type",
              schema = @Schema(type = "string", example = "generic, slack, msteams"))
          @QueryParam("alertActionType")
          String typeParam,
      @Parameter(description = "Limit the number alerts returned. (1 to 1000000, default = " + "10) ")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of alerts before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of alerts after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    ListFilter filter = new ListFilter(Include.ALL).addQueryParam("alertActionType", typeParam);
    return listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Valid
  @Operation(
      operationId = "getAlertActionByID",
      summary = "Get a alert alert action",
      tags = "alertAction",
      description = "Get a alert action by given Id",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity events",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = AlertAction.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public AlertAction getAlertActionById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Id of the alert action", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getAlertActionByFQN",
      summary = "Get a alert action by name",
      tags = "alertAction",
      description = "Get a alert action by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "alert",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = AlertAction.class))),
        @ApiResponse(responseCode = "404", description = "Alert Action for instance {name} is not found")
      })
  public AlertAction getAlertActionByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Name of the alert action", schema = @Schema(type = "string")) @PathParam("name")
          String name,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllAlertVersion",
      summary = "List alert versions",
      tags = "alertAction",
      description = "Get a list of all the versions of a alert action identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of alert versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listAlertActionVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the alert action", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificAlertActionVersion",
      summary = "Get a version of the alert action",
      tags = "alertAction",
      description = "Get a version of the alert action by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "alert",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = AlertAction.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Alert for instance {id} and version {version} is " + "not found")
      })
  public AlertAction getAlertActionVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the alert action", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "alert version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createAlertAction",
      summary = "Create a new alert Action",
      tags = "alertAction",
      description = "Create a new Alert Action",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "alert",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = CreateAlertAction.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createAlertAction(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateAlertAction create)
      throws IOException {
    generateRandomAlertActionName(create);
    AlertAction alertAction = getAlertAction(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, alertAction);
  }

  @POST
  @Path("/bulk")
  @Operation(
      operationId = "bulkCreateAlertAction",
      summary = "Create new alert Action with Bulk",
      tags = "alertAction",
      description = "Create new alert Action with Bulk",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "alert",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = CreateAlertAction.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response bulkCreateAlertAction(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid List<CreateAlertAction> create)
      throws IOException {
    List<AlertAction> alert = new ArrayList<>();
    for (CreateAlertAction createAlertAction : create) {
      generateRandomAlertActionName(createAlertAction);
      AlertAction alertAction = getAlertAction(createAlertAction, securityContext.getUserPrincipal().getName());
      Response resp = create(uriInfo, securityContext, alertAction);
      alert.add((AlertAction) resp.getEntity());
    }
    return Response.status(Response.Status.CREATED).entity(alert).build();
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateAlertAction",
      summary = "Updated an existing or create a new Alert Action",
      tags = "alertAction",
      description = "Updated an existing or create a new alert Action",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "alert",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = CreateAlertAction.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response updateAlertAction(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateAlertAction create)
      throws IOException {
    if (CommonUtil.nullOrEmpty(create.getName())) {
      throw new IllegalArgumentException("[name] must not be null.");
    }
    AlertAction alertAction = getAlertAction(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, alertAction);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchAlertAction",
      summary = "Update a Alert Action",
      tags = "alertAction",
      description = "Update an existing alert using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patchAlertAction(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the alert action", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[" + "{op:remove, path:/a}," + "{op:add, path: /b, value: val}" + "]")
                      }))
          JsonPatch patch)
      throws IOException {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Valid
  @Operation(
      operationId = "deleteAlertAction",
      summary = "Delete a Alert Action",
      tags = "alertAction",
      description = "Get a alert action by given Id",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity events",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = AlertAction.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public Response deleteAlertAction(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the alert action", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    Response response = delete(uriInfo, securityContext, id, false, true);
    AlertsPublisherManager.getInstance().deleteAlertActionFromAllAlertPublisher((AlertAction) response.getEntity());
    return response;
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteAlertActionByName",
      summary = "Delete an Alert Action",
      tags = "alertAction",
      description = "Delete an alert action by given `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Entity for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the alert", schema = @Schema(type = "string")) @PathParam("name") String name)
      throws IOException {
    return deleteByName(uriInfo, securityContext, name, false, true);
  }

  public AlertAction getAlertAction(CreateAlertAction create, String user) throws IOException {
    return copy(new AlertAction(), create, user)
        .withEnabled(create.getEnabled())
        .withAlertActionType(create.getAlertActionType())
        .withBatchSize(create.getBatchSize())
        .withTimeout(create.getTimeout())
        .withReadTimeout(create.getReadTimeout())
        .withAlertActionConfig(create.getAlertActionConfig());
  }

  public void generateRandomAlertActionName(CreateAlertAction createRequest) {
    if (CommonUtil.nullOrEmpty(createRequest.getName())) {
      String name = String.format("%s_%s", createRequest.getAlertActionType().toString(), UUID.randomUUID());
      createRequest.setName(name);
      createRequest.setDisplayName(name);
    }
  }
}
