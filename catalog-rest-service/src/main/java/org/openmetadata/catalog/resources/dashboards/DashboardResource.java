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
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.jdbi3.DashboardRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.SecurityUtil;
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

import javax.validation.Valid;
import javax.ws.rs.Consumes;
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

import java.io.IOException;
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
  public static final String COLLECTION_PATH = "/v1/dashboards/";
  private final List<String> attributes = RestUtil.getAttributes(Dashboard.class);
  private final List<String> relationships = RestUtil.getAttributes(Dashboard.class);

  private final DashboardRepository dao;
  private final CatalogAuthorizer authorizer;

  private static List<Dashboard> addHref(UriInfo uriInfo, List<Dashboard> dashboards) {
    Optional.ofNullable(dashboards).orElse(Collections.emptyList()).forEach(i -> addHref(uriInfo, i));
    return dashboards;
  }

  private static Dashboard addHref(UriInfo uriInfo, Dashboard dashboard) {
    dashboard.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, dashboard.getId()));
    return dashboard;
  }

  @Inject
  public DashboardResource(DashboardRepository dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "DashboardRepository must not be null");
    this.dao = dao;
    this.authorizer = authorizer;
  }

  static class DashboardList extends ResultList<Dashboard> {
    DashboardList(List<Dashboard> data) {
      super(data);
    }
  }

  static final String FIELDS ="owner,service,usageSummary";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replaceAll(" ", "")
          .split(","));
  @GET
  @Operation(summary = "List dashboards", tags = "dashboards",
          description = "Get a list of dashboards. Use `fields` parameter to get only necessary fields.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "List of dashboards",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = DashboardList.class)))
          })
  public DashboardList list(@Context UriInfo uriInfo,
                            @Context SecurityContext securityContext,
                            @Parameter(description = "Fields requested in the returned resource",
                                    schema = @Schema(type = "string", example = FIELDS))
                            @QueryParam("fields") String fieldsParam) throws IOException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return new DashboardList(addHref(uriInfo, dao.list(fields)));
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

  @POST
  @Operation(summary = "Create a dashboard", tags = "dashboards",
          description = "Create a new dashboard.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The dashboard",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Dashboard.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext,
                         @Valid Dashboard dashboard) throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    dashboard.setId(UUID.randomUUID());
    addHref(uriInfo, dao.create(dashboard, dashboard.getService(), dashboard.getOwner()));
    return Response.created(dashboard.getHref()).entity(dashboard).build();
  }

  @PUT
  @Operation(summary = "Create or update a dashboard", tags = "dashboards",
          description = "Create a new dashboard, if it does not exist or update an existing dashboard.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The dashboard",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Dashboard.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response createOrUpdate(@Context UriInfo uriInfo, @Context SecurityContext securityContext,
                                 @Valid Dashboard dashboard) throws IOException {
    dashboard.setId(UUID.randomUUID());
    PutResponse<Dashboard> response = dao.createOrUpdate(dashboard, dashboard.getService(), dashboard.getOwner());
    addHref(uriInfo, response.getEntity());
    return Response.status(response.getStatus()).entity(response.getEntity()).build();
  }
}
