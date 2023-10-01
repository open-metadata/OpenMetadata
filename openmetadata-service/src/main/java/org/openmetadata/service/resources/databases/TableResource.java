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
import java.util.List;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;
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
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTableProfile;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.tests.CreateCustomMetric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.CustomMetric;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.DataModel;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.SystemProfile;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TableJoins;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TableProfilerConfig;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

@Path("/v1/tables")
@Tag(name = "Tables", description = "`Table` organizes data in rows and columns and is defined in a `Database Schema`.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "tables")
public class TableResource extends EntityResource<Table, TableRepository> {
  public static final String COLLECTION_PATH = "v1/tables/";
  static final String FIELDS =
      "tableConstraints,tablePartition,usageSummary,owner,customMetrics,"
          + "tags,followers,joins,viewDefinition,dataModel,extension,testSuite,domain,dataProducts,lifeCycle";

  @Override
  public Table addHref(UriInfo uriInfo, Table table) {
    super.addHref(uriInfo, table);
    Entity.withHref(uriInfo, table.getDatabaseSchema());
    Entity.withHref(uriInfo, table.getDatabase());
    Entity.withHref(uriInfo, table.getService());
    return table;
  }

  public TableResource(Authorizer authorizer) {
    super(Entity.TABLE, authorizer);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    allowedFields.add("customMetrics");
    addViewOperation(
        "columns,tableConstraints,tablePartition,joins,viewDefinition,dataModel", MetadataOperation.VIEW_BASIC);
    addViewOperation("usageSummary", MetadataOperation.VIEW_USAGE);
    addViewOperation("customMetrics", MetadataOperation.VIEW_TESTS);
    addViewOperation("testSuite", MetadataOperation.VIEW_TESTS);
    return listOf(
        MetadataOperation.VIEW_TESTS,
        MetadataOperation.VIEW_QUERIES,
        MetadataOperation.VIEW_DATA_PROFILE,
        MetadataOperation.VIEW_SAMPLE_DATA,
        MetadataOperation.VIEW_USAGE,
        MetadataOperation.EDIT_TESTS,
        MetadataOperation.EDIT_QUERIES,
        MetadataOperation.EDIT_DATA_PROFILE,
        MetadataOperation.EDIT_SAMPLE_DATA,
        MetadataOperation.EDIT_LINEAGE);
  }

  public static class TableList extends ResultList<Table> {
    /* Required for serde */
  }

  public static class TableProfileList extends ResultList<TableProfile> {
    /* Required for serde */
  }

  public static class ColumnProfileList extends ResultList<ColumnProfile> {
    /* Required for serde */
  }

  public static class SystemProfileList extends ResultList<SystemProfile> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listTables",
      summary = "List tables",
      description =
          "Get a list of tables, optionally filtered by `database` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of tables",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TableList.class)))
      })
  public ResultList<Table> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter tables by database fully qualified name",
              schema = @Schema(type = "string", example = "snowflakeWestCoast.financeDB"))
          @QueryParam("database")
          String databaseParam,
      @Parameter(
              description = "Filter tables by databaseSchema fully qualified name",
              schema = @Schema(type = "string", example = "snowflakeWestCoast.financeDB.schema"))
          @QueryParam("databaseSchema")
          String databaseSchemaParam,
      @Parameter(
              description =
                  "Include tables with an empty test suite (i.e. no test cases have been created for this table). Default to true",
              schema = @Schema(type = "boolean", example = "true"))
          @QueryParam("includeEmptyTestSuite")
          @DefaultValue("true")
          boolean includeEmptyTestSuite,
      @Parameter(description = "Limit the number tables returned. (1 to 1000000, default = " + "10) ")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
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
          Include include) {
    ListFilter filter =
        new ListFilter(include)
            .addQueryParam("database", databaseParam)
            .addQueryParam("databaseSchema", databaseSchemaParam)
            .addQueryParam("includeEmptyTestSuite", includeEmptyTestSuite);
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getTableByID",
      summary = "Get a table by Id",
      description = "Get a table by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "table",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class))),
        @ApiResponse(responseCode = "404", description = "Table for instance {id} is not found")
      })
  public Table get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "table Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      operationId = "getTableByFQN",
      summary = "Get a table by fully qualified name",
      description = "Get a table by fully qualified table name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "table",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class))),
        @ApiResponse(responseCode = "404", description = "Table for instance {fqn} is not found")
      })
  public Table getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fully qualified name of the table", schema = @Schema(type = "string")) @PathParam("fqn")
          String fqn,
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
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllTableVersion",
      summary = "List table versions",
      description = "Get a list of all the versions of a table identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of table versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Table Id", schema = @Schema(type = "string")) @PathParam("id") UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificDatabaseVersion",
      summary = "Get a version of the table",
      description = "Get a version of the table by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "table",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Table for instance {id} and version {version} is " + "not found")
      })
  public Table getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Table Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "Table version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createTable",
      summary = "Create a table",
      description = "Create a new table under an existing `database`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "table",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTable create) {
    Table table = getTable(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, table);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateTable",
      summary = "Create or update a table",
      description = "Create a table, if it does not exist. If a table already exists, update the table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The table",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTable create) {
    Table table = getTable(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, table);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchTable",
      summary = "Update a table",
      description = "Update an existing table using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[" + "{op:remove, path:/a}," + "{op:add, path: /b, value: val}" + "]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteTable",
      summary = "Delete a table by Id",
      description = "Delete a table by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Table for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteTable",
      summary = "Delete a table by fully qualified name",
      description = "Delete a table by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Table for instance {fqn} is not found")
      })
  public Response deleteByFqn(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the table", schema = @Schema(type = "string")) @PathParam("fqn") String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted table",
      description = "Restore a soft deleted table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Table ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Response restoreTable(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollowerToTable",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as followed of this table",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "Table for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Id of the user to be added as follower", schema = @Schema(type = "string"))
          UUID userId) {
    return repository.addFollower(securityContext.getUserPrincipal().getName(), id, userId).toResponse();
  }

  @PUT
  @Path("/{id}/joins")
  @Operation(
      operationId = "addTableJoinInfo",
      summary = "Add table join information",
      description =
          "Add information about other tables that this table is joined with. Join information can only"
              + " be added for the last 30 days starting today.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully updated the Table",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class))),
        @ApiResponse(responseCode = "404", description = "Table for instance {id} is not found"),
        @ApiResponse(responseCode = "400", description = "Date range can only include past 30 days starting" + " today")
      })
  public Table addJoins(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Valid TableJoins joins) {
    // TODO add EDIT_JOINS operation
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.addJoins(id, joins);
    return addHref(uriInfo, table);
  }

  @PUT
  @Path("/{id}/sampleData")
  @Operation(
      operationId = "addSampleData",
      summary = "Add sample data",
      description = "Add sample data to the table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully update the Table",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Table addSampleData(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Valid TableData tableData) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_SAMPLE_DATA);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.addSampleData(id, tableData);
    return addHref(uriInfo, table);
  }

  @GET
  @Path("/{id}/sampleData")
  @Operation(
      operationId = "getSampleData",
      summary = "Get sample data",
      description = "Get sample data from the table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully update the Table",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Table getSampleData(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.VIEW_SAMPLE_DATA);
    ResourceContext resourceContext = getResourceContextById(id);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    boolean authorizePII = authorizer.authorizePII(securityContext, resourceContext.getOwner());

    Table table = repository.getSampleData(id, authorizePII);
    return addHref(uriInfo, table);
  }

  @DELETE
  @Path("/{id}/sampleData")
  @Operation(
      operationId = "deleteSampleData",
      summary = "Delete sample data",
      description = "Delete sample data from the table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully update the Table",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Table deleteSampleData(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_SAMPLE_DATA);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.deleteSampleData(id);
    return addHref(uriInfo, table);
  }

  @PUT
  @Path("/{id}/tableProfilerConfig")
  @Operation(
      operationId = "addDataProfilerConfig",
      summary = "Add table profile config",
      description = "Add table profile config to the table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully updated the Table ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Table addDataProfilerConfig(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Valid TableProfilerConfig tableProfilerConfig) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.addTableProfilerConfig(id, tableProfilerConfig);
    return addHref(uriInfo, table);
  }

  @GET
  @Path("/{id}/tableProfilerConfig")
  @Operation(
      operationId = "getDataProfilerConfig",
      summary = "Get table profile config",
      description = "Get table profile config to the table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully updated the Table ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Table getDataProfilerConfig(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.find(id, Include.NON_DELETED);
    return addHref(uriInfo, table.withTableProfilerConfig(repository.getTableProfilerConfig(table)));
  }

  @DELETE
  @Path("/{id}/tableProfilerConfig")
  @Operation(
      operationId = "delete DataProfilerConfig",
      summary = "Delete table profiler config",
      description = "delete table profile config to the table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully deleted the Table profiler config",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Table deleteDataProfilerConfig(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.deleteTableProfilerConfig(id);
    return addHref(uriInfo, table);
  }

  @GET
  @Path("/{fqn}/tableProfile/latest")
  @Operation(
      operationId = "Get the latest table and column profile",
      summary = "Get the latest table profile",
      description = "Get the latest table and column profile ",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Table with profile and column profile",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Response getLatestTableProfile(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "FQN of the table or column", schema = @Schema(type = "String")) @PathParam("fqn")
          String fqn) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    ResourceContext resourceContext = getResourceContextByName(fqn);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    boolean authorizePII = authorizer.authorizePII(securityContext, resourceContext.getOwner());

    return Response.status(Response.Status.OK)
        .entity(JsonUtils.pojoToJson(repository.getLatestTableProfile(fqn, authorizePII)))
        .build();
  }

  @GET
  @Path("/{fqn}/tableProfile")
  @Operation(
      operationId = "list Profiles",
      summary = "List of table profiles",
      description =
          "Get a list of all the table profiles for the given table fqn, optionally filtered by `extension`, `startTs` and `endTs` of the profile. "
              + "Use cursor-based pagination to limit the number of "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of table profiles",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = TableProfileList.class)))
      })
  public Response listTableProfiles(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "FQN of the table or column", schema = @Schema(type = "String")) @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Filter table/column profiles after the given start timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter table/column profiles before the given end timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("endTs")
          Long endTs) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return Response.status(Response.Status.OK)
        .entity(JsonUtils.pojoToJson(repository.getTableProfiles(fqn, startTs, endTs)))
        .build();
  }

  @GET
  @Path("/{fqn}/columnProfile")
  @Operation(
      operationId = "list column Profiles",
      summary = "List of column profiles",
      description =
          "Get a list of all the column profiles for the given table fqn, optionally filtered by `extension`, `startTs` and `endTs` of the profile. "
              + "Use cursor-based pagination to limit the number of "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of table profiles",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = ColumnProfileList.class)))
      })
  public ResultList<ColumnProfile> listColumnProfiles(
      @Context SecurityContext securityContext,
      @Parameter(description = "FQN of the column", schema = @Schema(type = "String")) @PathParam("fqn") String fqn,
      @Parameter(
              description = "Filter table/column profiles after the given start timestamp",
              schema = @Schema(type = "number"))
          @NotNull
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter table/column profiles before the given end timestamp",
              schema = @Schema(type = "number"))
          @NotNull
          @QueryParam("endTs")
          Long endTs) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return repository.getColumnProfiles(fqn, startTs, endTs);
  }

  @GET
  @Path("/{fqn}/systemProfile")
  @Operation(
      operationId = "list system Profiles",
      summary = "List of system profiles",
      description =
          "Get a list of all the system profiles for the given table fqn, filtered by `extension`, `startTs` and `endTs` of the profile. "
              + "Use cursor-based pagination to limit the number of "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of system profiles",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = SystemProfileList.class)))
      })
  public ResultList<SystemProfile> listSystemProfiles(
      @Context SecurityContext securityContext,
      @Parameter(description = "FQN of the table", schema = @Schema(type = "String")) @PathParam("fqn") String fqn,
      @Parameter(
              description = "Filter system profiles after the given start timestamp",
              schema = @Schema(type = "number"))
          @NotNull
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter system profiles before the given end timestamp",
              schema = @Schema(type = "number"))
          @NotNull
          @QueryParam("endTs")
          Long endTs) {
    return repository.getSystemProfiles(fqn, startTs, endTs);
  }

  @PUT
  @Path("/{id}/tableProfile")
  @Operation(
      operationId = "addDataProfiler",
      summary = "Add table profile data",
      description = "Add table profile data to the table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully updated the Table ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Table addDataProfiler(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Valid CreateTableProfile createTableProfile) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.addTableProfileData(id, createTableProfile);
    return addHref(uriInfo, table);
  }

  @DELETE
  @Path("/{fqn}/{entityType}/{timestamp}/profile")
  @Operation(
      operationId = "deleteDataProfiler",
      summary = "Delete table profile data",
      description = "Delete table profile data to the table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully deleted the Table Profile",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TableProfile.class)))
      })
  public Response deleteDataProfiler(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "FQN of the table or column", schema = @Schema(type = "String")) @PathParam("fqn")
          String fqn,
      @Parameter(description = "type of the entity table or column", schema = @Schema(type = "String"))
          @PathParam("entityType")
          String entityType,
      @Parameter(description = "Timestamp of the table profile", schema = @Schema(type = "long"))
          @PathParam("timestamp")
          Long timestamp) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    repository.deleteTableProfile(fqn, entityType, timestamp);
    return Response.ok().build();
  }

  @PUT
  @Path("/{id}/dataModel")
  @Operation(
      operationId = "addDataModel",
      summary = "Add data modeling information to a table",
      description = "Add data modeling (such as DBT model) information on how the table was created to the table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Table addDataModel(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "string")) @PathParam("id") UUID id,
      @Valid DataModel dataModel) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.addDataModel(id, dataModel);
    return addHref(uriInfo, table);
  }

  @PUT
  @Path("/{id}/customMetric")
  @Operation(
      operationId = "addCustomMetric",
      summary = "Add column custom metrics",
      description = "Add column custom metrics.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Table addCustomMetric(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Valid CreateCustomMetric createCustomMetric) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    CustomMetric customMetric = getCustomMetric(securityContext, createCustomMetric);
    Table table = repository.addCustomMetric(id, customMetric);
    return addHref(uriInfo, table);
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response updateVote(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Valid VoteRequest request) {
    return repository.updateVote(securityContext.getUserPrincipal().getName(), id, request).toResponse();
  }

  @DELETE
  @Path("/{id}/customMetric/{columnName}/{customMetricName}")
  @Operation(
      operationId = "deleteCustomMetric",
      summary = "Delete custom metric from a column",
      description = "Delete a custom metric from a column.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Table deleteCustomMetric(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "column of the table", schema = @Schema(type = "string")) @PathParam("columnName")
          String columnName,
      @Parameter(description = "column Test Type", schema = @Schema(type = "string")) @PathParam("customMetricName")
          String customMetricName) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_TESTS);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.deleteCustomMetric(id, columnName, customMetricName);
    return addHref(uriInfo, table);
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      operationId = "deleteFollower",
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ChangeEvent.class)))
      })
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Id of the user being removed as follower", schema = @Schema(type = "string"))
          @PathParam("userId")
          String userId) {
    return repository
        .deleteFollower(securityContext.getUserPrincipal().getName(), id, UUID.fromString(userId))
        .toResponse();
  }

  public static Table validateNewTable(Table table) {
    table.setId(UUID.randomUUID());
    DatabaseUtil.validateConstraints(table.getColumns(), table.getTableConstraints());
    DatabaseUtil.validateTablePartition(table.getColumns(), table.getTablePartition());
    DatabaseUtil.validateViewDefinition(table.getTableType(), table.getViewDefinition());
    DatabaseUtil.validateColumns(table.getColumns());
    return table;
  }

  private Table getTable(CreateTable create, String user) {
    return validateNewTable(
            copy(new Table(), create, user)
                .withColumns(create.getColumns())
                .withSourceUrl(create.getSourceUrl())
                .withTableConstraints(create.getTableConstraints())
                .withTablePartition(create.getTablePartition())
                .withTableType(create.getTableType())
                .withTags(create.getTags())
                .withFileFormat(create.getFileFormat())
                .withViewDefinition(create.getViewDefinition())
                .withTableProfilerConfig(create.getTableProfilerConfig())
                .withDatabaseSchema(getEntityReference(Entity.DATABASE_SCHEMA, create.getDatabaseSchema())))
        .withDatabaseSchema(getEntityReference(Entity.DATABASE_SCHEMA, create.getDatabaseSchema()))
        .withRetentionPeriod(create.getRetentionPeriod());
  }

  private CustomMetric getCustomMetric(SecurityContext securityContext, CreateCustomMetric create) {
    return new CustomMetric()
        .withId(UUID.randomUUID())
        .withDescription(create.getDescription())
        .withName(create.getName())
        .withColumnName(create.getColumnName())
        .withOwner(create.getOwner())
        .withExpression(create.getExpression())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }
}
