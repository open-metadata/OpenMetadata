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

package org.openmetadata.service.resources.mlmodels;

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
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.MlModelRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Path("/v1/mlmodels")
@Api(value = "MlModels collection", tags = "MlModels collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "mlmodels")
public class MlModelResource extends EntityResource<MlModel, MlModelRepository> {
  public static final String COLLECTION_PATH = "v1/mlmodels/";

  @Override
  public MlModel addHref(UriInfo uriInfo, MlModel mlmodel) {
    mlmodel.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, mlmodel.getId()));
    Entity.withHref(uriInfo, mlmodel.getOwner());
    Entity.withHref(uriInfo, mlmodel.getDashboard());
    Entity.withHref(uriInfo, mlmodel.getService());
    Entity.withHref(uriInfo, mlmodel.getFollowers());
    return mlmodel;
  }

  public MlModelResource(CollectionDAO dao, Authorizer authorizer) {
    super(MlModel.class, new MlModelRepository(dao), authorizer);
  }

  public static class MlModelList extends ResultList<MlModel> {
    @SuppressWarnings("unused")
    MlModelList() {
      // Empty constructor needed for deserialization
    }
  }

  static final String FIELDS = "owner,dashboard,followers,tags,usageSummary,extension";

  @GET
  @Valid
  @Operation(
      operationId = "listMlModels",
      summary = "List ML Models",
      tags = "mlModels",
      description =
          "Get a list of mlmodels, optionally filtered by `service` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of models",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = MlModelList.class)))
      })
  public ResultList<MlModel> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter MlModels by service name",
              schema = @Schema(type = "string", example = "airflow"))
          @QueryParam("service")
          String serviceParam,
      @Parameter(description = "Limit the number models returned. (1 to 1000000, " + "default = 10)")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of models before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of models after this cursor", schema = @Schema(type = "string"))
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
  @Path("/{id}")
  @Operation(
      operationId = "getMlModelByID",
      summary = "Get an ML Model",
      tags = "mlModels",
      description = "Get an ML Model by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The model",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = MlModel.class))),
        @ApiResponse(responseCode = "404", description = "Model for instance {id} is not found")
      })
  public MlModel get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ML Model", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      operationId = "getMlModelByFQN",
      summary = "Get an ML Model by name",
      tags = "mlModels",
      description = "Get an ML Model by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The model",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = MlModel.class))),
        @ApiResponse(responseCode = "404", description = "Model for instance {fqn} is not found")
      })
  public MlModel getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Fully qualified name of ML Model", schema = @Schema(type = "string")) @PathParam("fqn")
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

  @POST
  @Operation(
      operationId = "createMlModel",
      summary = "Create an ML Model",
      tags = "mlModels",
      description = "Create a new ML Model.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "ML Model",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = MlModel.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateMlModel create)
      throws IOException {
    MlModel mlModel = getMlModel(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, mlModel);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchMlModel",
      summary = "Update an ML Model",
      tags = "mlModels",
      description = "Update an existing ML Model using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ML Model", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      operationId = "createOrUpdateMlModel",
      summary = "Create or update an ML Model",
      tags = "mlModels",
      description = "Create a new ML Model, if it does not exist or update an existing model.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The model",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = MlModel.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateMlModel create)
      throws IOException {
    MlModel mlModel = getMlModel(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, mlModel);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollower",
      summary = "Add a follower",
      tags = "mlModels",
      description = "Add a user identified by `userId` as follower of this model",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ML Model", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Id of the user to be added as follower", schema = @Schema(type = "UUID")) UUID userId)
      throws IOException {
    return dao.addFollower(securityContext.getUserPrincipal().getName(), id, userId).toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      operationId = "deleteFollower",
      summary = "Remove a follower",
      tags = "mlModels",
      description = "Remove the user identified `userId` as a follower of the model.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ChangeEvent.class))),
      })
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ML Model", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Id of the user being removed as follower", schema = @Schema(type = "UUID"))
          @PathParam("userId")
          UUID userId)
      throws IOException {
    return dao.deleteFollower(securityContext.getUserPrincipal().getName(), id, userId).toResponse();
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllMlModelVersion",
      summary = "List Ml Model versions",
      tags = "mlModels",
      description = "Get a list of all the versions of an Ml Model identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Ml Model versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ML Model", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificMlModelVersion",
      summary = "Get a version of the ML Model",
      tags = "mlModels",
      description = "Get a version of the ML Model by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "MlModel",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = MlModel.class))),
        @ApiResponse(
            responseCode = "404",
            description = "ML Model for instance {id} and version {version} is " + "not found")
      })
  public MlModel getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ML Model", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "ML Model version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteMlModel",
      summary = "Delete an ML Model",
      tags = "mlModels",
      description = "Delete an ML Model by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the ML Model", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteMlModelByFQN",
      summary = "Delete an ML Model",
      tags = "mlModels",
      description = "Delete an ML Model by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "model for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the ML Model", schema = @Schema(type = "string")) @PathParam("fqn") String fqn)
      throws IOException {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted MlModel.",
      tags = "mlModels",
      description = "Restore a soft deleted MlModel.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the MlModel ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = MlModel.class)))
      })
  public Response restoreMlModel(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private MlModel getMlModel(CreateMlModel create, String user) throws IOException {
    return copy(new MlModel(), create, user)
        .withService(getEntityReference(Entity.MLMODEL_SERVICE, create.getService()))
        .withDashboard(getEntityReference(Entity.DASHBOARD, create.getDashboard()))
        .withAlgorithm(create.getAlgorithm())
        .withMlFeatures(create.getMlFeatures())
        .withMlHyperParameters(create.getMlHyperParameters())
        .withMlStore(create.getMlStore())
        .withServer(create.getServer())
        .withTarget(create.getTarget())
        .withTags(create.getTags());
  }
}
