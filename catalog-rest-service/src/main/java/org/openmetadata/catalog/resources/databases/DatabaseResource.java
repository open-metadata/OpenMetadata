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

package org.openmetadata.catalog.resources.databases;

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
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
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
import org.openmetadata.catalog.api.data.CreateDatabase;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.DatabaseRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.DeleteResponse;
import org.openmetadata.catalog.util.RestUtil.PatchResponse;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/databases")
@Api(value = "Databases collection", tags = "Databases collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "databases")
public class DatabaseResource {
  public static final String COLLECTION_PATH = "v1/databases/";
  private final DatabaseRepository dao;
  private final Authorizer authorizer;

  public static ResultList<Database> addHref(UriInfo uriInfo, ResultList<Database> databases) {
    Optional.ofNullable(databases.getData())
        .orElse(Collections.emptyList())
        .forEach(
            i -> {
              addHref(uriInfo, i);
              i.setTables(null);
            });
    return databases;
  }

  public static Database addHref(UriInfo uriInfo, Database db) {
    Entity.withHref(uriInfo, db.getTables());
    Entity.withHref(uriInfo, db.getLocation());
    Entity.withHref(uriInfo, db.getOwner());
    Entity.withHref(uriInfo, db.getService());
    return db;
  }

  public static void addHref(UriInfo uriInfo, EntityReference databaseEntityReference) {
    databaseEntityReference.withHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, databaseEntityReference.getId()));
  }

  public DatabaseResource(CollectionDAO dao, Authorizer authorizer) {
    this.dao = new DatabaseRepository(dao);
    this.authorizer = authorizer;
  }

  public static class DatabaseList extends ResultList<Database> {
    @SuppressWarnings("unused") // Empty constructor needed for deserialization
    DatabaseList() {}

    public DatabaseList(List<Database> data, String beforeCursor, String afterCursor, int total)
        throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "owner,tables,usageSummary,location";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replace(" ", "").split(","));

  @GET
  @Operation(
      summary = "List databases",
      tags = "databases",
      description =
          "Get a list of databases, optionally filtered by `service` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of databases",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DatabaseList.class)))
      })
  public ResultList<Database> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter databases by service name",
              schema = @Schema(type = "string", example = "snowflakeWestCoast"))
          @QueryParam("service")
          String serviceParam,
      @Parameter(description = "Limit the number tables returned. (1 to 1000000, default" + " = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(1)
          @Max(1000000)
          int limitParam,
      @Parameter(description = "Returns list of tables before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of tables after this cursor", schema = @Schema(type = "string"))
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
    Fields fields = new Fields(FIELD_LIST, fieldsParam);

    ResultList<Database> databases;

    // For calculating cursors, ask for one extra entry beyond limit. If the extra entry exists, then in forward
    // scrolling afterCursor is not null. Similarly, if the extra entry exists, then in reverse scrolling,
    // beforeCursor is not null. Remove the extra entry before returning results.
    if (before != null) { // Reverse paging
      databases = dao.listBefore(uriInfo, fields, serviceParam, limitParam, before, include); // Ask for one extra entry
    } else { // Forward paging or first page
      databases = dao.listAfter(uriInfo, fields, serviceParam, limitParam, after, include);
    }
    return addHref(uriInfo, databases);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      summary = "List database versions",
      tags = "databases",
      description = "Get a list of all the versions of a database identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of database versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "database Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException, ParseException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a database",
      tags = "databases",
      description = "Get a database by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The database",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Database.class))),
        @ApiResponse(responseCode = "404", description = "Database for instance {id} is not found")
      })
  public Response get(
      @Context UriInfo uriInfo,
      @PathParam("id") String id,
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
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    Database database = dao.get(uriInfo, id, fields, include);
    addHref(uriInfo, database);
    return Response.ok(database).build();
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      summary = "Get a database by name",
      tags = "databases",
      description = "Get a database by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The database",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Database.class))),
        @ApiResponse(responseCode = "404", description = "Database for instance {id} is not found")
      })
  public Response getByName(
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
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    Database database = dao.getByName(uriInfo, fqn, fields, include);
    addHref(uriInfo, database);
    return Response.ok(database).build();
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      summary = "Get a version of the database",
      tags = "databases",
      description = "Get a version of the database by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "database",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Database.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Database for instance {id} and version {version} is " + "not found")
      })
  public Database getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Database Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "Database version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException, ParseException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(
      summary = "Create a database",
      tags = "databases",
      description = "Create a database under an existing `service`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The database",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = CreateDatabase.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDatabase create)
      throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Database database = getDatabase(securityContext, create);
    database = addHref(uriInfo, dao.create(uriInfo, database));
    return Response.created(database.getHref()).entity(database).build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      summary = "Update a database",
      tags = "databases",
      description = "Update an existing database using JsonPatch.",
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
    Fields fields = new Fields(FIELD_LIST, FIELDS);
    Database database = dao.get(uriInfo, id, fields);
    SecurityUtil.checkAdminRoleOrPermissions(
        authorizer, securityContext, dao.getEntityInterface(database).getEntityReference(), patch);

    PatchResponse<Database> response =
        dao.patch(uriInfo, UUID.fromString(id), securityContext.getUserPrincipal().getName(), patch);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @PUT
  @Operation(
      summary = "Create or update database",
      tags = "databases",
      description = "Create a database, it it does not exist or update an existing database.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated database ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreateDatabase.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDatabase create)
      throws IOException, ParseException {
    Database database = getDatabase(securityContext, create);
    PutResponse<Database> response = dao.createOrUpdate(uriInfo, database);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @DELETE
  @Path("/{id}/location")
  @Operation(summary = "Remove the location", tags = "databases", description = "Remove the location")
  public Database deleteLocation(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the database", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, "location");
    dao.deleteLocation(id);
    Database database = dao.get(uriInfo, id, fields);
    return addHref(uriInfo, database);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      summary = "Delete a database",
      tags = "databases",
      description = "Delete a database by `id`. Database can only be deleted if it has no tables.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Database for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @PathParam("id") String id)
      throws IOException {
    DeleteResponse<Database> response = dao.delete(securityContext.getUserPrincipal().getName(), id, recursive);
    return response.toResponse();
  }

  private Database getDatabase(SecurityContext securityContext, CreateDatabase create) {
    return new Database()
        .withId(UUID.randomUUID())
        .withName(create.getName())
        .withDescription(create.getDescription())
        .withService(create.getService())
        .withOwner(create.getOwner())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }
}
