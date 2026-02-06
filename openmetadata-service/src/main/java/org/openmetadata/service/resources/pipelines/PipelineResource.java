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

package org.openmetadata.service.resources.pipelines;

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
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.PipelineExecutionTrendList;
import org.openmetadata.schema.type.PipelineMetrics;
import org.openmetadata.schema.type.PipelineObservabilityResponse;
import org.openmetadata.schema.type.PipelineRuntimeTrendList;
import org.openmetadata.schema.type.PipelineSummary;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.PipelineRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.EntityUtil.Fields;

@Path("/v1/pipelines")
@Tag(
    name = "Pipelines",
    description =
        "A `Pipeline` enables the flow of data from source to destination through a series of processing steps. ETL is a type of pipeline where the series of steps Extract, Transform and Load the data.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "pipelines")
public class PipelineResource extends EntityResource<Pipeline, PipelineRepository> {
  public static final String COLLECTION_PATH = "/v1/pipelines/";
  private final PipelineMapper mapper = new PipelineMapper();
  static final String FIELDS =
      "owners,tasks,pipelineStatus,followers,tags,extension,scheduleInterval,domains,sourceHash";

  @Override
  public Pipeline addHref(UriInfo uriInfo, Pipeline pipeline) {
    super.addHref(uriInfo, pipeline);
    Entity.withHref(uriInfo, pipeline.getService());
    return pipeline;
  }

  public PipelineResource(Authorizer authorizer, Limits limits) {
    super(Entity.PIPELINE, authorizer, limits);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("tasks,pipelineStatus", MetadataOperation.VIEW_BASIC);
    return listOf(MetadataOperation.EDIT_LINEAGE, MetadataOperation.EDIT_STATUS);
  }

  public static class PipelineList extends ResultList<Pipeline> {
    /* Required for serde */
  }

  public static class PipelineStatusList extends ResultList<PipelineStatus> {
    /* Required for serde */
  }

  public static class PipelineSummaryList extends ResultList<PipelineSummary> {
    /* Required for serde */
  }

  @GET
  @Valid
  @Operation(
      operationId = "listPipelines",
      summary = "List pipelines",
      description =
          "Get a list of pipelines, optionally filtered by `service` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of pipelines",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PipelineList.class)))
      })
  public ResultList<Pipeline> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter pipelines by service name",
              schema = @Schema(type = "string", example = "airflow"))
          @QueryParam("service")
          String serviceParam,
      @Parameter(description = "Limit the number pipelines returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of pipelines before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of pipelines after this cursor",
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
      operationId = "listAllPipelineVersion",
      summary = "List pipeline versions",
      description = "Get a list of all the versions of a pipeline identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of pipeline versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the pipeline", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getPipelineWithID",
      summary = "Get a pipeline by Id",
      description = "Get a pipeline by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The pipeline",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Pipeline.class))),
        @ApiResponse(responseCode = "404", description = "Pipeline for instance {id} is not found")
      })
  public Pipeline get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the pipeline", schema = @Schema(type = "UUID"))
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
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getPipelineByFQN",
      summary = "Get a pipeline by fully qualified name",
      description = "Get a pipeline by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The pipeline",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Pipeline.class))),
        @ApiResponse(responseCode = "404", description = "Pipeline for instance {fqn} is not found")
      })
  public Pipeline getByName(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fully qualified name of the pipeline",
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
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificPipelineVersion",
      summary = "Get a version of the pipeline",
      description = "Get a version of the pipeline by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "pipeline",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Pipeline.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Pipeline for instance {id} and version {version} is not found")
      })
  public Pipeline getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the pipeline", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Pipeline version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createPipeline",
      summary = "Create a pipeline",
      description = "Create a new pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The pipeline",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Pipeline.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreatePipeline create) {
    Pipeline pipeline = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, pipeline);
  }

  @PUT
  @Path("/bulk")
  @Operation(
      operationId = "bulkCreateOrUpdatePipelines",
      summary = "Bulk create or update pipelines",
      description =
          "Create or update multiple pipelines in a single operation. "
              + "Returns a BulkOperationResult with success/failure details for each pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Bulk operation results",
            content =
                @Content(
                    mediaType = "application/json",
                    schema =
                        @Schema(
                            implementation =
                                org.openmetadata.schema.type.api.BulkOperationResult.class))),
        @ApiResponse(
            responseCode = "202",
            description = "Bulk operation accepted for async processing",
            content =
                @Content(
                    mediaType = "application/json",
                    schema =
                        @Schema(
                            implementation =
                                org.openmetadata.schema.type.api.BulkOperationResult.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response bulkCreateOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @DefaultValue("false") @QueryParam("async") boolean async,
      List<CreatePipeline> createRequests) {
    return processBulkRequest(uriInfo, securityContext, createRequests, mapper, async);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchPipeline",
      summary = "Update a pipeline",
      description = "Update an existing pipeline using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the pipeline", schema = @Schema(type = "UUID"))
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
      operationId = "patchPipeline",
      summary = "Update a pipeline by name.",
      description = "Update an existing pipeline using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the pipeline", schema = @Schema(type = "string"))
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
      operationId = "createOrUpdatePipeline",
      summary = "Create or update a pipeline",
      description = "Create a new pipeline, if it does not exist or update an existing pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The pipeline",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Pipeline.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreatePipeline create) {
    Pipeline pipeline = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, pipeline);
  }

  @PUT
  @Path("/{fqn}/status")
  @Operation(
      operationId = "addStatusData",
      summary = "Add status data",
      description = "Add status data to the pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The pipeline with a the new status",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Pipeline.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response addPipelineStatus(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the pipeline",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Valid PipelineStatus pipelineStatus) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_STATUS);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return repository.addPipelineStatus(fqn, pipelineStatus).toResponse();
  }

  @PUT
  @Path("/{fqn}/status/bulk")
  @Operation(
      operationId = "addBulkStatusData",
      summary = "Add bulk status data",
      description = "Add multiple status records to the pipeline in a single request.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The pipeline with the latest status",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Pipeline.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response addBulkPipelineStatus(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the pipeline",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Valid @Size(max = 1000, message = "Bulk pipeline status list cannot exceed 1000 items")
          List<PipelineStatus> pipelineStatuses) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_STATUS);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return repository.addBulkPipelineStatus(fqn, pipelineStatuses).toResponse();
  }

  @GET
  @Path("/{fqn}/status")
  @Operation(
      operationId = "listPipelineStatuses",
      summary = "List pipeline status",
      description =
          "Get a list of pipeline status. Use `limit` and `before` or `after` query params for cursor-based pagination. "
              + "Filter by execution status using comma-separated values (e.g., 'Failed,Successful'). "
              + "Search by task name using the `search` parameter.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of pipeline statuses.",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PipelineResource.PipelineStatusList.class)))
      })
  public ResultList<PipelineStatus> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the pipeline",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Filter pipeline statues after the given start timestamp",
              schema = @Schema(type = "number"))
          @NotNull
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter pipeline statues before the given end timestamp",
              schema = @Schema(type = "number"))
          @NotNull
          @QueryParam("endTs")
          Long endTs,
      @Parameter(
              description =
                  "Limit the number of pipeline statuses returned. If not provided, returns all results.",
              schema = @Schema(type = "integer"))
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          Integer limitParam,
      @Parameter(
              description = "Returns list of pipeline statuses before this cursor (timestamp)",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of pipeline statuses after this cursor (timestamp)",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description =
                  "Filter by execution status. Supports multiple comma-separated values (e.g., 'Failed,Successful')",
              schema = @Schema(type = "string", example = "Failed,Successful"))
          @QueryParam("status")
          String status,
      @Parameter(
              description = "Search pipeline statuses by task name",
              schema = @Schema(type = "string"))
          @QueryParam("search")
          String search,
      @Parameter(
              description = "Filter pipeline statuses by minimum duration in milliseconds",
              schema = @Schema(type = "number"))
          @QueryParam("minDuration")
          Long minDuration,
      @Parameter(
              description = "Filter pipeline statuses by maximum duration in milliseconds",
              schema = @Schema(type = "number"))
          @QueryParam("maxDuration")
          Long maxDuration) {
    return repository.getPipelineStatuses(
        fqn, startTs, endTs, limitParam, before, after, status, search, minDuration, maxDuration);
  }

  @DELETE
  @Path("/{fqn}/status/{timestamp}")
  @Operation(
      operationId = "DeletePipelineStatus",
      summary = "Delete pipeline status",
      description = "Delete pipeline status for a pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully deleted the PipelineStatus",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Pipeline.class)))
      })
  public Pipeline deletePipelineStatus(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the pipeline",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(description = "Timestamp of the pipeline status", schema = @Schema(type = "long"))
          @PathParam("timestamp")
          Long timestamp) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_STATUS);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    Pipeline pipeline = repository.deletePipelineStatus(fqn, timestamp);
    return addHref(uriInfo, pipeline);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollower",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as follower of this pipeline",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "Pipeline for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the pipeline", schema = @Schema(type = "UUID"))
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
      description = "Remove the user identified `userId` as a follower of the pipeline.",
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
      @Parameter(description = "Id of the pipeline", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user being removed as follower",
              schema = @Schema(type = "UUID"))
          @PathParam("userId")
          UUID userId) {
    return repository
        .deleteFollower(securityContext.getUserPrincipal().getName(), id, userId)
        .toResponse();
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

  @GET
  @Path("/summary")
  @Operation(
      operationId = "listPipelineSummaries",
      summary = "List pipeline summaries with impacted assets count",
      description = "Get a paginated list of pipeline summaries including impacted assets count",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of pipeline summaries",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PipelineSummaryList.class)))
      })
  public ResultList<PipelineSummary> listPipelineSummaries(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fields requested in the returned resource") @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Filter by service name") @QueryParam("service") String serviceParam,
      @Parameter(description = "Search pipelines by name or FQN") @QueryParam("search")
          String searchParam,
      @Parameter(
              description = "Filter by execution status (Successful, Failed, Pending, Skipped)",
              schema = @Schema(type = "string"))
          @QueryParam("status")
          String status,
      @Parameter(
              description = "Filter by domain ID or fully qualified name",
              schema = @Schema(type = "string"))
          @QueryParam("domain")
          String domain,
      @Parameter(description = "Filter by owner ID or name", schema = @Schema(type = "string"))
          @QueryParam("owner")
          String owner,
      @Parameter(
              description = "Filter by tier (e.g., Tier.Tier1)",
              schema = @Schema(type = "string"))
          @QueryParam("tier")
          String tier,
      @Parameter(
              description = "Filter results after the given start timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter results before the given end timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("endTs")
          Long endTs,
      @Parameter(description = "Limit the number of results (1 to 1000, default = 10)")
          @DefaultValue("10")
          @Min(value = 1, message = "Limit must be at least 1")
          @Max(value = 1000, message = "Limit cannot exceed 1000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list before this cursor") @QueryParam("before")
          String before,
      @Parameter(description = "Returns list after this cursor") @QueryParam("after") String after,
      @Parameter(description = "Include all, deleted, or non-deleted entities")
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {

    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    Fields fields = getFields(fieldsParam);
    ListFilter filter =
        new ListFilter(include)
            .addQueryParam("service", serviceParam)
            .addQueryParam("search", searchParam)
            .addQueryParam("status", status)
            .addQueryParam("domain", domain)
            .addQueryParam("owner", owner)
            .addQueryParam("tier", tier)
            .addQueryParam("startTs", startTs != null ? String.valueOf(startTs) : null)
            .addQueryParam("endTs", endTs != null ? String.valueOf(endTs) : null);

    return repository.listPipelineSummaries(
        uriInfo, securityContext, fields, filter, limitParam, before, after);
  }

  @GET
  @Path("/metrics")
  @Operation(
      operationId = "getPipelineMetrics",
      summary = "Get aggregated pipeline metrics",
      description =
          "Get aggregated metrics about pipelines from the database. Optionally filter results using the q parameter.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Pipeline metrics",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PipelineMetrics.class)))
      })
  public Response getPipelineMetrics(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Search query to filter the aggregation results",
              schema = @Schema(type = "String"))
          @QueryParam("q")
          String query,
      @Parameter(description = "Filter by service type", schema = @Schema(type = "string"))
          @QueryParam("serviceType")
          String serviceType,
      @Parameter(description = "Filter by service name", schema = @Schema(type = "string"))
          @QueryParam("service")
          String service,
      @Parameter(
              description = "Filter by execution status (Successful, Failed, Pending, Skipped)",
              schema = @Schema(type = "string"))
          @QueryParam("status")
          String status,
      @Parameter(
              description = "Filter by domain ID or fully qualified name",
              schema = @Schema(type = "string"))
          @QueryParam("domain")
          String domain,
      @Parameter(description = "Filter by owner ID or name", schema = @Schema(type = "string"))
          @QueryParam("owner")
          String owner,
      @Parameter(
              description = "Filter by tier (e.g., Tier.Tier1)",
              schema = @Schema(type = "string"))
          @QueryParam("tier")
          String tier,
      @Parameter(
              description = "Filter results after the given start timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter results before the given end timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("endTs")
          Long endTs) {

    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);

    try {
      authorizer.authorize(securityContext, operationContext, getResourceContextByName(""));
      PipelineMetrics metrics =
          repository.getPipelineMetrics(
              query, service, serviceType, status, domain, owner, tier, startTs, endTs);
      return Response.ok(metrics).build();
    } catch (Exception e) {
      PipelineMetrics emptyMetrics =
          new PipelineMetrics()
              .withTotalPipelines(0)
              .withDataAvailable(false)
              .withErrorMessage(e.getMessage());
      return Response.ok(emptyMetrics).build();
    }
  }

  @GET
  @Path("/name/{fqn}/observability")
  @Operation(
      operationId = "getPipelineObservability",
      summary = "Get pipeline observability data",
      description = "Get observability data for all tables associated with this pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Pipeline observability data grouped by tables",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PipelineObservabilityResponse.class))),
        @ApiResponse(responseCode = "404", description = "Pipeline for instance {fqn} is not found")
      })
  public Response getPipelineObservability(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the pipeline",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description =
                  "Filter by execution status (Successful, Failed, Running, Pending, Skipped)",
              schema = @Schema(type = "string"))
          @QueryParam("status")
          String status,
      @Parameter(
              description = "Filter pipeline observability data after the given start timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter pipeline observability data before the given end timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("endTs")
          Long endTs,
      @Parameter(description = "Filter by service type", schema = @Schema(type = "string"))
          @QueryParam("serviceType")
          String serviceType,
      @Parameter(description = "Search tables by name or FQN", schema = @Schema(type = "string"))
          @QueryParam("search")
          String search,
      @Parameter(
              description = "Limit the number of tables returned",
              schema = @Schema(type = "integer"))
          @DefaultValue("10")
          @QueryParam("limit")
          int limit,
      @Parameter(description = "Returns list before this cursor") @QueryParam("before")
          String before,
      @Parameter(description = "Returns list after this cursor") @QueryParam("after")
          String after) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    PipelineObservabilityResponse response =
        repository.getPipelineObservability(
            fqn, status, startTs, endTs, serviceType, search, limit, before, after);
    return Response.ok(response).build();
  }

  @GET
  @Path("/executionTrend")
  @Operation(
      operationId = "getPipelineExecutionTrend",
      summary = "Get pipeline execution trend",
      description =
          "Get day-wise pipeline execution trend showing succeeded and failed counts from the database.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Pipeline execution trend data",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PipelineExecutionTrendList.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response getPipelineExecutionTrend(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Start timestamp for trend analysis",
              schema = @Schema(type = "number"),
              required = true)
          @QueryParam("startTs")
          @NotNull
          Long startTs,
      @Parameter(
              description = "End timestamp for trend analysis",
              schema = @Schema(type = "number"),
              required = true)
          @QueryParam("endTs")
          @NotNull
          Long endTs,
      @Parameter(description = "Filter by specific pipeline FQN", schema = @Schema(type = "string"))
          @QueryParam("pipelineFqn")
          String pipelineFqn,
      @Parameter(description = "Filter by service type", schema = @Schema(type = "string"))
          @QueryParam("serviceType")
          String serviceType,
      @Parameter(description = "Filter by service name", schema = @Schema(type = "string"))
          @QueryParam("service")
          String service,
      @Parameter(
              description = "Filter by execution status (Successful, Failed, Pending, Skipped)",
              schema = @Schema(type = "string"))
          @QueryParam("status")
          String status,
      @Parameter(
              description = "Filter by domain ID or fully qualified name",
              schema = @Schema(type = "string"))
          @QueryParam("domain")
          String domain,
      @Parameter(description = "Filter by owner ID or name", schema = @Schema(type = "string"))
          @QueryParam("owner")
          String owner,
      @Parameter(
              description = "Filter by tier (e.g., Tier.Tier1)",
              schema = @Schema(type = "string"))
          @QueryParam("tier")
          String tier,
      @Parameter(
              description = "Maximum number of trend data points to return",
              schema = @Schema(type = "integer"))
          @QueryParam("limit")
          @DefaultValue("30")
          Integer limit,
      @Parameter(description = "Offset for pagination (default = 0)")
          @DefaultValue("0")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @QueryParam("offset")
          Integer offset) {

    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContext());

    try {
      PipelineExecutionTrendList trendList =
          repository.getPipelineExecutionTrend(
              startTs,
              endTs,
              pipelineFqn,
              service,
              serviceType,
              status,
              domain,
              owner,
              tier,
              limit,
              offset);
      return Response.ok(trendList).build();
    } catch (Exception e) {
      PipelineExecutionTrendList emptyTrend =
          new PipelineExecutionTrendList()
              .withData(new ArrayList<>())
              .withDataAvailable(false)
              .withErrorMessage(e.getMessage());
      return Response.ok(emptyTrend).build();
    }
  }

  @GET
  @Path("/runtimeTrend")
  @Operation(
      operationId = "getPipelineRuntimeTrend",
      summary = "Get pipeline runtime trend",
      description =
          "Get day-wise pipeline runtime trend showing max, min, and average runtime from the database.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Pipeline runtime trend data",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PipelineRuntimeTrendList.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response getPipelineRuntimeTrend(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Start timestamp for trend analysis",
              schema = @Schema(type = "number"),
              required = true)
          @QueryParam("startTs")
          @NotNull
          Long startTs,
      @Parameter(
              description = "End timestamp for trend analysis",
              schema = @Schema(type = "number"),
              required = true)
          @QueryParam("endTs")
          @NotNull
          Long endTs,
      @Parameter(description = "Filter by specific pipeline FQN", schema = @Schema(type = "string"))
          @QueryParam("pipelineFqn")
          String pipelineFqn,
      @Parameter(description = "Filter by service type", schema = @Schema(type = "string"))
          @QueryParam("serviceType")
          String serviceType,
      @Parameter(description = "Filter by service name", schema = @Schema(type = "string"))
          @QueryParam("service")
          String service,
      @Parameter(
              description = "Filter by execution status (Successful, Failed, Pending, Skipped)",
              schema = @Schema(type = "string"))
          @QueryParam("status")
          String status,
      @Parameter(
              description = "Filter by domain ID or fully qualified name",
              schema = @Schema(type = "string"))
          @QueryParam("domain")
          String domain,
      @Parameter(description = "Filter by owner ID or name", schema = @Schema(type = "string"))
          @QueryParam("owner")
          String owner,
      @Parameter(
              description = "Filter by tier (e.g., Tier.Tier1)",
              schema = @Schema(type = "string"))
          @QueryParam("tier")
          String tier,
      @Parameter(
              description = "Maximum number of trend data points to return",
              schema = @Schema(type = "integer"))
          @QueryParam("limit")
          @DefaultValue("30")
          Integer limit,
      @Parameter(description = "Offset for pagination (default = 0)")
          @DefaultValue("0")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @QueryParam("offset")
          Integer offset) {

    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContext());

    try {
      PipelineRuntimeTrendList trendList =
          repository.getPipelineRuntimeTrend(
              startTs,
              endTs,
              pipelineFqn,
              service,
              serviceType,
              status,
              domain,
              owner,
              tier,
              limit,
              offset);
      return Response.ok(trendList).build();
    } catch (Exception e) {
      PipelineRuntimeTrendList emptyTrend =
          new PipelineRuntimeTrendList()
              .withData(new ArrayList<>())
              .withDataAvailable(false)
              .withErrorMessage(e.getMessage());
      return Response.ok(emptyTrend).build();
    }
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deletePipeline",
      summary = "Delete a pipeline by Id",
      description = "Delete a pipeline by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Pipeline for instance {id} is not found")
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
      @Parameter(description = "Id of the pipeline", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deletePipelineAsync",
      summary = "Asynchronously delete a pipeline by Id",
      description = "Asynchronously delete a pipeline by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Pipeline for instance {id} is not found")
      })
  public Response deleteByIdAsync(
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
      @Parameter(description = "Id of the pipeline", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deletePipelineByFQN",
      summary = "Delete a pipeline by fully qualified name",
      description = "Delete a pipeline by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Pipeline for instance {fqn} is not found")
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
              description = "Fully qualified name of the pipeline",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted pipeline",
      description = "Restore a soft deleted pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Pipeline ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Pipeline.class)))
      })
  public Response restorePipeline(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }
}
