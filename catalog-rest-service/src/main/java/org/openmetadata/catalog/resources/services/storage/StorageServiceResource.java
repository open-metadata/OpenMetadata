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

package org.openmetadata.catalog.resources.services.storage;

import com.google.inject.Inject;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.openmetadata.catalog.api.services.CreateStorageService;
import org.openmetadata.catalog.api.services.UpdateStorageService;
import org.openmetadata.catalog.entity.services.StorageService;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.StorageServiceRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.CatalogAuthorizer;
import org.openmetadata.catalog.security.SecurityUtil;
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

@Path("/v1/services/storageServices")
@Api(value = "Storage service collection", tags = "Services -> Storage service collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "storageServices")
public class StorageServiceResource {
  public static final String COLLECTION_PATH = "v1/services/storageServices/";
  private final StorageServiceRepository dao;
  private final CatalogAuthorizer authorizer;


  @Inject
  public StorageServiceResource(CollectionDAO dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "StorageServiceRepository must not be null");
    this.dao = new StorageServiceRepository(dao);
    this.authorizer = authorizer;
  }

  static class StorageServiceList extends ResultList<StorageService> {
    StorageServiceList(List<StorageService> data) {
      super(data);
    }
  }

  @GET
  @Operation(summary = "List storage services", tags = "services",
          description = "Get a list of storage services.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "List of storage service instances",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = StorageServiceList.class)))
          })
  public ResultList<StorageService> list(@Context UriInfo uriInfo) throws IOException, GeneralSecurityException,
          ParseException {
    return dao.listAfter(uriInfo, null, null, 10000, null);
  }

  @GET
  @Path("/{id}")
  @Operation(summary = "Get a storage service", tags = "services",
          description = "Get a storage service by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Storage service instance",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = StorageService.class))),
                  @ApiResponse(responseCode = "404", description = "Storage service for instance {id} is not found")
          })
  public StorageService get(@Context UriInfo uriInfo,
                            @Context SecurityContext securityContext,
                            @PathParam("id") String id) throws IOException, ParseException {
    return dao.get(uriInfo, id, null);
  }

  @GET
  @Path("/name/{name}")
  @Operation(summary = "Get storage service by name", tags = "services",
          description = "Get a storage service by the service `name`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Storage service instance",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = StorageService.class))),
                  @ApiResponse(responseCode = "404", description = "Storage service for instance {id} is not found")
          })
  public StorageService getByName(@Context UriInfo uriInfo,
                                  @Context SecurityContext securityContext,
                                  @PathParam("name") String name) throws IOException, ParseException {
    return dao.getByName(uriInfo, name, null);
  }

  @POST
  @Operation(summary = "Create storage service", tags = "services",
          description = "Create a new storage service.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Storage service instance",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = StorageService.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response create(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Valid CreateStorageService create) throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    StorageService databaseService = new StorageService().withId(UUID.randomUUID())
            .withName(create.getName()).withDescription(create.getDescription())
            .withServiceType(create.getServiceType()).withUpdatedBy(securityContext.getUserPrincipal().getName())
            .withUpdatedAt(new Date());

    dao.create(uriInfo, databaseService);
    return Response.created(databaseService.getHref()).entity(databaseService).build();
  }

  @PUT
  @Path("/{id}")
  @Operation(summary = "Update a storage service", tags = "services",
          description = "Update an existing storage service identified by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Storage service instance",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = StorageService.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response update(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Parameter(description = "Id of the storage service", schema = @Schema(type = "string"))
                         @PathParam("id") String id,
                         @Valid UpdateStorageService update) throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    StorageService databaseService = dao.update(uriInfo, UUID.fromString(id), update.getDescription());
    return Response.ok(databaseService).build();
  }

  @DELETE
  @Path("/{id}")
  @Operation(summary = "Delete a storage service", tags = "services",
          description = "Delete a storage services. If storages (and tables) belong the service, it can't be " +
                  "deleted.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "StorageService service for instance {id} " +
                          "is not found")
          })
  public Response delete(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Parameter(description = "Id of the storage service", schema = @Schema(type = "string"))
                         @PathParam("id") String id) {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    dao.delete(UUID.fromString(id));
    return Response.ok().build();
  }
}