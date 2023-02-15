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

package org.openmetadata.service.resources.dashboards;

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
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DashboardRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ResultList;

@Path("/v1/dashboards")
@Api(value = "Dashboards collection", tags = "Dashboards collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "dashboards")
public class DashboardResource extends EntityResource<Dashboard, DashboardRepository> {
  public static final String COLLECTION_PATH = "v1/dashboards/";

  @Override
  public Dashboard addHref(UriInfo uriInfo, Dashboard dashboard) {
    Entity.withHref(uriInfo, dashboard.getOwner());
    Entity.withHref(uriInfo, dashboard.getService());
    Entity.withHref(uriInfo, dashboard.getCharts());
    Entity.withHref(uriInfo, dashboard.getFollowers());
    return dashboard;
  }

  public DashboardResource(CollectionDAO dao, Authorizer authorizer) {
    super(Dashboard.class, new DashboardRepository(dao), authorizer);
  }

  public static class DashboardList extends ResultList<Dashboard> {
    @SuppressWarnings("unused")
    DashboardList() {
      // Empty constructor needed for deserialization
    }
  }

  static final String FIELDS = "owner,charts,followers,tags,usageSummary,extension";

  @GET
  @Valid
  @Operation(
      operationId = "listDashboards",
      summary = "List dashboards",
      tags = "dashboards",
      description =
          "Get a list of dashboards, optionally filtered by `service` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of dashboards",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DashboardList.class)))
      })
  public ResultList<Dashboard> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter dashboards by service name",
              schema = @Schema(type = "string", example = "superset"))
          @QueryParam("service")
          String serviceParam,
      @Parameter(description = "Limit the number dashboards returned. (1 to 1000000, " + "default = 10)")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of dashboards before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of dashboards after this cursor", schema = @Schema(type = "string"))
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
      operationId = "listAllDashboardVersion",
      summary = "List dashboard versions",
      tags = "dashboards",
      description = "Get a list of all the versions of a dashboard identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of dashboard versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dashboard", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getDashboardByID",
      summary = "Get a dashboard by Id",
      tags = "dashboards",
      description = "Get a dashboard by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The dashboard",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Dashboard.class))),
        @ApiResponse(responseCode = "404", description = "Dashboard for instance {id} is not found")
      })
  public Dashboard get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dashboard", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      operationId = "getDashboardByFQN",
      summary = "Get a dashboard by fully qualified name",
      tags = "dashboards",
      description = "Get a dashboard by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The dashboard",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Dashboard.class))),
        @ApiResponse(responseCode = "404", description = "Dashboard for instance {fqn} is not found")
      })
  public Dashboard getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Fully qualified name of the dashboard", schema = @Schema(type = "string"))
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
      operationId = "getSpecificDashboardVersion",
      summary = "Get a version of the dashboard",
      tags = "dashboards",
      description = "Get a version of the dashboard by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "dashboard",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Dashboard.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Dashboard for instance {id} and version {version} is " + "not found")
      })
  public Dashboard getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dashboard", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "Dashboard version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createDashboard",
      summary = "Create a dashboard",
      tags = "dashboards",
      description = "Create a new dashboard.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The dashboard",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Dashboard.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDashboard create)
      throws IOException {
    Dashboard dashboard = getDashboard(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, dashboard);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchDashboard",
      summary = "Update a dashboard",
      tags = "dashboards",
      description = "Update an existing dashboard using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dashboard", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      operationId = "createOrUpdateDashboard",
      summary = "Create or update a dashboard",
      tags = "dashboards",
      description = "Create a new dashboard, if it does not exist or update an existing dashboard.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The dashboard",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Dashboard.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDashboard create)
      throws IOException {
    Dashboard dashboard = getDashboard(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, dashboard);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollowerToDashboard",
      summary = "Add a follower",
      tags = "dashboards",
      description = "Add a user identified by `userId` as follower of this dashboard",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Dashboard for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dashboard", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Id of the user to be added as follower", schema = @Schema(type = "UUID")) UUID userId)
      throws IOException {
    return dao.addFollower(securityContext.getUserPrincipal().getName(), id, userId).toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      operationId = "removeFollowerFromDashboard",
      summary = "Remove a follower",
      tags = "dashboards",
      description = "Remove the user identified `userId` as a follower of the dashboard.")
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dashboard", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Id of the user being removed as follower", schema = @Schema(type = "UUID"))
          @PathParam("userId")
          UUID userId)
      throws IOException {
    return dao.deleteFollower(securityContext.getUserPrincipal().getName(), id, userId).toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteDashboard",
      summary = "Delete a dashboard by Id",
      tags = "dashboards",
      description = "Delete a dashboard by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Dashboard for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the dashboard", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteDashboardByFQN",
      summary = "Delete a dashboard by fully qualified name",
      tags = "dashboards",
      description = "Delete a dashboard by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Dashboard for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Fully qualified name of the dashboard", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn)
      throws IOException {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted dashboard",
      tags = "dashboards",
      description = "Restore a soft deleted dashboard.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Dashboard.",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Dashboard.class)))
      })
  public Response restoreDashboard(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private Dashboard getDashboard(CreateDashboard create, String user) throws IOException {
    return copy(new Dashboard(), create, user)
        .withService(getEntityReference(Entity.DASHBOARD_SERVICE, create.getService()))
        .withCharts(getEntityReferences(Entity.CHART, create.getCharts()))
        .withDashboardUrl(create.getDashboardUrl())
        .withTags(create.getTags());
  }
}
