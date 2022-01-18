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

package org.openmetadata.catalog.resources.mlmodels;

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
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
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
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateMlModel;
import org.openmetadata.catalog.entity.data.MlModel;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.MlModelRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.PatchResponse;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/mlmodels")
@Api(value = "MlModels collection", tags = "MlModels collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "mlmodels")
public class MlModelResource {
  public static final String COLLECTION_PATH = "v1/mlmodels/";
  private final MlModelRepository dao;
  private final Authorizer authorizer;

  public static MlModel addHref(UriInfo uriInfo, MlModel mlmodel) {
    mlmodel.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, mlmodel.getId()));
    Entity.withHref(uriInfo, mlmodel.getOwner());
    Entity.withHref(uriInfo, mlmodel.getDashboard());
    Entity.withHref(uriInfo, mlmodel.getFollowers());
    return mlmodel;
  }

  public MlModelResource(CollectionDAO dao, Authorizer authorizer) {
    Objects.requireNonNull(dao, "ModelRepository must not be null");
    this.dao = new MlModelRepository(dao);
    this.authorizer = authorizer;
  }

  public static class MlModelList extends ResultList<MlModel> {
    @SuppressWarnings("unused")
    MlModelList() {
      // Empty constructor needed for deserialization
    }

    public MlModelList(List<MlModel> data, String beforeCursor, String afterCursor, int total)
        throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS =
      "owner,dashboard,algorithm,mlFeatures,mlHyperParameters,mlStore,server,target,followers,tags,usageSummary";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replace(" ", "").split(","));

  @GET
  @Valid
  @Operation(
      summary = "List ML Models",
      tags = "mlModels",
      description =
          "Get a list of ML Models. Use `fields` parameter to get only necessary fields. "
              + " Use cursor-based pagination to limit the number "
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
      @Parameter(description = "Limit the number models returned. (1 to 1000000, " + "default = 10)")
          @DefaultValue("10")
          @Min(1)
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
      throws IOException, GeneralSecurityException, ParseException {
    RestUtil.validateCursors(before, after);
    Fields fields = new Fields(FIELD_LIST, fieldsParam);

    ResultList<MlModel> mlmodels;
    if (before != null) { // Reverse paging
      mlmodels = dao.listBefore(uriInfo, fields, null, limitParam, before, include);
    } else { // Forward paging or first page
      mlmodels = dao.listAfter(uriInfo, fields, null, limitParam, after, include);
    }
    mlmodels.getData().forEach(m -> addHref(uriInfo, m));
    return mlmodels;
  }

  @GET
  @Path("/{id}")
  @Operation(
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
      @PathParam("id") String id,
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
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.get(uriInfo, id, fields, include));
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      summary = "Get an ML Model by name",
      tags = "mlModels",
      description = "Get an ML Model by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The model",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = MlModel.class))),
        @ApiResponse(responseCode = "404", description = "Model for instance {id} is not found")
      })
  public MlModel getByName(
      @Context UriInfo uriInfo,
      @PathParam("fqn") String fqn,
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
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.getByName(uriInfo, fqn, fields, include));
  }

  @POST
  @Operation(
      summary = "Create an ML Model",
      tags = "mlModels",
      description = "Create a new ML Model.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "ML Model",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreateMlModel.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateMlModel create)
      throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    MlModel mlModel = getMlModel(securityContext, create);
    mlModel = addHref(uriInfo, dao.create(uriInfo, mlModel));
    return Response.created(mlModel.getHref()).entity(mlModel).build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      summary = "Update an ML Model",
      tags = "mlModels",
      description = "Update an existing ML Model using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ML Model", schema = @Schema(type = "string")) @PathParam("id") String id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[" + "{op:remove, path:/a}," + "{op:add, path: /b, value: val}" + "]")
                      }))
          JsonPatch patch)
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, FIELDS);
    MlModel mlModel = dao.get(uriInfo, id, fields);
    SecurityUtil.checkAdminRoleOrPermissions(
        authorizer, securityContext, dao.getEntityInterface(mlModel).getEntityReference(), patch);

    PatchResponse<MlModel> response =
        dao.patch(uriInfo, UUID.fromString(id), securityContext.getUserPrincipal().getName(), patch);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @PUT
  @Operation(
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
      throws IOException, ParseException {
    MlModel mlModel = getMlModel(securityContext, create);
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext, dao.getOwnerReference(mlModel));
    PutResponse<MlModel> response = dao.createOrUpdate(uriInfo, mlModel);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      summary = "Add a follower",
      tags = "mlModels",
      description = "Add a user identified by `userId` as follower of this model",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the model", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(description = "Id of the user to be added as follower", schema = @Schema(type = "string"))
          String userId)
      throws IOException {
    return dao.addFollower(securityContext.getUserPrincipal().getName(), UUID.fromString(id), UUID.fromString(userId))
        .toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      summary = "Remove a follower",
      tags = "mlModels",
      description = "Remove the user identified `userId` as a follower of the model.")
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the model", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(description = "Id of the user being removed as follower", schema = @Schema(type = "string"))
          @PathParam("userId")
          String userId)
      throws IOException {
    return dao.deleteFollower(
            securityContext.getUserPrincipal().getName(), UUID.fromString(id), UUID.fromString(userId))
        .toResponse();
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
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
      @Parameter(description = "ML Model Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException, ParseException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
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
      @Parameter(description = "ML Model Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "ML Model version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException, ParseException {
    return dao.getVersion(id, version);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
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
      @Parameter(description = "Id of the ML Model", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    dao.delete(UUID.fromString(id), false);
    return Response.ok().build();
  }

  private MlModel getMlModel(SecurityContext securityContext, CreateMlModel create) {
    return new MlModel()
        .withId(UUID.randomUUID())
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withDescription(create.getDescription())
        .withDashboard(create.getDashboard())
        .withAlgorithm(create.getAlgorithm())
        .withMlFeatures(create.getMlFeatures())
        .withMlHyperParameters(create.getMlHyperParameters())
        .withMlStore(create.getMlStore())
        .withServer(create.getServer())
        .withTarget(create.getTarget())
        .withTags(create.getTags())
        .withOwner(create.getOwner())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }
}
