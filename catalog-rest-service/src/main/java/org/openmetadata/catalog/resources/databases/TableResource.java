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
import java.util.ArrayList;
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
import org.openmetadata.catalog.api.data.CreateTable;
import org.openmetadata.catalog.api.tests.CreateColumnTest;
import org.openmetadata.catalog.api.tests.CreateCustomMetric;
import org.openmetadata.catalog.api.tests.CreateTableTest;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.jdbi3.TableRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.resources.EntityResource;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.tests.ColumnTest;
import org.openmetadata.catalog.tests.CustomMetric;
import org.openmetadata.catalog.tests.TableTest;
import org.openmetadata.catalog.type.DataModel;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.SQLQuery;
import org.openmetadata.catalog.type.TableData;
import org.openmetadata.catalog.type.TableJoins;
import org.openmetadata.catalog.type.TableProfile;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.ResultList;

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
    allowedFields.add("tests");
    allowedFields.add("customMetrics");
  }

  public static class TableList extends ResultList<Table> {
    @SuppressWarnings("unused")
    public TableList() {
      /* Required for serde */
    }

    public TableList(List<Table> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS =
      "tableConstraints,tablePartition,usageSummary,owner,profileSample,customMetrics,"
          + "tags,followers,joins,sampleData,viewDefinition,tableProfile,location,tableQueries,dataModel,tests";

  @GET
  @Operation(
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
      @Parameter(description = "table Id", schema = @Schema(type = "string")) @PathParam("id") String id,
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
      summary = "Get a table by name",
      tags = "tables",
      description = "Get a table by fully qualified table name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "table",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class))),
        @ApiResponse(responseCode = "404", description = "Table for instance {id} is not found")
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
      @Parameter(description = "table Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
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
      @Parameter(description = "table Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "table version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(
      summary = "Create a table",
      tags = "tables",
      description = "Create a new table under an existing `database`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "table",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreateTable.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTable create)
      throws IOException {
    Table table = getTable(securityContext, create);
    return create(uriInfo, securityContext, table, ADMIN | BOT);
  }

  @PUT
  @Operation(
      summary = "Create or update a table",
      tags = "tables",
      description = "Create a table, if it does not exist. If a table already exists, update the table.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The table",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreateTable.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTable create)
      throws IOException {
    Table table = getTable(securityContext, create);
    return createOrUpdate(uriInfo, securityContext, table, ADMIN | BOT | OWNER);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      summary = "Update a table",
      tags = "tables",
      description = "Update an existing table using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "string")) @PathParam("id") String id,
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
      summary = "Delete a table",
      tags = "tables",
      description = "Delete a table by `id`. Table is not immediately deleted and is only marked as deleted.",
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
      @Parameter(description = "Id of the table", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete, ADMIN | BOT);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      summary = "Add a follower",
      tags = "tables",
      description = "Add a user identified by `userId` as followed of this table",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Table for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(description = "Id of the user to be added as follower", schema = @Schema(type = "string"))
          String userId)
      throws IOException {
    return dao.addFollower(securityContext.getUserPrincipal().getName(), UUID.fromString(id), UUID.fromString(userId))
        .toResponse();
  }

  @PUT
  @Path("/{id}/joins")
  @Operation(
      summary = "Add table join information",
      description =
          "Add information about other tables that this table is joined with. Join information can only"
              + " be added for the last 30 days starting today.",
      tags = "tables",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Table for instance {id} is not found"),
        @ApiResponse(responseCode = "400", description = "Date range can only include past 30 days starting" + " today")
      })
  public Table addJoins(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Valid TableJoins joins)
      throws IOException {
    SecurityUtil.authorizeAdmin(authorizer, securityContext, ADMIN | BOT);
    Table table = dao.addJoins(UUID.fromString(id), joins);
    return addHref(uriInfo, table);
  }

  @PUT
  @Path("/{id}/sampleData")
  @Operation(summary = "Add sample data", tags = "tables", description = "Add sample data to the table.")
  public Table addSampleData(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Valid TableData tableData)
      throws IOException {
    SecurityUtil.authorizeAdmin(authorizer, securityContext, ADMIN | BOT);
    Table table = dao.addSampleData(UUID.fromString(id), tableData);
    return addHref(uriInfo, table);
  }

  @PUT
  @Path("/{id}/tableProfile")
  @Operation(summary = "Add table profile data", tags = "tables", description = "Add table profile data to the table.")
  public Table addDataProfiler(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Valid TableProfile tableProfile)
      throws IOException {
    SecurityUtil.authorizeAdmin(authorizer, securityContext, ADMIN | BOT);
    Table table = dao.addTableProfileData(UUID.fromString(id), tableProfile);
    return addHref(uriInfo, table);
  }

  @PUT
  @Path("/{id}/location")
  @Operation(
      summary = "Add a location",
      tags = "tables",
      description = "Add a location identified by `locationId` to this table",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Table for instance {id} is not found")
      })
  public Response addLocation(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(description = "Id of the location to be added", schema = @Schema(type = "string")) String locationId)
      throws IOException {
    Table table = dao.addLocation(UUID.fromString(id), UUID.fromString(locationId));
    return Response.ok().entity(table).build();
  }

  @PUT
  @Path("/{id}/tableQuery")
  @Operation(summary = "Add table query data", tags = "tables", description = "Add table query data to the table.")
  public Table addQuery(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Valid SQLQuery sqlQuery)
      throws IOException {
    SecurityUtil.authorizeAdmin(authorizer, securityContext, ADMIN | BOT);
    Table table = dao.addQuery(UUID.fromString(id), sqlQuery);
    return addHref(uriInfo, table);
  }

  @PUT
  @Path("/{id}/dataModel")
  @Operation(
      summary = "Add data modeling information to a table",
      tags = "tables",
      description = "Add data modeling (such as DBT model) information on how the table was created to the table.")
  public Table addDataModel(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Valid DataModel dataModel)
      throws IOException {
    SecurityUtil.authorizeAdmin(authorizer, securityContext, ADMIN | BOT);
    Table table = dao.addDataModel(UUID.fromString(id), dataModel);
    return addHref(uriInfo, table);
  }

  @PUT
  @Path("/{id}/tableTest")
  @Operation(summary = "Add table test cases", tags = "tables", description = "Add test cases to the table.")
  public Table addTableTest(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Valid CreateTableTest createTableTest)
      throws IOException {
    SecurityUtil.authorizeAdmin(authorizer, securityContext, ADMIN | BOT);
    TableTest tableTest = getTableTest(securityContext, createTableTest);
    Table table = dao.addTableTest(UUID.fromString(id), tableTest);
    return addHref(uriInfo, table);
  }

  @DELETE
  @Path("/{id}/tableTest/{tableTestType}")
  @Operation(summary = "delete table test case", tags = "tables", description = "Delete test case from the table.")
  public Table deleteTableTest(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(description = "Table Test Type", schema = @Schema(type = "string")) @PathParam("tableTestType")
          String tableTestType)
      throws IOException {
    SecurityUtil.authorizeAdmin(authorizer, securityContext, ADMIN | BOT);
    Table table = dao.deleteTableTest(UUID.fromString(id), tableTestType);
    return addHref(uriInfo, table);
  }

  @PUT
  @Path("/{id}/columnTest")
  @Operation(summary = "Add column test cases", tags = "tables", description = "Add column test cases to the table.")
  public Table addColumnTest(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Valid CreateColumnTest createColumnTest)
      throws IOException {
    SecurityUtil.authorizeAdmin(authorizer, securityContext, ADMIN | BOT);
    ColumnTest columnTest = getColumnTest(securityContext, createColumnTest);
    Table table = dao.addColumnTest(UUID.fromString(id), columnTest);
    return addHref(uriInfo, table);
  }

  @PUT
  @Path("/{id}/customMetric")
  @Operation(summary = "Add column custom metrics", tags = "tables", description = "Add column custom metrics.")
  public Table addCustomMetric(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Valid CreateCustomMetric createCustomMetric)
      throws IOException {
    SecurityUtil.authorizeAdmin(authorizer, securityContext, ADMIN | BOT);
    CustomMetric customMetric = getCustomMetric(securityContext, createCustomMetric);
    Table table = dao.addCustomMetric(UUID.fromString(id), customMetric);
    return addHref(uriInfo, table);
  }

  @DELETE
  @Path("/{id}/columnTest/{columnName}/{columnTestType}")
  @Operation(
      summary = "delete column test case",
      tags = "tables",
      description = "Delete column test case from the table.")
  public Table deleteColumnTest(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(description = "column of the table", schema = @Schema(type = "string")) @PathParam("columnName")
          String columnName,
      @Parameter(description = "column Test Type", schema = @Schema(type = "string")) @PathParam("columnTestType")
          String columnTestType)
      throws IOException {
    SecurityUtil.authorizeAdmin(authorizer, securityContext, ADMIN | BOT);
    Table table = dao.deleteColumnTest(UUID.fromString(id), columnName, columnTestType);
    return addHref(uriInfo, table);
  }

  @DELETE
  @Path("/{id}/customMetric/{columnName}/{customMetricName}")
  @Operation(
      summary = "delete custom metric from a column",
      tags = "tables",
      description = "Delete a custom metric from a column.")
  public Table deleteCustomMetric(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(description = "column of the table", schema = @Schema(type = "string")) @PathParam("columnName")
          String columnName,
      @Parameter(description = "column Test Type", schema = @Schema(type = "string")) @PathParam("customMetricName")
          String customMetricName)
      throws IOException {
    SecurityUtil.authorizeAdmin(authorizer, securityContext, ADMIN | BOT);
    Table table = dao.deleteCustomMetric(UUID.fromString(id), columnName, customMetricName);
    return addHref(uriInfo, table);
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      summary = "Remove a follower",
      tags = "tables",
      description = "Remove the user identified `userId` as a follower of the table.")
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(description = "Id of the user being removed as follower", schema = @Schema(type = "string"))
          @PathParam("userId")
          String userId)
      throws IOException {
    return dao.deleteFollower(
            securityContext.getUserPrincipal().getName(), UUID.fromString(id), UUID.fromString(userId))
        .toResponse();
  }

  @DELETE
  @Path("/{id}/location")
  @Operation(summary = "Remove the location", tags = "tables", description = "Remove the location")
  public Table deleteLocation(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the table", schema = @Schema(type = "string")) @PathParam("id") String id)
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

  private Table getTable(SecurityContext securityContext, CreateTable create) {
    return validateNewTable(
        new Table()
            .withId(UUID.randomUUID())
            .withName(create.getName())
            .withColumns(create.getColumns())
            .withDescription(create.getDescription())
            .withTableConstraints(create.getTableConstraints())
            .withTablePartition(create.getTablePartition())
            .withTableType(create.getTableType())
            .withTags(create.getTags())
            .withViewDefinition(create.getViewDefinition())
            .withProfileSample(create.getProfileSample())
            .withUpdatedBy(securityContext.getUserPrincipal().getName())
            .withOwner(create.getOwner())
            .withUpdatedAt(System.currentTimeMillis())
            .withDatabaseSchema(create.getDatabaseSchema()));
  }

  private TableTest getTableTest(SecurityContext securityContext, CreateTableTest create) {
    return new TableTest()
        .withId(UUID.randomUUID())
        .withDescription(create.getDescription())
        .withTestCase(create.getTestCase())
        .withOwner(create.getOwner())
        .withExecutionFrequency(create.getExecutionFrequency())
        .withResults(create.getResult() != null ? List.of(create.getResult()) : new ArrayList<>())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }

  private ColumnTest getColumnTest(SecurityContext securityContext, CreateColumnTest create) {
    return new ColumnTest()
        .withId(UUID.randomUUID())
        .withDescription(create.getDescription())
        .withTestCase(create.getTestCase())
        .withColumnName(create.getColumnName())
        .withOwner(create.getOwner())
        .withExecutionFrequency(create.getExecutionFrequency())
        .withResults(create.getResult() != null ? List.of(create.getResult()) : new ArrayList<>())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
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
