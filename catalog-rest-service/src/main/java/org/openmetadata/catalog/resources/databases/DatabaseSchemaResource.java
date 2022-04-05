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

import static org.openmetadata.catalog.security.SecurityUtil.ADMIN;
import static org.openmetadata.catalog.security.SecurityUtil.BOT;
import static org.openmetadata.catalog.security.SecurityUtil.OWNER;

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
import java.util.List;
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
import org.openmetadata.catalog.api.data.CreateDatabaseSchema;
import org.openmetadata.catalog.entity.data.DatabaseSchema;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.DatabaseSchemaRepository;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.resources.EntityResource;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/databaseSchemas")
@Api(value = "Database schemas collection", tags = "Database schemas collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "databaseSchemas")
public class DatabaseSchemaResource extends EntityResource<DatabaseSchema, DatabaseSchemaRepository> {
  public static final String COLLECTION_PATH = "v1/databaseSchemas/";

  @Override
  public DatabaseSchema addHref(UriInfo uriInfo, DatabaseSchema schema) {
    Entity.withHref(uriInfo, schema.getTables());
    Entity.withHref(uriInfo, schema.getOwner());
    Entity.withHref(uriInfo, schema.getService());
    Entity.withHref(uriInfo, schema.getDatabase());
    return schema;
  }

  public DatabaseSchemaResource(CollectionDAO dao, Authorizer authorizer) {
    super(DatabaseSchema.class, new DatabaseSchemaRepository(dao), authorizer);
  }

  public static class DatabaseSchemaList extends ResultList<DatabaseSchema> {
    @SuppressWarnings("unused") // Empty constructor needed for deserialization
    DatabaseSchemaList() {}

    public DatabaseSchemaList(List<DatabaseSchema> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "owner,tables,usageSummary";

  @GET
  @Operation(
      summary = "List database schemas",
      tags = "databaseSchemas",
      description =
          "Get a list of database schemas, optionally filtered by `database` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of database schema",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DatabaseSchemaList.class)))
      })
  public ResultList<DatabaseSchema> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter schemas by database name",
              schema = @Schema(type = "string", example = "customerDatabase"))
          @QueryParam("database")
          String serviceParam,
      @Parameter(description = "Limit the number schemas returned. (1 to 1000000, default" + " = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(description = "Returns list of schemas before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of schemas after this cursor", schema = @Schema(type = "string"))
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
    return listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      summary = "List schema versions",
      tags = "databaseSchemas",
      description = "Get a list of all the versions of a schema identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of schema versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Database schema Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a schema",
      tags = "databaseSchemas",
      description = "Get a database schema by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The schema",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DatabaseSchema.class))),
        @ApiResponse(responseCode = "404", description = "Schema for instance {id} is not found")
      })
  public DatabaseSchema get(
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
      throws IOException {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      summary = "Get a schema by name",
      tags = "databaseSchemas",
      description = "Get a database schema by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The schema",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DatabaseSchema.class))),
        @ApiResponse(responseCode = "404", description = "Database schema for instance {id} is not found")
      })
  public DatabaseSchema getByName(
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
      throws IOException {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      summary = "Get a version of the schema",
      tags = "databaseSchemas",
      description = "Get a version of the database schema by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "database schema",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DatabaseSchema.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Database schema for instance {id} and version {version} is " + "not found")
      })
  public DatabaseSchema getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Database schema Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "Database schema version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(
      summary = "Create a schema",
      tags = "databaseSchemas",
      description = "Create a schema under an existing `service`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The database schema",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CreateDatabaseSchema.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDatabaseSchema create)
      throws IOException {
    DatabaseSchema schema = getDatabaseSchema(securityContext, create);
    return create(uriInfo, securityContext, schema, ADMIN | BOT);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      summary = "Update a database schema",
      tags = "databaseSchemas",
      description = "Update an existing database schema using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
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
      throws IOException {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @PUT
  @Operation(
      summary = "Create or update schema",
      tags = "databaseSchemas",
      description = "Create a database schema, if it does not exist or update an existing database schema.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated schema ",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = CreateDatabaseSchema.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDatabaseSchema create)
      throws IOException {
    DatabaseSchema schema = getDatabaseSchema(securityContext, create);
    return createOrUpdate(uriInfo, securityContext, schema, ADMIN | BOT | OWNER);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      summary = "Delete a schema",
      tags = "databaseSchemas",
      description = "Delete a schema by `id`. Schema can only be deleted if it has no tables.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Schema for instance {id} is not found")
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
      @PathParam("id") String id)
      throws IOException {
    return delete(uriInfo, securityContext, id, recursive, hardDelete, ADMIN | BOT);
  }

  private DatabaseSchema getDatabaseSchema(SecurityContext securityContext, CreateDatabaseSchema create) {
    return new DatabaseSchema()
        .withId(UUID.randomUUID())
        .withName(create.getName())
        .withDescription(create.getDescription())
        .withDatabase(create.getDatabase())
        .withOwner(create.getOwner())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }
}
