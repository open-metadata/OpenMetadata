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

import static org.openmetadata.common.utils.CommonUtil.listOf;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.DatabaseProfilerConfig;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.CSVExportResponse;
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
  private final DatabaseMapper mapper = new DatabaseMapper();
  static final String FIELDS =
      "owners,databaseSchemas,usageSummary,location,tags,certification,extension,domain,sourceHash,followers";

  @Override
  public Database addHref(UriInfo uriInfo, Database db) {
    super.addHref(uriInfo, db);
    Entity.withHref(uriInfo, db.getDatabaseSchemas());
    Entity.withHref(uriInfo, db.getLocation());
    Entity.withHref(uriInfo, db.getService());
    return db;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("databaseSchemas,location", MetadataOperation.VIEW_BASIC);
    addViewOperation("usageSummary", MetadataOperation.VIEW_USAGE);
    return listOf(MetadataOperation.VIEW_USAGE, MetadataOperation.EDIT_USAGE);
  }

  public DatabaseResource(Authorizer authorizer, Limits limits) {
    super(Entity.DATABASE, authorizer, limits);
  }

  public static class DatabaseList extends ResultList<Database> {
    /* Required for serde */
  }

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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DatabaseList.class)))
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
      @Parameter(description = "Limit the number tables returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limitParam,
      @Parameter(
              description = "Returns list of tables before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of tables after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include).addQueryParam("service", serviceParam);
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the database", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Database.class))),
        @ApiResponse(responseCode = "404", description = "Database for instance {id} is not found")
      })
  public Database get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the database", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
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
          Include include) {
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Database.class))),
        @ApiResponse(responseCode = "404", description = "Database for instance {fqn} is not found")
      })
  public Database getByName(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fully qualified name of the database",
              schema = @Schema(type = "string"))
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
          Include include) {
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Database.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Database for instance {id} and version {version} is not found")
      })
  public Database getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the database", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Database version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Database.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateDatabase create) {
    Database database = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, database);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchDatabase",
      summary = "Update a database",
      description = "Update an existing database using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the database", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchDatabase",
      summary = "Update a database by name.",
      description = "Update an existing database using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the database", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, fqn, patch);
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Database.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateDatabase create) {
    Database database = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
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
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the database", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteDatabaseAsync",
      summary = "Asynchronously delete a database by Id",
      description =
          "Asynchronously delete a database by `Id`. Database can only be deleted if it has no tables.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Database for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the database", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @GET
  @Path("/name/{name}/exportAsync")
  @Produces(MediaType.APPLICATION_JSON)
  @Valid
  @Operation(
      operationId = "exportDatabase",
      summary = "Export database in CSV format",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Exported csv with database schemas",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CSVExportResponse.class)))
      })
  public Response exportCsvAsync(
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Database", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description =
                  "If true, export will include child entities (schemas, tables, columns)",
              schema = @Schema(type = "boolean"))
          @DefaultValue("false") // Default: Export only database
          @QueryParam("recursive")
          boolean recursive) {
    return exportCsvInternalAsync(securityContext, name, recursive);
  }

  @GET
  @Path("/name/{name}/export")
  @Produces({MediaType.TEXT_PLAIN + "; charset=UTF-8"})
  @Valid
  @Operation(
      operationId = "exportDatabase",
      summary = "Export database in CSV format",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Exported csv with database schemas",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = String.class)))
      })
  public String exportCsv(
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Database", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description =
                  "If true, export will include child entities (schemas, tables, columns)",
              schema = @Schema(type = "boolean"))
          @DefaultValue("false") // Default: Export only database
          @QueryParam("recursive")
          boolean recursive)
      throws IOException {
    return exportCsvInternal(securityContext, name, recursive);
  }

  @PUT
  @Path("/name/{name}/import")
  @Consumes({MediaType.TEXT_PLAIN + "; charset=UTF-8"})
  @Valid
  @Operation(
      operationId = "importDatabase",
      summary =
          "Import database schemas from CSV to update database schemas (no creation " + "allowed)",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Import result",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CsvImportResult.class)))
      })
  public CsvImportResult importCsv(
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Database", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description =
                  "Dry-run when true is used for validating the CSV without really importing it. (default=true)",
              schema = @Schema(type = "boolean"))
          @DefaultValue("true")
          @QueryParam("dryRun")
          boolean dryRun,
      @Parameter(description = "If true, resursive import", schema = @Schema(type = "boolean"))
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      String csv)
      throws IOException {
    return importCsvInternal(securityContext, name, csv, dryRun, recursive);
  }

  @PUT
  @Path("/name/{name}/importAsync")
  @Consumes({MediaType.TEXT_PLAIN + "; charset=UTF-8"})
  @Produces(MediaType.APPLICATION_JSON)
  @Valid
  @Operation(
      operationId = "importDatabaseAsync",
      summary = "Import database schemas from CSV asynchronously",
      description =
          "Import database schemas from CSV to update database schemas asynchronously (no creation allowed).",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Import initiated successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CsvImportResult.class)))
      })
  public Response importCsvAsync(
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Database", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description =
                  "Dry-run when true is used for validating the CSV without really importing it. (default=true)",
              schema = @Schema(type = "boolean"))
          @DefaultValue("true")
          @QueryParam("dryRun")
          boolean dryRun,
      @Parameter(description = "If true, recursive import", schema = @Schema(type = "boolean"))
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      String csv) {
    return importCsvInternalAsync(securityContext, name, csv, dryRun, recursive);
  }

  @PUT
  @Path("/{id}/vote")
  @Operation(
      operationId = "updateVoteForEntity",
      summary = "Update Vote for a Entity",
      description = "Update vote for a Entity",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response updateVote(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid VoteRequest request) {
    return repository
        .updateVote(securityContext.getUserPrincipal().getName(), id, request)
        .toResponse();
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteDatabaseByFQN",
      summary = "Delete a database by fully qualified name",
      description =
          "Delete a database by `fullyQualifiedName`. Databases can only be deleted if it has no tables.",
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
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(
              description = "Fully qualified name of the database",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, recursive, hardDelete);
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Database.class)))
      })
  public Response restoreDatabase(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @PUT
  @Path("/{id}/databaseProfilerConfig")
  @Operation(
      operationId = "addDataProfilerConfig",
      summary = "Add database profile config",
      description = "Add database profile config to the database.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully updated the Database ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Database.class)))
      })
  public Database addDataProfilerConfig(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the database", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Valid DatabaseProfilerConfig databaseProfilerConfig) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Database database = repository.addDatabaseProfilerConfig(id, databaseProfilerConfig);
    return addHref(uriInfo, database);
  }

  @GET
  @Path("/{id}/databaseProfilerConfig")
  @Operation(
      operationId = "getDataProfilerConfig",
      summary = "Get database profile config",
      description = "Get database profile config to the database.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully updated the Database ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Database.class)))
      })
  public Database getDataProfilerConfig(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the database", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Database database = repository.find(id, Include.NON_DELETED);
    return addHref(
        uriInfo,
        database.withDatabaseProfilerConfig(repository.getDatabaseProfilerConfig(database)));
  }

  @DELETE
  @Path("/{id}/databaseProfilerConfig")
  @Operation(
      operationId = "delete DataProfilerConfig",
      summary = "Delete database profiler config",
      description = "delete database profile config to the database.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully deleted the Database profiler config",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Database.class)))
      })
  public Database deleteDataProfilerConfig(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Database database = repository.deleteDatabaseProfilerConfig(id);
    return addHref(uriInfo, database);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollowerToDatabase",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as followed of this Database",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "Database for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Database", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user to be added as follower",
              schema = @Schema(type = "string"))
          UUID userId) {
    return repository
        .addFollower(securityContext.getUserPrincipal().getName(), id, userId)
        .toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      operationId = "deleteFollower",
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the entity.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class)))
      })
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user being removed as follower",
              schema = @Schema(type = "string"))
          @PathParam("userId")
          String userId) {
    return repository
        .deleteFollower(securityContext.getUserPrincipal().getName(), id, UUID.fromString(userId))
        .toResponse();
  }
}
