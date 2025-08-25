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
import static org.openmetadata.schema.type.MetadataOperation.CREATE;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_PIPELINE_STATUS;
import static org.openmetadata.service.jdbi3.IngestionPipelineRepository.validateProfileSample;

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
import jakarta.ws.rs.core.StreamingOutput;
import jakarta.ws.rs.core.UriInfo;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.openmetadata.service.util.ResultList;

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
  public static final String COLLECTION_PATH = "v1/services/ingestionPipelines/";
  private PipelineServiceClientInterface pipelineServiceClient;
  private OpenMetadataApplicationConfig openMetadataApplicationConfig;
  static final String FIELDS = "owners,followers";

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
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    return listOf(
        MetadataOperation.CREATE_INGESTION_PIPELINE_AUTOMATOR,
        MetadataOperation.EDIT_INGESTION_PIPELINE_STATUS);
  }

  public static class IngestionPipelineList extends ResultList<IngestionPipeline> {
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
   */
  private MetadataOperation getOperationForPipelineType(IngestionPipeline ingestionPipeline) {
    String pipelineType = IngestionPipelineRepository.getPipelineWorkflowType(ingestionPipeline);
    try {
      return MetadataOperation.valueOf(
          String.format("CREATE_INGESTION_PIPELINE_%s", pipelineType.toUpperCase()));
    } catch (IllegalArgumentException | NullPointerException e) {
      return CREATE;
    }
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
                    schema = @Schema(implementation = IngestionPipeline.class)))
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
          ProviderType provider) {
    ListFilter filter =
        new ListFilter(include)
            .addQueryParam("service", serviceParam)
            .addQueryParam("pipelineType", pipelineType)
            .addQueryParam("serviceType", serviceType)
            .addQueryParam("testSuite", testSuiteParam)
            .addQueryParam("applicationType", applicationType)
            .addQueryParam("provider", provider == null ? null : provider.value());
    ResultList<IngestionPipeline> ingestionPipelines =
        super.listInternal(
            uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);

    for (IngestionPipeline ingestionPipeline : listOrEmpty(ingestionPipelines.getData())) {
      if (fieldsParam != null && fieldsParam.contains(FIELD_PIPELINE_STATUS)) {
        ingestionPipeline.setPipelineStatuses(
            repository.getLatestPipelineStatus(ingestionPipeline));
      }
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
          Include include) {
    IngestionPipeline ingestionPipeline =
        getInternal(uriInfo, securityContext, id, fieldsParam, include);
    if (fieldsParam != null && fieldsParam.contains(FIELD_PIPELINE_STATUS)) {
      ingestionPipeline.setPipelineStatuses(repository.getLatestPipelineStatus(ingestionPipeline));
    }
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
          Include include) {
    IngestionPipeline ingestionPipeline =
        getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
    if (fieldsParam != null && fieldsParam.contains(FIELD_PIPELINE_STATUS)) {
      ingestionPipeline.setPipelineStatuses(repository.getLatestPipelineStatus(ingestionPipeline));
    }
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
                    schema = @Schema(implementation = PipelineServiceClientResponse.class)))
      })
  public List<PipelineServiceClientResponse> bulkDeployIngestion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid List<UUID> pipelineIdList) {

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
                    .withPlatform(pipelineServiceClient.getPlatform());
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
    Fields fields = getFields(FIELD_OWNERS);
    IngestionPipeline pipeline = repository.get(uriInfo, id, fields);
    // This call updates the state in Airflow as well as the `enabled` field on the
    // IngestionPipeline
    if (pipelineServiceClient == null) {
      return Response.status(200).entity("Pipeline Client Disabled").build();
    }
    decryptOrNullify(securityContext, pipeline, true);
    pipelineServiceClient.toggleIngestion(pipeline);
    Response response = createOrUpdate(uriInfo, securityContext, pipeline);
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
        @ApiResponse(responseCode = "404", description = "Ingestion for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, false, hardDelete);
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

  @GET
  @Path("/logs/{id}/last")
  @Operation(
      summary = "Retrieve all logs from last ingestion pipeline run",
      description = "Get all logs from last ingestion pipeline run by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description =
                "JSON object with the task instance name of the ingestion on each key and log in the value",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(responseCode = "404", description = "Logs for instance {id} is not found")
      })
  public Response getLastIngestionLogs(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Returns log chunk after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after) {
    if (pipelineServiceClient == null) {
      return Response.status(200).entity("Pipeline Client Disabled").build();
    }
    IngestionPipeline ingestionPipeline =
        getInternal(uriInfo, securityContext, id, FIELDS, Include.NON_DELETED);
    Map<String, String> lastIngestionLogs =
        pipelineServiceClient.getLastIngestionLogs(ingestionPipeline, after);
    return Response.ok(lastIngestionLogs, MediaType.APPLICATION_JSON_TYPE).build();
  }

  @GET
  @Path("/logs/{id}/last/download")
  @Produces(MediaType.APPLICATION_OCTET_STREAM)
  @Operation(
      operationId = "downloadLastIngestionLogs",
      summary = "Download all logs from last ingestion pipeline run as a stream",
      description = "Stream all logs from last ingestion pipeline run by `Id` for download.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Log content as a downloadable stream",
            content = @Content(mediaType = "application/octet-stream")),
        @ApiResponse(responseCode = "404", description = "Logs for instance {id} is not found")
      })
  public Response downloadLastIngestionLogs(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    try {
      if (pipelineServiceClient == null) {
        return Response.status(200).entity("Pipeline Client Disabled").build();
      }
      IngestionPipeline ingestionPipeline =
          getInternal(uriInfo, securityContext, id, FIELDS, Include.NON_DELETED);

      String filename =
          String.format(
              "ingestion_logs_%s_%d.txt", ingestionPipeline.getName(), System.currentTimeMillis());

      StreamingOutput streamingOutput =
          output -> {
            String cursor = null;
            boolean hasMoreData = true;

            while (hasMoreData) {
              Map<String, String> logChunk =
                  pipelineServiceClient.getLastIngestionLogs(ingestionPipeline, cursor);

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
    } catch (Exception e) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("Error downloading logs: " + e.getMessage())
          .build();
    }
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
          "Get a list of all the pipeline status for the given ingestion pipeline id, optionally filtered by  `startTs` and `endTs` of the profile. "
              + "Use cursor-based pagination to limit the number of "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of pipeline status",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IngestionPipeline.class)))
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
          @NonNull
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter pipeline status before the given end timestamp",
              schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("endTs")
          Long endTs) {
    return repository.listPipelineStatus(fqn, startTs, endTs);
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
                    schema = @Schema(implementation = IngestionPipeline.class)))
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
    Fields fields = getFields(FIELD_OWNERS);
    IngestionPipeline ingestionPipeline = repository.get(uriInfo, id, fields);
    CreateResourceContext<IngestionPipeline> createResourceContext =
        new CreateResourceContext<>(entityType, ingestionPipeline);
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DEPLOY);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    decryptOrNullify(securityContext, ingestionPipeline, true);
    ServiceEntityInterface service =
        Entity.getEntity(ingestionPipeline.getService(), "", Include.NON_DELETED);
    PipelineServiceClientResponse status =
        pipelineServiceClient.deployPipeline(ingestionPipeline, service);
    if (status.getCode() == 200) {
      createOrUpdate(uriInfo, securityContext, ingestionPipeline);
    }
    return status;
  }

  public PipelineServiceClientResponse triggerPipelineInternal(
      UUID id, UriInfo uriInfo, SecurityContext securityContext, String botName) {
    Fields fields = getFields(FIELD_OWNERS);
    IngestionPipeline ingestionPipeline = repository.get(uriInfo, id, fields);
    CreateResourceContext<IngestionPipeline> createResourceContext =
        new CreateResourceContext<>(entityType, ingestionPipeline);
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.TRIGGER);
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
        Entity.getEntity(ingestionPipeline.getService(), "", Include.NON_DELETED);
    return pipelineServiceClient.runPipeline(ingestionPipeline, service);
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
    OpenMetadataConnection openMetadataServerConnection =
        new OpenMetadataConnectionBuilder(openMetadataApplicationConfig, ingestionPipeline).build();
    ingestionPipeline.setOpenMetadataServerConnection(
        secretsManager.encryptOpenMetadataConnection(openMetadataServerConnection, false));
    if (authorizer.shouldMaskPasswords(securityContext) && !forceNotMask) {
      EntityMaskerFactory.getEntityMasker().maskIngestionPipeline(ingestionPipeline);
    }
  }
}
