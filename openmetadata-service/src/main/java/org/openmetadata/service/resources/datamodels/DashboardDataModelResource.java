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

package org.openmetadata.service.resources.datamodels;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.UUID;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DashboardDataModelRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.ResultList;

@Path("/v1/dashboard/datamodels")
@Tag(
    name = "Dashboard Data Models",
    description =
        "`Data Models` are the schemas used to build dashboards, charts, or other data assets.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "datamodels")
public class DashboardDataModelResource
    extends EntityResource<DashboardDataModel, DashboardDataModelRepository> {
  private final DashboardDataModelMapper mapper = new DashboardDataModelMapper();
  public static final String COLLECTION_PATH = "/v1/dashboard/datamodels";
  protected static final String FIELDS = "owners,tags,followers,domain,sourceHash,extension";

  @Override
  public DashboardDataModel addHref(UriInfo uriInfo, DashboardDataModel dashboardDataModel) {
    super.addHref(uriInfo, dashboardDataModel);
    Entity.withHref(uriInfo, dashboardDataModel.getService());
    return dashboardDataModel;
  }

  public DashboardDataModelResource(Authorizer authorizer, Limits limits) {
    super(Entity.DASHBOARD_DATA_MODEL, authorizer, limits);
  }

  public static class DashboardDataModelList extends ResultList<DashboardDataModel> {
    /* Required for serde */
  }

  public static class DataModelColumnList extends ResultList<org.openmetadata.schema.type.Column> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listDashboardDataModels",
      summary = "List Dashboard Data Models",
      description =
          "Get a list of dashboard datamodels, optionally filtered by `service` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of dashboard datamodels",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DashboardDataModelList.class)))
      })
  public ResultList<DashboardDataModel> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter dashboardDataModel by service name",
              schema = @Schema(type = "string", example = "superset"))
          @QueryParam("service")
          String serviceParam,
      @Parameter(
              description =
                  "Limit the number dashboardDataModel returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limitParam,
      @Parameter(
              description = "Returns list of dashboardDataModel before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of dashboardDataModel after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include).addQueryParam("service", serviceParam);
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllDataModelVersions",
      summary = "List dashboard datamodel versions",
      description = "Get a list of all the versions of a dashboard datamodel identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of dashboard datamodel versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dashboard datamodel", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getDataModelByID",
      summary = "Get a dashboard datamodel by Id",
      description = "Get a dashboard datamodel by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The dashboard datamodel",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DashboardDataModel.class))),
        @ApiResponse(responseCode = "404", description = "DataModel for instance {id} is not found")
      })
  public DashboardDataModel get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dashboard datamodel", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getDataModelByFQN",
      summary = "Get a dashboard datamodel by fully qualified name",
      description = "Get a dashboard datamodel by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The dashboard datamodel",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DashboardDataModel.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataModel for instance {fqn} is not found")
      })
  public DashboardDataModel getByName(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fully qualified name of the dashboard datamodel",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificDataModelVersion",
      summary = "Get a version of the dashboard datamodel",
      description = "Get a version of the dashboard datamodel by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "dashboard datamodel",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DashboardDataModel.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataModel for instance {id} and version {version} is not found")
      })
  public DashboardDataModel getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dashboard datamodel", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "DataModel version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createDataModel",
      summary = "Create a dashboard datamodel",
      description = "Create a dashboard datamodel under an existing `service`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The dashboard datamodel",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DashboardDataModel.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateDashboardDataModel create) {
    DashboardDataModel dashboardDataModel =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, dashboardDataModel);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchDataModel",
      summary = "Update a dashboard datamodel",
      description = "Update an existing dashboard datamodel using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dashboard datamodel", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchDataModel",
      summary = "Update a dashboard datamodel by name.",
      description = "Update an existing dashboard datamodel using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the dashboard datamodel", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, fqn, patch);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateDataModel",
      summary = "Create or update dashboard datamodel",
      description =
          "Create a dashboard datamodel, it it does not exist or update an existing dashboard datamodel.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated dashboard datamodel",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DashboardDataModel.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateDashboardDataModel create) {
    DashboardDataModel dashboardDataModel =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, dashboardDataModel);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollowerToDataModel",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as followed of this data model",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "DataModel for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data model", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user to be added as follower",
              schema = @Schema(type = "UUID"))
          UUID userId) {
    return repository
        .addFollower(securityContext.getUserPrincipal().getName(), id, userId)
        .toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      operationId = "deleteFollowerFromDataModel",
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the data model.")
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data model", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user being removed as follower",
              schema = @Schema(type = "UUID"))
          @PathParam("userId")
          UUID userId) {
    return repository
        .deleteFollower(securityContext.getUserPrincipal().getName(), id, userId)
        .toResponse();
  }

  @PUT
  @Path("/{id}/vote")
  @Operation(
      operationId = "updateVoteForEntity",
      summary = "Update Vote for a Entity",
      description = "Update vote for a Entity",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response updateVote(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid VoteRequest request) {
    return repository
        .updateVote(securityContext.getUserPrincipal().getName(), id, request)
        .toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteDataModel",
      summary = "Delete a data model by `id`.",
      description = "Delete a dashboard datamodel by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "DataModel for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Id of the data model", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteDataModelAsync",
      summary = "Asynchronously delete a data model by `id`.",
      description = "Asynchronously delete a dashboard datamodel by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "DataModel for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Id of the data model", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteDataModelByFQN",
      summary = "Delete a data model by fully qualified name.",
      description = "Delete a data model by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "DataModel for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(
              description = "Fully qualified name of the data model",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted data model.",
      description = "Restore a soft deleted data model.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the data model",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DashboardDataModel.class)))
      })
  public Response restoreDataModel(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @GET
  @Path("/{id}/columns")
  @Operation(
      operationId = "getDataModelColumns",
      summary = "Get data model columns with pagination",
      description =
          "Get a paginated list of data model columns. This endpoint provides server-side pagination to handle data models with large numbers of columns efficiently.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of data model columns",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataModelColumnList.class)))
      })
  public DataModelColumnList getDataModelColumns(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data model", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Limit the number of columns returned (1 to 1000, default = 50)")
          @DefaultValue("50")
          @Min(value = 1, message = "must be greater than or equal to 1")
          @Max(value = 1000, message = "must be less than or equal to 1000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Offset for pagination (default = 0)")
          @DefaultValue("0")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @QueryParam("offset")
          int offsetParam,
      @Parameter(
              description = "Fields requested in the returned columns",
              schema = @Schema(type = "string", example = "tags"))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));

    ResultList<org.openmetadata.schema.type.Column> result =
        repository.getDataModelColumns(id, limitParam, offsetParam, fieldsParam, include);
    DataModelColumnList dataModelColumnList = new DataModelColumnList();
    dataModelColumnList.setData(result.getData());
    dataModelColumnList.setPaging(result.getPaging());
    return dataModelColumnList;
  }

  @GET
  @Path("/name/{fqn}/columns")
  @Operation(
      operationId = "getDataModelColumnsByFQN",
      summary = "Get data model columns with pagination by FQN",
      description =
          "Get a paginated list of data model columns by fully qualified name. This endpoint provides server-side pagination to handle data models with large numbers of columns efficiently.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of data model columns",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataModelColumnList.class)))
      })
  public DataModelColumnList getDataModelColumnsByFQN(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the data model",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(description = "Limit the number of columns returned (1 to 1000, default = 50)")
          @DefaultValue("50")
          @Min(value = 1, message = "must be greater than or equal to 1")
          @Max(value = 1000, message = "must be less than or equal to 1000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Offset for pagination (default = 0)")
          @DefaultValue("0")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @QueryParam("offset")
          int offsetParam,
      @Parameter(
              description = "Fields requested in the returned columns",
              schema = @Schema(type = "string", example = "tags"))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    // JAX-RS automatically URL-decodes path parameters, so fqn is already decoded
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));

    ResultList<org.openmetadata.schema.type.Column> result =
        repository.getDataModelColumnsByFQN(fqn, limitParam, offsetParam, fieldsParam, include);
    DataModelColumnList dataModelColumnList = new DataModelColumnList();
    dataModelColumnList.setData(result.getData());
    dataModelColumnList.setPaging(result.getPaging());
    return dataModelColumnList;
  }

  @GET
  @Path("/{id}/columns/search")
  @Operation(
      operationId = "searchDataModelColumnsById",
      summary = "Search data model columns with pagination by ID",
      description =
          "Search data model columns by name, description, or data type with server-side pagination. This endpoint provides efficient search functionality for data models with large numbers of columns.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of matching data model columns",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataModelColumnList.class)))
      })
  public DataModelColumnList searchDataModelColumnsById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data model", schema = @Schema(type = "string"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Search query for column names, descriptions, or data types")
          @QueryParam("q")
          String query,
      @Parameter(description = "Limit the number of columns returned (1 to 1000, default = 50)")
          @DefaultValue("50")
          @Min(value = 1, message = "must be greater than or equal to 1")
          @Max(value = 1000, message = "must be less than or equal to 1000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Offset for pagination (default = 0)")
          @DefaultValue("0")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @QueryParam("offset")
          int offsetParam,
      @Parameter(
              description = "Fields requested in the returned columns",
              schema = @Schema(type = "string", example = "tags"))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    ResultList<Column> result =
        repository.searchDataModelColumnsById(
            id, query, limitParam, offsetParam, fieldsParam, include);
    DataModelColumnList dataModelColumnList = new DataModelColumnList();
    dataModelColumnList.setData(result.getData());
    dataModelColumnList.setPaging(result.getPaging());
    return dataModelColumnList;
  }

  @GET
  @Path("/name/{fqn}/columns/search")
  @Operation(
      operationId = "searchDataModelColumnsByFQN",
      summary = "Search data model columns with pagination by FQN",
      description =
          "Search data model columns by name, description, or data type with server-side pagination. This endpoint provides efficient search functionality for data models with large numbers of columns.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of matching data model columns",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataModelColumnList.class)))
      })
  public DataModelColumnList searchDataModelColumnsByFQN(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the data model",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(description = "Search query for column names, descriptions, or data types")
          @QueryParam("q")
          String query,
      @Parameter(description = "Limit the number of columns returned (1 to 1000, default = 50)")
          @DefaultValue("50")
          @Min(value = 1, message = "must be greater than or equal to 1")
          @Max(value = 1000, message = "must be less than or equal to 1000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Offset for pagination (default = 0)")
          @DefaultValue("0")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @QueryParam("offset")
          int offsetParam,
      @Parameter(
              description = "Fields requested in the returned columns",
              schema = @Schema(type = "string", example = "tags"))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    ResultList<org.openmetadata.schema.type.Column> result =
        repository.searchDataModelColumnsByFQN(
            fqn, query, limitParam, offsetParam, fieldsParam, include);
    DataModelColumnList dataModelColumnList = new DataModelColumnList();
    dataModelColumnList.setData(result.getData());
    dataModelColumnList.setPaging(result.getPaging());
    return dataModelColumnList;
  }
}
