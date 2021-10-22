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

package org.openmetadata.catalog.resources.services.dashboard;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.google.inject.Inject;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.openmetadata.catalog.api.services.CreateDashboardService;
import org.openmetadata.catalog.api.services.UpdateDashboardService;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.jdbi3.DashboardServiceRepositoryHelper;
import org.openmetadata.catalog.security.CatalogAuthorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;

import javax.validation.Valid;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
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
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Path("/v1/services/dashboardServices")
@Api(value = "Dashboard service collection", tags = "Services -> Dashboard service collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
//@Collection(name = "dashboardServices", repositoryClass = "org.openmetadata.catalog.jdbi3.DashboardServiceRepositoryHelper")
public class DashboardServiceResource {
  private final DashboardServiceRepositoryHelper dao;
  private final CatalogAuthorizer authorizer;

  public static EntityReference addHref(UriInfo uriInfo, EntityReference service) {
    return service.withHref(RestUtil.getHref(uriInfo, "v1/services/dashboardServices/", service.getId()));
  }

  private static List<DashboardService> addHref(UriInfo uriInfo, List<DashboardService> instances) {
    instances.forEach(i -> addHref(uriInfo, i));
    return instances;
  }

  private static DashboardService addHref(UriInfo uriInfo, DashboardService dashboardService) {
    dashboardService.setHref(RestUtil.getHref(uriInfo, "v1/services/dashboardServices/",
            dashboardService.getId()));
    return dashboardService;
  }

  @Inject
  public DashboardServiceResource(DashboardServiceRepositoryHelper dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "DashboardServiceRepositoryHelper must not be null");
    this.dao = dao;
    this.authorizer = authorizer;
  }

  public static class DashboardServiceList extends ResultList<DashboardService> {
    public DashboardServiceList(List<DashboardService> data) {
      super(data);
    }
  }

  @GET
  @Operation(summary = "List dashboard services", tags = "services",
          description = "Get a list of dashboard services.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "List of dashboard service instances",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = DashboardServiceList.class)))
          })
  public ResultList<DashboardService> list(@Context UriInfo uriInfo, @QueryParam("name") String name) throws IOException, GeneralSecurityException, ParseException {
    ResultList<DashboardService> list = dao.listAfter(null, null, 10000, null);
    list.getData().forEach(d -> addHref(uriInfo, d));
    return list;
  }

  @GET
  @Path("/{id}")
  @Operation(summary = "Get a dashboard service", tags = "services",
          description = "Get a dashboard service by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Dashboard service instance",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = DashboardService.class))),
                  @ApiResponse(responseCode = "404", description = "Dashboard service for instance {id} is not found")
          })
  public DashboardService get(@Context UriInfo uriInfo,
                             @Context SecurityContext securityContext,
                             @PathParam("id") String id) throws IOException, ParseException {
    return addHref(uriInfo, dao.get(id, null));
  }

  @GET
  @Path("/name/{name}")
  @Operation(summary = "Get dashboard service by name", tags = "services",
          description = "Get a dashboard service by the service `name`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Dashboard service instance",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = DashboardService.class))),
                  @ApiResponse(responseCode = "404", description = "Dashboard service for instance {id} is not found")
          })
  public DashboardService getByName(@Context UriInfo uriInfo,
                             @Context SecurityContext securityContext,
                             @PathParam("name") String name) throws IOException, ParseException {
    return addHref(uriInfo, dao.getByName(name, null));
  }

  @POST
  @Operation(summary = "Create a dashboard service", tags = "services",
          description = "Create a new dashboard service.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Dashboard service instance",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = CreateDashboardService.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response create(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Valid CreateDashboardService create) throws JsonProcessingException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    DashboardService service = new DashboardService().withId(UUID.randomUUID())
            .withName(create.getName()).withDescription(create.getDescription())
            .withServiceType(create.getServiceType())
            .withDashboardUrl(create.getDashboardUrl())
            .withUsername(create.getUsername())
            .withPassword(create.getPassword())
            .withIngestionSchedule(create.getIngestionSchedule())
            .withUpdatedBy(securityContext.getUserPrincipal().getName())
            .withUpdatedAt(new Date());

    addHref(uriInfo, dao.create(service));
    return Response.created(service.getHref()).entity(service).build();
  }

  @PUT
  @Path("/{id}")
  @Operation(summary = "Update a Dashboard service", tags = "services",
          description = "Update an existing dashboard service identified by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Dashboard service instance",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = CreateDashboardService.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response update(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Parameter(description = "Id of the dashboard service", schema = @Schema(type = "string"))
                         @PathParam("id") String id,
                         @Valid UpdateDashboardService update) throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    DashboardService service = addHref(uriInfo,
            dao.update(id, update.getDescription(), update.getDashboardUrl(), update.getUsername(),
                    update.getPassword(), update.getIngestionSchedule()));
    return Response.ok(service).build();
  }

  @DELETE
  @Path("/{id}")
  @Operation(summary = "Delete a Dashboard service", tags = "services",
          description = "Delete a Dashboard services. If dashboard (and charts) belong to the service, it can't be " +
                  "deleted.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "DashboardService service for instance {id} " +
                          "is not found")
          })
  public Response delete(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Parameter(description = "Id of the dashboard service", schema = @Schema(type = "string"))
                         @PathParam("id") String id) {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    dao.delete(id);
    return Response.ok().build();
  }
}
