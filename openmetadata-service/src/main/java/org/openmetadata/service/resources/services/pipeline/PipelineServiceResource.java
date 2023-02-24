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

package org.openmetadata.service.resources.services.pipeline;

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
import java.util.UUID;
import java.util.stream.Collectors;
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
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.services.CreatePipelineService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.PipelineConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.PipelineServiceRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.services.ServiceEntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Path("/v1/services/pipelineServices")
@Api(value = "Pipeline service collection", tags = "Services -> Pipeline service collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "pipelineServices")
public class PipelineServiceResource
    extends ServiceEntityResource<PipelineService, PipelineServiceRepository, PipelineConnection> {
  public static final String COLLECTION_PATH = "v1/services/pipelineServices/";
  static final String FIELDS = "pipelines,owner";

  @Override
  public PipelineService addHref(UriInfo uriInfo, PipelineService service) {
    service.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, service.getId()));
    Entity.withHref(uriInfo, service.getOwner());
    Entity.withHref(uriInfo, service.getPipelines());
    return service;
  }

  public PipelineServiceResource(CollectionDAO dao, Authorizer authorizer) {
    super(PipelineService.class, new PipelineServiceRepository(dao), authorizer, ServiceType.PIPELINE);
  }

  public static class PipelineServiceList extends ResultList<PipelineService> {
    @SuppressWarnings("unused") /* Required for tests */
    public PipelineServiceList() {}
  }

  @GET
  @Operation(
      operationId = "listPipelineService",
      summary = "List pipeline services",
      tags = "pipelineServices",
      description =
          "Get a list of pipeline services. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of pipeline services",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = PipelineServiceList.class)))
      })
  public ResultList<PipelineService> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit number services returned. (1 to 1000000, " + "default 10)")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of services before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of services after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    ListFilter filter = new ListFilter(include);
    ResultList<PipelineService> pipelineServices =
        super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
    return addHref(uriInfo, decryptOrNullify(securityContext, pipelineServices));
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getPipelineServiceByID",
      summary = "Get a pipeline service by Id",
      tags = "pipelineServices",
      description = "Get a pipeline service by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Pipeline service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = PipelineService.class))),
        @ApiResponse(responseCode = "404", description = "Pipeline service for instance {id} is not found")
      })
  public PipelineService get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the pipeline service", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
    PipelineService pipelineService = getInternal(uriInfo, securityContext, id, fieldsParam, include);
    return decryptOrNullify(securityContext, pipelineService);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getPipelineServiceByFQN",
      summary = "Get pipeline service by fully qualified name",
      tags = "pipelineServices",
      description = "Get a pipeline service by the service `fullyQualifiedName`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Pipeline service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = PipelineService.class))),
        @ApiResponse(responseCode = "404", description = "Pipeline service for instance {fqn} is not found")
      })
  public PipelineService getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fully qualified name of the pipeline service", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
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
    PipelineService pipelineService = getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
    return decryptOrNullify(securityContext, pipelineService);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllPipelineServiceVersion",
      summary = "List pipeline service versions",
      tags = "pipelineServices",
      description = "Get a list of all the versions of a pipeline service identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of pipeline service versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the pipeline service", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    EntityHistory entityHistory = super.listVersionsInternal(securityContext, id);

    List<Object> versions =
        entityHistory.getVersions().stream()
            .map(
                json -> {
                  try {
                    PipelineService pipelineService = JsonUtils.readValue((String) json, PipelineService.class);
                    return JsonUtils.pojoToJson(decryptOrNullify(securityContext, pipelineService));
                  } catch (IOException e) {
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
      operationId = "getSpecificPipelineService",
      summary = "Get a version of the pipeline service",
      tags = "pipelineServices",
      description = "Get a version of the pipeline service by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "pipeline service",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = PipelineService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Pipeline service for instance {id} and version " + "{version} is not found")
      })
  public PipelineService getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the pipeline service", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "pipeline service version number in the form `major`" + ".`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    PipelineService pipelineService = super.getVersionInternal(securityContext, id, version);
    return decryptOrNullify(securityContext, pipelineService);
  }

  @POST
  @Operation(
      operationId = "createPipelineService",
      summary = "Create a pipeline service",
      tags = "pipelineServices",
      description = "Create a new pipeline service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Pipeline service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = PipelineService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreatePipelineService create)
      throws IOException {
    PipelineService service = getService(create, securityContext.getUserPrincipal().getName());
    Response response = create(uriInfo, securityContext, service);
    decryptOrNullify(securityContext, (PipelineService) response.getEntity());
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdatePipelineService",
      summary = "Update pipeline service",
      tags = "pipelineServices",
      description = "Create a new pipeline service or update an existing pipeline service identified by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Pipeline service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = PipelineService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreatePipelineService update)
      throws IOException {
    PipelineService service = getService(update, securityContext.getUserPrincipal().getName());
    Response response = createOrUpdate(uriInfo, securityContext, service);
    decryptOrNullify(securityContext, (PipelineService) response.getEntity());
    return response;
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchPipelineService",
      summary = "Update a pipeline service",
      tags = "pipelineServices",
      description = "Update an existing pipeline service using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the pipeline service", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
  @Operation(
      operationId = "deletePipelineService",
      summary = "Delete a pipeline service by Id",
      tags = "pipelineServices",
      description =
          "Delete a pipeline services. If pipelines (and tasks) belong to the service, it can't be " + "deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Pipeline service for instance {id} " + "is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the pipeline service", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deletePipelineServiceByName",
      summary = "Delete a pipeline service by fully qualified name",
      tags = "pipelineServices",
      description =
          "Delete a pipeline services by `fullyQualifiedName`. If pipelines (and tasks) belong to the service, it can't be "
              + "deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Pipeline service for instance {fqn} " + "is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Fully qualified name of the pipeline service", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn)
      throws IOException {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted pipeline service.",
      tags = "pipelineServices",
      description = "Restore a soft deleted pipeline service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the PipelineService ",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = PipelineService.class)))
      })
  public Response restorePipelineService(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private PipelineService getService(CreatePipelineService create, String user) throws IOException {
    return copy(new PipelineService(), create, user)
        .withServiceType(create.getServiceType())
        .withConnection(create.getConnection());
  }

  @Override
  protected PipelineService nullifyConnection(PipelineService service) {
    return service.withConnection(null);
  }

  @Override
  protected String extractServiceType(PipelineService service) {
    return service.getServiceType().value();
  }
}
