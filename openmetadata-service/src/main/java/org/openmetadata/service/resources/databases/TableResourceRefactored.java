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

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.ServiceRegistry;
import org.openmetadata.service.services.databases.TableService;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * DEMONSTRATION: Refactored TableResource using Service Layer Pattern.
 *
 * <p>This class demonstrates how TableResource should be refactored to use TableService. Key
 * principles:
 *
 * <ul>
 *   <li>Resource class is THIN - only handles HTTP concerns (parsing params, returning responses)
 *   <li>All business logic is in TableService
 *   <li>No direct repository access from resource
 *   <li>Service is injected via constructor
 * </ul>
 *
 * <p>This is a PILOT IMPLEMENTATION to demonstrate the pattern. Once validated, the actual
 * TableResource will be refactored following this pattern.
 */
@Path("/v1/tables-refactored")
@Tag(
    name = "Tables (Refactored)",
    description = "Demonstration of service layer pattern for Table resources")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TableResourceRefactored {
  private final TableService tableService;
  private final Authorizer authorizer;
  private final Limits limits;

  public static final String FIELDS =
      "tableConstraints,tablePartition,usageSummary,owners,customMetrics,columns,sampleData,"
          + "tags,followers,joins,schemaDefinition,dataModel,extension,testSuite,domains,dataProducts,lifeCycle,sourceHash";

  /**
   * NEW CONSTRUCTOR PATTERN: Uses ServiceRegistry for dependency injection.
   *
   * <p>This constructor will be used by CollectionRegistry when ServiceRegistry is available.
   *
   * @param serviceRegistry Registry containing all services
   * @param authorizer Authorizer for access control
   * @param limits Limits configuration
   */
  public TableResourceRefactored(
      ServiceRegistry serviceRegistry, Authorizer authorizer, Limits limits) {
    this.tableService = serviceRegistry.getService(TableService.class);
    this.authorizer = authorizer;
    this.limits = limits;
  }

  /**
   * List tables endpoint - demonstrates service delegation pattern.
   *
   * <p>Notice how this method is THIN:
   *
   * <ul>
   *   <li>Parses HTTP parameters
   *   <li>Creates filter object
   *   <li>Delegates to service
   *   <li>Returns result
   * </ul>
   *
   * <p>NO business logic in this method!
   */
  @GET
  @Operation(
      operationId = "listTablesRefactored",
      summary = "List tables (refactored)",
      description = "Get a list of tables using the service layer pattern.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of tables",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TableResource.TableList.class)))
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
      @Parameter(description = "Limit the number tables returned. (1 to 1000000, default = 10) ")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
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

    // Parse fields
    Fields fields = tableService.getFields(fieldsParam);

    // Create filter
    ListFilter filter =
        new ListFilter(include)
            .addQueryParam("database", databaseParam)
            .addQueryParam("databaseSchema", databaseSchemaParam)
            .addQueryParam("includeEmptyTestSuite", includeEmptyTestSuite);

    // Delegate to service - ALL business logic happens here
    return tableService.listEntities(
        uriInfo, securityContext, fields, filter, limitParam, before, after);
  }

  /**
   * Get table by ID endpoint - demonstrates service delegation pattern.
   *
   * <p>Again, this method is THIN - just HTTP handling, delegate to service.
   */
  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getTableByIDRefactored",
      summary = "Get a table by Id (refactored)",
      description = "Get a table by `Id` using service layer pattern",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "table",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Table.class))),
        @ApiResponse(responseCode = "404", description = "Table for instance {id} is not found")
      })
  public Table get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "table Id", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
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

    // Parse fields
    Fields fields = tableService.getFields(fieldsParam);

    // Delegate to service
    return tableService.getEntity(uriInfo, securityContext, id, fields, include);
  }

  /**
   * Get table by name endpoint - demonstrates service delegation pattern.
   */
  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getTableByFQNRefactored",
      summary = "Get a table by fully qualified name (refactored)",
      description = "Get a table by fully qualified table name using service layer pattern.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "table",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Table.class))),
        @ApiResponse(responseCode = "404", description = "Table for instance {fqn} is not found")
      })
  public Table getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the table",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
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

    // Parse fields
    Fields fields = tableService.getFields(fieldsParam);

    // Delegate to service
    return tableService.getEntityByName(uriInfo, securityContext, fqn, fields, include);
  }

  /**
   * List versions endpoint - demonstrates service delegation pattern.
   */
  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllTableVersionRefactored",
      summary = "List table versions (refactored)",
      description = "Get a list of all the versions of a table identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of table versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Table Id", schema = @Schema(type = "string")) @PathParam("id")
          UUID id) {

    // Delegate to service
    return tableService.listEntityVersions(securityContext, id);
  }

  /**
   * Get specific version endpoint - demonstrates service delegation pattern.
   */
  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificTableVersionRefactored",
      summary = "Get a version of the table (refactored)",
      description = "Get a version of the table by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "table",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Table.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Table for instance {id} and version {version} is not found")
      })
  public Table getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Table Id", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Table version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {

    // Delegate to service
    return tableService.getEntityVersion(securityContext, id, version);
  }
}
