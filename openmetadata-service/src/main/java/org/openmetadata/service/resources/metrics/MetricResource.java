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

package org.openmetadata.service.resources.metrics;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.ArraySchema;
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
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.MetricAssetDirection;
import org.openmetadata.schema.api.data.MetricHierarchyContext;
import org.openmetadata.schema.api.data.MetricHierarchyItem;
import org.openmetadata.schema.api.data.MetricObservability;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.MetricRepository;
import org.openmetadata.service.jdbi3.MetricRepository.MetricCsv;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.CSVExportResponse;

@Path("/v1/metrics")
@Tag(
    name = "Metrics",
    description =
        "`Metrics` are measurements computed from data such as `Monthly Active Users`. Some of the metrics that "
            + "measures used to determine performance against an objective are called KPIs or Key Performance Indicators, such as `User Retention`.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "metrics")
public class MetricResource extends EntityResource<Metric, MetricRepository> {
  public static final String COLLECTION_PATH = "/v1/metrics/";
  private final MetricMapper mapper = new MetricMapper();
  static final String FIELDS =
      "owners,experts,reviewers,relatedMetrics,followers,tags,extension,domains,dataProducts,parent,children,childrenCount,metricGroup";
  private static final String ROOT_METRICS_PARENT = "null";

  public MetricResource(Authorizer authorizer, Limits limits) {
    super(Entity.METRIC, authorizer, limits);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("relatedMetrics", MetadataOperation.VIEW_BASIC);
    return Collections.emptyList();
  }

  public static class MetricsList extends ResultList<Metric> {
    /* Required for serde */
  }

  public static class MetricHierarchyList extends ResultList<MetricHierarchyItem> {
    /* Required for serde */
  }

  public static class MetricAssetsList extends ResultList<MetricAssetDirection> {
    /* Required for serde */
  }

  @GET
  @Path("/hierarchy")
  @Operation(
      operationId = "listMetricHierarchy",
      summary = "List top-level Metric hierarchy entries",
      description =
          "Returns Metric Groups and standalone root Metrics in one stable, offset-paged list.")
  public ResultList<MetricHierarchyItem> listHierarchy(
      @Context SecurityContext securityContext,
      @Parameter(description = "Case-insensitive name search") @QueryParam("q") String query,
      @DefaultValue("20") @Min(1) @Max(1000) @QueryParam("limit") int limit,
      @DefaultValue("0") @Min(0) @QueryParam("offset") int offset) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContext());
    ResultList<MetricHierarchyItem> result;
    if (canListHierarchyWithoutFiltering(securityContext)) {
      result = repository.listHierarchy(limit, offset, query);
    } else {
      result =
          repository.listHierarchy(
              limit,
              offset,
              query,
              metric -> canAccessEntity(securityContext, metric, MetadataOperation.VIEW_BASIC),
              group -> canAccessEntity(securityContext, group, MetadataOperation.VIEW_BASIC));
    }
    return result;
  }

  private boolean canListHierarchyWithoutFiltering(SecurityContext securityContext) {
    String user = securityContext.getUserPrincipal().getName();
    return hasUnconditionalView(authorizer.getPermission(securityContext, user, Entity.METRIC))
        && hasUnconditionalView(
            authorizer.getPermission(securityContext, user, Entity.METRIC_GROUP));
  }

  static boolean hasUnconditionalView(ResourcePermission resourcePermission) {
    return resourcePermission != null
        && listOrEmpty(resourcePermission.getPermissions()).stream()
            .anyMatch(
                permission ->
                    MetadataOperation.VIEW_BASIC.equals(permission.getOperation())
                        && Permission.Access.ALLOW.equals(permission.getAccess()));
  }

  @GET
  @Operation(
      operationId = "listMetrics",
      summary = "List metrics",
      description = "Get a list of metrics. Use `fields` parameter to get only necessary fields.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of metrics",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetricsList.class)))
      })
  public ResultList<Metric> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of metrics before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of metrics after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include,
      @Parameter(
              description =
                  "Filter by hierarchy position. Omit to list every metric, pass the literal "
                      + "`null` to list only metrics that have no parent, or pass a parent "
                      + "metric's fully qualified name to list its immediate children.",
              schema = @Schema(type = "string", example = "net_sales"))
          @QueryParam("parent")
          String parent,
      @Parameter(
              description = "Filter metrics by approval status.",
              schema = @Schema(type = "string", example = "Approved"))
          @QueryParam("entityStatus")
          String entityStatus) {
    ListFilter filter = new ListFilter(include);
    addHierarchyFilter(filter, parent);
    if (!nullOrEmpty(entityStatus)) {
      filter.addQueryParam("entityStatus", entityStatus);
    }
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  Response buildBulkOperationResponse(BulkOperationResult result) {
    if (result.getStatus() == ApiStatus.FAILURE) {
      return Response.status(Response.Status.BAD_REQUEST).entity(result).build();
    }
    return Response.ok().entity(result).build();
  }

  /**
   * Metric fully qualified names are flat, so the generic {@code parent} ListFilter key — which
   * builds an fqnHash prefix condition — would match nothing. The parent FQN is resolved to an id
   * up front and handed to MetricDAO under a key that filters on CONTAINS edges instead.
   */
  void addHierarchyFilter(ListFilter filter, String parent) {
    if (nullOrEmpty(parent)) {
      return;
    }
    if (ROOT_METRICS_PARENT.equals(parent)) {
      filter.addQueryParam("rootMetrics", Boolean.TRUE.toString());
    } else {
      EntityReference parentRef =
          Entity.getEntityReferenceByName(Entity.METRIC, parent, NON_DELETED);
      filter.addQueryParam("parentMetricId", parentRef.getId().toString());
    }
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getMetricByID",
      summary = "Get a metric by Id",
      description = "Get a metric by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The metrics",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Metric.class))),
        @ApiResponse(responseCode = "404", description = "Metrics for instance {id} is not found")
      })
  public Metric get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the metric", schema = @Schema(type = "UUID")) @PathParam("id")
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
          Include include,
      @Parameter(
              description =
                  "Per-relation include control. Format: field:value,field2:value2. "
                      + "Example: owners:non-deleted,followers:all. "
                      + "Valid values: all, deleted, non-deleted. "
                      + "If not specified for a field, uses the entity's include value.",
              schema = @Schema(type = "string", example = "owners:non-deleted,followers:all"))
          @QueryParam("includeRelations")
          String includeRelations) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include, includeRelations);
  }

  @GET
  @Path("/{id}/hierarchy")
  @Operation(
      operationId = "getMetricHierarchyContext",
      summary = "Get the hierarchy context for one Metric")
  public MetricHierarchyContext getHierarchyContext(
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @DefaultValue("20") @Min(0) @Max(1000) @QueryParam("childLimit") int childLimit,
      @DefaultValue("0") @Min(0) @QueryParam("childOffset") int childOffset,
      @DefaultValue("20") @Min(0) @Max(1000) @QueryParam("siblingLimit") int siblingLimit,
      @DefaultValue("0") @Min(0) @QueryParam("siblingOffset") int siblingOffset) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return repository.getHierarchyContext(
        id,
        childLimit,
        childOffset,
        siblingLimit,
        siblingOffset,
        metric -> canAccessEntity(securityContext, metric, MetadataOperation.VIEW_BASIC),
        group -> canAccessEntity(securityContext, group, MetadataOperation.VIEW_BASIC));
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getMetricByFQN",
      summary = "Get a Metric by fully qualified name.",
      description = "Get a Metric by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Metric",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Metric.class))),
        @ApiResponse(responseCode = "404", description = "Metric for instance {fqn} is not found")
      })
  public Metric getByName(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fully qualified name of the Metric",
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
          Include include,
      @Parameter(
              description =
                  "Per-relation include control. Format: field:value,field2:value2. "
                      + "Example: owners:non-deleted,followers:all. "
                      + "Valid values: all, deleted, non-deleted. "
                      + "If not specified for a field, uses the entity's include value.",
              schema = @Schema(type = "string", example = "owners:non-deleted,followers:all"))
          @QueryParam("includeRelations")
          String includeRelations) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include, includeRelations);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllMetricVersion",
      summary = "List Metric versions",
      description = "Get a list of all the versions of a metric identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Metric versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the metric", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificEndpointVersion",
      summary = "Get a version of the Metric",
      description = "Get a version of the Metric by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Metric Version",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Metric.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Metric for instance {id} and version {version} is not found")
      })
  public Metric getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Metric", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Metric version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createMetric",
      summary = "Create a Metric",
      description = "Create a Metric.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Metric",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Metric.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateMetric create) {
    Metric metric = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    repository.prepareInternal(metric, false);
    authorizeHierarchyDestinations(securityContext, null, metric);
    return create(uriInfo, securityContext, metric);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateMetric",
      summary = "Create or update a metric",
      description = "Create a new metric, if it does not exist or update an existing metric.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The metric",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Metric.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateMetric create) {
    Metric metric = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    preauthorizeHierarchyUpdate(securityContext, metric);
    return createOrUpdate(uriInfo, securityContext, metric);
  }

  private void preauthorizeHierarchyUpdate(SecurityContext securityContext, Metric metric) {
    repository.setFullyQualifiedName(metric);
    Metric original =
        repository.findByNameOrNull(metric.getFullyQualifiedName(), Include.NON_DELETED);
    repository.prepareInternal(metric, true);
    if (original != null) {
      original = repository.get(null, original.getId(), repository.getFields("parent,metricGroup"));
    }
    authorizeHierarchyChange(securityContext, original, metric);
  }

  @PUT
  @Path("/bulk")
  @Operation(
      operationId = "bulkCreateOrUpdateMetrics",
      summary = "Bulk create or update metrics",
      description = "Create or update multiple metrics in a single operation.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Bulk operation results"),
        @ApiResponse(
            responseCode = "202",
            description = "Bulk operation accepted for async processing"),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  @Parameter(
      name = "overrideMetadata",
      in = ParameterIn.QUERY,
      description =
          "When true, allows the bulk update to overwrite user-curated fields "
              + "(description, displayName, owners, tags) that bot-driven updates "
              + "normally preserve, and disables the sourceHash fast-path so unchanged "
              + "entities are re-evaluated. Defaults to false.",
      schema = @Schema(type = "boolean", defaultValue = "false"))
  public Response bulkCreateOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @DefaultValue("false") @QueryParam("async") boolean async,
      List<CreateMetric> createRequests) {
    for (CreateMetric create : listOrEmpty(createRequests)) {
      preauthorizeHierarchyUpdate(
          securityContext,
          mapper.createToEntity(create, securityContext.getUserPrincipal().getName()));
    }
    return processBulkRequest(uriInfo, securityContext, createRequests, mapper, async);
  }

  @GET
  @Path("/documentation/csv")
  @Valid
  @Operation(
      operationId = "getMetricCsvDocumentation",
      summary = "Get CSV documentation for metric import/export")
  public String getCsvDocumentation(@Context SecurityContext securityContext) {
    return JsonUtils.pojoToJson(MetricCsv.DOCUMENTATION);
  }

  @GET
  @Path("/name/{name}/exportAsync")
  @Produces(MediaType.TEXT_PLAIN)
  @Valid
  @Operation(
      operationId = "exportMetricsAsync",
      summary = "Export metrics in CSV format asynchronously",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Export initiated successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CSVExportResponse.class)))
      })
  public Response exportCsvAsync(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Metric fully qualified name, or * to export all metrics",
              schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    return exportCsvInternalAsync(securityContext, name, false);
  }

  @GET
  @Path("/name/{name}/export")
  @Produces({MediaType.TEXT_PLAIN + "; charset=UTF-8"})
  @Valid
  @Operation(
      operationId = "exportMetrics",
      summary = "Export metrics in CSV format",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Exported CSV with metrics",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = String.class)))
      })
  public String exportCsv(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Metric fully qualified name, or * to export all metrics",
              schema = @Schema(type = "string"))
          @PathParam("name")
          String name)
      throws IOException {
    return exportCsvInternal(securityContext, name, false);
  }

  @PUT
  @Path("/name/{name}/import")
  @Consumes({MediaType.TEXT_PLAIN + "; charset=UTF-8"})
  @Valid
  @Operation(
      operationId = "importMetrics",
      summary = "Import metrics from CSV to create or update metrics",
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
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Metric import scope. Use * for collection import",
              schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description =
                  "Dry-run when true validates the CSV without importing it. (default=true)",
              schema = @Schema(type = "boolean"))
          @DefaultValue("true")
          @QueryParam("dryRun")
          boolean dryRun,
      String csv)
      throws IOException {
    return importCsvInternal(uriInfo, securityContext, name, csv, dryRun, false);
  }

  @PUT
  @Path("/name/{name}/importAsync")
  @Consumes({MediaType.TEXT_PLAIN + "; charset=UTF-8"})
  @Produces(MediaType.APPLICATION_JSON)
  @Valid
  @Operation(
      operationId = "importMetricsAsync",
      summary = "Import metrics from CSV asynchronously",
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
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Metric import scope. Use * for collection import",
              schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description =
                  "Dry-run when true validates the CSV without importing it. (default=true)",
              schema = @Schema(type = "boolean"))
          @DefaultValue("true")
          @QueryParam("dryRun")
          boolean dryRun,
      String csv) {
    return importCsvInternalAsync(uriInfo, securityContext, name, csv, dryRun, false);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchMetric",
      summary = "Update a Metric",
      description = "Update an existing Metric using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateMetric(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Metric", schema = @Schema(type = "UUID")) @PathParam("id")
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
    validateMetricPatch(patch);
    if (patchMutatesHierarchy(patch)) {
      preauthorizeHierarchyPatch(securityContext, id, patch);
    }
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchMetric",
      summary = "Update a Metric using name.",
      description = "Update an existing Metric using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateMetric(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Metric", schema = @Schema(type = "string"))
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
    validateMetricPatch(patch);
    if (patchMutatesHierarchy(patch)) {
      preauthorizeHierarchyPatch(securityContext, fqn, patch);
    }
    return patchInternal(uriInfo, securityContext, fqn, patch);
  }

  private void preauthorizeHierarchyPatch(
      SecurityContext securityContext, UUID metricId, JsonPatch patch) {
    Metric original = repository.get(null, metricId, repository.getFields("parent,metricGroup"));
    authorizePatchedHierarchy(securityContext, original, patch);
  }

  private void preauthorizeHierarchyPatch(
      SecurityContext securityContext, String metricFqn, JsonPatch patch) {
    Metric original =
        repository.getByName(null, metricFqn, repository.getFields("parent,metricGroup"));
    authorizePatchedHierarchy(securityContext, original, patch);
  }

  private void authorizePatchedHierarchy(
      SecurityContext securityContext, Metric original, JsonPatch patch) {
    Metric updated = JsonUtils.applyPatch(original, patch, Metric.class);
    repository.prepareInternal(updated, true);
    authorizeHierarchyChange(securityContext, original, updated);
  }

  private void authorizeHierarchyChange(
      SecurityContext securityContext, Metric original, Metric updated) {
    boolean changed = original == null || hierarchyMembershipChanged(original, updated);
    if (changed) {
      if (original != null) {
        authorizeHierarchyMutation(securityContext, original.getId());
      }
      authorizeHierarchyDestinations(securityContext, original, updated);
    }
  }

  void authorizeHierarchyDestinations(
      SecurityContext securityContext, Metric original, Metric updated) {
    for (EntityReference destination : hierarchyDestinations(original, updated)) {
      authorizer.authorize(
          securityContext,
          new OperationContext(destination.getType(), MetadataOperation.EDIT_ALL),
          new ResourceContext<>(
              destination.getType(), destination.getId(), destination.getFullyQualifiedName()));
    }
  }

  static List<EntityReference> hierarchyDestinations(Metric original, Metric updated) {
    List<EntityReference> destinations = new ArrayList<>();
    if (original == null || hierarchyMembershipChanged(original, updated)) {
      if (updated.getParent() != null) {
        destinations.add(updated.getParent());
      }
      if (updated.getMetricGroup() != null) {
        destinations.add(updated.getMetricGroup());
      }
    }
    return destinations;
  }

  private void authorizeHierarchyMutation(SecurityContext securityContext, UUID metricId) {
    for (EntityReference metric : repository.hierarchySubtree(metricId)) {
      authorizer.authorize(
          securityContext,
          new OperationContext(Entity.METRIC, MetadataOperation.EDIT_ALL),
          new ResourceContext<>(Entity.METRIC, metric.getId(), metric.getFullyQualifiedName()));
    }
  }

  static boolean hierarchyMembershipChanged(Metric original, Metric updated) {
    return !sameReference(original.getParent(), updated.getParent())
        || !sameReference(original.getMetricGroup(), updated.getMetricGroup());
  }

  private static boolean sameReference(EntityReference left, EntityReference right) {
    return left == right
        || (left != null && right != null && Objects.equals(left.getId(), right.getId()));
  }

  static boolean patchMutatesHierarchy(JsonPatch patch) {
    Set<String> fields = JsonUtils.extractPatchedFields(patch);
    return fields.contains("parent") || fields.contains("metricGroup");
  }

  static void validateMetricPatch(JsonPatch patch) {
    Set<String> fields = JsonUtils.extractPatchedFields(patch);
    if (fields.contains("assets")) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.readOnlyAttribute(Entity.METRIC, "assets"));
    }
    if (fields.contains("children")) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.readOnlyAttribute(Entity.METRIC, "children"));
    }
    if (fields.contains("childrenCount")) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.readOnlyAttribute(Entity.METRIC, "childrenCount"));
    }
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollower",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as followed of this Metric.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(
            responseCode = "404",
            description = "APIEndpoint for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Metric", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user to be added as follower",
              schema = @Schema(type = "UUID"))
          UUID userId) {
    return repository
        .addFollower(securityContext.getUserPrincipal().getName(), id, userId)
        .toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the Metric.",
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
      @Parameter(description = "Id of the Metric", schema = @Schema(type = "UUID")) @PathParam("id")
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

  @PUT
  @Path("/{id}/vote")
  @Operation(
      operationId = "updateVoteForMetric",
      summary = "Update Vote for a Metric",
      description = "Update vote for a Metric",
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
  @Path("/{id}")
  @Operation(
      operationId = "deleteMetric",
      summary = "Delete a Metric by id",
      description = "Delete a Metric by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Metric for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "Recursively delete this metric and its child metrics. (Default = `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the Metric", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteMetricAsync",
      summary = "Asynchronously delete a Metric by id",
      description = "Asynchronously delete a Metric by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Metric for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "Recursively delete this metric and its child metrics. (Default = `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the Metric", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteAPIEndpointByFQN",
      summary = "Delete a Metric by fully qualified name",
      description = "Delete a Metric by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Metric for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description =
                  "Recursively delete this metric and its child metrics. (Default = `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(
              description = "Fully qualified name of the Metric",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted Metric.",
      description = "Restore a soft deleted Metric.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Metric.",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Metric.class)))
      })
  public Response restore(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @PUT
  @Path("/{name}/assets/add")
  @Operation(
      operationId = "bulkAddMetricAssets",
      summary = "Link data assets to a metric",
      description = "Link the given data assets to the metric identified by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(
            responseCode = "400",
            description = "All operations failed",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(responseCode = "404", description = "Metric for instance {name} is not found")
      })
  public Response bulkAddAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Metric", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Valid BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    AuthorizedBulk authorized = authorizeAssets(securityContext, request);
    BulkOperationResult result =
        authorized.request().getAssets().isEmpty()
            ? emptyBulkResult(request)
            : repository.bulkAddAssets(
                name, authorized.request(), securityContext.getUserPrincipal().getName());
    return buildBulkOperationResponse(mergeAuthorizationFailures(result, authorized.failures()));
  }

  @PUT
  @Path("/{name}/assets/remove")
  @Operation(
      operationId = "bulkRemoveMetricAssets",
      summary = "Unlink data assets from a metric",
      description = "Unlink the given data assets from the metric identified by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(
            responseCode = "400",
            description = "All operations failed",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(responseCode = "404", description = "Metric for instance {name} is not found")
      })
  public Response bulkRemoveAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Metric", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Valid BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    AuthorizedBulk authorized = authorizeAssets(securityContext, request);
    BulkOperationResult result =
        authorized.request().getAssets().isEmpty()
            ? emptyBulkResult(request)
            : repository.bulkRemoveAssets(
                name, authorized.request(), securityContext.getUserPrincipal().getName());
    return buildBulkOperationResponse(mergeAuthorizationFailures(result, authorized.failures()));
  }

  @GET
  @Path("/{id}/assets")
  @Operation(
      operationId = "getMetricAssets",
      summary = "List a metric's linked assets with their lineage direction",
      description =
          "List the data assets linked to a metric. Each asset is annotated with whether it is "
              + "upstream of the metric, downstream of it, or has no lineage edge to it.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Linked assets with direction",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetricAssetsList.class))),
        @ApiResponse(responseCode = "404", description = "Metric for instance {id} is not found")
      })
  public ResultList<MetricAssetDirection> getAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the metric", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @DefaultValue("20") @Min(1) @Max(1000) @QueryParam("limit") int limit,
      @DefaultValue("0") @Min(0) @QueryParam("offset") int offset,
      @Parameter(description = "Case-insensitive asset name search") @QueryParam("q") String query,
      @Parameter(description = "Filter by linked entity type") @QueryParam("entityType")
          String assetEntityType,
      @Parameter(description = "Filter by lineage direction") @QueryParam("direction")
          MetricAssetDirection.Direction direction) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    repository.get(null, id, repository.getFields("id"));
    return repository.listAssets(
        id,
        limit,
        offset,
        query,
        assetEntityType,
        direction,
        asset -> canViewAsset(securityContext, asset));
  }

  @GET
  @Path("/{id}/observability")
  @Operation(
      operationId = "getMetricObservability",
      summary = "Get a metric's health rollup",
      description =
          "Compute the metric's health from the data quality of the upstream assets it is computed "
              + "on, together with a plain-English explanation of how that health was reached. "
              + "Downstream assets consume the metric rather than feed it, so they are excluded.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The metric's health rollup",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetricObservability.class))),
        @ApiResponse(responseCode = "404", description = "Metric for instance {id} is not found")
      })
  public MetricObservability getObservability(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the metric", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    repository.get(null, id, repository.getFields("id"));
    List<MetricAssetDirection> linkedAssets = repository.getAssetsWithDirection(id);
    Set<UUID> visibleAssets = new HashSet<>();
    for (MetricAssetDirection linked : linkedAssets) {
      if (canViewAsset(securityContext, linked.getAsset())) {
        visibleAssets.add(linked.getAsset().getId());
      }
    }
    return repository.getObservability(id, linkedAssets, visibleAssets);
  }

  private boolean canViewAsset(SecurityContext securityContext, EntityReference asset) {
    return canAccessEntity(securityContext, asset, MetadataOperation.VIEW_BASIC);
  }

  private boolean canAccessEntity(
      SecurityContext securityContext, EntityReference entity, MetadataOperation operation) {
    boolean result = true;
    try {
      OperationContext operationContext = new OperationContext(entity.getType(), operation);
      authorizer.authorize(
          securityContext,
          operationContext,
          new ResourceContext<>(entity.getType(), entity.getId(), entity.getFullyQualifiedName()));
    } catch (AuthorizationException
        | EntityNotFoundException
        | IllegalArgumentException exception) {
      result = false;
    }
    return result;
  }

  private AuthorizedBulk authorizeAssets(SecurityContext securityContext, BulkAssets request) {
    List<EntityReference> allowed = new ArrayList<>();
    List<BulkResponse> failures = new ArrayList<>();
    for (EntityReference asset : listOrEmpty(request.getAssets())) {
      if (canViewAsset(securityContext, asset)) {
        allowed.add(asset);
      } else {
        failures.add(
            new BulkResponse()
                .withRequest(asset)
                .withMessage("Not authorized to view the requested asset"));
      }
    }
    BulkAssets authorized = new BulkAssets().withAssets(allowed).withDryRun(request.getDryRun());
    return new AuthorizedBulk(authorized, failures);
  }

  BulkOperationResult emptyBulkResult(BulkAssets request) {
    return new BulkOperationResult()
        .withDryRun(Boolean.TRUE.equals(request.getDryRun()))
        .withStatus(ApiStatus.SUCCESS);
  }

  BulkOperationResult mergeAuthorizationFailures(
      BulkOperationResult result, List<BulkResponse> authorizationFailures) {
    List<BulkResponse> failures = new ArrayList<>(listOrEmpty(result.getFailedRequest()));
    failures.addAll(authorizationFailures);
    result.setFailedRequest(failures);
    result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + authorizationFailures.size());
    result.setNumberOfRowsProcessed(
        result.getNumberOfRowsProcessed() + authorizationFailures.size());
    if (result.getNumberOfRowsPassed() == 0 && !failures.isEmpty()) {
      result.setStatus(ApiStatus.FAILURE);
    } else if (!failures.isEmpty()) {
      result.setStatus(ApiStatus.PARTIAL_SUCCESS);
    }
    return result;
  }

  private record AuthorizedBulk(BulkAssets request, List<BulkResponse> failures) {}

  @GET
  @Path("/customUnits")
  @Operation(
      operationId = "getCustomUnitsOfMeasurement",
      summary = "Get list of custom units of measurement",
      description =
          "Get a list of all custom units of measurement that have been used in existing metrics. This helps UI provide autocomplete suggestions.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of custom units",
            content =
                @Content(
                    mediaType = "application/json",
                    array = @ArraySchema(schema = @Schema(type = "string"))))
      })
  public Response getCustomUnitsOfMeasurement(@Context SecurityContext securityContext) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContext());
    List<String> customUnits = repository.getDistinctCustomUnitsOfMeasurement();
    return Response.ok(customUnits).build();
  }
}
