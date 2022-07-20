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

package org.openmetadata.catalog.resources.services.mlmodel;

import static org.openmetadata.catalog.security.SecurityUtil.ADMIN;
import static org.openmetadata.catalog.security.SecurityUtil.BOT;
import static org.openmetadata.catalog.security.SecurityUtil.OWNER;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;
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
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreateMlModelService;
import org.openmetadata.catalog.entity.services.MlModelService;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.jdbi3.MlModelServiceRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.resources.services.ServiceEntityResource;
import org.openmetadata.catalog.secrets.SecretsManager;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.MlModelConnection;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/services/mlmodelServices")
@Api(value = "MlModel service collection", tags = "Services -> MlModel service collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "mlmodelServices")
public class MlModelServiceResource
    extends ServiceEntityResource<MlModelService, MlModelServiceRepository, MlModelConnection> {
  public static final String COLLECTION_PATH = "v1/services/mlmodelServices/";

  public static final String FIELDS = "pipelines,owner";

  @Override
  public MlModelService addHref(UriInfo uriInfo, MlModelService service) {
    service.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, service.getId()));
    Entity.withHref(uriInfo, service.getOwner());
    Entity.withHref(uriInfo, service.getPipelines());
    return service;
  }

  public MlModelServiceResource(CollectionDAO dao, Authorizer authorizer, SecretsManager secretsManager) {
    super(MlModelService.class, new MlModelServiceRepository(dao, secretsManager), authorizer, secretsManager);
  }

  public static class MlModelServiceList extends ResultList<MlModelService> {
    @SuppressWarnings("unused") /* Required for tests */
    public MlModelServiceList() {}

    public MlModelServiceList(List<MlModelService> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  @GET
  @Operation(
      operationId = "listMlModelService",
      summary = "List mlModel services",
      tags = "mlModelService",
      description =
          "Get a list of mlModel services. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of mlModel services",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = MlModelServiceList.class)))
      })
  public ResultList<MlModelService> list(
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
    ResultList<MlModelService> mlModelServices =
        super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
    return addHref(uriInfo, decryptOrNullify(securityContext, mlModelServices));
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getMlModelServiceByID",
      summary = "Get a mlModel service",
      tags = "mlModelService",
      description = "Get a mlModel service by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "MlModel service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = MlModelService.class))),
        @ApiResponse(responseCode = "404", description = "MlModel service for instance {id} is not found")
      })
  public MlModelService get(
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
      throws IOException {
    MlModelService mlModelService = getInternal(uriInfo, securityContext, id, fieldsParam, include);
    return decryptOrNullify(securityContext, mlModelService);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getMlModelServiceByFQN",
      summary = "Get mlModel service by name",
      tags = "mlModelService",
      description = "Get a mlModel service by the service `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "MlModel service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = MlModelService.class))),
        @ApiResponse(responseCode = "404", description = "MlModel service for instance {id} is not found")
      })
  public MlModelService getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("name") String name,
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
    MlModelService mlModelService = getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
    return decryptOrNullify(securityContext, mlModelService);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllMlModelServiceVersion",
      summary = "List mlModel service versions",
      tags = "mlModelService",
      description = "Get a list of all the versions of a mlModel service identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of mlModel service versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "mlModel service Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    EntityHistory entityHistory = dao.listVersions(id);
    List<Object> versions =
        entityHistory.getVersions().stream()
            .map(
                json -> {
                  try {
                    MlModelService mlModelService = JsonUtils.readValue((String) json, MlModelService.class);
                    return JsonUtils.pojoToJson(decryptOrNullify(securityContext, mlModelService));
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
      operationId = "getSpecificMlModelService",
      summary = "Get a version of the mlModel service",
      tags = "mlModelService",
      description = "Get a version of the mlModel service by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "mlModel service",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = MlModelService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "MlModel service for instance {id} and version " + "{version} is not found")
      })
  public MlModelService getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "mlModel service Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "mlModel service version number in the form `major`" + ".`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    MlModelService mlModelService = dao.getVersion(id, version);
    return decryptOrNullify(securityContext, mlModelService);
  }

  @POST
  @Operation(
      operationId = "createMlModelService",
      summary = "Create a mlModel service",
      tags = "mlModelService",
      description = "Create a new mlModel service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "MlModel service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = MlModelService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateMlModelService create)
      throws IOException {
    MlModelService service = getService(create, securityContext.getUserPrincipal().getName());
    Response response = create(uriInfo, securityContext, service, ADMIN | BOT);
    decryptOrNullify(securityContext, (MlModelService) response.getEntity());
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateMlModelService",
      summary = "Update mlModel service",
      tags = "mlModelService",
      description = "Create a new mlModel service or update an existing mlModel service identified by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "MlModel service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = MlModelService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateMlModelService update)
      throws IOException {
    MlModelService service = getService(update, securityContext.getUserPrincipal().getName());
    Response response = createOrUpdate(uriInfo, securityContext, service, ADMIN | BOT | OWNER);
    decryptOrNullify(securityContext, (MlModelService) response.getEntity());
    return response;
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteMlModelService",
      summary = "Delete a mlModel service",
      tags = "mlModelService",
      description =
          "Delete a mlModel services. If mlModels (and tasks) belong to the service, it can't be " + "deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "MlModel service for instance {id} " + "is not found")
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
      @Parameter(description = "Id of the mlModel service", schema = @Schema(type = "string")) @PathParam("id")
          String id)
      throws IOException {
    return delete(uriInfo, securityContext, id, recursive, hardDelete, ADMIN | BOT);
  }

  private MlModelService getService(CreateMlModelService create, String user) {
    return copy(new MlModelService(), create, user)
        .withServiceType(create.getServiceType())
        .withConnection(create.getConnection());
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
