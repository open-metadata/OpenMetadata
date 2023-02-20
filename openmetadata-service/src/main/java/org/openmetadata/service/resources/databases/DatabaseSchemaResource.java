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
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DatabaseSchemaRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ResultList;

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
  }

  static final String FIELDS = "owner,tables,usageSummary";

  @GET
  @Operation(
      operationId = "listDBSchemas",
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
      operationId = "listAllDBSchemaVersion",
      summary = "List schema versions",
      tags = "databaseSchemas",
      description = "Get a list of all the versions of a schema identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of schema versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Database schema Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getDBSchemaByID",
      summary = "Get a schema by Id",
      tags = "databaseSchemas",
      description = "Get a database schema by `Id`.",
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
      @Parameter(description = "Database schema Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      operationId = "getDBSchemaByFQN",
      summary = "Get a schema by fully qualified name",
      tags = "databaseSchemas",
      description = "Get a database schema by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The schema",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DatabaseSchema.class))),
        @ApiResponse(responseCode = "404", description = "Database schema for instance {fqn} is not found")
      })
  public DatabaseSchema getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Fully qualified name of the database schema", schema = @Schema(type = "string"))
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
      operationId = "getSpecificDBSchemaVersion",
      summary = "Get a version of the schema",
      tags = "databaseSchemas",
      description = "Get a version of the database schema by given `Id`",
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
      @Parameter(description = "Database schema Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "Database schema version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createDBSchema",
      summary = "Create a schema",
      tags = "databaseSchemas",
      description = "Create a schema under an existing `service`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The database schema",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DatabaseSchema.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDatabaseSchema create)
      throws IOException {
    DatabaseSchema schema = getDatabaseSchema(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, schema);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchDBSchema",
      summary = "Update a database schema",
      tags = "databaseSchemas",
      description = "Update an existing database schema using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Database schema Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "Filter to apply patch to child entities",
              schema = @Schema(type = "list", example = "false"))
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean isRecursive,
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
    Response response = patchInternal(uriInfo, securityContext, id, patch);
    if (isRecursive) {
      dao.applyPatchRecursivelyToChildren(id, patch, securityContext);
    }
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateDBSchema",
      summary = "Create or update schema",
      tags = "databaseSchemas",
      description = "Create a database schema, if it does not exist or update an existing database schema.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated schema ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DatabaseSchema.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDatabaseSchema create)
      throws IOException {
    DatabaseSchema schema = getDatabaseSchema(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, schema);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteDBSchema",
      summary = "Delete a schema by Id",
      tags = "databaseSchemas",
      description = "Delete a schema by `Id`. Schema can only be deleted if it has no tables.",
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
      @Parameter(description = "Database schema Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteDBSchemaByFQN",
      summary = "Delete a schema by fully qualified name",
      tags = "databaseSchemas",
      description = "Delete a schema by `fullyQualifiedName`. Schema can only be deleted if it has no tables.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Schema for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the DBSchema", schema = @Schema(type = "string")) @PathParam("fqn") String fqn)
      throws IOException {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted database schema.",
      tags = "databaseSchemas",
      description = "Restore a soft deleted database schema.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the DatabaseSchema ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DatabaseSchema.class)))
      })
  public Response restoreDatabaseSchema(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private DatabaseSchema getDatabaseSchema(CreateDatabaseSchema create, String user) throws IOException {
    return copy(new DatabaseSchema(), create, user)
        .withDatabase(getEntityReference(Entity.DATABASE, create.getDatabase()));
  }
}
