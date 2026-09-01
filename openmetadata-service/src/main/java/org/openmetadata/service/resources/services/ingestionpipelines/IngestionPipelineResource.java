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

package org.openmetadata.service.resources.services.ingestionpipelines;

import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.MetadataOperation.CREATE;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.jdbi3.IngestionPipelineRepository.validateProfileSample;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.inject.Inject;
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.BadRequestException;
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
import jakarta.ws.rs.ServiceUnavailableException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.StreamingOutput;
import jakarta.ws.rs.core.UriInfo;
import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseEventSink;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.configuration.LogStorageConfiguration;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.AgentType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.sdk.exception.PipelineServiceClientException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository.ForcedDeleteResult;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.logstorage.LogStorageFactory;
import org.openmetadata.service.logstorage.LogStorageInterface;
import org.openmetadata.service.logstorage.stream.IngestionLogStreamFactory;
import org.openmetadata.service.logstorage.stream.IngestionLogStreamManager;
import org.openmetadata.service.monitoring.IngestionProgressTracker;
import org.openmetadata.service.monitoring.MicrometerBundle;
import org.openmetadata.service.monitoring.StreamableLogsMetrics;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.openmetadata.service.util.RestUtil;

// TODO merge with workflows
@Slf4j
@Path("/v1/services/ingestionPipelines")
@Tag(
    name = "Ingestion Pipelines",
    description = "APIs related pipelines/workflows created by the system to ingest metadata.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "IngestionPipelines")
public class IngestionPipelineResource
    extends EntityResource<IngestionPipeline, IngestionPipelineRepository> {
  private IngestionPipelineMapper mapper;
  public static final String COLLECTION_PATH = "/v1/services/ingestionPipelines/";
  static final String SORT_FIELD_DISPLAY_NAME = "displayName";
  static final String RUNNER_CLEANUP_HEADER = "X-OpenMetadata-Runner-Cleanup";
  static final String RUNNER_CLEANUP_SKIPPED = "skipped-unavailable";
  private PipelineServiceClientInterface pipelineServiceClient;
  private OpenMetadataApplicationConfig openMetadataApplicationConfig;
  private IngestionLogStreamFactory logStreamFactory;
  static final String FIELDS = "owners,followers";
  private static final String NO_LOG_BACKEND =
      "No log backend is configured on this deployment, so ingestion logs cannot be streamed.";
  private static final String LOG_STREAM_FIELDS = "pipelineStatuses,ingestionRunner";

  @Inject private StreamableLogsMetrics streamableLogsMetrics;
  @Inject private IngestionProgressTracker progressTracker;

  @Override
  public IngestionPipeline addHref(UriInfo uriInfo, IngestionPipeline ingestionPipeline) {
    super.addHref(uriInfo, ingestionPipeline);
    Entity.withHref(uriInfo, ingestionPipeline.getService());
    return ingestionPipeline;
  }

  public IngestionPipelineResource(Authorizer authorizer, Limits limits) {
    super(Entity.INGESTION_PIPELINE, authorizer, limits);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    this.openMetadataApplicationConfig = config;
    this.mapper = new IngestionPipelineMapper(config);
    this.pipelineServiceClient =
        PipelineServiceClientFactory.createPipelineServiceClient(
            config.getPipelineServiceClientConfiguration());
    repository.setPipelineServiceClient(pipelineServiceClient);
    this.logStreamFactory = new IngestionLogStreamFactory(repository, pipelineServiceClient);

    // Initialize log storage - always initialize with at least DefaultLogStorage
    LogStorageConfiguration logStorageConfig =
        config.getPipelineServiceClientConfiguration() != null
            ? config.getPipelineServiceClientConfiguration().getLogStorageConfiguration()
            : null;

    // Set the configuration in repository so it knows what's enabled
    repository.setLogStorageConfiguration(logStorageConfig);

    try {
      LogStorageInterface logStorage =
          LogStorageFactory.create(logStorageConfig, pipelineServiceClient, streamableLogsMetrics);
      repository.setLogStorage(logStorage);
      LOG.info(
          "Log storage initialized successfully: type={}",
          logStorageConfig != null ? logStorageConfig.getType() : "default");
    } catch (Exception e) {
      LOG.warn("Failed to initialize configured log storage, using default implementation", e);
      try {
        // Fallback to default log storage that delegates to pipeline service client
        LogStorageInterface defaultLogStorage =
            LogStorageFactory.create(null, pipelineServiceClient, streamableLogsMetrics);
        repository.setLogStorage(defaultLogStorage);
        // Set a default configuration so isLogStorageEnabled() returns true
        repository.setLogStorageConfiguration(new LogStorageConfiguration());
      } catch (Exception ex) {
        LOG.error("Failed to initialize default log storage", ex);
      }
    }

    // Initialize progress tracker for real-time ingestion progress updates.
    // initialize() runs before HK2 injects @Inject fields, so progressTracker
    // is typically still null here; fall back to the tracker the
    // MicrometerBundle created during its run() (executed before resources are
    // registered) so the repository always receives a live instance.
    IngestionProgressTracker tracker =
        progressTracker != null ? progressTracker : MicrometerBundle.getSharedProgressTracker();
    if (tracker != null) {
      repository.setProgressTracker(tracker);
      LOG.info("Progress tracker initialized for ingestion pipelines");
    } else {
      LOG.warn("Progress tracker unavailable; real-time ingestion progress is disabled");
    }
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    return listOf(
        MetadataOperation.CREATE_INGESTION_PIPELINE_AUTOMATOR,
        MetadataOperation.EDIT_INGESTION_PIPELINE_STATUS,
        MetadataOperation.DEPLOY,
        MetadataOperation.TRIGGER);
  }

  public static class IngestionPipelineList extends ResultList<IngestionPipeline> {
    /* Required for serde */
  }

  public static class PipelineStatusList extends ResultList<PipelineStatus> {
    /* Required for serde */
  }

  /**
   * Handle permissions based on the pipeline type
   */
  @Override
  public Response create(
      UriInfo uriInfo, SecurityContext securityContext, IngestionPipeline entity) {
    OperationContext operationContext =
        new OperationContext(entityType, getOperationForPipelineType(entity));
    CreateResourceContext<IngestionPipeline> createResourceContext =
        new CreateResourceContext<>(entityType, entity);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    authorizer.authorize(securityContext, operationContext, createResourceContext);
    entity = addHref(uriInfo, repository.create(uriInfo, entity));
    return Response.created(entity.getHref()).entity(entity).build();
  }

  /**
   * Dynamically get the MetadataOperation based on the pipelineType (or application Type).
   * E.g., for the Automator, the Operation will be `CREATE_INGESTION_PIPELINE_AUTOMATOR`.
   *
   * <p>Deriving the workflow type is part of the lookup, not a precondition of it: an application
   * pipeline can reach here with no `appConfig` to read the type from, and that has to fall back to
   * the generic create permission like any other unrecognized type rather than fail the request.
   */
  private MetadataOperation getOperationForPipelineType(IngestionPipeline ingestionPipeline) {
    MetadataOperation operation = CREATE;
    try {
      String pipelineType = IngestionPipelineRepository.getPipelineWorkflowType(ingestionPipeline);
      operation =
          MetadataOperation.valueOf(
              String.format("CREATE_INGESTION_PIPELINE_%s", pipelineType.toUpperCase(Locale.ROOT)));
    } catch (IllegalArgumentException | NullPointerException e) {
      LOG.debug(
          "No specific create operation for ingestion pipeline [{}], falling back to {}",
          ingestionPipeline.getName(),
          CREATE);
    }
    return operation;
  }

  // Sorting is optional and lenient: only `displayName` is supported, and any other value (or none)
  // falls through to the default name-ordered listing rather than erroring. The repository reads
  // the
  // sort off the filter and swaps in the display-name keyset query, so the resource keeps a single
  // listInternal path — auth, domain filter and cursor validation are shared, not forked.
  private boolean isDisplayNameSort(String sortField) {
    return SORT_FIELD_DISPLAY_NAME.equalsIgnoreCase(sortField);
  }

  @GET
  @Valid
  @Operation(
      operationId = "listIngestionPipelines",
      summary = "List ingestion pipelines for metadata operations",
      description =
          "Get a list of airflow pipelines for metadata operations. Use `fields` parameter to get only necessary fields. "
              + " Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of ingestion workflows",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IngestionPipelineList.class)))
      })
  public ResultList<IngestionPipeline> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter Ingestion Pipelines by service fully qualified name",
              schema = @Schema(type = "string", example = "snowflakeWestCoast"))
          @QueryParam("service")
          String serviceParam,
      @Parameter(
              description = "Filter Ingestion Pipelines by test suite fully qualified name",
              schema = @Schema(type = "string", example = "service.db.schema.name.testSuite"))
          @QueryParam("testSuite")
          String testSuiteParam,
      @Parameter(
              description = "Filter Ingestion Pipelines by pipeline Type",
              schema = @Schema(type = "string", example = "elasticSearchReindex"))
          @QueryParam("pipelineType")
          String pipelineType,
      @Parameter(
              description =
                  "Filter Ingestion Pipelines by agent type. Expands to the set of `pipelineType` "
                      + "values that make up the group, and is intersected with `pipelineType` when both are given.",
              schema = @Schema(implementation = AgentType.class))
          @QueryParam("agentType")
          AgentType agentType,
      @Parameter(
              description = "Filter Ingestion Pipelines by service Type",
              schema = @Schema(type = "string", example = "messagingService"))
          @QueryParam("serviceType")
          String serviceType,
      @Parameter(
              description = "Filter Ingestion Pipelines by the type of the application",
              schema = @Schema(type = "string", example = "Automator"))
          @QueryParam("applicationType")
          String applicationType,
      @Parameter(description = "Limit the number ingestion returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of ingestion before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of ingestion after this cursor",
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
              description = "List Ingestion Pipelines by provider..",
              schema = @Schema(implementation = ProviderType.class))
          @QueryParam("provider")
          ProviderType provider,
      @Parameter(
              description =
                  "Optionally order the list by a field instead of the default `name`. Only "
                      + "`displayName` is supported — it orders by the effective display name "
                      + "(`displayName` falling back to `name`), the value clients render. Any other "
                      + "value (or none) falls through to the default `name` ordering rather than "
                      + "erroring.",
              schema = @Schema(type = "string", allowableValues = SORT_FIELD_DISPLAY_NAME))
          @QueryParam("sortField")
          String sortField,
      @Parameter(
              description = "Direction to apply to `sortField`.",
              schema =
                  @Schema(
                      type = "string",
                      allowableValues = {"asc", "desc"}))
          @QueryParam("sortOrder")
          @DefaultValue("asc")
          String sortOrder) {
    ListFilter filter =
        new ListFilter(include)
            .addQueryParam("service", serviceParam)
            .addQueryParam(
                "pipelineType", AgentTypeResolver.resolvePipelineTypes(agentType, pipelineType))
            .addQueryParam("serviceType", serviceType)
            .addQueryParam("testSuite", testSuiteParam)
            .addQueryParam("applicationType", applicationType)
            .addQueryParam("provider", provider == null ? null : provider.value());
    if (isDisplayNameSort(sortField)) {
      filter.withSort(SORT_FIELD_DISPLAY_NAME, sortOrder);
    }
    ResultList<IngestionPipeline> ingestionPipelines =
        super.listInternal(
            uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);

    for (IngestionPipeline ingestionPipeline : listOrEmpty(ingestionPipelines.getData())) {
      decryptOrNullify(securityContext, ingestionPipeline, false);
    }
    return ingestionPipelines;
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollowerToIngestionPipeline",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as followed of this ingestion pipeline",
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
            description = "Ingestion Pipeline for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Ingestion Pipeline", schema = @Schema(type = "UUID"))
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

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllIngestionPipelineVersion",
      summary = "List ingestion workflow versions",
      description = "Get a list of all the versions of a ingestion pipeline identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of IngestionPipeline versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getIngestionPipelineByID",
      summary = "Get an ingestion pipeline by Id",
      description = "Get an ingestion pipeline by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The ingestion",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IngestionPipeline.class))),
        @ApiResponse(
            responseCode = "404",
            description = "IngestionPipeline for instance {id} is not found")
      })
  public IngestionPipeline get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID"))
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
    IngestionPipeline ingestionPipeline =
        getInternal(uriInfo, securityContext, id, fieldsParam, include, includeRelations);
    decryptOrNullify(securityContext, ingestionPipeline, false);
    return ingestionPipeline;
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificIngestionPipelineVersion",
      summary = "Get a version of the ingestion pipeline",
      description = "Get a version of the ingestion pipeline by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "IngestionPipelines",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IngestionPipeline.class))),
        @ApiResponse(
            responseCode = "404",
            description = "IngestionPipeline for instance {id} and version  {version} is not found")
      })
  public IngestionPipeline getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Ingestion version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    IngestionPipeline ingestionPipeline = super.getVersionInternal(securityContext, id, version);
    decryptOrNullify(securityContext, ingestionPipeline, false);
    return ingestionPipeline;
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getSpecificIngestionPipelineByFQN",
      summary = "Get an ingestion pipeline by fully qualified name",
      description = "Get an ingestion by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "IngestionPipeline",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IngestionPipeline.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Ingestion for instance {fqn} is not found")
      })
  public IngestionPipeline getByName(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fully qualified name of the ingestion pipeline",
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
    IngestionPipeline ingestionPipeline =
        getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include, includeRelations);
    decryptOrNullify(securityContext, ingestionPipeline, false);
    return ingestionPipeline;
  }

  @POST
  @Operation(
      operationId = "createIngestionPipeline",
      summary = "Create an ingestion pipeline",
      description = "Create a new ingestion pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Ingestion Pipeline",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IngestionPipeline.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateIngestionPipeline create) {
    IngestionPipeline ingestionPipeline =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    Response response = create(uriInfo, securityContext, ingestionPipeline);
    validateProfileSample(ingestionPipeline);
    decryptOrNullify(securityContext, (IngestionPipeline) response.getEntity(), false);
    return response;
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchIngestionPipeline",
      summary = "Update an ingestion pipeline",
      description = "Update an existing ingestion pipeline using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID"))
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
    Response response = patchInternal(uriInfo, securityContext, id, patch);
    decryptOrNullify(securityContext, (IngestionPipeline) response.getEntity(), false);
    return response;
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchIngestionPipeline",
      summary = "Update an ingestion pipeline using name.",
      description = "Update an existing ingestion pipeline using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the ingestion pipeline", schema = @Schema(type = "string"))
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
    Response response = patchInternal(uriInfo, securityContext, fqn, patch);
    decryptOrNullify(securityContext, (IngestionPipeline) response.getEntity(), false);
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateIngestionPipeline",
      summary = "Create or update an ingestion pipeline",
      description =
          "Create a new ingestion pipeline, if it does not exist or update an existing ingestion pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The IngestionPipeline",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IngestionPipeline.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateIngestionPipeline update) {
    IngestionPipeline ingestionPipeline =
        mapper.createToEntity(update, securityContext.getUserPrincipal().getName());
    unmask(ingestionPipeline);
    Response response = createOrUpdate(uriInfo, securityContext, ingestionPipeline);
    validateProfileSample(ingestionPipeline);
    decryptOrNullify(securityContext, (IngestionPipeline) response.getEntity(), false);
    return response;
  }

  @POST
  @Path("/deploy/{id}")
  @Operation(
      summary = "Deploy an ingestion pipeline run",
      description = "Deploy a ingestion pipeline run by Id.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The ingestion",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PipelineServiceClientResponse.class))),
        @ApiResponse(responseCode = "404", description = "Ingestion for instance {id} is not found")
      })
  public PipelineServiceClientResponse deployIngestion(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Context SecurityContext securityContext) {
    authorizePipelineOperation(securityContext, id, MetadataOperation.DEPLOY);
    return deployPipelineInternal(id, uriInfo, securityContext);
  }

  @POST
  @Path("/bulk/deploy")
  @Operation(
      summary = "Bulk deploy a list of Ingestion Pipeline",
      description = "Bulk deploy a list of Ingestion Pipelines given a list of IDs",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Statuses of the deployed pipelines",
            content =
                @Content(
                    mediaType = "application/json",
                    array =
                        @ArraySchema(
                            schema =
                                @Schema(implementation = PipelineServiceClientResponse.class))))
      })
  public List<PipelineServiceClientResponse> bulkDeployIngestion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @NotNull @Valid List<UUID> pipelineIdList) {
    pipelineIdList.forEach(
        id -> authorizePipelineOperation(securityContext, id, MetadataOperation.DEPLOY));

    return pipelineIdList.stream()
        .map(
            id -> {
              try {
                return deployPipelineInternal(id, uriInfo, securityContext);
              } catch (Exception e) {
                return new PipelineServiceClientResponse()
                    .withCode(500)
                    .withReason(
                        String.format("Error deploying [%s] due to [%s]", id, e.getMessage()))
                    .withPlatform(
                        pipelineServiceClient != null ? pipelineServiceClient.getPlatform() : null);
              }
            })
        .collect(Collectors.toList());
  }

  @POST
  @Path("/trigger/{id}")
  @Operation(
      operationId = "triggerIngestionPipelineRun",
      summary = "Trigger an ingestion pipeline run",
      description = "Trigger a ingestion pipeline run by id.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The ingestion",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PipelineServiceClientResponse.class))),
        @ApiResponse(responseCode = "404", description = "Ingestion for instance {id} is not found")
      })
  public PipelineServiceClientResponse triggerIngestion(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Context SecurityContext securityContext) {
    return triggerPipelineInternal(id, uriInfo, securityContext, null);
  }

  @POST
  @Path("/toggleIngestion/{id}")
  @Operation(
      operationId = "toggleIngestionPipelineEnabled",
      summary = "Set an ingestion pipeline either as enabled or disabled",
      description = "Toggle an ingestion pipeline state by Id.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The ingestion",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IngestionPipeline.class))),
        @ApiResponse(responseCode = "404", description = "Ingestion for instance {id} is not found")
      })
  public Response toggleIngestion(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Context SecurityContext securityContext) {
    authorizePipelineOperation(
        securityContext, id, MetadataOperation.EDIT_INGESTION_PIPELINE_STATUS);
    Fields fields = getFields(FIELD_OWNERS);
    IngestionPipeline pipeline = repository.get(uriInfo, id, fields);
    // This call updates the state in Airflow as well as the `enabled` field on the
    // IngestionPipeline
    if (pipelineServiceClient == null) {
      return Response.status(200).entity("Pipeline Client Disabled").build();
    }
    decryptOrNullify(securityContext, pipeline, true);
    pipelineServiceClient.toggleIngestion(pipeline);
    Response response =
        createOrUpdateAfterPipelineOperation(
            uriInfo, securityContext, pipeline, MetadataOperation.EDIT_INGESTION_PIPELINE_STATUS);
    decryptOrNullify(securityContext, (IngestionPipeline) response.getEntity(), false);
    return response;
  }

  @POST
  @Path("/kill/{id}")
  @Operation(
      operationId = "killIngestionPipelineRuns",
      summary =
          "Mark as failed and kill any not-finished workflow or task for the ingestion pipeline",
      description = "Kill an ingestion pipeline by Id.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The ingestion",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PipelineServiceClientResponse.class))),
        @ApiResponse(responseCode = "404", description = "Ingestion for instance {id} is not found")
      })
  public PipelineServiceClientResponse killIngestion(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Context SecurityContext securityContext) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    IngestionPipeline ingestionPipeline =
        getInternal(uriInfo, securityContext, id, FIELDS, Include.NON_DELETED);
    decryptOrNullify(securityContext, ingestionPipeline, true);
    if (pipelineServiceClient == null) {
      return new PipelineServiceClientResponse()
          .withCode(200)
          .withReason("Pipeline Client Disabled");
    }
    return pipelineServiceClient.killIngestion(ingestionPipeline);
  }

  @GET
  @Path("/ip")
  @Operation(
      operationId = "checkAirflowHostIp",
      summary = "Check the airflow REST host IP",
      description = "Check the Airflow REST host IP",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Pipeline Service host IP",
            content = @Content(mediaType = "application/json"))
      })
  public Response getHostIp(@Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    if (pipelineServiceClient == null) {
      return Response.status(200).entity("Pipeline Client Disabled").build();
    }
    return pipelineServiceClient.getHostIp();
  }

  @GET
  @Path("/status")
  @Operation(
      operationId = "checkRestAirflowStatus",
      summary = "Check the airflow REST status",
      description = "Check that the Airflow REST endpoint is reachable and up and running",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Status message",
            content = @Content(mediaType = "application/json"))
      })
  public PipelineServiceClientResponse getRESTStatus(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    if (pipelineServiceClient == null) {
      return new PipelineServiceClientResponse()
          .withCode(200)
          .withReason("Pipeline Client Disabled");
    }
    return pipelineServiceClient.getServiceStatus();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteIngestionPipeline",
      summary = "Delete an ingestion pipeline by Id",
      description = "Delete an ingestion pipeline by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "400", description = "Force requires hardDelete=true"),
        @ApiResponse(responseCode = "403", description = "Force requires administrator access"),
        @ApiResponse(responseCode = "404", description = "Ingestion for instance {id} is not found")
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
                  "Allow an administrator to hard-delete metadata when the ingestion runner is unavailable. "
                      + "The external workflow might require manual cleanup. (Default = `false`)")
          @QueryParam("force")
          @DefaultValue("false")
          boolean force,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    Response response =
        force
            ? forceDelete(uriInfo, securityContext, id, hardDelete)
            : delete(uriInfo, securityContext, id, false, hardDelete);
    return response;
  }

  private Response forceDelete(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, boolean hardDelete) {
    authorizeForceDelete(securityContext, id);
    validateForceDelete(hardDelete);
    String userName = securityContext.getUserPrincipal().getName();
    ForcedDeleteResult result = repository.forceDelete(userName, id);
    limits.invalidateCache(entityType);
    addHref(uriInfo, result.response().entity());
    return toForceDeleteResponse(result);
  }

  private void authorizeForceDelete(SecurityContext securityContext, UUID id) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(
        securityContext,
        operationContext,
        getResourceContextById(id, ResourceContext.Operation.DELETE));
    authorizer.authorizeAdmin(securityContext);
  }

  static void validateForceDelete(boolean hardDelete) {
    if (!hardDelete) {
      throw new BadRequestException(
          "Force deleting an ingestion pipeline requires hardDelete=true");
    }
  }

  private Response toForceDeleteResponse(ForcedDeleteResult result) {
    RestUtil.DeleteResponse<IngestionPipeline> deleteResponse = result.response();
    Response.ResponseBuilder responseBuilder = Response.fromResponse(deleteResponse.toResponse());
    if (result.wasRunnerCleanupSkipped()) {
      responseBuilder.header(RUNNER_CLEANUP_HEADER, RUNNER_CLEANUP_SKIPPED);
    }
    return responseBuilder.build();
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteIngestionPipelineAsync",
      summary = "Asynchronously delete an ingestion pipeline by Id",
      description = "Asynchronously delete an ingestion pipeline by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Ingestion for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteIngestionPipelineByFQN",
      summary = "Delete an ingestion pipeline by fully qualified name",
      description = "Delete an ingestion pipeline by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Ingestion for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Fully qualified name of the ingestion pipeline",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted ingestion pipeline",
      description = "Restore a soft deleted ingestion pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the IngestionPipeline. ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IngestionPipeline.class)))
      })
  public Response restoreIngestionPipeline(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  /**
   * Resolve the ingestion pipeline from a path segment that is either its Id (UUID) or its
   * fullyQualifiedName. Accepting the fqn lets a client fetch logs directly by the pipeline's
   * fully-qualified name — the identifier the logs are stored under — without first looking up the
   * pipeline Id, and keeps the log URL stable for a pipeline across its lifetime. The Id form is
   * unchanged and remains fully supported.
   */
  private IngestionPipeline getIngestionPipelineByIdOrName(
      UriInfo uriInfo, SecurityContext securityContext, String idOrName, String fields) {
    try {
      UUID pipelineId = UUID.fromString(idOrName);
      return getInternal(uriInfo, securityContext, pipelineId, fields, Include.NON_DELETED);
    } catch (IllegalArgumentException notAUuid) {
      // Not a UUID -> treat the segment as the pipeline's fullyQualifiedName.
      return getByNameInternal(uriInfo, securityContext, idOrName, fields, Include.NON_DELETED);
    }
  }

  @GET
  @Path("/logs/{id}/last")
  @Operation(
      summary = "Retrieve all logs from last ingestion pipeline run",
      description =
          "Get all logs from last ingestion pipeline run by `Id` or `fullyQualifiedName`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description =
                "JSON object with the task instance name of the ingestion on each key and log in the value",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(
            responseCode = "404",
            description = "Logs for the ingestion pipeline are not found")
      })
  public Response getLastIngestionLogs(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Id (UUID) or fullyQualifiedName of the ingestion pipeline",
              schema = @Schema(type = "string"))
          @PathParam("id")
          String id,
      @Parameter(
              description = "Returns log chunk after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Maximum number of lines to return",
              schema = @Schema(type = "integer"))
          @QueryParam("limit")
          @DefaultValue("1000")
          int limit) {
    if (pipelineServiceClient == null) {
      return Response.status(200).entity("Pipeline Client Disabled").build();
    }
    IngestionPipeline ingestionPipeline =
        getIngestionPipelineByIdOrName(uriInfo, securityContext, id, LOG_STREAM_FIELDS);
    Map<String, String> lastIngestionLogs;
    boolean useStreamableLogs =
        ingestionPipeline.getEnableStreamableLogs()
            || (ingestionPipeline.getIngestionRunner() != null
                && repository.isIngestionRunnerStreamableLogsEnabled(
                    ingestionPipeline.getIngestionRunner()));
    if (useStreamableLogs) {
      // Get logs using the repository's log storage picking up the last runId
      PipelineStatus latestStatus =
          IngestionPipelineRepository.latestPipelineStatus(ingestionPipeline);
      String runId = latestStatus == null ? null : latestStatus.getRunId();
      if (!CommonUtil.nullOrEmpty(runId)) {
        Map<String, Object> lastIngestionLogsMap =
            repository.getLogs(
                ingestionPipeline.getFullyQualifiedName(), UUID.fromString(runId), after, limit);
        Object logError = lastIngestionLogsMap.get(PipelineServiceClientInterface.LOGS_ERROR_KEY);
        if (logError != null) {
          return Response.status(Response.Status.SERVICE_UNAVAILABLE)
              .entity(Map.of(PipelineServiceClientInterface.LOGS_ERROR_KEY, logError))
              .build();
        }
        lastIngestionLogs =
            lastIngestionLogsMap.entrySet().stream()
                .filter(entry -> entry.getValue() != null)
                .collect(Collectors.toMap(Map.Entry::getKey, entry -> entry.getValue().toString()));
        Object logs = lastIngestionLogs.remove("logs");
        if (logs != null) {
          lastIngestionLogs.put(
              PipelineServiceClientInterface.taskKeyOf(
                  ingestionPipeline.getPipelineType().toString()),
              logs.toString());
        }
      } else {
        throw new PipelineServiceClientException(
            "No runId found for the last ingestion pipeline run");
      }
    } else {
      // Get the logs from the service client
      lastIngestionLogs = pipelineServiceClient.getLastIngestionLogs(ingestionPipeline, after);
      String logError = lastIngestionLogs.get(PipelineServiceClientInterface.LOGS_ERROR_KEY);
      if (logError != null) {
        return Response.status(Response.Status.SERVICE_UNAVAILABLE)
            .entity(Map.of(PipelineServiceClientInterface.LOGS_ERROR_KEY, logError))
            .build();
      }
    }

    return Response.ok(lastIngestionLogs, MediaType.APPLICATION_JSON_TYPE).build();
  }

  @GET
  @Path("/logs/{id}/last/download")
  @Produces(MediaType.APPLICATION_OCTET_STREAM)
  @Operation(
      operationId = "downloadLastIngestionLogs",
      summary = "Download all logs from last ingestion pipeline run as a stream",
      description =
          "Stream all logs from last ingestion pipeline run by `Id` or `fullyQualifiedName` for download.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Log content as a downloadable stream",
            content = @Content(mediaType = "application/octet-stream")),
        @ApiResponse(
            responseCode = "404",
            description = "Logs for the ingestion pipeline are not found")
      })
  public Response downloadLastIngestionLogs(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Id (UUID) or fullyQualifiedName of the ingestion pipeline",
              schema = @Schema(type = "string"))
          @PathParam("id")
          String id) {
    if (pipelineServiceClient == null) {
      return Response.status(200).entity("Pipeline Client Disabled").build();
    }
    // Resolve the pipeline up front (no surrounding catch) so an unknown Id/fqn surfaces as 404,
    // like getLastIngestionLogs. The streaming body below runs after this method returns, so its
    // failures were never caught here anyway.
    IngestionPipeline ingestionPipeline =
        getIngestionPipelineByIdOrName(uriInfo, securityContext, id, LOG_STREAM_FIELDS);

    String filename =
        String.format(
            "ingestion_logs_%s_%d.txt", ingestionPipeline.getName(), System.currentTimeMillis());

    boolean useStreamableLogs =
        ingestionPipeline.getEnableStreamableLogs()
            || (ingestionPipeline.getIngestionRunner() != null
                && repository.isIngestionRunnerStreamableLogsEnabled(
                    ingestionPipeline.getIngestionRunner()));

    StreamingOutput streamingOutput =
        output -> {
          String cursor = null;
          boolean hasMoreData = true;

          while (hasMoreData) {
            Map<String, String> logChunk;

            if (useStreamableLogs) {
              // Get logs using the repository's log storage picking up the last runId
              PipelineStatus latestStatus =
                  IngestionPipelineRepository.latestPipelineStatus(ingestionPipeline);
              String runId = latestStatus == null ? null : latestStatus.getRunId();
              if (CommonUtil.nullOrEmpty(runId)) {
                throw new PipelineServiceClientException(
                    "No runId found for the last ingestion pipeline run");
              }

              Map<String, Object> lastIngestionLogsMap =
                  repository.getLogs(
                      ingestionPipeline.getFullyQualifiedName(),
                      UUID.fromString(runId),
                      cursor,
                      1000);
              logChunk =
                  lastIngestionLogsMap.entrySet().stream()
                      .filter(entry -> entry.getValue() != null)
                      .collect(
                          Collectors.toMap(
                              Map.Entry::getKey, entry -> entry.getValue().toString()));
              String logError = logChunk.get(PipelineServiceClientInterface.LOGS_ERROR_KEY);
              if (logError != null) {
                throw new PipelineServiceClientException(logError);
              }
              Object logs = logChunk.remove("logs");
              if (logs != null) {
                logChunk.put(
                    PipelineServiceClientInterface.taskKeyOf(
                        ingestionPipeline.getPipelineType().toString()),
                    logs.toString());
              }
            } else {
              // Get the logs from the service client
              logChunk = pipelineServiceClient.getLastIngestionLogs(ingestionPipeline, cursor);
              String logError =
                  logChunk == null
                      ? null
                      : logChunk.get(PipelineServiceClientInterface.LOGS_ERROR_KEY);
              if (logError != null) {
                throw new PipelineServiceClientException(logError);
              }
            }

            if (logChunk == null || logChunk.isEmpty()) {
              break;
            }

            for (Map.Entry<String, String> entry : logChunk.entrySet()) {
              if (entry.getValue() != null
                  && !entry.getKey().equals("after")
                  && !entry.getKey().equals("total")) {
                output.write(entry.getValue().getBytes(StandardCharsets.UTF_8));
                output.write("\n".getBytes(StandardCharsets.UTF_8));
              }
            }
            output.flush();

            cursor = logChunk.get("after");
            if (cursor == null) {
              hasMoreData = false;
            }
          }
        };

    return Response.ok(streamingOutput)
        .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
        .build();
  }

  @PUT
  @Path("/{fqn}/pipelineStatus")
  @Operation(
      operationId = "addPipelineStatus",
      summary = "Add pipeline status",
      description = "Add pipeline status of ingestion pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully updated the PipelineStatus. ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IngestionPipeline.class)))
      })
  public Response addPipelineStatus(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the ingestion pipeline",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Valid PipelineStatus pipelineStatus) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_INGESTION_PIPELINE_STATUS);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return repository.addPipelineStatus(uriInfo, fqn, pipelineStatus).toResponse();
  }

  @GET
  @Path("/{fqn}/pipelineStatus")
  @Operation(
      operationId = "listPipelineStatuses",
      summary = "List of pipeline status",
      description =
          "Get a list of pipeline statuses for the given ingestion pipeline id. Optionally filter by `startTs` and `endTs`. "
              + "When no time range is provided, the latest 5 runs are returned by default. "
              + "Use cursor-based pagination to limit the number of "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of pipeline status",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PipelineStatusList.class)))
      })
  public ResultList<PipelineStatus> listPipelineStatuses(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the ingestion pipeline",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Filter pipeline status after the given start timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter pipeline status before the given end timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("endTs")
          Long endTs,
      @Parameter(
              description = "Maximum number of pipeline statuses to return",
              schema = @Schema(type = "integer"))
          @Min(1)
          @QueryParam("limit")
          Integer limit) {
    return repository.listPipelineStatus(fqn, startTs, endTs, limit);
  }

  @GET
  @Path("/{fqn}/pipelineStatus/{id}")
  @Operation(
      operationId = "getPipelineStatus",
      summary = "Get pipeline status",
      description = "Get pipeline status of ingestion pipeline",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully updated state of the PipelineStatus.",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PipelineStatus.class)))
      })
  public PipelineStatus getPipelineStatus(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the ingestion pipeline",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(description = "Id of pipeline status run", schema = @Schema(type = "string"))
          @PathParam("id")
          UUID runId) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return repository.getPipelineStatus(fqn, runId);
  }

  @DELETE
  @Path("/{id}/pipelineStatus/{runId}")
  @Operation(
      operationId = "deletePipelineStatusByRunId",
      summary = "Delete pipeline status by run ID",
      description =
          "Delete a specific pipeline status by its run ID for the given ingestion pipeline.",
      responses = {
        @ApiResponse(responseCode = "204", description = "Pipeline status deleted successfully"),
        @ApiResponse(
            responseCode = "404",
            description = "Ingestion Pipeline or Pipeline Status not found")
      })
  public Response deletePipelineStatusByRunId(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Ingestion Pipeline", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Run ID of the pipeline status", schema = @Schema(type = "UUID"))
          @PathParam("runId")
          UUID runId) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    repository.deletePipelineStatusByRunId(id, runId);
    return Response.noContent().build();
  }

  @DELETE
  @Path("/{id}/pipelineStatus")
  @Operation(
      operationId = "deletePipelineStatus",
      summary = "Delete Pipeline Status",
      tags = "ingestionPipelines",
      description = "Delete the Pipeline Status for this Ingestion Pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully deleted the Statuses",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IngestionPipeline.class)))
      })
  public IngestionPipeline deletePipelineStatus(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Ingestion Pipeline", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    IngestionPipeline ingestionPipeline = repository.deletePipelineStatus(id);
    return addHref(uriInfo, ingestionPipeline);
  }

  private void unmask(IngestionPipeline ingestionPipeline) {
    repository.setFullyQualifiedName(ingestionPipeline);
    IngestionPipeline originalIngestionPipeline =
        repository.findByNameOrNull(ingestionPipeline.getFullyQualifiedName(), Include.NON_DELETED);
    EntityMaskerFactory.getEntityMasker()
        .unmaskIngestionPipeline(ingestionPipeline, originalIngestionPipeline);
  }

  private PipelineServiceClientResponse deployPipelineInternal(
      UUID id, UriInfo uriInfo, SecurityContext securityContext) {
    if (pipelineServiceClient == null) {
      return new PipelineServiceClientResponse()
          .withCode(200)
          .withReason("Pipeline Client Disabled");
    }
    Fields fields = getFields(FIELD_OWNERS);
    IngestionPipeline ingestionPipeline = repository.get(uriInfo, id, fields);
    CreateResourceContext<IngestionPipeline> createResourceContext =
        new CreateResourceContext<>(entityType, ingestionPipeline);
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DEPLOY);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    decryptOrNullify(securityContext, ingestionPipeline, true);
    ServiceEntityInterface service =
        Entity.getEntity(ingestionPipeline.getService(), "ingestionRunner", Include.NON_DELETED);
    PipelineServiceClientResponse status =
        repository.deployIngestionPipeline(ingestionPipeline, service);
    if (status.getCode() == 200) {
      createOrUpdateAfterPipelineOperation(
          uriInfo, securityContext, ingestionPipeline, MetadataOperation.DEPLOY);
    }
    return status;
  }

  private void authorizePipelineOperation(
      SecurityContext securityContext, UUID id, MetadataOperation operation) {
    authorizer.authorizeRequests(
        securityContext, getPipelineOperationAuthRequests(id, operation), AuthorizationLogic.ANY);
  }

  // Preserve existing EditAll access while allowing roles to grant only the scoped action.
  private List<AuthRequest> getPipelineOperationAuthRequests(UUID id, MetadataOperation operation) {
    ResourceContext<IngestionPipeline> resourceContext = getResourceContextById(id);
    return List.of(
        new AuthRequest(new OperationContext(entityType, operation), resourceContext),
        new AuthRequest(
            new OperationContext(entityType, MetadataOperation.EDIT_ALL), resourceContext));
  }

  private Response createOrUpdateAfterPipelineOperation(
      UriInfo uriInfo,
      SecurityContext securityContext,
      IngestionPipeline ingestionPipeline,
      MetadataOperation operation) {
    return createOrUpdate(
        uriInfo,
        securityContext,
        getPipelineOperationAuthRequests(ingestionPipeline.getId(), operation),
        AuthorizationLogic.ANY,
        ingestionPipeline);
  }

  public PipelineServiceClientResponse triggerPipelineInternal(
      UUID id, UriInfo uriInfo, SecurityContext securityContext, String botName) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.TRIGGER);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    if (pipelineServiceClient == null) {
      return new PipelineServiceClientResponse()
          .withCode(200)
          .withReason("Pipeline Client Disabled");
    }
    Fields fields = getFields(FIELD_OWNERS);
    IngestionPipeline ingestionPipeline = repository.get(uriInfo, id, fields);
    CreateResourceContext<IngestionPipeline> createResourceContext =
        new CreateResourceContext<>(entityType, ingestionPipeline);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    if (CommonUtil.nullOrEmpty(botName)) {
      // Use Default Ingestion Bot
      ingestionPipeline.setOpenMetadataServerConnection(
          new OpenMetadataConnectionBuilder(openMetadataApplicationConfig).build());
    } else {
      ingestionPipeline.setOpenMetadataServerConnection(
          new OpenMetadataConnectionBuilder(openMetadataApplicationConfig, botName).build());
    }
    decryptOrNullify(securityContext, ingestionPipeline, true);
    ServiceEntityInterface service =
        Entity.getEntity(ingestionPipeline.getService(), "ingestionRunner", Include.NON_DELETED);
    PipelineServiceClientResponse response =
        pipelineServiceClient.runPipeline(ingestionPipeline, service);
    repository.recordQueuedPipelineStatus(
        uriInfo, ingestionPipeline.getFullyQualifiedName(), response.getRunId());
    return response;
  }

  private void decryptOrNullify(
      SecurityContext securityContext, IngestionPipeline ingestionPipeline, boolean forceNotMask) {
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    try {
      authorizer.authorize(
          securityContext,
          new OperationContext(entityType, MetadataOperation.VIEW_ALL),
          getResourceContextById(ingestionPipeline.getId()));
    } catch (AuthorizationException e) {
      ingestionPipeline.getSourceConfig().setConfig(null);
    }
    secretsManager.decryptIngestionPipeline(ingestionPipeline);

    // SECURITY: Only include OpenMetadataServerConnection for deploy operations
    // (forceNotMask=true).
    // The connection contains the bot's JWT token which should NOT be exposed in GET/LIST
    // responses.
    // For API responses, we nullify this field to prevent token leakage.
    if (forceNotMask) {
      OpenMetadataConnection openMetadataServerConnection =
          new OpenMetadataConnectionBuilder(openMetadataApplicationConfig, ingestionPipeline)
              .build();
      ingestionPipeline.setOpenMetadataServerConnection(
          secretsManager.encryptOpenMetadataConnection(openMetadataServerConnection, false));
    } else {
      ingestionPipeline.setOpenMetadataServerConnection(null);
    }

    if (authorizer.shouldMaskPasswords(securityContext) && !forceNotMask) {
      EntityMaskerFactory.getEntityMasker().maskIngestionPipeline(ingestionPipeline);
    }
  }

  @POST
  @Path("/logs/{fqn}/{runId}")
  @Consumes(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "writePipelineLogs",
      summary = "Write logs for a pipeline run",
      description =
          "Write or append logs for a specific pipeline run identified by FQN and runId. "
              + "Supports both simple text logs and structured log batches with compression.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully wrote logs",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(responseCode = "404", description = "Pipeline not found"),
        @ApiResponse(responseCode = "500", description = "Internal server error")
      })
  public Response writePipelineLogs(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Context HttpHeaders headers,
      @Parameter(
              description = "Fully qualified name of the ingestion pipeline",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(description = "Run ID", schema = @Schema(type = "string")) @PathParam("runId")
          UUID runId,
      @Parameter(description = "Log content - either raw string or LogBatch object")
          Object logData) {
    try {
      // Authorize the request
      OperationContext operationContext =
          new OperationContext(entityType, MetadataOperation.EDIT_ALL);
      authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));

      // Parse log data
      String logContent;
      if (logData instanceof String) {
        logContent = (String) logData;
      } else if (logData instanceof Map) {
        LogBatch batch = JsonUtils.convertValue(logData, LogBatch.class);
        logContent = batch.getDecompressedLogs();
        if (batch.getConnectorId() != null && !nullOrEmpty(logContent)) {
          logContent = String.format("[%s] %s", batch.getConnectorId(), logContent);
        }
      } else {
        return Response.status(Response.Status.BAD_REQUEST)
            .entity("Invalid log data format")
            .build();
      }

      // Set session cookie for ALB stickiness
      String sessionCookie =
          String.format(
              "PIPELINE_SESSION=%s_%s; Path=/; Max-Age=86400",
              fqn.replaceAll("[^a-zA-Z0-9]", "_"), runId);

      // Write logs using the repository's log storage - only if we have content
      if (!nullOrEmpty(logContent)) {
        repository.appendLogs(fqn, runId, logContent);
      }

      return Response.ok().header("Set-Cookie", sessionCookie).build();
    } catch (Exception e) {
      LOG.error("Failed to write logs for pipeline: {}, runId: {}", fqn, runId, e);
      return Response.serverError()
          .entity(Map.of("message", e.getMessage()))
          .type(MediaType.APPLICATION_JSON_TYPE)
          .build();
    }
  }

  @POST
  @Path("/logs/{fqn}/{runId}/close")
  @Operation(
      operationId = "closePipelineLogStream",
      summary = "Close log stream for a pipeline run",
      description =
          "Close and finalize the log stream for a specific pipeline run identified by FQN and runId. "
              + "This ensures any buffered data is written and the stream is properly closed.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully closed log stream",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(responseCode = "404", description = "Pipeline not found"),
        @ApiResponse(responseCode = "500", description = "Internal server error")
      })
  public Response closePipelineLogStream(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the ingestion pipeline",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(description = "Run ID", schema = @Schema(type = "string")) @PathParam("runId")
          UUID runId) {
    try {
      // Authorize the request
      OperationContext operationContext =
          new OperationContext(entityType, MetadataOperation.EDIT_ALL);
      authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));

      // Close the log stream
      repository.closeStream(fqn, runId);

      return Response.ok()
          .entity(Map.of("message", "Log stream closed successfully"))
          .type(MediaType.APPLICATION_JSON_TYPE)
          .build();
    } catch (Exception e) {
      LOG.error("Failed to close log stream for pipeline: {}, runId: {}", fqn, runId, e);
      return Response.serverError()
          .entity(Map.of("message", e.getMessage()))
          .type(MediaType.APPLICATION_JSON_TYPE)
          .build();
    }
  }

  @GET
  @Path("/logs/{fqn}/{runId}")
  @Operation(
      operationId = "getPipelineLogs",
      summary = "Get logs for a pipeline run",
      description =
          "Get logs for a specific pipeline run identified by FQN and runId with pagination support",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Pipeline logs",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(responseCode = "404", description = "Logs not found")
      })
  public Response getPipelineLogs(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the ingestion pipeline",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(description = "Run ID", schema = @Schema(type = "string")) @PathParam("runId")
          UUID runId,
      @Parameter(
              description = "Returns log chunk after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Maximum number of lines to return",
              schema = @Schema(type = "integer"))
          @QueryParam("limit")
          @DefaultValue("1000")
          int limit) {
    try {
      // Validate that the pipeline exists first
      getByNameInternal(uriInfo, securityContext, fqn, "", Include.NON_DELETED);

      // Authorize the request
      OperationContext operationContext =
          new OperationContext(entityType, MetadataOperation.VIEW_ALL);
      authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));

      // Get logs using the repository's log storage
      Map<String, Object> logs = repository.getLogs(fqn, runId, after, limit);

      return Response.ok(logs, MediaType.APPLICATION_JSON_TYPE).build();
    } catch (Exception e) {
      LOG.error("Failed to get logs for pipeline: {}, runId: {}", fqn, runId, e);
      return Response.status(Response.Status.NOT_FOUND)
          .entity(Map.of("message", e.getMessage()))
          .type(MediaType.APPLICATION_JSON_TYPE)
          .build();
    }
  }

  @GET
  @Path("/logs/{fqn}")
  @Operation(
      operationId = "listPipelineRuns",
      summary = "List available runs for a pipeline",
      description = "Get a list of available run IDs for a pipeline",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of run IDs",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(responseCode = "404", description = "Pipeline not found")
      })
  public Response listPipelineRuns(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the ingestion pipeline",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Maximum number of runs to return",
              schema = @Schema(type = "integer"))
          @QueryParam("limit")
          @DefaultValue("10")
          int limit) {
    try {
      // Validate that the pipeline exists first
      IngestionPipeline pipeline =
          getByNameInternal(uriInfo, securityContext, fqn, "", Include.NON_DELETED);

      // Authorize the request
      OperationContext operationContext =
          new OperationContext(entityType, MetadataOperation.VIEW_ALL);
      authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));

      // List runs using the repository's log storage
      List<UUID> runIds = repository.listRuns(fqn, limit);

      return Response.ok(Map.of("runs", runIds), MediaType.APPLICATION_JSON_TYPE).build();
    } catch (Exception e) {
      LOG.error("Failed to list runs for pipeline: {}", fqn, e);
      return Response.status(Response.Status.NOT_FOUND)
          .entity(Map.of("message", e.getMessage()))
          .type(MediaType.APPLICATION_JSON_TYPE)
          .build();
    }
  }

  @GET
  @Path("/logs/{fqn}/stream/{runId}")
  @Produces(MediaType.SERVER_SENT_EVENTS)
  @Operation(
      operationId = "streamPipelineLogs",
      summary = "Stream logs for a pipeline run",
      description =
          "Tail a pipeline run's logs over Server-Sent Events so a client renders them as they are "
              + "produced instead of polling. Reads from whichever backend holds the run's log — "
              + "object storage when streamable logs are enabled for the pipeline, the pipeline "
              + "service otherwise. Every event carries an `after` cursor; reconnect with "
              + "`?after=<cursor>` to resume without re-reading what was already delivered. The "
              + "server closes the stream with a `complete` event once the run finishes, and all "
              + "viewers of the same run share a single reader against the log backend.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description =
                "Log stream of `logs`, `complete` and `error` events. A deployment with no log "
                    + "backend, or a server at its stream capacity, answers on the stream itself "
                    + "with a single `error` event.",
            content = @Content(mediaType = MediaType.SERVER_SENT_EVENTS)),
        @ApiResponse(responseCode = "404", description = "Ingestion pipeline not found")
      })
  public void streamPipelineLogs(
      @Context SseEventSink eventSink,
      @Context Sse sse,
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Id (UUID) or fullyQualifiedName of the ingestion pipeline",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description =
                  "Run to stream. A UUID for a run whose logs are in object storage, or the "
                      + "pipeline service's own run identifier.",
              schema = @Schema(type = "string"))
          @PathParam("runId")
          String runId,
      @Parameter(
              description = "Resume the stream after this cursor, as returned by a previous event",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after) {
    IngestionPipeline pipeline =
        getIngestionPipelineByIdOrName(uriInfo, securityContext, fqn, LOG_STREAM_FIELDS);
    IngestionLogStreamManager streams = IngestionLogStreamManager.getInstance();
    if (logStreamFactory.hasLogBackend()) {
      streams.stream(logStreamFactory.request(pipeline, runId, after), eventSink, sse);
    } else {
      streams.refuse(eventSink, sse, runId, NO_LOG_BACKEND);
    }
  }

  @GET
  @Path("/progress/{fqn}/stream/{runId}")
  @Produces(MediaType.SERVER_SENT_EVENTS)
  @Operation(
      operationId = "streamPipelineProgress",
      summary = "Stream progress updates for a pipeline run",
      description =
          "Stream real-time progress updates for a specific pipeline run using Server-Sent Events",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Progress stream",
            content = @Content(mediaType = MediaType.SERVER_SENT_EVENTS)),
        @ApiResponse(responseCode = "404", description = "Pipeline not found"),
        @ApiResponse(responseCode = "503", description = "Progress tracking is not configured")
      })
  public void streamPipelineProgress(
      @Context SseEventSink eventSink,
      @Context Sse sse,
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the ingestion pipeline",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(description = "Run ID", schema = @Schema(type = "string")) @PathParam("runId")
          UUID runId) {
    getByNameInternal(uriInfo, securityContext, fqn, "", Include.NON_DELETED);
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    if (!repository.isProgressTrackingEnabled()) {
      throw new ServiceUnavailableException("Progress tracking is not configured");
    }
    repository.streamProgress(fqn, runId, eventSink, sse);
  }

  @GET
  @Path("/progress/service/{serviceType}/{serviceFqn}/stream")
  @Produces(MediaType.SERVER_SENT_EVENTS)
  @Operation(
      operationId = "streamServiceProgress",
      summary = "Stream progress for all pipelines of a service",
      description =
          "Stream real-time progress for every live ingestion pipeline run under a service on a "
              + "single Server-Sent Events connection",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Service progress stream",
            content = @Content(mediaType = MediaType.SERVER_SENT_EVENTS)),
        @ApiResponse(responseCode = "503", description = "Progress tracking is not configured")
      })
  public void streamServiceProgress(
      @Context SseEventSink eventSink,
      @Context Sse sse,
      @Context SecurityContext securityContext,
      @Parameter(description = "Service entity type", schema = @Schema(type = "string"))
          @PathParam("serviceType")
          String serviceType,
      @Parameter(
              description = "Fully qualified name of the service",
              schema = @Schema(type = "string"))
          @PathParam("serviceFqn")
          String serviceFqn) {
    OperationContext operationContext =
        new OperationContext(serviceType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(
        securityContext, operationContext, new ResourceContext<>(serviceType, null, serviceFqn));
    if (!repository.isProgressTrackingEnabled()) {
      throw new ServiceUnavailableException("Progress tracking is not configured");
    }
    repository.streamServiceProgress(serviceFqn, eventSink, sse);
  }

  @PUT
  @Path("/progress/{fqn}/{runId}")
  @Consumes(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "updatePipelineProgress",
      summary = "Update pipeline progress",
      description = "Update real-time progress for a pipeline run",
      responses = {
        @ApiResponse(responseCode = "200", description = "Progress updated"),
        @ApiResponse(responseCode = "404", description = "Pipeline not found")
      })
  public Response updatePipelineProgress(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the ingestion pipeline",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(description = "Run ID", schema = @Schema(type = "string")) @PathParam("runId")
          UUID runId,
      @Valid
          @RequestBody(
              description = "Progress update",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON,
                      schema =
                          @Schema(
                              implementation =
                                  org.openmetadata
                                      .schema
                                      .entity
                                      .services
                                      .ingestionPipelines
                                      .ProgressUpdate
                                      .class)))
          org.openmetadata.schema.entity.services.ingestionPipelines.ProgressUpdate
              progressUpdate) {
    // Authorize the request - let authorization exceptions propagate for proper 403 response
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_INGESTION_PIPELINE_STATUS);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));

    try {
      repository.updateProgress(fqn, runId, progressUpdate);
      return Response.ok().build();
    } catch (Exception e) {
      LOG.error("Failed to update progress for pipeline: {}, runId: {}", fqn, runId, e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(Map.of("message", e.getMessage()))
          .type(MediaType.APPLICATION_JSON_TYPE)
          .build();
    }
  }

  @POST
  @Path("/metrics/{fqn}/{runId}")
  @Consumes(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "submitOperationMetrics",
      summary = "Submit operation metrics batch",
      description = "Submit a batch of operation metrics for a pipeline run",
      responses = {
        @ApiResponse(responseCode = "200", description = "Metrics accepted"),
        @ApiResponse(responseCode = "404", description = "Pipeline not found")
      })
  public Response submitOperationMetrics(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the ingestion pipeline",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(description = "Run ID", schema = @Schema(type = "string")) @PathParam("runId")
          UUID runId,
      @Valid
          @RequestBody(
              description = "Operation metrics batch",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON,
                      schema =
                          @Schema(
                              implementation =
                                  org.openmetadata
                                      .schema
                                      .entity
                                      .services
                                      .ingestionPipelines
                                      .OperationMetricsBatch
                                      .class)))
          org.openmetadata.schema.entity.services.ingestionPipelines.OperationMetricsBatch
              metricsBatch) {
    // Authorize the request - let authorization exceptions propagate for proper 403 response
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_INGESTION_PIPELINE_STATUS);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));

    try {
      repository.addOperationMetrics(fqn, runId, metricsBatch);
      return Response.ok().build();
    } catch (Exception e) {
      LOG.error("Failed to submit metrics for pipeline: {}, runId: {}", fqn, runId, e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(Map.of("message", e.getMessage()))
          .type(MediaType.APPLICATION_JSON_TYPE)
          .build();
    }
  }
}
