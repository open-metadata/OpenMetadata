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

package org.openmetadata.catalog.resources.services.storage;

import com.google.inject.Inject;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.openmetadata.catalog.api.services.CreateStorageService;
import org.openmetadata.catalog.entity.services.StorageService;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.StorageServiceRepository;
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

  public static class StorageServiceList extends ResultList<StorageService> {
    @SuppressWarnings("unused") /* Required for tests */
    public StorageServiceList() {}

    public StorageServiceList(List<StorageService> data, String beforeCursor, String afterCursor, int total)
            throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  @GET
  @Operation(summary = "List storage services", tags = "services",
          description = "Get a list of storage services. Use cursor-based pagination to limit the number " +
                  "entries in the list using `limit` and `before` or `after` query params.",
          responses = {@ApiResponse(responseCode = "200", description = "List of storage services",
                  content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = StorageServiceList.class)))
          })
  public ResultList<StorageService> list(@Context UriInfo uriInfo,
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
                                         @QueryParam("after") String after) throws IOException,
          GeneralSecurityException, ParseException {
    RestUtil.validateCursors(before, after);
    if (before != null) { // Reverse paging
      return dao.listBefore(uriInfo, null, null, limitParam, before);
    }
    // Forward paging or first page
    return dao.listAfter(uriInfo, null, null, limitParam, after);
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

  @GET
  @Path("/{id}/versions")
  @Operation(summary = "List storage service versions", tags = "services",
          description = "Get a list of all the versions of a storage service identified by `id`",
          responses = {@ApiResponse(responseCode = "200", description = "List of storage service versions",
                  content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = EntityHistory.class)))
          })
  public EntityHistory listVersions(@Context UriInfo uriInfo,
                                    @Context SecurityContext securityContext,
                                    @Parameter(description = "storage service Id", schema = @Schema(type = "string"))
                                    @PathParam("id") String id)
          throws IOException, ParseException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(summary = "Get a version of the storage service", tags = "services",
          description = "Get a version of the storage service by given `id`",
          responses = {
                  @ApiResponse(responseCode = "200", description = "storage service",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = StorageService.class))),
                  @ApiResponse(responseCode = "404", description = "Storage service for instance {id} and version " +
                          "{version} is not found")
          })
  public StorageService getVersion(@Context UriInfo uriInfo,
                                   @Context SecurityContext securityContext,
                                   @Parameter(description = "storage service Id", schema = @Schema(type = "string"))
                                   @PathParam("id") String id,
                                   @Parameter(description = "storage service version number in the form `major`" +
                                           ".`minor`",
                                           schema = @Schema(type = "string", example = "0.1 or 1.1"))
                                   @PathParam("version") String version) throws IOException, ParseException {
    return dao.getVersion(id, version);
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
                         @Valid CreateStorageService create) throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    StorageService databaseService = getService(create, securityContext);
    dao.create(uriInfo, databaseService);
    return Response.created(databaseService.getHref()).entity(databaseService).build();
  }

  @PUT
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
                         @Valid CreateStorageService update) throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    StorageService databaseService = getService(update, securityContext);
    PutResponse<StorageService> response = dao.createOrUpdate(uriInfo, databaseService);
    return response.toResponse();
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

  private StorageService getService(CreateStorageService create, SecurityContext securityContext) {
    return new StorageService().withId(UUID.randomUUID())
            .withName(create.getName()).withDescription(create.getDescription())
            .withServiceType(create.getServiceType()).withUpdatedBy(securityContext.getUserPrincipal().getName())
            .withUpdatedAt(new Date());
  }
}