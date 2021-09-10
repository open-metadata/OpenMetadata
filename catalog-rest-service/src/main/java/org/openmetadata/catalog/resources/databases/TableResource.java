/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.databases;

import com.google.inject.Inject;
import org.openmetadata.catalog.type.TableData;
import org.openmetadata.catalog.type.TableJoins;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.openmetadata.catalog.api.data.CreateTable;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.jdbi3.TableRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.CatalogAuthorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TableProfile;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Path("/v1/tables")
@Api(value = "Tables collection", tags = "Tables collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "tables", repositoryClass = "org.openmetadata.catalog.jdbi3.TableRepository")
public class TableResource {
  private static final Logger LOG = LoggerFactory.getLogger(TableResource.class);
  private static final String TABLE_COLLECTION_PATH = "v1/tables/";
  private final TableRepository dao;
  private final CatalogAuthorizer authorizer;

  public static void addHref(UriInfo uriInfo, EntityReference ref) {
    ref.withHref(RestUtil.getHref(uriInfo, TABLE_COLLECTION_PATH, ref.getId()));
  }

  public static Table addHref(UriInfo uriInfo, Table table) {
    table.setHref(RestUtil.getHref(uriInfo, TABLE_COLLECTION_PATH, table.getId()));
    if (table.getDatabase() != null) {
      DatabaseResource.addHref(uriInfo, table.getDatabase());
    }
    EntityUtil.addHref(uriInfo, table.getOwner());
    EntityUtil.addHref(uriInfo, table.getFollowers());
    return table;
  }

  @Inject
  public TableResource(TableRepository dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "TableRepository must not be null");
    this.dao = dao;
    this.authorizer = authorizer;
  }

  public static class TableList extends ResultList<Table> {
    @SuppressWarnings("unused") /* Required for tests */
    public TableList() {}

    public TableList(List<Table> data, String beforeCursor, String afterCursor, int total)
            throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "columns,tableConstraints,usageSummary,owner," +
          "database,tags,followers,joins,sampleData,viewDefinition,tableProfile";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replaceAll(" ", "")
          .split(","));

  @GET
  @Operation(summary = "List tables", tags = "tables",
          description = "Get a list of tables, optionally filtered by `database` it belongs to. Use `fields` " +
                  "parameter to get only necessary fields. Use cursor-based pagination to limit the number " +
                  "entries in the list using `limit` and `before` or `after` query params.",
          responses = {@ApiResponse(responseCode = "200", description = "List of tables",
                  content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = TableList.class)))
          })
  public TableList list(@Context UriInfo uriInfo,
                        @Context SecurityContext securityContext,
                        @Parameter(description = "Fields requested in the returned resource",
                                schema = @Schema(type = "string", example = FIELDS))
                        @QueryParam("fields") String fieldsParam,
                        @Parameter(description = "Filter tables by database fully qualified name",
                                schema = @Schema(type = "string", example = "snowflakeWestCoast.financeDB"))
                        @QueryParam("database") String databaseParam,
                        @Parameter(description = "Limit the number tables returned. (1 to 1000000, default = 10) ",
                                schema = @Schema(type = "string", example = "snowflakeWestCoast.financeDB"))
                        @DefaultValue("10")
                        @Min(1)
                        @Max(1000000)
                        @QueryParam("limit") int limitParam,
                        @Parameter(description = "Returns list of tables before this cursor",
                                schema = @Schema(type = "string"))
                        @QueryParam("before") String before,
                        @Parameter(description = "Returns list of tables after this curor",
                                schema = @Schema(type = "string"))
                        @QueryParam("after") String after)
          throws IOException, ParseException, GeneralSecurityException {
    RestUtil.validateCursors(before, after);
    Fields fields = new Fields(FIELD_LIST, fieldsParam);

    TableList tables;
    if (before != null) { // Reverse paging
      tables = dao.listBefore(fields, databaseParam, limitParam, before);
    } else { // Forward paging or first page
      tables = dao.listAfter(fields, databaseParam, limitParam, after);
    }
    tables.getData().forEach(t -> addHref(uriInfo, t));
    return tables;
  }

  @GET
  @Path("/{id}")
  @Operation(summary = "Get a table", tags = "tables",
          description = "Get a table by `id`",
          responses = {
                  @ApiResponse(responseCode = "200", description = "table",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Table.class))),
                  @ApiResponse(responseCode = "404", description = "Table for instance {id} is not found")
          })
  public Table get(@Context UriInfo uriInfo,
                   @Context SecurityContext securityContext,
                   @Parameter(description = "table Id", schema = @Schema(type = "string"))
                   @PathParam("id") String id,
                   @Parameter(description = "Fields requested in the returned resource",
                           schema = @Schema(type = "string", example = FIELDS))
                   @QueryParam("fields") String fieldsParam) throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.get(id, fields));
  }
  
  @GET
  @Path("/name/{fqn}")
  @Operation(summary = "Get a table by name", tags = "tables",
          description = "Get a table by fully qualified table name.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "table",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Table.class))),
                  @ApiResponse(responseCode = "404", description = "Table for instance {id} is not found")
          })
  public Table getByName(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Parameter(description = "Fully qualified name of the table",
                                    schema = @Schema(type = "string"))
                         @PathParam("fqn") String fqn,
                         @Parameter(description = "Fields requested in the returned resource",
                                    schema = @Schema(type = "string", example = FIELDS))
                         @QueryParam("fields") String fieldsParam) throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.getByName(fqn, fields));
  }

  @POST
  @Operation(summary = "Create a table", tags = "tables",
          description = "Create a new table under an existing `database`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "table",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Table.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response create(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Valid CreateTable create) throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Table table = new Table().withId(UUID.randomUUID()).withName(create.getName())
            .withColumns(create.getColumns()).withDescription(create.getDescription())
            .withTableConstraints(create.getTableConstraints()).withTableType(create.getTableType())
            .withTags(create.getTags()).withViewDefinition(create.getViewDefinition());
    table = addHref(uriInfo, dao.create(validateNewTable(table), create.getOwner(), create.getDatabase()));
    return Response.created(table.getHref()).entity(table).build();
  }

  @PUT
  @Operation(summary = "Create or update a table", tags = "tables",
          description = "Create a table, if it does not exist. If a table already exists, update the table.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The table",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Table.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response createOrUpdate(@Context UriInfo uriInfo,
                                 @Context SecurityContext securityContext,
                                 @Valid CreateTable create) throws IOException, ParseException {
    Table table = new Table().withId(UUID.randomUUID()).withName(create.getName())
            .withColumns(create.getColumns()).withDescription(create.getDescription())
            .withTableConstraints(create.getTableConstraints()).withTableType(create.getTableType())
            .withTags(create.getTags()).withViewDefinition(create.getViewDefinition());
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext, dao.getOwnerReference(table));
    PutResponse<Table> response = dao.createOrUpdate(validateNewTable(table), create.getOwner(), create.getDatabase());
    table = addHref(uriInfo, response.getEntity());
    return Response.status(response.getStatus()).entity(table).build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(summary = "Update a table", tags = "tables",
          description = "Update an existing table using JsonPatch.",
          externalDocs = @ExternalDocumentation(description = "JsonPatch RFC",
                  url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Table patch(@Context UriInfo uriInfo,
                     @Context SecurityContext securityContext,
                     @Parameter(description = "Id of the table", schema = @Schema(type = "string"))
                     @PathParam("id") String id,
                     @RequestBody(description = "JsonPatch with array of operations",
                             content = @Content(mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                                     examples = {@ExampleObject("[" +
                                             "{op:remove, path:/a}," +
                                             "{op:add, path: /b, value: val}" +
                                             "]")}))
                             JsonPatch patch) throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, FIELDS);
    Table table = dao.get(id, fields);
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext, dao.getOwnerReference(table));
    table = dao.patch(id, patch);
    return addHref(uriInfo, table);
  }

  @DELETE
  @Path("/{id}")
  @Operation(summary = "Delete a table", tags = "tables",
          description = "Delete a table by `id`. Table is not immediately deleted and is only marked as deleted.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "Table for instance {id} is not found")
          })
  public Response delete(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Parameter(description = "Id of the table", schema = @Schema(type = "string"))
                         @PathParam("id") String id) {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    dao.delete(id);
    return Response.ok().build();
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(summary = "Add a follower", tags = "tables",
          description = "Add a user identified by `userId` as followed of this table",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "Table for instance {id} is not found")
          })
  public Response addFollower(@Context UriInfo uriInfo,
                              @Context SecurityContext securityContext,
                              @Parameter(description = "Id of the table", schema = @Schema(type = "string"))
                              @PathParam("id") String id,
                              @Parameter(description = "Id of the user to be added as follower",
                                      schema = @Schema(type = "string"))
                                      String userId) throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, "followers");
    Status status = dao.addFollower(id, userId);
    Table table = dao.get(id, fields);
    return Response.status(status).entity(table).build();
  }

  @PUT
  @Path("/{id}/joins")
  @Operation(summary = "Add table join information",
          description = "Add information about other tables that this table is joined with. Join information can only" +
                  " be added for the last 30 days starting today.", tags = "tables",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "Table for instance {id} is not found"),
                  @ApiResponse(responseCode = "400", description = "Date range can only include past 30 days starting" +
                          " today")
          })
  public Table addJoins(@Context UriInfo uriInfo,
                           @Context SecurityContext securityContext,
                           @Parameter(description = "Id of the table", schema = @Schema(type = "string"))
                           @PathParam("id") String id, TableJoins joins) throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Fields fields = new Fields(FIELD_LIST, "joins");
    dao.addJoins(id, joins);
    Table table = dao.get(id, fields);
    return addHref(uriInfo, table);
  }

  @PUT
  @Path("/{id}/sampleData")
  @Operation(summary = "Add sample data", tags = "tables",
          description = "Add sample data to the table.")
  public Table addSampleData(@Context UriInfo uriInfo,
                                @Context SecurityContext securityContext,
                                @Parameter(description = "Id of the table", schema = @Schema(type = "string"))
                                @PathParam("id") String id, TableData tableData) throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Fields fields = new Fields(FIELD_LIST, "sampleData");
    dao.addSampleData(id, tableData);
    Table table = dao.get(id, fields);
    return addHref(uriInfo, table);
  }

  @PUT
  @Path("/{id}/tableProfile")
  @Operation(summary = "Add table profile data", tags = "tables",
          description = "Add table profile data to the table.")
  public Table addDataProfiler(@Context UriInfo uriInfo,
                             @Context SecurityContext securityContext,
                             @Parameter(description = "Id of the table", schema = @Schema(type = "string"))
                             @PathParam("id") String id, TableProfile tableProfile) throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Fields fields = new Fields(FIELD_LIST, "tableProfile");
    dao.addTableProfileData(id, tableProfile);
    Table table = dao.get(id, fields);
    return addHref(uriInfo, table);
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(summary = "Remove a follower", tags = "tables",
          description = "Remove the user identified `userId` as a follower of the table.")
  public Table deleteFollower(@Context UriInfo uriInfo,
                                 @Context SecurityContext securityContext,
                                 @Parameter(description = "Id of the table",
                                         schema = @Schema(type = "string"))
                                 @PathParam("id") String id,
                                 @Parameter(description = "Id of the user being removed as follower",
                                         schema = @Schema(type = "string"))
                                 @PathParam("userId") String userId) throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, "followers");
    dao.deleteFollower(id, userId);
    Table table = dao.get(id, fields);
    return addHref(uriInfo, table);
  }

  public static Table validateNewTable(Table table) {
    table.setId(UUID.randomUUID());
    DatabaseUtil.validateConstraints(table.getColumns(), table.getTableConstraints());
    DatabaseUtil.validateViewDefinition(table.getTableType(), table.getViewDefinition());
    return table;
  }
}
