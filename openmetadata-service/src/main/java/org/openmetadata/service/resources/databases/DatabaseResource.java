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

package org.openmetadata.service.resources.databases;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
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
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DatabaseRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.ResultList;

@Path("/v1/databases")
@Tag(
    name = "Databases",
    description = "A `Database` also referred to as `Database Catalog` is a collection of schemas.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "databases")
public class DatabaseResource extends EntityResource<Database, DatabaseRepository> {
  public static final String COLLECTION_PATH = "v1/databases/";

  @Override
  public Database addHref(UriInfo uriInfo, Database db) {
    Entity.withHref(uriInfo, db.getDatabaseSchemas());
    Entity.withHref(uriInfo, db.getLocation());
    Entity.withHref(uriInfo, db.getOwner());
    Entity.withHref(uriInfo, db.getService());
    return db;
  }

  public DatabaseResource(CollectionDAO dao, Authorizer authorizer) {
    super(Database.class, new DatabaseRepository(dao), authorizer);
  }

  public static class DatabaseList extends ResultList<Database> {
    @SuppressWarnings("unused") // Empty constructor needed for deserialization
    DatabaseList() {}
  }

  static final String FIELDS = "owner,databaseSchemas,usageSummary,location,tags";

  @GET
  @Operation(
      operationId = "listDatabases",
      summary = "List databases",
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
          @Min(0)
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
      throws IOException {
    ListFilter filter = new ListFilter(include).addQueryParam("service", serviceParam);
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllDatabaseVersion",
      summary = "List database versions",
      description = "Get a list of all the versions of a database identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of database versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the database", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getDatabaseByID",
      summary = "Get a database by Id",
      description = "Get a database by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The database",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Database.class))),
        @ApiResponse(responseCode = "404", description = "Database for instance {id} is not found")
      })
  public Database get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the database", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      throws IOException {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getDatabaseByFQN",
      summary = "Get a database by fully qualified name",
      description = "Get a database by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The database",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Database.class))),
        @ApiResponse(responseCode = "404", description = "Database for instance {fqn} is not found")
      })
  public Database getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Fully qualified name of the database", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
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
      throws IOException {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificDatabaseVersion",
      summary = "Get a version of the database",
      description = "Get a version of the database by given `Id`",
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
      @Parameter(description = "Id of the database", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "Database version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createDatabase",
      summary = "Create a database",
      description = "Create a database under an existing `service`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The database",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Database.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDatabase create)
      throws IOException {
    Database database = getDatabase(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, database);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchDatabase",
      summary = "Update a database",
      description = "Update an existing database using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the database", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[" + "{op:remove, path:/a}," + "{op:add, path: /b, value: val}" + "]")
                      }))
          JsonPatch patch)
      throws IOException {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateDatabase",
      summary = "Create or update database",
      description = "Create a database, if it does not exist or update an existing database.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated database ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Database.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDatabase create)
      throws IOException {
    Database database = getDatabase(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, database);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteDatabase",
      summary = "Delete a database by Id",
      description = "Delete a database by `Id`. Database can only be deleted if it has no tables.",
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
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the database", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteDatabaseByFQN",
      summary = "Delete a database by fully qualified name",
      description = "Delete a database by `fullyQualifiedName`. Databases can only be deleted if it has no tables.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Database for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Fully qualified name of the database", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn)
      throws IOException {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted Database.",
      description = "Restore a soft deleted Database.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Database. ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Database.class)))
      })
  public Response restoreDatabase(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private Database getDatabase(CreateDatabase create, String user) throws IOException {
    return copy(new Database(), create, user)
        .withService(getEntityReference(Entity.DATABASE_SERVICE, create.getService()));
  }
}
