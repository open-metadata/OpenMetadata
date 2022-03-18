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

package org.openmetadata.catalog.resources.dashboards;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

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
import org.openmetadata.catalog.api.data.CreateDashboard;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.DashboardRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.DeleteResponse;
import org.openmetadata.catalog.util.RestUtil.PatchResponse;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/dashboards")
@Api(value = "Dashboards collection", tags = "Dashboards collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "dashboards")
public class DashboardResource {
  public static final String COLLECTION_PATH = "v1/dashboards/";
  private final DashboardRepository dao;
  private final Authorizer authorizer;

  public static ResultList<Dashboard> addHref(UriInfo uriInfo, ResultList<Dashboard> dashboards) {
    listOrEmpty(dashboards.getData()).forEach(i -> addHref(uriInfo, i));
    return dashboards;
  }

  public static Dashboard addHref(UriInfo uriInfo, Dashboard dashboard) {
    Entity.withHref(uriInfo, dashboard.getOwner());
    Entity.withHref(uriInfo, dashboard.getService());
    Entity.withHref(uriInfo, dashboard.getCharts());
    Entity.withHref(uriInfo, dashboard.getFollowers());
    return dashboard;
  }

  public DashboardResource(CollectionDAO dao, Authorizer authorizer) {
    Objects.requireNonNull(dao, "DashboardRepository must not be null");
    this.dao = new DashboardRepository(dao);
    this.authorizer = authorizer;
  }

  public static class DashboardList extends ResultList<Dashboard> {
    @SuppressWarnings("unused")
    DashboardList() {
      // Empty constructor needed for deserialization
    }

    public DashboardList(List<Dashboard> data, String beforeCursor, String afterCursor, int total)
        throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "owner,charts,followers,tags,usageSummary";
  public static final List<String> ALLOWED_FIELDS = Entity.getEntityFields(Dashboard.class);

  @GET
  @Valid
  @Operation(
      summary = "List Dashboards",
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
          @Min(1)
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
      throws IOException, GeneralSecurityException, ParseException {
    RestUtil.validateCursors(before, after);
    Fields fields = new Fields(ALLOWED_FIELDS, fieldsParam);

    ResultList<Dashboard> dashboards;
    if (before != null) { // Reverse paging
      dashboards =
          dao.listBefore(uriInfo, fields, serviceParam, limitParam, before, include); // Ask for one extra entry
    } else { // Forward paging or first page
      dashboards = dao.listAfter(uriInfo, fields, serviceParam, limitParam, after, include);
    }
    return addHref(uriInfo, dashboards);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      summary = "List dashboard versions",
      tags = "dashboards",
      description = "Get a list of all the versions of a dashboard identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of dashboard versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Dashboard Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException, ParseException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a dashboard",
      tags = "dashboards",
      description = "Get a dashboard by `id`.",
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
    Fields fields = new Fields(ALLOWED_FIELDS, fieldsParam);
    return addHref(uriInfo, dao.get(uriInfo, id, fields, include));
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      summary = "Get a dashboard by name",
      tags = "dashboards",
      description = "Get a dashboard by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The dashboard",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Dashboard.class))),
        @ApiResponse(responseCode = "404", description = "Dashboard for instance {id} is not found")
      })
  public Dashboard getByName(
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
    Fields fields = new Fields(ALLOWED_FIELDS, fieldsParam);
    Dashboard dashboard = dao.getByName(uriInfo, fqn, fields, include);
    return addHref(uriInfo, dashboard);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
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
      @Parameter(description = "Dashboard Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "Dashboard version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException, ParseException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(
      summary = "Create a dashboard",
      tags = "dashboards",
      description = "Create a new dashboard.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The dashboard",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = CreateDashboard.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDashboard create)
      throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Dashboard dashboard = getDashboard(securityContext, create);
    dashboard = addHref(uriInfo, dao.create(uriInfo, dashboard));
    return Response.created(dashboard.getHref()).entity(dashboard).build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      summary = "Update a Dashboard",
      tags = "dashboards",
      description = "Update an existing dashboard using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
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
    Fields fields = new Fields(ALLOWED_FIELDS, FIELDS);
    Dashboard dashboard = dao.get(uriInfo, id, fields);
    SecurityUtil.checkAdminRoleOrPermissions(
        authorizer,
        securityContext,
        dao.getEntityInterface(dashboard).getEntityReference(),
        dao.getOwnerReference(dashboard),
        patch);

    PatchResponse<Dashboard> response =
        dao.patch(uriInfo, UUID.fromString(id), securityContext.getUserPrincipal().getName(), patch);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @PUT
  @Operation(
      summary = "Create or update a dashboard",
      tags = "dashboards",
      description = "Create a new dashboard, if it does not exist or update an existing dashboard.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The dashboard",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = CreateDashboard.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDashboard create)
      throws IOException, ParseException {
    Dashboard dashboard = getDashboard(securityContext, create);
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext, dao.getOriginalOwner(dashboard));
    PutResponse<Dashboard> response = dao.createOrUpdate(uriInfo, dashboard);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
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
      @Parameter(description = "Id of the dashboard", schema = @Schema(type = "string")) @PathParam("id") String id,
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
      tags = "dashboards",
      description = "Remove the user identified `userId` as a follower of the dashboard.")
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dashboard", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(description = "Id of the user being removed as follower", schema = @Schema(type = "string"))
          @PathParam("userId")
          String userId)
      throws IOException {
    return dao.deleteFollower(
            securityContext.getUserPrincipal().getName(), UUID.fromString(id), UUID.fromString(userId))
        .toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      summary = "Delete a Dashboard",
      tags = "dashboards",
      description = "Delete a dashboard by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Dashboard for instance {id} is not found")
      })
  public Response delete(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @PathParam("id") String id)
      throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    DeleteResponse<Dashboard> response = dao.delete(securityContext.getUserPrincipal().getName(), id);
    return response.toResponse();
  }

  private Dashboard getDashboard(SecurityContext securityContext, CreateDashboard create) {
    return new Dashboard()
        .withId(UUID.randomUUID())
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withDescription(create.getDescription())
        .withService(create.getService())
        .withCharts(create.getCharts())
        .withDashboardUrl(create.getDashboardUrl())
        .withTags(create.getTags())
        .withOwner(create.getOwner())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }
}
