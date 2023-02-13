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
import org.openmetadata.schema.type.SQLQuery;
import org.openmetadata.schema.type.SystemProfile;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TableJoins;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TableProfilerConfig;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.ResultList;

@Path("/v1/tables")
@Api(value = "Tables collection", tags = "Tables collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "tables")
public class TableResource extends EntityResource<Table, TableRepository> {
  public static final String COLLECTION_PATH = "v1/tables/";

  @Override
  public Table addHref(UriInfo uriInfo, Table table) {
    Entity.withHref(uriInfo, table.getDatabaseSchema());
    Entity.withHref(uriInfo, table.getDatabase());
    Entity.withHref(uriInfo, table.getService());
    Entity.withHref(uriInfo, table.getLocation());
    Entity.withHref(uriInfo, table.getOwner());
    Entity.withHref(uriInfo, table.getFollowers());
    return table;
  }

  public TableResource(CollectionDAO dao, Authorizer authorizer) {
    super(Table.class, new TableRepository(dao), authorizer);
    allowedFields.add("customMetrics");
  }

  public static class TableList extends ResultList<Table> {
    @SuppressWarnings("unused")
    public TableList() {
      /* Required for serde */
    }
  }

  public static class TableProfileList extends ResultList<TableProfile> {
    @SuppressWarnings("unused")
    public TableProfileList() {
      /* Required for serde */
    }
  }

  public static class ColumnProfileList extends ResultList<ColumnProfile> {
    @SuppressWarnings("unused")
    public ColumnProfileList() {
      /* Required for serde */
    }
  }

  public static class SystemProfileList extends ResultList<SystemProfile> {
    @SuppressWarnings("unused")
    public SystemProfileList() {
      /* Required for serde */
    }
  }

  static final String FIELDS =
      "tableConstraints,tablePartition,usageSummary,owner,customMetrics,"
          + "tags,followers,joins,viewDefinition,location,dataModel,extension";

  @GET
  @Operation(
      operationId = "listTables",
      summary = "List tables",
      tags = "tables",
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
          Include include)
      throws IOException {
    ListFilter filter = new ListFilter(include).addQueryParam("database", databaseParam);
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getTableByID",
      summary = "Get a table",
      tags = "tables",
      description = "Get a table by `id`",
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
          Include include)
      throws IOException {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getTableByFQN",
      summary = "Get a table by name",
      tags = "tables",
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
          Include include)
      throws IOException {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllTableVersion",
      summary = "List table versions",
      tags = "tables",
      description = "Get a list of all the versions of a table identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of table versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Table Id", schema = @Schema(type = "string")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificDatabaseVersion",
      summary = "Get a version of the table",
      tags = "tables",
      description = "Get a version of the table by given `id`",
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
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createTable",
      summary = "Create a table",
      tags = "tables",
      description = "Create a new table under an existing `database`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "table",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTable create)
      throws IOException {
    Table table = getTable(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, table);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateTable",
      summary = "Create or update a table",
      tags = "tables",
      description = "Create a table, if it does not exist. If a table already exists, update the table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The table",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTable create)
      throws IOException {
    Table table = getTable(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, table);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchTable",
      summary = "Update a table",
      tags = "tables",
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
          JsonPatch patch)
      throws IOException {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteTable",
      summary = "Delete a table",
      tags = "tables",
      description = "Delete a table by `id`.",
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
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteTable",
      summary = "Delete a table",
      tags = "tables",
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
      @Parameter(description = "Name of the table", schema = @Schema(type = "string")) @PathParam("fqn") String fqn)
      throws IOException {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted table.",
      tags = "tables",
      description = "Restore a soft deleted table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Table ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Response restoreTable(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollowerToTable",
      summary = "Add a follower",
      tags = "tables",
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
      @Parameter(description = "Id of the user to be added as follower", schema = @Schema(type = "string")) UUID userId)
      throws IOException {
    return dao.addFollower(securityContext.getUserPrincipal().getName(), id, userId).toResponse();
  }

  @PUT
  @Path("/{id}/joins")
  @Operation(
      operationId = "addTableJoinInfo",
      summary = "Add table join information",
      description =
          "Add information about other tables that this table is joined with. Join information can only"
              + " be added for the last 30 days starting today.",
      tags = "tables",
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
      @Valid TableJoins joins)
      throws IOException {
    // TODO add EDIT_JOINS operation
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = dao.addJoins(id, joins);
    return addHref(uriInfo, table);
  }

  @PUT
  @Path("/{id}/sampleData")
  @Operation(
      operationId = "addSampleData",
      summary = "Add sample data",
      tags = "tables",
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
      @Valid TableData tableData)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_SAMPLE_DATA);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = dao.addSampleData(id, tableData);
    return addHref(uriInfo, table);
  }

  @GET
  @Path("/{id}/sampleData")
  @Operation(
      operationId = "getSampleData",
      summary = "get sample data",
      tags = "tables",
      description = "get sample data from the table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully update the Table",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Table getSampleData(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Valid TableData tableData)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.VIEW_SAMPLE_DATA);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return addHref(uriInfo, dao.getSampleData(id));
  }

  @DELETE
  @Path("/{id}/sampleData")
  @Operation(
      operationId = "deleteSampleData",
      summary = "delete sample data",
      tags = "tables",
      description = "delete sample data from the table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully update the Table",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Table deleteSampleData(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Valid TableData tableData)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_SAMPLE_DATA);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = dao.deleteSampleData(id);
    return addHref(uriInfo, table);
  }

  @PUT
  @Path("/{id}/tableProfilerConfig")
  @Operation(
      operationId = "addDataProfilerConfig",
      summary = "Add table profile Config",
      tags = "tables",
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
      @Valid TableProfilerConfig tableProfilerConfig)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = dao.addTableProfilerConfig(id, tableProfilerConfig);
    return addHref(uriInfo, table);
  }

  @GET
  @Path("/{id}/tableProfilerConfig")
  @Operation(
      operationId = "getDataProfilerConfig",
      summary = "Get table profile Config",
      tags = "tables",
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
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = dao.get(uriInfo, id, Fields.EMPTY_FIELDS);
    return addHref(uriInfo, table.withTableProfilerConfig(dao.getTableProfilerConfig(table)));
  }

  @DELETE
  @Path("/{id}/tableProfilerConfig")
  @Operation(
      operationId = "delete DataProfilerConfig",
      summary = "delete table profiler config",
      tags = "tables",
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
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = dao.deleteTableProfilerConfig(id);
    return addHref(uriInfo, table);
  }

  @GET
  @Path("/{fqn}/tableProfile/latest")
  @Operation(
      operationId = "Get the latest table and column profile",
      summary = "get the latest tableProfile",
      tags = "tables",
      description = "Get the latest table and column profile ",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Table with profile and column profile",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Table getLatestTableProfile(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "FQN of the table or column", schema = @Schema(type = "String")) @PathParam("fqn")
          String fqn)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return dao.getLatestTableProfile(fqn);
  }

  @GET
  @Path("/{fqn}/tableProfile")
  @Operation(
      operationId = "list Profiles",
      summary = "List of table profiles",
      tags = "tables",
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
  public ResultList<TableProfile> listTableProfiles(
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
          Long endTs)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return dao.getTableProfiles(fqn, startTs, endTs);
  }

  @GET
  @Path("/{fqn}/columnProfile")
  @Operation(
      operationId = "list column Profiles",
      summary = "List of column profiles",
      tags = "tables",
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
          Long endTs)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return dao.getColumnProfiles(fqn, startTs, endTs);
  }

  @GET
  @Path("/{fqn}/systemProfile")
  @Operation(
      operationId = "list system Profiles",
      summary = "List of system profiles",
      tags = "tables",
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
          Long endTs)
      throws IOException {
    return dao.getSystemProfiles(fqn, startTs, endTs);
  }

  @PUT
  @Path("/{id}/tableProfile")
  @Operation(
      operationId = "addDataProfiler",
      summary = "Add table profile data",
      tags = "tables",
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
      @Valid CreateTableProfile createTableProfile)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = dao.addTableProfileData(id, createTableProfile);
    return addHref(uriInfo, table);
  }

  @DELETE
  @Path("/{fqn}/{entityType}/{timestamp}/profile")
  @Operation(
      operationId = "deleteDataProfiler",
      summary = "delete table profile data",
      tags = "tables",
      description = "delete table profile data to the table.",
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
          Long timestamp)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    dao.deleteTableProfile(fqn, entityType, timestamp);
    return Response.ok().build();
  }

  @PUT
  @Path("/{id}/location")
  @Operation(
      operationId = "addLocationToTable",
      summary = "Add a location",
      tags = "tables",
      description = "Add a location identified by `locationId` to this table",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class))),
        @ApiResponse(responseCode = "404", description = "Table for instance {id} is not found")
      })
  public Response addLocation(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Id of the location to be added", schema = @Schema(type = "UUID")) UUID locationId)
      throws IOException {

    Table table = dao.addLocation(id, locationId);
    return Response.ok().entity(table).build();
  }

  @PUT
  @Path("/{id}/tableQuery")
  @Operation(
      operationId = "addTableQuery",
      summary = "Add table query data",
      tags = "tables",
      description = "Add table query data to the table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Table addQuery(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Valid SQLQuery sqlQuery)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = dao.addQuery(id, sqlQuery);
    return addHref(uriInfo, table);
  }

  @GET
  @Path("/{id}/tableQuery")
  @Operation(
      operationId = "getTableQuery",
      summary = "get table query data",
      tags = "tables",
      description = "get table query data from the table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Table getQuery(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Valid SQLQuery sqlQuery)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.VIEW_QUERIES);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = dao.getQueries(id);
    return addHref(uriInfo, table);
  }

  @GET
  @Path("/{id}/getTableQueries")
  @Operation(
      operationId = "getTableQueryList",
      summary = "get table query data",
      tags = "tables",
      description = "get table query data from the table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public ResultList<SQLQuery> getTableQueryList(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Valid SQLQuery sqlQuery,
      @DefaultValue("10") @Min(0) @Max(1000000) @QueryParam("limit") int limitParam,
      @Parameter(description = "Returns list of users before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of users after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.VIEW_QUERIES);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return dao.getQueriesForPagination(id, limitParam, before, after);
  }

  @PUT
  @Path("/{id}/dataModel")
  @Operation(
      operationId = "addDataModel",
      summary = "Add data modeling information to a table",
      tags = "tables",
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
      @Valid DataModel dataModel)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = dao.addDataModel(id, dataModel);
    return addHref(uriInfo, table);
  }

  @PUT
  @Path("/{id}/customMetric")
  @Operation(
      operationId = "addCustomMetric",
      summary = "Add column custom metrics",
      tags = "tables",
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
      @Valid CreateCustomMetric createCustomMetric)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    CustomMetric customMetric = getCustomMetric(securityContext, createCustomMetric);
    Table table = dao.addCustomMetric(id, customMetric);
    return addHref(uriInfo, table);
  }

  @DELETE
  @Path("/{id}/customMetric/{columnName}/{customMetricName}")
  @Operation(
      operationId = "deleteCustomMetric",
      summary = "delete custom metric from a column",
      tags = "tables",
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
          String customMetricName)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_TESTS);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = dao.deleteCustomMetric(id, columnName, customMetricName);
    return addHref(uriInfo, table);
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      operationId = "deleteFollower",
      summary = "Remove a follower",
      tags = "tables",
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
          String userId)
      throws IOException {
    return dao.deleteFollower(securityContext.getUserPrincipal().getName(), id, UUID.fromString(userId)).toResponse();
  }

  @DELETE
  @Path("/{id}/location")
  @Operation(
      operationId = "deleteLocation",
      summary = "Remove the location",
      tags = "tables",
      description = "Remove the location",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Table deleteLocation(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    Fields fields = getFields("location");
    dao.deleteLocation(id);
    Table table = dao.get(uriInfo, id, fields);
    return addHref(uriInfo, table);
  }

  public static Table validateNewTable(Table table) {
    table.setId(UUID.randomUUID());
    DatabaseUtil.validateConstraints(table.getColumns(), table.getTableConstraints());
    DatabaseUtil.validateTablePartition(table.getColumns(), table.getTablePartition());
    DatabaseUtil.validateViewDefinition(table.getTableType(), table.getViewDefinition());
    DatabaseUtil.validateColumns(table);
    return table;
  }

  private Table getTable(CreateTable create, String user) throws IOException {
    return validateNewTable(
        copy(new Table(), create, user)
            .withColumns(create.getColumns())
            .withTableConstraints(create.getTableConstraints())
            .withTablePartition(create.getTablePartition())
            .withTableType(create.getTableType())
            .withTags(create.getTags())
            .withViewDefinition(create.getViewDefinition())
            .withTableProfilerConfig(create.getTableProfilerConfig())
            .withDatabaseSchema(create.getDatabaseSchema()));
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
