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

package org.openmetadata.service.resources.services.mlmodel;

import static org.openmetadata.common.utils.CommonUtil.listOf;

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
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.services.CreateMlModelService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.MlModelConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.MlModelServiceRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.services.ServiceEntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.ResultList;

@Path("/v1/services/mlmodelServices")
@Tag(name = "ML Model Services")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "mlmodelServices")
public class MlModelServiceResource
    extends ServiceEntityResource<MlModelService, MlModelServiceRepository, MlModelConnection> {
  private final MlModelServiceMapper mapper = new MlModelServiceMapper();
  public static final String COLLECTION_PATH = "v1/services/mlmodelServices/";
  public static final String FIELDS = "pipelines,owners,tags,domain,followers";

  @Override
  public MlModelService addHref(UriInfo uriInfo, MlModelService service) {
    super.addHref(uriInfo, service);
    Entity.withHref(uriInfo, service.getPipelines());
    return service;
  }

  public MlModelServiceResource(Authorizer authorizer, Limits limits) {
    super(Entity.MLMODEL_SERVICE, authorizer, limits, ServiceType.ML_MODEL);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("pipelines", MetadataOperation.VIEW_BASIC);
    return listOf(MetadataOperation.VIEW_USAGE, MetadataOperation.EDIT_USAGE);
  }

  public static class MlModelServiceList extends ResultList<MlModelService> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listMlModelService",
      summary = "List ML model services",
      description =
          "Get a list of mlModel services. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of mlModel services",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MlModelServiceList.class)))
      })
  public ResultList<MlModelService> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter services by domain",
              schema = @Schema(type = "string", example = "Marketing"))
          @QueryParam("domain")
          String domain,
      @Parameter(description = "Limit number services returned. (1 to 1000000, default 10)")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of services before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of services after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return listInternal(
        uriInfo, securityContext, fieldsParam, include, domain, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getMlModelServiceByID",
      summary = "Get an ML model service by Id",
      description = "Get a mlModel service by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "MlModel service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MlModelService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "MlModel service for instance {id} is not found")
      })
  public MlModelService get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ML Model service", schema = @Schema(type = "UUID"))
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
    MlModelService mlModelService = getInternal(uriInfo, securityContext, id, fieldsParam, include);
    return decryptOrNullify(securityContext, mlModelService);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getMlModelServiceByFQN",
      summary = "Get an ML model service by name",
      description = "Get a mlModel service by the service `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "MlModel service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MlModelService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "MlModel service for instance {name} is not found")
      })
  public MlModelService getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the ML Model service", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
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
    MlModelService mlModelService =
        getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
    return decryptOrNullify(securityContext, mlModelService);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollowerToMlModelService",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as followed of this MlModel service",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(
            responseCode = "404",
            description = "MlModel Service for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the MlModel Service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user to be added as follower",
              schema = @Schema(type = "string"))
          UUID userId) {
    return repository
        .addFollower(securityContext.getUserPrincipal().getName(), id, userId)
        .toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      operationId = "deleteFollower",
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the entity.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class)))
      })
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user being removed as follower",
              schema = @Schema(type = "string"))
          @PathParam("userId")
          String userId) {
    return repository
        .deleteFollower(securityContext.getUserPrincipal().getName(), id, UUID.fromString(userId))
        .toResponse();
  }

  @PUT
  @Path("/{id}/testConnectionResult")
  @Operation(
      operationId = "addTestConnectionResult",
      summary = "Add test connection result",
      description = "Add test connection result to the service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully updated the service",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MlModelService.class)))
      })
  public MlModelService addTestConnectionResult(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Valid TestConnectionResult testConnectionResult) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.CREATE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    MlModelService service = repository.addTestConnectionResult(id, testConnectionResult);
    return decryptOrNullify(securityContext, service);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllMlModelServiceVersion",
      summary = "List ML model service versions",
      description = "Get a list of all the versions of a mlModel service identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of mlModel service versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ML Model service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    EntityHistory entityHistory = super.listVersionsInternal(securityContext, id);

    List<Object> versions =
        entityHistory.getVersions().stream()
            .map(
                json -> {
                  try {
                    MlModelService mlModelService =
                        JsonUtils.readValue((String) json, MlModelService.class);
                    return JsonUtils.pojoToJson(decryptOrNullify(securityContext, mlModelService));
                  } catch (Exception e) {
                    return json;
                  }
                })
            .collect(Collectors.toList());
    entityHistory.setVersions(versions);
    return entityHistory;
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificMlModelService",
      summary = "Get a version of the ML model service",
      description = "Get a version of the mlModel service by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "mlModel service",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MlModelService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "MlModel service for instance {id} and version {version} is not found")
      })
  public MlModelService getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ML Model service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "mlModel service version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    MlModelService mlModelService = super.getVersionInternal(securityContext, id, version);
    return decryptOrNullify(securityContext, mlModelService);
  }

  @POST
  @Operation(
      operationId = "createMlModelService",
      summary = "Create an ML model service",
      description = "Create a new mlModel service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "MlModel service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MlModelService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateMlModelService create) {
    MlModelService service =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    Response response = create(uriInfo, securityContext, service);
    decryptOrNullify(securityContext, (MlModelService) response.getEntity());
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateMlModelService",
      summary = "Update ML model service",
      description =
          "Create a new mlModel service or update an existing mlModel service identified by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "MlModel service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MlModelService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateMlModelService update) {
    MlModelService service =
        mapper.createToEntity(update, securityContext.getUserPrincipal().getName());
    Response response = createOrUpdate(uriInfo, securityContext, unmask(service));
    decryptOrNullify(securityContext, (MlModelService) response.getEntity());
    return response;
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchMlModelService",
      summary = "Update an ML model service",
      description = "Update an existing MlModelService service using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ML Model service", schema = @Schema(type = "UUID"))
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
      operationId = "patchMlModelService",
      summary = "Update an ML model service using name.",
      description = "Update an existing MlModelService service using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the ML Model service", schema = @Schema(type = "string"))
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

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteMlModelService",
      summary = "Delete an ML model service by Id",
      description =
          "Delete a mlModel services. If mlModels (and tasks) belong to the service, it can't be deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "MlModel service for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the ML Model service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteMlModelServiceAsync",
      summary = "Asynchronously delete an ML model service by Id",
      description =
          "Asynchronously delete a mlModel services. If mlModels (and tasks) belong to the service, it can't be deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "MlModel service for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the ML Model service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteMlModelServiceByName",
      summary = "Delete an ML model service by name",
      description =
          "Delete a mlModel services by `name`. If mlModels (and tasks) belong to the service, it can't be "
              + "deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "MlModel service for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the ML Model service", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    return deleteByName(uriInfo, securityContext, name, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted ML model service",
      description = "Restore a soft deleted Ml model service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the MlModelService ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MlModelService.class)))
      })
  public Response restoreTable(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @Override
  protected MlModelService nullifyConnection(MlModelService service) {
    return service.withConnection(null);
  }

  @Override
  protected String extractServiceType(MlModelService service) {
    return service.getServiceType().value();
  }
}
