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
import org.openmetadata.schema.api.data.CreateDataModel;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.DataModel;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DataModelRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.resources.databases.DatabaseUtil;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Path("/v1/datamodels")
@Api(value = "Data Model data asset collection", tags = "Data Model data asset collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "datamodels")
public class DataModelResource extends EntityResource<DataModel, DataModelRepository> {
  public static final String COLLECTION_PATH = "/v1/datamodels";
  protected static final String FIELDS = "owner,tags,followers";

  @Override
  public DataModel addHref(UriInfo uriInfo, DataModel dataModel) {
    dataModel.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, dataModel.getId()));
    Entity.withHref(uriInfo, dataModel.getOwner());
    Entity.withHref(uriInfo, dataModel.getService());
    Entity.withHref(uriInfo, dataModel.getFollowers());
    return dataModel;
  }

  public DataModelResource(CollectionDAO dao, Authorizer authorizer) {
    super(DataModel.class, new DataModelRepository(dao), authorizer);
  }

  public static class DataModelList extends ResultList<DataModel> {
    @SuppressWarnings("unused")
    DataModelList() {
      // Empty constructor needed for deserialization
    }
  }

  @GET
  @Operation(
      operationId = "listDataModels",
      summary = "List dataModels",
      tags = "dataModels",
      description =
          "Get a list of dataModels, optionally filtered by `service` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of dataModels",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DataModelList.class)))
      })
  public ResultList<DataModel> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter dataModels by service name",
              schema = @Schema(type = "string", example = "superset"))
          @QueryParam("service")
          String serviceParam,
      @Parameter(description = "Limit the number dataModels returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(description = "Returns list of dataModels before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of dataModels after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    ListFilter filter = new ListFilter(include).addQueryParam("service", serviceParam);
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllDataModelVersions",
      summary = "List dataModel versions",
      tags = "dataModels",
      description = "Get a list of all the versions of a dataModel identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of dataModel versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dataModel", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getDataModelByID",
      summary = "Get a dataModel by Id",
      tags = "dataModels",
      description = "Get a dataModel by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The dataModel",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DataModel.class))),
        @ApiResponse(responseCode = "404", description = "DataModel for instance {id} is not found")
      })
  public DataModel get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dataModel", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
          Include include)
      throws IOException {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getDataModelByFQN",
      summary = "Get a dataModel by fully qualified name",
      tags = "dataModels",
      description = "Get a dataModel by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The dataModel",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DataModel.class))),
        @ApiResponse(responseCode = "404", description = "DataModel for instance {fqn} is not found")
      })
  public DataModel getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Fully qualified name of the dataModel", schema = @Schema(type = "string"))
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
          Include include)
      throws IOException {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificDataModelVersion",
      summary = "Get a version of the dataModel",
      tags = "dataModels",
      description = "Get a version of the dataModel by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "dataModel",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DataModel.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataModel for instance {id} and version {version} is " + "not found")
      })
  public DataModel getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dataModel", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "DataModel version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createDataModel",
      summary = "Create a dataModel",
      tags = "dataModels",
      description = "Create a dataModel under an existing `service`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The dataModel",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DataModel.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDataModel create)
      throws IOException {
    DataModel dataModel = getDataModel(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, dataModel);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchDataModel",
      summary = "Update a dataModel",
      tags = "dataModels",
      description = "Update an existing dataModel using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dataModel", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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

  @PUT
  @Operation(
      operationId = "createOrUpdateDataModel",
      summary = "Create or update dataModel",
      tags = "dataModels",
      description = "Create a dataModel, it it does not exist or update an existing dataModel.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated dataModel ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DataModel.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDataModel create)
      throws IOException {
    DataModel dataModel = getDataModel(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, dataModel);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollowerToDataModel",
      summary = "Add a follower",
      tags = "dataModels",
      description = "Add a user identified by `userId` as followed of this data model",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "DataModel for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data model", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Id of the user to be added as follower", schema = @Schema(type = "UUID")) UUID userId)
      throws IOException {
    return dao.addFollower(securityContext.getUserPrincipal().getName(), id, userId).toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      operationId = "deleteFollowerFromDataModel",
      summary = "Remove a follower",
      tags = "dataModels",
      description = "Remove the user identified `userId` as a follower of the data model.")
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data model", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Id of the user being removed as follower", schema = @Schema(type = "UUID"))
          @PathParam("userId")
          UUID userId)
      throws IOException {
    return dao.deleteFollower(securityContext.getUserPrincipal().getName(), id, userId).toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteDataModel",
      summary = "Delete a data model by `id`.",
      tags = "dataModels",
      description = "Delete a dataModel by `id`.",
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
      @Parameter(description = "Id of the data model", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteDataModelByFQN",
      summary = "Delete a data model by fully qualified name.",
      tags = "dataModels",
      description = "Delete a data model by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "DataModel for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Fully qualified name of the data model", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn)
      throws IOException {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted data model.",
      tags = "dataModels",
      description = "Restore a soft deleted data model.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the data model",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DataModel.class)))
      })
  public Response restoreDataModel(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private DataModel getDataModel(CreateDataModel create, String user) throws IOException {
    DatabaseUtil.validateColumns(create.getColumns());
    return copy(new DataModel(), create, user)
        .withService(EntityUtil.getEntityReference(Entity.DASHBOARD_SERVICE, create.getService()))
        .withDataModelType(create.getDataModelType())
        .withSql(create.getSql())
        .withDataModelType(create.getDataModelType())
        .withServiceType(create.getServiceType())
        .withColumns(create.getColumns())
        .withTags(create.getTags());
  }
}
