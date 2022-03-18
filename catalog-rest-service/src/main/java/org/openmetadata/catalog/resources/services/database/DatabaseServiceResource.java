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

package org.openmetadata.catalog.resources.services.database;

import static org.openmetadata.catalog.fernet.Fernet.isTokenized;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
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
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.fernet.Fernet;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.DatabaseServiceRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.AuthorizationException;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.DatabaseConnection;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.DeleteResponse;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/services/databaseServices")
@Api(value = "Database service collection", tags = "Services -> Database service collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "databaseServices")
public class DatabaseServiceResource {
  public static final String COLLECTION_PATH = "v1/services/databaseServices/";
  private final DatabaseServiceRepository dao;
  private final Authorizer authorizer;

  static final String FIELDS = "airflowPipeline,owner";
  public static final List<String> ALLOWED_FIELDS = Entity.getEntityFields(DatabaseService.class);
  private final Fernet fernet;

  public static ResultList<DatabaseService> addHref(UriInfo uriInfo, ResultList<DatabaseService> dbServices) {
    listOrEmpty(dbServices.getData()).forEach(i -> addHref(uriInfo, i));
    return dbServices;
  }

  public static DatabaseService addHref(UriInfo uriInfo, DatabaseService service) {
    service.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, service.getId()));
    Entity.withHref(uriInfo, service.getOwner());
    return service;
  }

  public DatabaseServiceResource(CollectionDAO dao, Authorizer authorizer) {
    Objects.requireNonNull(dao, "DatabaseServiceRepository must not be null");
    this.dao = new DatabaseServiceRepository(dao);
    this.authorizer = authorizer;
    this.fernet = Fernet.getInstance();
  }

  public static class DatabaseServiceList extends ResultList<DatabaseService> {
    @SuppressWarnings("unused") /* Required for tests */
    public DatabaseServiceList() {}

    public DatabaseServiceList(List<DatabaseService> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  @GET
  @Operation(
      summary = "List database services",
      tags = "services",
      description = "Get a list of database services.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of database service instances",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DatabaseServiceList.class)))
      })
  public ResultList<DatabaseService> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @DefaultValue("10") @Min(1) @Max(1000000) @QueryParam("limit") int limitParam,
      @Parameter(
              description = "Returns list of database services before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of database services after this cursor", schema = @Schema(type = "string"))
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
    EntityUtil.Fields fields = new EntityUtil.Fields(ALLOWED_FIELDS, fieldsParam);
    ResultList<DatabaseService> dbServices;
    if (before != null) {
      dbServices = dao.listBefore(uriInfo, fields, null, limitParam, before, include);
    } else {
      dbServices = dao.listAfter(uriInfo, fields, null, limitParam, after, include);
    }
    return addHref(uriInfo, decryptOrNullify(securityContext, dbServices));
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a database service",
      tags = "services",
      description = "Get a database service by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Database service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DatabaseService.class))),
        @ApiResponse(responseCode = "404", description = "Database service for instance {id} is not found")
      })
  public DatabaseService get(
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
    EntityUtil.Fields fields = new EntityUtil.Fields(ALLOWED_FIELDS, fieldsParam);
    return addHref(uriInfo, decryptOrNullify(securityContext, dao.get(uriInfo, id, fields, include)));
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      summary = "Get database service by name",
      tags = "services",
      description = "Get a database service by the service `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Database service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DatabaseService.class))),
        @ApiResponse(responseCode = "404", description = "Database service for instance {id} is not found")
      })
  public DatabaseService getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("name") String name,
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
    EntityUtil.Fields fields = new EntityUtil.Fields(ALLOWED_FIELDS, fieldsParam);
    return addHref(uriInfo, decryptOrNullify(securityContext, dao.getByName(uriInfo, name, fields, include)));
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      summary = "List database service versions",
      tags = "services",
      description = "Get a list of all the versions of a database service identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of database service versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "database service Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException, ParseException {
    EntityHistory entityHistory = dao.listVersions(id);
    List<Object> versions =
        entityHistory.getVersions().stream()
            .map(
                json -> {
                  try {
                    DatabaseService databaseService = JsonUtils.readValue((String) json, DatabaseService.class);
                    return JsonUtils.pojoToJson(decryptOrNullify(securityContext, databaseService));
                  } catch (IOException e) {
                    return json;
                  }
                })
            .collect(Collectors.toList());
    entityHistory.setVersions(versions);
    return entityHistory;
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      summary = "Get a version of the database service",
      tags = "services",
      description = "Get a version of the database service by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "database service",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DatabaseService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Database service for instance {id} and version " + "{version} is not found")
      })
  public DatabaseService getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "database service Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "database service version number in the form `major`" + ".`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException, ParseException {
    return decryptOrNullify(securityContext, dao.getVersion(id, version));
  }

  @POST
  @Operation(
      summary = "Create database service",
      tags = "services",
      description = "Create a new database service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Database service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CreateDatabaseService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDatabaseService create)
      throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    DatabaseService service = getService(create, securityContext);
    service = addHref(uriInfo, decryptOrNullify(securityContext, dao.create(uriInfo, service)));
    return Response.created(service.getHref()).entity(service).build();
  }

  @PUT
  @Operation(
      summary = "Update a database service",
      tags = "services",
      description = "Update an existing database service identified by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Database service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CreateDatabaseService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response update(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDatabaseService update)
      throws IOException, ParseException {
    DatabaseService service = getService(update, securityContext);
    SecurityUtil.checkAdminOrBotOrOwner(authorizer, securityContext, dao.getOriginalOwner(service));
    PutResponse<DatabaseService> response = dao.createOrUpdate(uriInfo, service, true);
    addHref(uriInfo, decryptOrNullify(securityContext, response.getEntity()));
    return response.toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      summary = "Delete a database service",
      tags = "services",
      description =
          "Delete a database services. If databases (and tables) belong the service, it can't be " + "deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "DatabaseService service for instance {id} " + "is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Id of the database service", schema = @Schema(type = "string")) @PathParam("id")
          String id)
      throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    DeleteResponse<DatabaseService> response = dao.delete(securityContext.getUserPrincipal().getName(), id, recursive);
    decryptOrNullify(securityContext, response.getEntity());
    return response.toResponse();
  }

  private ResultList<DatabaseService> decryptOrNullify(
      SecurityContext securityContext, ResultList<DatabaseService> databaseServices) {
    Optional.ofNullable(databaseServices.getData())
        .orElse(Collections.emptyList())
        .forEach(databaseService -> decryptOrNullify(securityContext, databaseService));
    return databaseServices;
  }

  private DatabaseService decryptOrNullify(SecurityContext securityContext, DatabaseService databaseService) {
    try {
      SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext, null, MetadataOperation.DecryptTokens);
    } catch (AuthorizationException e) {
      return databaseService.withDatabaseConnection(null);
    }
    DatabaseConnection databaseConnection = databaseService.getDatabaseConnection();
    if (databaseConnection != null
        && databaseConnection.getPassword() != null
        && isTokenized(databaseConnection.getPassword())) {
      databaseConnection.setPassword(fernet.decrypt(databaseConnection.getPassword()));
    }
    return databaseService;
  }

  private DatabaseService getService(CreateDatabaseService create, SecurityContext securityContext) {
    return new DatabaseService()
        .withId(UUID.randomUUID())
        .withName(create.getName())
        .withDescription(create.getDescription())
        .withServiceType(create.getServiceType())
        .withDatabaseConnection(create.getDatabaseConnection())
        .withOwner(create.getOwner())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }
}
