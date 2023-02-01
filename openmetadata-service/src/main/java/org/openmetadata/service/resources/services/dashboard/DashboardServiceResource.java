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

package org.openmetadata.service.resources.services.dashboard;

import static org.openmetadata.service.Entity.FIELD_OWNER;

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
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.DashboardConnection;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DashboardServiceRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.services.ServiceEntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Path("/v1/services/dashboardServices")
@Api(value = "Dashboard service collection", tags = "Services -> Dashboard service collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "dashboardServices")
public class DashboardServiceResource
    extends ServiceEntityResource<DashboardService, DashboardServiceRepository, DashboardConnection> {
  public static final String COLLECTION_PATH = "v1/services/dashboardServices";
  static final String FIELDS = FIELD_OWNER;

  @Override
  public DashboardService addHref(UriInfo uriInfo, DashboardService service) {
    service.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, service.getId()));
    Entity.withHref(uriInfo, service.getOwner());
    return service;
  }

  public DashboardServiceResource(CollectionDAO dao, Authorizer authorizer) {

    super(DashboardService.class, new DashboardServiceRepository(dao), authorizer, ServiceType.DASHBOARD);
  }

  public static class DashboardServiceList extends ResultList<DashboardService> {
    @SuppressWarnings("unused") /* Required for tests */
    public DashboardServiceList() {}
  }

  @GET
  @Operation(
      operationId = "listDashboardsService",
      summary = "List dashboard services",
      tags = "dashboardServices",
      description = "Get a list of dashboard services.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of dashboard service instances",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DashboardServiceList.class)))
      })
  public ResultList<DashboardService> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @QueryParam("name") String name,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @DefaultValue("10") @Min(0) @Max(1000000) @QueryParam("limit") int limitParam,
      @Parameter(
              description = "Returns list of dashboard services before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of dashboard services after this cursor",
              schema = @Schema(type = "string"))
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
    ResultList<DashboardService> dashboardServices =
        listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
    return addHref(uriInfo, decryptOrNullify(securityContext, dashboardServices));
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getDashboardServiceByID",
      summary = "Get a dashboard service",
      tags = "dashboardServices",
      description = "Get a dashboard service by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Dashboard service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DashboardService.class))),
        @ApiResponse(responseCode = "404", description = "Dashboard service for instance {id} is not found")
      })
  public DashboardService get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dashboard service", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
    DashboardService dashboardService = getInternal(uriInfo, securityContext, id, fieldsParam, include);
    return decryptOrNullify(securityContext, dashboardService);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getDashboardServiceByFQN",
      summary = "Get dashboard service by name",
      tags = "dashboardServices",
      description = "Get a dashboard service by the service `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Dashboard service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DashboardService.class))),
        @ApiResponse(responseCode = "404", description = "Dashboard service for instance {name} is not found")
      })
  public DashboardService getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the dashboard service", schema = @Schema(type = "string")) @PathParam("name")
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
          Include include)
      throws IOException {
    DashboardService dashboardService = getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
    return decryptOrNullify(securityContext, dashboardService);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllDashboardServiceVersion",
      summary = "List dashboard service versions",
      tags = "dashboardServices",
      description = "Get a list of all the versions of a dashboard service identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of dashboard service versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dashboard service", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    EntityHistory entityHistory = super.listVersionsInternal(securityContext, id);

    List<Object> versions =
        entityHistory.getVersions().stream()
            .map(
                json -> {
                  try {
                    DashboardService dashboardService = JsonUtils.readValue((String) json, DashboardService.class);
                    return JsonUtils.pojoToJson(decryptOrNullify(securityContext, dashboardService));
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
      operationId = "getSpecificDashboardServiceVersion",
      summary = "Get a version of the dashboard service",
      tags = "dashboardServices",
      description = "Get a version of the dashboard service by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "dashboard service",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DashboardService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Dashboard service for instance {id} and version " + "{version} is not found")
      })
  public DashboardService getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dashboard service", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "dashboard service version number in the form `major`" + ".`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    DashboardService dashboardService = super.getVersionInternal(securityContext, id, version);
    return decryptOrNullify(securityContext, dashboardService);
  }

  @POST
  @Operation(
      operationId = "createDashboardService",
      summary = "Create a dashboard service",
      tags = "dashboardServices",
      description = "Create a new dashboard service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Dashboard service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DashboardService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDashboardService create)
      throws IOException {
    DashboardService service = getService(create, securityContext.getUserPrincipal().getName());
    Response response = create(uriInfo, securityContext, service);
    decryptOrNullify(securityContext, (DashboardService) response.getEntity());
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateDashboardService",
      summary = "Update a Dashboard service",
      tags = "dashboardServices",
      description = "Update an existing dashboard service identified by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Dashboard service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DashboardService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDashboardService update)
      throws IOException {
    DashboardService service = getService(update, securityContext.getUserPrincipal().getName());
    Response response = createOrUpdate(uriInfo, securityContext, service);
    decryptOrNullify(securityContext, (DashboardService) response.getEntity());
    return response;
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchDashboardService",
      summary = "Update a dashboard service",
      tags = "dashboardServices",
      description = "Update an existing dashboard service using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dashboard service", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      operationId = "deleteDashboardService",
      summary = "Delete a Dashboard service",
      tags = "dashboardServices",
      description =
          "Delete a Dashboard services. If dashboard (and charts) belong to the service, it can't be " + "deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "DashboardService service for instance {id} " + "is not found")
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
      @Parameter(description = "Id of the dashboard service", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteDashboardServiceByName",
      summary = "Delete a Dashboard service",
      tags = "dashboardServices",
      description =
          "Delete a Dashboard services by `name`. If dashboard (and charts) belong to the service, it can't be "
              + "deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "DashboardService service for instance {name} " + "is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the dashboard service", schema = @Schema(type = "string")) @PathParam("name")
          String name)
      throws IOException {
    return deleteByName(uriInfo, securityContext, name, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted DashboardService.",
      tags = "dashboardServices",
      description = "Restore a soft deleted DashboardService.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Chart ",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DashboardService.class)))
      })
  public Response restoreDashboardService(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private DashboardService getService(CreateDashboardService create, String user) throws IOException {
    return copy(new DashboardService(), create, user)
        .withServiceType(create.getServiceType())
        .withConnection(create.getConnection());
  }

  @Override
  protected DashboardService nullifyConnection(DashboardService service) {
    return service.withConnection(null);
  }

  @Override
  protected String extractServiceType(DashboardService service) {
    return service.getServiceType().value();
  }
}
