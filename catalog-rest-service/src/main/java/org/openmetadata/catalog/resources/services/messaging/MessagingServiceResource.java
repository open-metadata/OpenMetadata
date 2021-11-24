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

package org.openmetadata.catalog.resources.services.messaging;

import com.google.inject.Inject;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.openmetadata.catalog.api.services.CreateMessagingService;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.MessagingServiceRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.CatalogAuthorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

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
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Path("/v1/services/messagingServices")
@Api(value = "Messaging service collection", tags = "Services -> Messaging service collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "messagingServices")
public class MessagingServiceResource {
  public static final String COLLECTION_PATH = "v1/services/messagingServices/";
  private final MessagingServiceRepository dao;
  private final CatalogAuthorizer authorizer;

  @Inject
  public MessagingServiceResource(CollectionDAO dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "MessagingServiceRepository must not be null");
    this.dao = new MessagingServiceRepository(dao);
    this.authorizer = authorizer;
  }

  public static class MessagingServiceList extends ResultList<MessagingService> {
    @SuppressWarnings("unused") /* Required for tests */
    public MessagingServiceList() {}

    public MessagingServiceList(List<MessagingService> data, String beforeCursor, String afterCursor, int total)
            throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  @GET
  @Operation(summary = "List messaging services", tags = "services",
          description = "Get a list of messaging services. Use cursor-based pagination to limit the number " +
                  "entries in the list using `limit` and `before` or `after` query params.",
          responses = {@ApiResponse(responseCode = "200", description = "List of messaging services",
                  content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = MessagingServiceList.class)))
          })
  public ResultList<MessagingService> list(@Context UriInfo uriInfo,
                                           @Context SecurityContext securityContext,
                                           @Parameter(description = "Limit number services returned. (1 to 1000000, " +
                                                   "default 10)")
                                           @DefaultValue("10")
                                           @Min(1)
                                           @Max(1000000)
                                           @QueryParam("limit") int limitParam,
                                           @Parameter(description = "Returns list of services before this cursor",
                                                   schema = @Schema(type = "string"))
                                           @QueryParam("before") String before,
                                           @Parameter(description = "Returns list of services after this cursor",
                                                   schema = @Schema(type = "string"))
                                           @QueryParam("after") String after)
          throws IOException, ParseException, GeneralSecurityException {
    RestUtil.validateCursors(before, after);
    if (before != null) { // Reverse paging
      return dao.listBefore(uriInfo, null, null, limitParam, before);
    }
    // Forward paging or first page
    return dao.listAfter(uriInfo, null, null, limitParam, after);
  }

  @GET
  @Path("/{id}")
  @Operation(summary = "Get a messaging service", tags = "services",
          description = "Get a messaging service by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Messaging service instance",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = MessagingService.class))),
                  @ApiResponse(responseCode = "404", description = "Messaging service for instance {id} is not found")
          })
  public MessagingService get(@Context UriInfo uriInfo,
                             @Context SecurityContext securityContext,
                             @PathParam("id") String id) throws IOException, ParseException {
    MessagingService service = dao.get(uriInfo, id, null);
    System.out.println("Ingestion schedule in request " + service.getIngestionSchedule());
    return service;
  }

  @GET
  @Path("/name/{name}")
  @Operation(summary = "Get messaging service by name", tags = "services",
          description = "Get a messaging service by the service `name`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Messaging service instance",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = MessagingService.class))),
                  @ApiResponse(responseCode = "404", description = "Messaging service for instance {id} is not found")
          })
  public MessagingService getByName(@Context UriInfo uriInfo,
                             @Context SecurityContext securityContext,
                             @PathParam("name") String name) throws IOException, ParseException {
    return dao.getByName(uriInfo, name, null);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(summary = "List messaging service versions", tags = "services",
          description = "Get a list of all the versions of a messaging service identified by `id`",
          responses = {@ApiResponse(responseCode = "200", description = "List of messaging service versions",
                  content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = EntityHistory.class)))
          })
  public EntityHistory listVersions(@Context UriInfo uriInfo,
                                    @Context SecurityContext securityContext,
                                    @Parameter(description = "messaging service Id", schema = @Schema(type = "string"))
                                    @PathParam("id") String id)
          throws IOException, ParseException, GeneralSecurityException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(summary = "Get a version of the messaging service", tags = "services",
          description = "Get a version of the messaging service by given `id`",
          responses = {
                  @ApiResponse(responseCode = "200", description = "messaging service",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = MessagingService.class))),
                  @ApiResponse(responseCode = "404", description = "Messaging s3rvice for instance {id} and version " +
                          "{version} is not found")
          })
  public MessagingService getVersion(@Context UriInfo uriInfo,
                          @Context SecurityContext securityContext,
                          @Parameter(description = "messaging service Id", schema = @Schema(type = "string"))
                          @PathParam("id") String id,
                          @Parameter(description = "messaging service version number in the form `major`.`minor`",
                                  schema = @Schema(type = "string", example = "0.1 or 1.1"))
                          @PathParam("version") String version) throws IOException, ParseException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(summary = "Create a messaging service", tags = "services",
          description = "Create a new messaging service.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Messaging service instance",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = CreateMessagingService.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response create(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Valid CreateMessagingService create) throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    MessagingService service = getService(create, securityContext);
    dao.create(uriInfo, service);
    return Response.created(service.getHref()).entity(service).build();
  }

  @PUT
  @Operation(summary = "Update a messaging service", tags = "services",
          description = "Create a new messaging service or Update an existing messaging service identified by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Messaging service instance",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = CreateMessagingService.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response update(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Parameter(description = "Id of the messaging service", schema = @Schema(type = "string"))
                         @PathParam("id") String id,
                         @Valid CreateMessagingService update) throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    MessagingService service = getService(update, securityContext);
    PutResponse<MessagingService> response = dao.createOrUpdate(uriInfo, service);
    return response.toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(summary = "Delete a messaging service", tags = "services",
          description = "Delete a messaging service. If topics belong the service, it can't be " +
                  "deleted.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "MessagingService service for instance {id} " +
                          "is not found")
          })
  public Response delete(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Parameter(description = "Id of the messaging service", schema = @Schema(type = "string"))
                         @PathParam("id") String id) {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    dao.delete(UUID.fromString(id));
    return Response.ok().build();
  }

  private MessagingService getService(CreateMessagingService create, SecurityContext securityContext) {
    System.out.println("Ingestion schedule in request " + create.getIngestionSchedule());
    return new MessagingService().withId(UUID.randomUUID())
            .withName(create.getName()).withDescription(create.getDescription())
            .withServiceType(create.getServiceType())
            .withBrokers(create.getBrokers())
            .withSchemaRegistry(create.getSchemaRegistry())
            .withIngestionSchedule(create.getIngestionSchedule())
            .withUpdatedBy(securityContext.getUserPrincipal().getName())
            .withUpdatedAt(new Date());
  }
}
