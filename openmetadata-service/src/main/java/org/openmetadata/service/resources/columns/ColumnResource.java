/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.resources.columns;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
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
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.BulkColumnUpdatePreview;
import org.openmetadata.schema.api.data.BulkColumnUpdateRequest;
import org.openmetadata.schema.api.data.ColumnGridResponse;
import org.openmetadata.schema.api.data.GroupedColumnsResponse;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ColumnRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.search.ColumnAggregator;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.CSVImportResponse;
import org.openmetadata.service.util.WebsocketNotificationHandler;

@Slf4j
@Path("/v1/columns")
@Tag(
    name = "Columns",
    description =
        "Columns represent individual data fields within tables and dashboard data models. "
            + "This API provides operations to update column metadata such as tags, glossary terms, "
            + "descriptions, and other properties using the column's fully qualified name.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "columns")
public class ColumnResource {

  private final ColumnRepository repository;
  private final Authorizer authorizer;

  public ColumnResource(Authorizer authorizer) {
    this.authorizer = authorizer;
    this.repository =
        new ColumnRepository(authorizer, Entity.getSearchRepository().getSearchClient());
  }

  @PUT
  @Path("/name/{fqn}")
  @Operation(
      operationId = "updateColumnByFQN",
      summary = "Update a column by fully qualified name",
      description =
          "Update column metadata such as display name, description, tags, glossary terms, "
              + "and other properties. This API works for columns in both tables and dashboard data models. "
              + "The column is identified by its fully qualified name and the parent entity type is specified. "
              + "\n\nTag Management Examples:"
              + "\n• Add tags: {\"tags\": [{\"tagFQN\": \"PersonalData.PII\", \"source\": \"Classification\"}]}"
              + "\n• Remove specific tag: {\"tags\": []} (specify only tags you want to keep)"
              + "\n• Remove all tags: {\"tags\": []}"
              + "\n• Mix classifications and glossary terms: {\"tags\": [{\"tagFQN\": \"PII.Sensitive\", \"source\": \"Classification\"}, {\"tagFQN\": \"Glossary.CustomerData\", \"source\": \"Glossary\"}]}"
              + "\n• Don't change tags: omit the 'tags' field entirely"
              + "\n\nValidation Rules:"
              + "\n• Invalid or non-existent tags/glossary terms will result in a 404 error"
              + "\n• All tags and glossary terms must exist and be valid before the request succeeds",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated column",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Column.class))),
        @ApiResponse(responseCode = "400", description = "Bad request"),
        @ApiResponse(responseCode = "404", description = "Column not found")
      })
  public Response updateColumnByFQN(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the column",
              schema = @Schema(type = "string"),
              example = "sample_data.ecommerce_db.shopify.dim_address.address_id")
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Entity type of the parent entity (table or dashboardDataModel)",
              schema =
                  @Schema(
                      type = "string",
                      allowableValues = {"table", "dashboardDataModel"}),
              example = "table",
              required = true)
          @QueryParam("entityType")
          @NotNull
          String entityType,
      @RequestBody(
              description = "Column update payload",
              content =
                  @Content(
                      mediaType = "application/json",
                      schema = @Schema(implementation = UpdateColumn.class)))
          @Valid
          UpdateColumn updateColumn) {

    Column updatedColumn =
        repository.updateColumnByFQN(uriInfo, securityContext, fqn, entityType, updateColumn);

    return Response.ok(updatedColumn).build();
  }

  @GET
  @Path("/search")
  @Operation(
      operationId = "searchColumns",
      summary = "Search and group columns by name",
      description =
          "Search for columns across different entity types and group them by exact column name match. "
              + "This endpoint helps identify unique column names and their occurrences across tables, "
              + "dashboard data models, containers, and search indexes. Supports filtering by entity type, "
              + "service, database, schema, and domain.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of grouped columns",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GroupedColumnsResponse.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response searchColumns(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Column name to search for", example = "order_id")
          @QueryParam("columnName")
          String columnName,
      @Parameter(
              description = "Filter by entity types (comma-separated)",
              example = "table,dashboardDataModel")
          @QueryParam("entityTypes")
          String entityTypes,
      @Parameter(description = "Filter by service name", example = "sample_data")
          @QueryParam("serviceName")
          String serviceName,
      @Parameter(description = "Filter by database name", example = "ecommerce_db")
          @QueryParam("databaseName")
          String databaseName,
      @Parameter(description = "Filter by schema name", example = "shopify")
          @QueryParam("schemaName")
          String schemaName,
      @Parameter(description = "Filter by domain ID") @QueryParam("domainId") String domainId) {

    List<GroupedColumnsResponse> groupedColumns =
        repository.searchColumns(
            securityContext,
            columnName,
            entityTypes,
            serviceName,
            databaseName,
            schemaName,
            domainId);

    return Response.ok(groupedColumns).build();
  }

  @GET
  @Path("/grid")
  @Operation(
      operationId = "getColumnGrid",
      summary = "Get column grid with metadata grouping",
      description =
          "Returns unique columns with metadata variations grouped for grid-based editing. "
              + "Uses scalable Elasticsearch/OpenSearch aggregations with cursor-based pagination. "
              + "Columns with the same name but different metadata (description, tags, etc.) are grouped "
              + "by metadata hash, allowing efficient bulk editing of similar columns.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Column grid response with grouped metadata",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ColumnGridResponse.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response getColumnGrid(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Number of columns per batch (max 10000)", example = "1000")
          @DefaultValue("1000")
          @QueryParam("size")
          int size,
      @Parameter(description = "Cursor for pagination") @QueryParam("cursor") String cursor,
      @Parameter(description = "Column name pattern (wildcard search)", example = "order")
          @QueryParam("columnNamePattern")
          String columnNamePattern,
      @Parameter(
              description = "Filter by entity types (comma-separated)",
              example = "table,dashboardDataModel")
          @QueryParam("entityTypes")
          String entityTypes,
      @Parameter(description = "Filter by service name", example = "sample_data")
          @QueryParam("serviceName")
          String serviceName,
      @Parameter(
              description = "Filter by service types (comma-separated)",
              example = "BigQuery,Mysql,Postgres")
          @QueryParam("serviceTypes")
          String serviceTypes,
      @Parameter(description = "Filter by database name", example = "ecommerce_db")
          @QueryParam("databaseName")
          String databaseName,
      @Parameter(description = "Filter by schema name", example = "shopify")
          @QueryParam("schemaName")
          String schemaName,
      @Parameter(description = "Filter by domain ID") @QueryParam("domainId") String domainId,
      @Parameter(
              description = "Show only columns with conflicting metadata",
              schema = @Schema(type = "boolean"))
          @DefaultValue("false")
          @QueryParam("hasConflicts")
          boolean hasConflicts,
      @Parameter(
              description = "Show only columns with missing metadata",
              schema = @Schema(type = "boolean"))
          @DefaultValue("false")
          @QueryParam("hasMissingMetadata")
          boolean hasMissingMetadata,
      @Parameter(
              description =
                  "Filter by metadata status: MISSING (no description AND no tags), "
                      + "INCOMPLETE (has description OR tags, but not both), "
                      + "COMPLETE (has both description AND tags)",
              schema =
                  @Schema(
                      type = "string",
                      allowableValues = {"MISSING", "INCOMPLETE", "COMPLETE"}))
          @QueryParam("metadataStatus")
          String metadataStatus,
      @Parameter(
              description =
                  "Filter by classification tags at column level (comma-separated tag FQNs)",
              example = "PII.Sensitive,PersonalData.Email")
          @QueryParam("tags")
          String tags,
      @Parameter(
              description =
                  "Filter by glossary terms at column level (comma-separated glossary term FQNs)",
              example = "Business.CustomerData,Business.Revenue")
          @QueryParam("glossaryTerms")
          String glossaryTerms)
      throws Exception {

    ColumnAggregator.ColumnAggregationRequest request =
        new ColumnAggregator.ColumnAggregationRequest();
    request.setSize(Math.min(size, 10000));
    request.setCursor(cursor);
    request.setColumnNamePattern(columnNamePattern);
    if (entityTypes != null && !entityTypes.isEmpty()) {
      request.setEntityTypes(java.util.Arrays.asList(entityTypes.split(",")));
    }
    request.setServiceName(serviceName);
    if (serviceTypes != null && !serviceTypes.isEmpty()) {
      request.setServiceTypes(java.util.Arrays.asList(serviceTypes.split(",")));
    }
    request.setDatabaseName(databaseName);
    request.setSchemaName(schemaName);
    request.setDomainId(domainId);
    request.setHasConflicts(hasConflicts);
    request.setHasMissingMetadata(hasMissingMetadata);
    request.setMetadataStatus(metadataStatus);
    if (tags != null && !tags.isEmpty()) {
      request.setTags(java.util.Arrays.asList(tags.split(",")));
    }
    if (glossaryTerms != null && !glossaryTerms.isEmpty()) {
      request.setGlossaryTerms(java.util.Arrays.asList(glossaryTerms.split(",")));
    }

    ColumnGridResponse response = repository.getColumnGridPaginated(securityContext, request);

    return Response.ok(response).build();
  }

  @POST
  @Path("/bulk-update-preview")
  @Operation(
      operationId = "bulkUpdateColumnsPreview",
      summary = "Preview bulk column updates (dry-run)",
      description =
          "Preview what columns will be updated without making actual changes. "
              + "Returns a detailed diff showing current vs new values for each matching column. "
              + "Use this to review changes before executing the actual bulk update. "
              + "Supports both search-based (columnName + filters) and explicit (columnUpdates list) modes.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Preview of column updates",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkColumnUpdatePreview.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response bulkUpdateColumnsPreview(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @RequestBody(
              description = "Bulk column update request",
              content =
                  @Content(
                      mediaType = "application/json",
                      schema = @Schema(implementation = BulkColumnUpdateRequest.class)))
          @Valid
          BulkColumnUpdateRequest request) {

    BulkColumnUpdatePreview preview =
        repository.previewBulkUpdateColumns(uriInfo, securityContext, request);

    return Response.ok(preview).build();
  }

  @GET
  @Path("/export")
  @Produces(MediaType.TEXT_PLAIN)
  @Operation(
      operationId = "exportUniqueColumns",
      summary = "Export unique column names to CSV",
      description =
          "Export all unique column names across entity types to CSV format. "
              + "The CSV includes column metadata (name, displayName, description, tags, glossaryTerms) "
              + "for bulk editing. Supports filtering by entity types, service, database, schema, and domain.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "CSV export of unique columns",
            content =
                @Content(
                    mediaType = "text/plain",
                    schema = @Schema(implementation = String.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public String exportUniqueColumns(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Column name to filter by", example = "order_id")
          @QueryParam("columnName")
          String columnName,
      @Parameter(
              description = "Filter by entity types (comma-separated)",
              example = "table,dashboardDataModel")
          @QueryParam("entityTypes")
          String entityTypes,
      @Parameter(description = "Filter by service name", example = "sample_data")
          @QueryParam("serviceName")
          String serviceName,
      @Parameter(description = "Filter by database name", example = "ecommerce_db")
          @QueryParam("databaseName")
          String databaseName,
      @Parameter(description = "Filter by schema name", example = "shopify")
          @QueryParam("schemaName")
          String schemaName,
      @Parameter(description = "Filter by domain ID") @QueryParam("domainId") String domainId) {

    return repository.exportUniqueColumnsCSV(
        securityContext, columnName, entityTypes, serviceName, databaseName, schemaName, domainId);
  }

  @POST
  @Path("/import")
  @Consumes(MediaType.TEXT_PLAIN)
  @Operation(
      operationId = "importUniqueColumns",
      summary = "Import column metadata from CSV (with dry-run)",
      description =
          "Import column metadata updates from CSV. Each row should contain column name and metadata fields. "
              + "The system will search for all occurrences of each column name and apply the updates. "
              + "Supports dry-run mode to preview changes before applying.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "CSV import result",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CsvImportResult.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response importUniqueColumns(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Dry-run mode for validation without applying changes",
              schema = @Schema(type = "boolean"))
          @DefaultValue("true")
          @QueryParam("dryRun")
          boolean dryRun,
      @Parameter(
              description = "Filter by entity types (comma-separated)",
              example = "table,dashboardDataModel")
          @QueryParam("entityTypes")
          String entityTypes,
      @Parameter(description = "Filter by service name") @QueryParam("serviceName")
          String serviceName,
      @Parameter(description = "Filter by database name") @QueryParam("databaseName")
          String databaseName,
      @Parameter(description = "Filter by schema name") @QueryParam("schemaName") String schemaName,
      @Parameter(description = "Filter by domain ID") @QueryParam("domainId") String domainId,
      String csv) {

    CsvImportResult result =
        repository.importColumnsCSV(
            uriInfo,
            securityContext,
            csv,
            dryRun,
            entityTypes,
            serviceName,
            databaseName,
            schemaName,
            domainId);

    return Response.ok(result).build();
  }

  @POST
  @Path("/import-async")
  @Consumes(MediaType.TEXT_PLAIN)
  @Operation(
      operationId = "importUniqueColumnsAsync",
      summary = "Import column metadata from CSV asynchronously",
      description =
          "Import column metadata updates from CSV asynchronously. "
              + "Returns a job ID for tracking progress via WebSocket notifications.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Async import job initiated",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CSVImportResponse.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response importUniqueColumnsAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Filter by entity types (comma-separated)",
              example = "table,dashboardDataModel")
          @QueryParam("entityTypes")
          String entityTypes,
      @Parameter(description = "Filter by service name") @QueryParam("serviceName")
          String serviceName,
      @Parameter(description = "Filter by database name") @QueryParam("databaseName")
          String databaseName,
      @Parameter(description = "Filter by schema name") @QueryParam("schemaName") String schemaName,
      @Parameter(description = "Filter by domain ID") @QueryParam("domainId") String domainId,
      String csv) {

    String jobId = UUID.randomUUID().toString();
    CSVImportResponse responseEntity =
        new CSVImportResponse(jobId, "CSV column import is in progress.");
    Response response =
        Response.ok().entity(responseEntity).type(MediaType.APPLICATION_JSON).build();

    ExecutorService executorService = AsyncService.getInstance().getExecutorService();
    executorService.submit(
        () -> {
          try {
            WebsocketNotificationHandler.sendBulkAssetsOperationStartedNotification(
                jobId, securityContext);
            CsvImportResult result =
                repository.importColumnsCSV(
                    uriInfo,
                    securityContext,
                    csv,
                    false,
                    entityTypes,
                    serviceName,
                    databaseName,
                    schemaName,
                    domainId);
            WebsocketNotificationHandler.sendCsvImportCompleteNotification(
                jobId, securityContext, result);
          } catch (Exception e) {
            LOG.error("Encountered Exception while importing CSV for columns.", e);
            WebsocketNotificationHandler.sendBulkAssetsOperationFailedNotification(
                jobId, securityContext, e.getMessage());
          }
        });

    return response;
  }

  @POST
  @Path("/bulk-update-async")
  @Operation(
      operationId = "bulkUpdateColumnsAsync",
      summary = "Bulk update columns asynchronously",
      description =
          "Update multiple columns across different entities asynchronously. "
              + "This endpoint accepts a list of column updates and processes them in the background. "
              + "Returns a job ID that can be used to track progress via WebSocket notifications. "
              + "Updates are applied to column metadata including description, display name, tags, and glossary terms.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Bulk update job initiated",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CSVImportResponse.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response bulkUpdateColumnsAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @RequestBody(
              description = "Bulk column update request",
              content =
                  @Content(
                      mediaType = "application/json",
                      schema = @Schema(implementation = BulkColumnUpdateRequest.class)))
          @Valid
          BulkColumnUpdateRequest request) {

    String jobId = UUID.randomUUID().toString();
    CSVImportResponse responseEntity =
        new CSVImportResponse(jobId, "Bulk column update is in progress.");
    Response response =
        Response.ok().entity(responseEntity).type(MediaType.APPLICATION_JSON).build();

    ExecutorService executorService = AsyncService.getInstance().getExecutorService();
    executorService.submit(
        () -> {
          try {
            WebsocketNotificationHandler.sendBulkAssetsOperationStartedNotification(
                jobId, securityContext);
            BulkOperationResult result =
                repository.bulkUpdateColumns(
                    uriInfo,
                    securityContext,
                    request,
                    (processed, total) ->
                        WebsocketNotificationHandler.sendBulkAssetsOperationProgressNotification(
                            jobId,
                            securityContext,
                            processed,
                            total,
                            "Bulk column update is in progress."));
            WebsocketNotificationHandler.sendBulkAssetsOperationCompleteNotification(
                jobId, securityContext, result);
          } catch (Exception e) {
            LOG.error("Encountered Exception while bulk updating columns.", e);
            WebsocketNotificationHandler.sendBulkAssetsOperationFailedNotification(
                jobId, securityContext, e.getMessage());
          }
        });

    return response;
  }
}
