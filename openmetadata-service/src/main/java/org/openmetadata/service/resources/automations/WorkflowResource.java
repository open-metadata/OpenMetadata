package org.openmetadata.service.resources.automations;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.FIELD_OWNERS;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Hidden;
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
import jakarta.ws.rs.core.UriInfo;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.automations.CreateWorkflow;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.automations.WorkflowStatus;
import org.openmetadata.schema.entity.automations.WorkflowType;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.converter.ClassConverterFactory;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/automations/workflows")
@Tag(
    name = "Workflows",
    description = "APIs related to creating and managing Automation workflows.")
@Hidden
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "Workflow")
public class WorkflowResource extends EntityResource<Workflow, WorkflowRepository> {
  public static final String COLLECTION_PATH = "/v1/automations/workflows";
  static final String FIELDS = "owners";
  private WorkflowMapper mapper;
  private PipelineServiceClientInterface pipelineServiceClient;
  private OpenMetadataApplicationConfig openMetadataApplicationConfig;

  public WorkflowResource(Authorizer authorizer, Limits limits) {
    super(Entity.WORKFLOW, authorizer, limits);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    this.openMetadataApplicationConfig = config;
    this.mapper = new WorkflowMapper();
    this.pipelineServiceClient =
        PipelineServiceClientFactory.createPipelineServiceClient(
            config.getPipelineServiceClientConfiguration());
  }

  public static class WorkflowList extends ResultList<Workflow> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listWorkflows",
      summary = "List automations workflows",
      description =
          "Get a list of automations workflows. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of automations workflows",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WorkflowList.class)))
      })
  public ResultList<Workflow> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description =
                  "Limit the number automations workflows returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limitParam,
      @Parameter(
              description = "Returns list of automations workflows before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of automations workflows after this cursor",
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
              description = "Filter by workflowType.",
              schema = @Schema(implementation = WorkflowType.class))
          @QueryParam("workflowType")
          String workflowType,
      @Parameter(
              description = "Filter by status",
              schema = @Schema(implementation = WorkflowStatus.class))
          @QueryParam("workflowStatus")
          String status) {
    ListFilter filter = new ListFilter(include);
    if (workflowType != null) {
      filter.addQueryParam("workflowType", workflowType);
    }
    if (status != null) {
      filter.addQueryParam("workflowStatus", status);
    }
    ResultList<Workflow> workflows =
        super.listInternal(
            uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
    workflows.setData(
        listOrEmpty(workflows.getData()).stream()
            .map(service -> decryptOrNullify(securityContext, service))
            .collect(Collectors.toList()));
    return workflows;
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllWorkflowVersion",
      summary = "List Workflow versions",
      description = "Get a list of all the versions of a Workflow identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Workflow versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Workflow", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a Workflow by Id",
      description = "Get a Workflow by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Workflow",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Workflow.class))),
        @ApiResponse(responseCode = "404", description = "Workflow for instance {id} is not found")
      })
  public Workflow get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the Workflow", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
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
    return decryptOrNullify(
        securityContext, getInternal(uriInfo, securityContext, id, fieldsParam, include));
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getWorkflowByName",
      summary = "Get a Workflow by name",
      description = "Get a Workflow by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Workflow",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Workflow.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Workflow for instance {name} is not found")
      })
  public Workflow getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Name of the Workflow", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
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
    return decryptOrNullify(
        securityContext, getByNameInternal(uriInfo, securityContext, name, fieldsParam, include));
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificWorkflowVersion",
      summary = "Get a version of the Workflow",
      description = "Get a version of the Workflow by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Workflow",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Workflow.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Workflow for instance {id} and version {version} is not found")
      })
  public Workflow getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Workflow", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Workflow version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return decryptOrNullify(
        securityContext, super.getVersionInternal(securityContext, id, version));
  }

  @POST
  @Operation(
      operationId = "createWorkflow",
      summary = "Create a Workflow",
      description = "Create a Workflow.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Workflow",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Workflow.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateWorkflow create) {
    Workflow workflow = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    Response response = create(uriInfo, securityContext, unmask(workflow));
    return Response.fromResponse(response)
        .entity(decryptOrNullify(securityContext, (Workflow) response.getEntity()))
        .build();
  }

  @POST
  @Path("/trigger/{id}")
  @Operation(
      operationId = "triggerWorkflow",
      summary = "Trigger an workflow run",
      description = "Trigger a workflow run by id.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Workflow trigger status code",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(responseCode = "404", description = "Workflow for instance {id} is not found")
      })
  public PipelineServiceClientResponse runAutomationsWorkflow(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the Workflow", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Context SecurityContext securityContext) {
    EntityUtil.Fields fields = getFields(FIELD_OWNERS);
    Workflow workflow = repository.get(uriInfo, id, fields);
    workflow.setOpenMetadataServerConnection(
        new OpenMetadataConnectionBuilder(openMetadataApplicationConfig).build());
    /*
     We will send the encrypted Workflow to the Pipeline Service Client
     It will be fetched from the API from there, since we are
     decrypting on GET based on user auth. The ingestion-bot will then
     be able to pick up the right data.
    */
    return pipelineServiceClient.runAutomationsWorkflow(workflow);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchWorkflow",
      summary = "Update a Workflow",
      description = "Update an existing Workflow using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Workflow", schema = @Schema(type = "UUID"))
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
    return Response.fromResponse(response)
        .entity(decryptOrNullify(securityContext, (Workflow) response.getEntity()))
        .build();
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchWorkflow",
      summary = "Update a Workflow by name.",
      description = "Update an existing Workflow using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Workflow", schema = @Schema(type = "string"))
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
    return Response.fromResponse(response)
        .entity(decryptOrNullify(securityContext, (Workflow) response.getEntity()))
        .build();
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateWorkflow",
      summary = "Update Workflow",
      description = "Create a Workflow, if it does not exist, or update an existing Workflow.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated Workflow ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Workflow.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateWorkflow create) {
    Workflow workflow = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    workflow = unmask(workflow);
    Response response = createOrUpdate(uriInfo, securityContext, workflow);
    return Response.fromResponse(response)
        .entity(decryptOrNullify(securityContext, (Workflow) response.getEntity()))
        .build();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteWorkflow",
      summary = "Delete a Workflow",
      description = "Delete a Workflow by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Workflow for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the Workflow", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    Response response = delete(uriInfo, securityContext, id, false, hardDelete);
    return Response.fromResponse(response)
        .entity(decryptOrNullify(securityContext, (Workflow) response.getEntity()))
        .build();
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteWorkflowAsync",
      summary = "Asynchronously delete a Workflow",
      description = "Asynchronously delete a Workflow by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Workflow for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the Workflow", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {

    return deleteByIdAsync(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteWorkflowByName",
      summary = "Delete a Workflow",
      description = "Delete a Workflow by `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Workflow for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the Workflow", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    Response response = deleteByName(uriInfo, securityContext, name, false, hardDelete);
    return Response.fromResponse(response)
        .entity(decryptOrNullify(securityContext, (Workflow) response.getEntity()))
        .build();
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted Workflow",
      description = "Restore a soft deleted Workflow.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Workflow. ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Workflow.class)))
      })
  public Response restoreWorkflow(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    Response response = restoreEntity(uriInfo, securityContext, restore.getId());
    return Response.fromResponse(response)
        .entity(decryptOrNullify(securityContext, (Workflow) response.getEntity()))
        .build();
  }

  private Workflow unmask(Workflow workflow) {
    repository.setFullyQualifiedName(workflow);
    Workflow originalWorkflow;
    if (WorkflowType.TEST_CONNECTION.equals(workflow.getWorkflowType())) {
      // in case of test connection type, we get the original connection values from the service
      // name
      originalWorkflow = buildFromOriginalServiceConnection(workflow);
    } else {
      originalWorkflow =
          repository.findByNameOrNull(workflow.getFullyQualifiedName(), Include.NON_DELETED);
    }
    return EntityMaskerFactory.getEntityMasker().unmaskWorkflow(workflow, originalWorkflow);
  }

  private Workflow decryptOrNullify(SecurityContext securityContext, Workflow workflow) {
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    try {
      authorizer.authorize(
          securityContext,
          new OperationContext(entityType, MetadataOperation.VIEW_ALL),
          getResourceContextById(workflow.getId()));
    } catch (AuthorizationException e) {
      Workflow workflowConverted =
          (Workflow) ClassConverterFactory.getConverter(Workflow.class).convert(workflow);
      if (workflowConverted.getRequest() instanceof TestServiceConnectionRequest) {
        ((ServiceConnectionEntityInterface)
                ((TestServiceConnectionRequest) workflowConverted.getRequest()).getConnection())
            .setConfig(null);
      }
      return workflowConverted;
    }
    Workflow workflowDecrypted = secretsManager.decryptWorkflow(workflow);
    OpenMetadataConnection openMetadataServerConnection =
        new OpenMetadataConnectionBuilder(openMetadataApplicationConfig).build();
    workflowDecrypted.setOpenMetadataServerConnection(
        secretsManager.encryptOpenMetadataConnection(openMetadataServerConnection, false));
    if (authorizer.shouldMaskPasswords(securityContext)) {
      workflowDecrypted = EntityMaskerFactory.getEntityMasker().maskWorkflow(workflowDecrypted);
    }
    return workflowDecrypted;
  }

  private Workflow buildFromOriginalServiceConnection(Workflow workflow) {
    Workflow originalWorkflow =
        repository.findByNameOrNull(workflow.getFullyQualifiedName(), Include.NON_DELETED);
    if (originalWorkflow == null) {
      originalWorkflow =
          (Workflow) ClassConverterFactory.getConverter(Workflow.class).convert(workflow);
    }
    if (originalWorkflow.getRequest()
        instanceof TestServiceConnectionRequest testServiceConnection) {
      EntityRepository<? extends EntityInterface> serviceRepository =
          Entity.getServiceEntityRepository(testServiceConnection.getServiceType());
      ServiceEntityInterface originalService =
          (ServiceEntityInterface)
              serviceRepository.findByNameOrNull(
                  testServiceConnection.getServiceName(), Include.NON_DELETED);
      if (originalService != null && originalService.getConnection() != null) {
        testServiceConnection.setConnection(originalService.getConnection());
        originalWorkflow.setRequest(testServiceConnection);
      }
    }
    return originalWorkflow;
  }
}
