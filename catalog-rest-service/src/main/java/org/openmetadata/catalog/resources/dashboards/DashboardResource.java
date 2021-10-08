/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.dashboards;

import com.google.inject.Inject;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import org.openmetadata.catalog.api.data.CreateDashboard;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.jdbi3.DashboardRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.openmetadata.catalog.security.CatalogAuthorizer;

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

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Path("/v1/dashboards")
@Api(value = "Dashboards collection", tags = "Dashboards collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "dashboards", repositoryClass = "org.openmetadata.catalog.jdbi3.DashboardRepository")
public class DashboardResource {
  public static final String DASHBOARD_COLLECTION_PATH = "v1/dashboards/";
  private final DashboardRepository dao;
  private final CatalogAuthorizer authorizer;

  public static void addHref(UriInfo uriInfo, EntityReference ref) {
    ref.withHref(RestUtil.getHref(uriInfo, DASHBOARD_COLLECTION_PATH, ref.getId()));
  }

  public static List<Dashboard> addHref(UriInfo uriInfo, List<Dashboard> dashboards) {
    Optional.ofNullable(dashboards).orElse(Collections.emptyList()).forEach(i -> addHref(uriInfo, i));
    return dashboards;
  }

  public static Dashboard addHref(UriInfo uriInfo, Dashboard dashboard) {
    dashboard.setHref(RestUtil.getHref(uriInfo, DASHBOARD_COLLECTION_PATH, dashboard.getId()));
    EntityUtil.addHref(uriInfo, dashboard.getOwner());
    EntityUtil.addHref(uriInfo, dashboard.getService());
    if (dashboard.getCharts() != null) {
      EntityUtil.addHref(uriInfo, dashboard.getCharts());
    }
    EntityUtil.addHref(uriInfo, dashboard.getFollowers());
    return dashboard;
  }

  @Inject
  public DashboardResource(DashboardRepository dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "DashboardRepository must not be null");
    this.dao = dao;
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

  static final String FIELDS = "owner,service,charts,followers,tags,usageSummary";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replaceAll(" ", "")
          .split(","));

  @GET
  @Valid
  @Operation(summary = "List Dashboards", tags = "dashboards",
          description = "Get a list of dashboards, optionally filtered by `service` it belongs to. Use `fields` " +
                  "parameter to get only necessary fields. Use cursor-based pagination to limit the number " +
                  "entries in the list using `limit` and `before` or `after` query params.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "List of dashboards",
                               content = @Content(mediaType = "application/json",
                                       schema = @Schema(implementation = DashboardList.class)))
          })
  public DashboardList list(@Context UriInfo uriInfo,
                                      @Context SecurityContext securityContext,
                                      @Parameter(description = "Fields requested in the returned resource",
                                              schema = @Schema(type = "string", example = FIELDS))
                                      @QueryParam("fields") String fieldsParam,
                                      @Parameter(description = "Filter dashboards by service name",
                                              schema = @Schema(type = "string", example = "superset"))
                                      @QueryParam("service") String serviceParam,
                                      @Parameter(description = "Limit the number dashboards returned. (1 to 1000000, " +
                                              "default = 10)")
                                      @DefaultValue("10")
                                      @Min(1)
                                      @Max(1000000)
                                      @QueryParam("limit") int limitParam,
                                      @Parameter(description = "Returns list of dashboards before this cursor",
                                              schema = @Schema(type = "string"))
                                      @QueryParam("before") String before,
                                      @Parameter(description = "Returns list of dashboards after this cursor",
                                              schema = @Schema(type = "string"))
                                      @QueryParam("after") String after
  ) throws IOException, GeneralSecurityException {
    RestUtil.validateCursors(before, after);
    Fields fields = new Fields(FIELD_LIST, fieldsParam);

    DashboardList dashboards;
    if (before != null) { // Reverse paging
      dashboards = dao.listBefore(fields, serviceParam, limitParam, before); // Ask for one extra entry
    } else { // Forward paging or first page
      dashboards = dao.listAfter(fields, serviceParam, limitParam, after);
    }
    addHref(uriInfo, dashboards.getData());
    return dashboards;
  }

  @GET
  @Path("/{id}")
  @Operation(summary = "Get a dashboard", tags = "dashboards",
          description = "Get a dashboard by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The dashboard",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Dashboard.class))),
                  @ApiResponse(responseCode = "404", description = "Dashboard for instance {id} is not found")
          })
  public Dashboard get(@Context UriInfo uriInfo,
                       @Context SecurityContext securityContext,
                       @PathParam("id") String id,
                       @Parameter(description = "Fields requested in the returned resource",
                               schema = @Schema(type = "string", example = FIELDS))
                       @QueryParam("fields") String fieldsParam) throws IOException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.get(id, fields));
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(summary = "Get a dashboard by name", tags = "dashboards",
          description = "Get a dashboard by fully qualified name.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The dashboard",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = Dashboard.class))),
                  @ApiResponse(responseCode = "404", description = "Dashboard for instance {id} is not found")
          })
  public Dashboard getByName(@Context UriInfo uriInfo, @PathParam("fqn") String fqn,
                            @Context SecurityContext securityContext,
                            @Parameter(description = "Fields requested in the returned resource",
                                    schema = @Schema(type = "string", example = FIELDS))
                            @QueryParam("fields") String fieldsParam) throws IOException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    Dashboard dashboard = dao.getByName(fqn, fields);
    return addHref(uriInfo, dashboard);
  }


  @POST
  @Operation(summary = "Create a dashboard", tags = "dashboards",
          description = "Create a new dashboard.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The dashboard",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = CreateDashboard.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext,
                         @Valid CreateDashboard create) throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Dashboard dashboard = new Dashboard().withId(UUID.randomUUID()).withName(create.getName())
            .withDisplayName(create.getDisplayName())
            .withDescription(create.getDescription()).withService(create.getService()).withCharts(create.getCharts())
            .withDashboardUrl(create.getDashboardUrl()).withTags(create.getTags())
            .withOwner(create.getOwner());
    dashboard = addHref(uriInfo, dao.create(dashboard, dashboard.getService(), dashboard.getOwner()));
    return Response.created(dashboard.getHref()).entity(dashboard).build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(summary = "Update a Dashboard", tags = "dashboards",
          description = "Update an existing dashboard using JsonPatch.",
          externalDocs = @ExternalDocumentation(description = "JsonPatch RFC",
                  url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Dashboard updateDescription(@Context UriInfo uriInfo,
                                     @Context SecurityContext securityContext,
                                     @PathParam("id") String id,
                                     @RequestBody(description = "JsonPatch with array of operations",
                                         content = @Content(mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                                                 examples = {@ExampleObject("[" +
                                                         "{op:remove, path:/a}," +
                                                         "{op:add, path: /b, value: val}" +
                                                         "]")}))
                                         JsonPatch patch) throws IOException {
    Fields fields = new Fields(FIELD_LIST, FIELDS);
    Dashboard dashboard = dao.get(id, fields);
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext,
            dao.getOwnerReference(dashboard));
    dashboard = dao.patch(id, patch);
    return addHref(uriInfo, dashboard);
  }

  @PUT
  @Operation(summary = "Create or update a dashboard", tags = "dashboards",
          description = "Create a new dashboard, if it does not exist or update an existing dashboard.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The dashboard",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = CreateDashboard.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response createOrUpdate(@Context UriInfo uriInfo,
                                 @Context SecurityContext securityContext,
                                 @Valid CreateDashboard create) throws IOException {
    Dashboard dashboard = new Dashboard().withId(UUID.randomUUID()).withName(create.getName())
            .withDisplayName(create.getDisplayName())
            .withDescription(create.getDescription()).withService(create.getService()).withCharts(create.getCharts())
            .withDashboardUrl(create.getDashboardUrl()).withTags(create.getTags())
            .withOwner(create.getOwner());

    PutResponse<Dashboard> response = dao.createOrUpdate(dashboard, dashboard.getService(), dashboard.getOwner());
    dashboard = addHref(uriInfo, response.getEntity());
    return Response.status(response.getStatus()).entity(dashboard).build();
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(summary = "Add a follower", tags = "dashboards",
          description = "Add a user identified by `userId` as follower of this dashboard",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "Dashboard for instance {id} is not found")
          })
  public Response addFollower(@Context UriInfo uriInfo,
                              @Context SecurityContext securityContext,
                              @Parameter(description = "Id of the dashboard", schema = @Schema(type = "string"))
                              @PathParam("id") String id,
                              @Parameter(description = "Id of the user to be added as follower",
                                      schema = @Schema(type = "string"))
                                      String userId) throws IOException {
    Fields fields = new Fields(FIELD_LIST, "followers");
    Response.Status status = dao.addFollower(id, userId);
    Dashboard dashboard = dao.get(id, fields);
    return Response.status(status).entity(dashboard).build();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(summary = "Remove a follower", tags = "dashboards",
          description = "Remove the user identified `userId` as a follower of the dashboard.")
  public Dashboard deleteFollower(@Context UriInfo uriInfo,
                              @Context SecurityContext securityContext,
                              @Parameter(description = "Id of the dashboard",
                                      schema = @Schema(type = "string"))
                              @PathParam("id") String id,
                              @Parameter(description = "Id of the user being removed as follower",
                                      schema = @Schema(type = "string"))
                              @PathParam("userId") String userId) throws IOException {
    Fields fields = new Fields(FIELD_LIST, "followers");
    dao.deleteFollower(id, userId);
    Dashboard dashboard = dao.get(id, fields);
    return addHref(uriInfo, dashboard);
  }

  @DELETE
  @Path("/{id}")
  @Operation(summary = "Delete a Dashboard", tags = "dashboards",
          description = "Delete a dashboard by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "Dashboard for instance {id} is not found")
          })
  public Response delete(@Context UriInfo uriInfo, @PathParam("id") String id) {
    dao.delete(id);
    return Response.ok().build();
  }
}
