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

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
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
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.api.data.CreateMetricGroup;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.MetricGroupRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Path("/v1/metricGroups")
@Tag(
    name = "Metric Groups",
    description =
        "A `Metric Group` is a named collection of Metrics, such as `Profitability` or "
            + "`Supply Chain`. Groups organize metrics for browsing and governance without owning "
            + "them — deleting a group leaves its metrics intact and merely ungrouped.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "metricGroups")
public class MetricGroupResource extends EntityResource<MetricGroup, MetricGroupRepository> {
  public static final String COLLECTION_PATH = "/v1/metricGroups/";
  private final MetricGroupMapper mapper = new MetricGroupMapper();
  static final String FIELDS = "owners,followers,tags,extension,domains,metricCount";

  public MetricGroupResource(Authorizer authorizer, Limits limits) {
    super(Entity.METRIC_GROUP, authorizer, limits);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    return Collections.emptyList();
  }

  public static class MetricGroupList extends ResultList<MetricGroup> {
    /* Required for serde */
  }

  public static class MetricGroupMembersList extends ResultList<Metric> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listMetricGroups",
      summary = "List metric groups",
      description = "Get a list of metric groups.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of metric groups",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetricGroupList.class)))
      })
  public ResultList<MetricGroup> list(
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
      @Parameter(description = "Returns list of metric groups before this cursor")
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of metric groups after this cursor")
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include);
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getMetricGroupByID",
      summary = "Get a metric group by Id",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The metric group",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetricGroup.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Metric group for instance {id} is not found")
      })
  public MetricGroup get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the metric group", schema = @Schema(type = "UUID"))
          @PathParam("id")
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
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/{id}/metrics")
  @Operation(
      operationId = "listMetricGroupMembers",
      summary = "List Metrics in a Metric Group",
      description = "Returns roots and inherited descendants using offset pagination.")
  public ResultList<Metric> listMetrics(
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Parameter(description = "Case-insensitive Metric name search") @QueryParam("q") String query,
      @Parameter(description = "Return hierarchy roots only")
          @DefaultValue("false")
          @QueryParam("rootOnly")
          boolean rootOnly,
      @DefaultValue("20") @Min(1) @Max(1000) @QueryParam("limit") int limit,
      @DefaultValue("0") @Min(0) @QueryParam("offset") int offset) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    ResourcePermission metricPermission =
        authorizer.getPermission(
            securityContext, securityContext.getUserPrincipal().getName(), Entity.METRIC);
    ResultList<Metric> result;
    if (MetricResource.hasUnconditionalView(metricPermission)) {
      result = repository.listMetrics(id, limit, offset, query, rootOnly);
    } else {
      result =
          repository.listMetrics(
              id,
              limit,
              offset,
              query,
              rootOnly,
              metric -> canAccessMetric(securityContext, metric, MetadataOperation.VIEW_BASIC));
    }
    return result;
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getMetricGroupByFQN",
      summary = "Get a metric group by fully qualified name",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The metric group",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetricGroup.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Metric group for instance {fqn} is not found")
      })
  public MetricGroup getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fully qualified name of the metric group") @PathParam("fqn")
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
      operationId = "listAllMetricGroupVersions",
      summary = "List metric group versions",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of metric group versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the metric group", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificMetricGroupVersion",
      summary = "Get a version of the metric group",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The metric group version",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetricGroup.class)))
      })
  public MetricGroup getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the metric group", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Metric group version number", schema = @Schema(type = "string"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createMetricGroup",
      summary = "Create a metric group",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The metric group",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetricGroup.class)))
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateMetricGroup create) {
    MetricGroup metricGroup =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    repository.prepareInternal(metricGroup, false);
    authorizeMembershipMutation(securityContext, null, metricGroup);
    return withoutMembers(create(uriInfo, securityContext, metricGroup));
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateMetricGroup",
      summary = "Create or update a metric group",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The metric group",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetricGroup.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateMetricGroup create) {
    MetricGroup metricGroup =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    repository.prepareInternal(metricGroup, true);
    MetricGroup original =
        repository.findByNameOrNull(metricGroup.getFullyQualifiedName(), Include.NON_DELETED);
    if (original != null) {
      original = repository.getWithMembers(original.getId(), Include.NON_DELETED);
    }
    authorizeMembershipMutation(securityContext, original, metricGroup);
    return withoutMembers(createOrUpdate(uriInfo, securityContext, metricGroup));
  }

  @PATCH
  @Path("/{id}")
  @Operation(operationId = "patchMetricGroup", summary = "Update a metric group")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the metric group", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Valid JsonPatch patch) {
    MetricGroup original = repository.getWithMembers(id, Include.NON_DELETED);
    MetricGroup updated = JsonUtils.applyPatch(original, patch, MetricGroup.class);
    repository.prepareInternal(updated, true);
    authorizeMembershipMutation(securityContext, original, updated);
    return withoutMembers(patchInternal(uriInfo, securityContext, id, patch));
  }

  @PUT
  @Path("/{name}/metrics/add")
  @Operation(
      operationId = "bulkAddMetricsToGroup",
      summary = "Add metrics to a group",
      description = "Add the given metrics to the group identified by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(responseCode = "400", description = "All operations failed")
      })
  public Response bulkAddMetrics(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the metric group") @PathParam("name") String name,
      @Valid BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    AuthorizedBulk authorized = authorizeBulkMetrics(securityContext, request);
    BulkOperationResult result =
        authorized.request().getAssets().isEmpty()
            ? emptyBulkResult(request)
            : repository.bulkAddMetrics(
                name, authorized.request(), securityContext.getUserPrincipal().getName());
    return buildBulkOperationResponse(mergeAuthorizationFailures(result, authorized.failures()));
  }

  @PUT
  @Path("/{name}/metrics/remove")
  @Operation(
      operationId = "bulkRemoveMetricsFromGroup",
      summary = "Remove metrics from a group",
      description = "Remove the given metrics from the group identified by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(responseCode = "400", description = "All operations failed")
      })
  public Response bulkRemoveMetrics(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the metric group") @PathParam("name") String name,
      @Valid BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    AuthorizedBulk authorized = authorizeBulkMetrics(securityContext, request);
    BulkOperationResult result =
        authorized.request().getAssets().isEmpty()
            ? emptyBulkResult(request)
            : repository.bulkRemoveMetrics(
                name, authorized.request(), securityContext.getUserPrincipal().getName());
    return buildBulkOperationResponse(mergeAuthorizationFailures(result, authorized.failures()));
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteMetricGroup",
      summary = "Delete a metric group by Id",
      description =
          "Delete a metric group. Its metrics are left intact and become ungrouped, because a "
              + "group organizes metrics rather than owning them.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Metric group for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the metric group", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    MetricGroup membershipSnapshot = membershipSnapshot(id);
    Response response = delete(uriInfo, securityContext, id, false, hardDelete);
    repository.refreshMembersAfterGroupLifecycle(membershipSnapshot);
    return withoutMembers(response);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteMetricGroupByFQN",
      summary = "Delete a metric group by fully qualified name",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Metric group for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Fully qualified name of the metric group") @PathParam("fqn")
          String fqn) {
    MetricGroup membershipSnapshot = membershipSnapshot(fqn);
    Response response = deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
    repository.refreshMembersAfterGroupLifecycle(membershipSnapshot);
    return withoutMembers(response);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restoreMetricGroup",
      summary = "Restore a soft deleted metric group",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the metric group",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetricGroup.class)))
      })
  public Response restore(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return withoutMembers(restoreEntity(uriInfo, securityContext, restore.getId()));
  }

  private MetricGroup membershipSnapshot(UUID id) {
    return repository.getWithMembers(id, Include.ALL);
  }

  private MetricGroup membershipSnapshot(String fqn) {
    return repository.getByNameWithMembers(fqn, Include.ALL);
  }

  static Response withoutMembers(Response response) {
    if (response.hasEntity() && response.getEntity() instanceof MetricGroup metricGroup) {
      metricGroup.setMetrics(null);
    }
    return response;
  }

  Response buildBulkOperationResponse(BulkOperationResult result) {
    if (result.getStatus() == ApiStatus.FAILURE) {
      return Response.status(Response.Status.BAD_REQUEST).entity(result).build();
    }
    return Response.ok().entity(result).build();
  }

  private boolean canAccessMetric(
      SecurityContext securityContext, EntityReference metric, MetadataOperation operation) {
    try {
      authorizer.authorize(
          securityContext,
          new OperationContext(Entity.METRIC, operation),
          new ResourceContext<>(Entity.METRIC, metric.getId(), metric.getFullyQualifiedName()));
      return true;
    } catch (AuthorizationException
        | EntityNotFoundException
        | IllegalArgumentException exception) {
      return false;
    }
  }

  private void authorizeMembershipMutation(
      SecurityContext securityContext, MetricGroup original, MetricGroup updated) {
    for (EntityReference metric : membershipMutationTargets(original, updated)) {
      authorizer.authorize(
          securityContext,
          new OperationContext(Entity.METRIC, MetadataOperation.EDIT_ALL),
          new ResourceContext<>(Entity.METRIC, metric.getId(), metric.getFullyQualifiedName()));
    }
  }

  static List<EntityReference> membershipMutationTargets(
      MetricGroup original, MetricGroup updated) {
    Map<UUID, EntityReference> originalMembers = new LinkedHashMap<>();
    Map<UUID, EntityReference> updatedMembers = new LinkedHashMap<>();
    for (EntityReference metric : listOrEmpty(original == null ? null : original.getMetrics())) {
      originalMembers.put(metric.getId(), metric);
    }
    for (EntityReference metric : listOrEmpty(updated.getMetrics())) {
      updatedMembers.put(metric.getId(), metric);
    }
    List<EntityReference> affected = new ArrayList<>();
    originalMembers.forEach(
        (id, metric) -> {
          if (!updatedMembers.containsKey(id)) {
            affected.add(metric);
          }
        });
    updatedMembers.forEach(
        (id, metric) -> {
          if (!originalMembers.containsKey(id)) {
            affected.add(metric);
          }
        });
    return affected;
  }

  private AuthorizedBulk authorizeBulkMetrics(SecurityContext securityContext, BulkAssets request) {
    List<EntityReference> allowed = new ArrayList<>();
    List<BulkResponse> failures = new ArrayList<>();
    for (EntityReference requested : listOrEmpty(request.getAssets())) {
      boolean authorized = true;
      try {
        for (EntityReference metric : repository.hierarchySubtree(requested)) {
          if (!canAccessMetric(securityContext, metric, MetadataOperation.EDIT_ALL)) {
            authorized = false;
            break;
          }
        }
      } catch (EntityNotFoundException | IllegalArgumentException exception) {
        authorized = true;
      }
      if (authorized) {
        allowed.add(requested);
      } else {
        failures.add(
            new BulkResponse()
                .withRequest(requested)
                .withMessage("Not authorized to edit the complete Metric hierarchy"));
      }
    }
    return new AuthorizedBulk(
        new BulkAssets().withAssets(allowed).withDryRun(request.getDryRun()), failures);
  }

  private BulkOperationResult emptyBulkResult(BulkAssets request) {
    return new BulkOperationResult()
        .withDryRun(Boolean.TRUE.equals(request.getDryRun()))
        .withStatus(ApiStatus.SUCCESS);
  }

  private BulkOperationResult mergeAuthorizationFailures(
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
}
