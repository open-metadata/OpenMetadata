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

import com.fasterxml.jackson.core.JsonProcessingException;
import com.google.inject.Inject;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.openmetadata.catalog.api.services.CreateMessagingService;
import org.openmetadata.catalog.api.services.UpdateMessagingService;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.MessagingServiceRepositoryHelper;
import org.openmetadata.catalog.resources.Collection;
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

@Path("/v1/services/messagingServices")
@Api(value = "Messaging service collection", tags = "Services -> Messaging service collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "messagingServices")
public class MessagingServiceResource {
  private final MessagingServiceRepositoryHelper dao;
  private final CatalogAuthorizer authorizer;

  public static EntityReference addHref(UriInfo uriInfo, EntityReference service) {
    return service.withHref(RestUtil.getHref(uriInfo, "v1/services/messagingServices/", service.getId()));
  }

  private static List<MessagingService> addHref(UriInfo uriInfo, List<MessagingService> instances) {
    instances.forEach(i -> addHref(uriInfo, i));
    return instances;
  }

  private static MessagingService addHref(UriInfo uriInfo, MessagingService dbService) {
    dbService.setHref(RestUtil.getHref(uriInfo, "v1/services/messagingServices/", dbService.getId()));
    return dbService;
  }

  @Inject
  public MessagingServiceResource(CollectionDAO dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "MessagingServiceRepositoryHelper must not be null");
    this.dao = new MessagingServiceRepositoryHelper(dao);
    this.authorizer = authorizer;
  }

  public static class MessagingServiceList extends ResultList<MessagingService> {
    public MessagingServiceList(List<MessagingService> data) {
      super(data);
    }
  }

  @GET
  @Operation(summary = "List messaging services", tags = "services",
          description = "Get a list of messaging services.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "List of messaging service instances",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = MessagingServiceList.class)))
          })
  public ResultList<MessagingService> list(@Context UriInfo uriInfo,
                                           @QueryParam("name") String name) throws IOException,
          GeneralSecurityException, ParseException {
    ResultList<MessagingService> list = dao.listAfter(null, null, 10000, null);
    list.getData().forEach(m -> addHref(uriInfo, m));
    return list;
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
    return addHref(uriInfo, dao.get(id, null));
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
    return addHref(uriInfo, dao.getByName(name, null));
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
                         @Valid CreateMessagingService create) throws JsonProcessingException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    MessagingService service = new MessagingService().withId(UUID.randomUUID())
            .withName(create.getName()).withDescription(create.getDescription())
            .withServiceType(create.getServiceType())
            .withBrokers(create.getBrokers())
            .withSchemaRegistry(create.getSchemaRegistry())
            .withIngestionSchedule(create.getIngestionSchedule())
            .withUpdatedBy(securityContext.getUserPrincipal().getName())
            .withUpdatedAt(new Date());

    addHref(uriInfo, dao.create(service));
    return Response.created(service.getHref()).entity(service).build();
  }

  @PUT
  @Path("/{id}")
  @Operation(summary = "Update a messaging service", tags = "services",
          description = "Update an existing messaging service identified by `id`.",
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
                         @Valid UpdateMessagingService update) throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    MessagingService service = addHref(uriInfo,
            dao.update(id, update.getDescription(), update.getBrokers(), update.getSchemaRegistry(),
                    update.getIngestionSchedule()));
    return Response.ok(service).build();
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
    dao.delete(id);
    return Response.ok().build();
  }
}
