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

package org.openmetadata.catalog.resources.services.database;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

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

import com.google.inject.Inject;

import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.api.services.UpdateDatabaseService;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.DatabaseServiceRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.CatalogAuthorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;

@Path("/v1/services/databaseServices")
@Api(value = "Database service collection", tags = "Services -> Database service collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "databaseServices")
public class DatabaseServiceResource {
  private final DatabaseServiceRepository dao;
  private final CatalogAuthorizer authorizer;

  public static EntityReference addHref(UriInfo uriInfo, EntityReference service) {
    return service.withHref(RestUtil.getHref(uriInfo, "v1/services/databaseServices/", service.getId()));
  }

  private static List<DatabaseService> addHref(UriInfo uriInfo, List<DatabaseService> instances) {
    instances.forEach(i -> addHref(uriInfo, i));
    return instances;
  }

  private static DatabaseService addHref(UriInfo uriInfo, DatabaseService dbService) {
    dbService.setHref(RestUtil.getHref(uriInfo, "v1/services/databaseServices/", dbService.getId()));
    return dbService;
  }

  @Inject
  public DatabaseServiceResource(CollectionDAO dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "DatabaseServiceRepository must not be null");
    this.dao = new DatabaseServiceRepository(dao);
    this.authorizer = authorizer;
  }

  public static class DatabaseServiceList extends ResultList<DatabaseService> {
    public DatabaseServiceList(List<DatabaseService> data) {
      super(data);
    }
  }

  @GET
  @Operation(summary = "List database services", tags = "services",
          description = "Get a list of database services.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "List of database service instances",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = DatabaseServiceList.class)))
          })
  public ResultList<DatabaseService> list(@Context UriInfo uriInfo, 
                              @DefaultValue("10")
                              @Min(1)
                              @Max(1000000)
                              @QueryParam("limit") int limitParam,
                                          @Parameter(description = "Returns list of database services before this cursor",
                                          schema = @Schema(type = "string"))
                              @QueryParam("before") String before,
                                          @Parameter(description = "Returns list of database services after this cursor",
                                          schema = @Schema(type = "string"))
                              @QueryParam("after") String after) 
          throws IOException, GeneralSecurityException, ParseException {
    RestUtil.validateCursors(before, after);

    ResultList<DatabaseService> list;
    if(before == null) {
      list = dao.listBefore(null, null, limitParam, before);
    }
    else {
      list = dao.listAfter(null, null, limitParam, after);
    }
    list.getData().forEach(d -> addHref(uriInfo, d));
    
    return list;
  }

  @GET
  @Path("/{id}")
  @Operation(summary = "Get a database service", tags = "services",
          description = "Get a database service by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Database service instance",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = DatabaseService.class))),
                  @ApiResponse(responseCode = "404", description = "Database service for instance {id} is not found")
          })
  public DatabaseService get(@Context UriInfo uriInfo,
                             @Context SecurityContext securityContext,
                             @PathParam("id") String id) throws IOException, ParseException {
    return addHref(uriInfo, dao.get(id, null));
  }

  @GET
  @Path("/name/{name}")
  @Operation(summary = "Get database service by name", tags = "services",
          description = "Get a database service by the service `name`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Database service instance",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = DatabaseService.class))),
                  @ApiResponse(responseCode = "404", description = "Database service for instance {id} is not found")
          })
  public DatabaseService getByName(@Context UriInfo uriInfo,
                             @Context SecurityContext securityContext,
                             @PathParam("name") String name) throws IOException, ParseException {
    return addHref(uriInfo, dao.getByName(name, null));
  }

  @POST
  @Operation(summary = "Create database service", tags = "services",
          description = "Create a new database service.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Database service instance",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = CreateDatabaseService.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response create(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Valid CreateDatabaseService create) throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    DatabaseService databaseService = new DatabaseService().withId(UUID.randomUUID())
            .withName(create.getName()).withDescription(create.getDescription())
            .withServiceType(create.getServiceType()).withJdbc(create.getJdbc())
            .withIngestionSchedule(create.getIngestionSchedule())
            .withUpdatedBy(securityContext.getUserPrincipal().getName())
            .withUpdatedAt(new Date());

    addHref(uriInfo, dao.create(databaseService));
    return Response.created(databaseService.getHref()).entity(databaseService).build();
  }

  @PUT
  @Path("/{id}")
  @Operation(summary = "Update a database service", tags = "services",
          description = "Update an existing database service identified by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Database service instance",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = CreateDatabaseService.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response update(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Parameter(description = "Id of the database service", schema = @Schema(type = "string"))
                         @PathParam("id") String id,
                         @Valid UpdateDatabaseService update) throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    DatabaseService databaseService = addHref(uriInfo,
            dao.update(UUID.fromString(id), update.getDescription(), update.getJdbc(), update.getIngestionSchedule()));
    return Response.ok(databaseService).build();
  }

  @DELETE
  @Path("/{id}")
  @Operation(summary = "Delete a database service", tags = "services",
          description = "Delete a database services. If databases (and tables) belong the service, it can't be " +
                  "deleted.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "DatabaseService service for instance {id} " +
                          "is not found")
          })
  public Response delete(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Parameter(description = "Id of the database service", schema = @Schema(type = "string"))
                         @PathParam("id") String id) {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    dao.delete(UUID.fromString(id));
    return Response.ok().build();
  }
}
