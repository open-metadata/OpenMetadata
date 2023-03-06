package org.openmetadata.service.resources.operations;

import static org.openmetadata.service.Entity.FIELD_OWNER;

import com.google.inject.Inject;
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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.automations.CreateWorkflow;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.automations.WorkflowStatus;
import org.openmetadata.schema.entity.automations.WorkflowType;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/operations/workflow")
@Api(value = "Operations Workflow collection", tags = "Operations Workflow collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "Workflow")
public class WorkflowResource extends EntityResource<Workflow, WorkflowRepository> {

  public static final String COLLECTION_PATH = "/v1/operations/workflow";
  static final String FIELDS = "owner";

  private PipelineServiceClient pipelineServiceClient;
  private OpenMetadataApplicationConfig openMetadataApplicationConfig;

  @Override
  public Workflow addHref(UriInfo uriInfo, Workflow workflow) {
    workflow.withHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, workflow.getId()));
    Entity.withHref(uriInfo, workflow.getOwner());
    return workflow;
  }

  @Inject
  public WorkflowResource(CollectionDAO dao, Authorizer authorizer) {
    super(Workflow.class, new WorkflowRepository(dao), authorizer);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    this.openMetadataApplicationConfig = config;

    this.pipelineServiceClient =
        PipelineServiceClientFactory.createPipelineServiceClient(config.getPipelineServiceClientConfiguration());
    dao.setPipelineServiceClient(pipelineServiceClient);
  }

  public static class WorkflowList extends ResultList<Workflow> {
    @SuppressWarnings("unused")
    public WorkflowList() {
      // Empty constructor needed for deserialization
    }
  }

  @GET
  @Operation(
      operationId = "listWorkflows",
      summary = "List operations workflows",
      tags = "automationsWorkflow",
      description =
          "Get a list of operations workflows. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of operations workflows",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WorkflowResource.WorkflowList.class)))
      })
  public ResultList<Workflow> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number operations workflows returned. (1 to 1000000, default = " + "10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(
              description = "Returns list of operations workflows before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of operations workflows after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include,
      @Parameter(description = "Filter by workflowType.", schema = @Schema(implementation = WorkflowType.class))
          @QueryParam("workflowType")
          String workflowType,
      @Parameter(description = "Filter by status", schema = @Schema(implementation = WorkflowStatus.class))
          @QueryParam("status")
          String status)
      throws IOException {
    ListFilter filter = new ListFilter(include);
    if (workflowType != null) {
      filter.addQueryParam("workflowType", workflowType);
    }
    if (status != null) {
      filter.addQueryParam("status", status);
    }
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllWorkflowVersion",
      summary = "List Workflow versions",
      tags = "automationsWorkflow",
      description = "Get a list of all the versions of a Workflow identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Workflow versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Workflow", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a Workflow by Id",
      tags = "automationsWorkflow",
      description = "Get a Workflow by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Workflow",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Workflow.class))),
        @ApiResponse(responseCode = "404", description = "Workflow for instance {id} is not found")
      })
  public Workflow get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the Workflow", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
          Include include)
      throws IOException {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getWorkflowByName",
      summary = "Get a Workflow by name",
      tags = "automationsWorkflow",
      description = "Get a Workflow by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Workflow",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Workflow.class))),
        @ApiResponse(responseCode = "404", description = "Workflow for instance {name} is not found")
      })
  public Workflow getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Name of the Workflow", schema = @Schema(type = "string")) @PathParam("name")
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
          Include include)
      throws IOException {
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificWorkflowVersion",
      summary = "Get a version of the Workflow",
      tags = "automationsWorkflow",
      description = "Get a version of the Workflow by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Workflow",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Workflow.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Workflow for instance {id} and version {version} is " + "not found")
      })
  public Workflow getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Workflow", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "Workflow version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createWorkflow",
      summary = "Create a Workflow",
      tags = "automationsWorkflow",
      description = "Create a Workflow.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Workflow",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Workflow.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateWorkflow create)
      throws IOException {
    Workflow workflow = getWorkflow(create, securityContext.getUserPrincipal().getName());
    // TODO: Create Trigger workflow endpoint using the pipelineServiceClient
    return create(uriInfo, securityContext, workflow);
  }

  @POST
  @Path("/trigger/{id}")
  @Operation(
      operationId = "triggerWorkflow",
      summary = "Trigger an workflow run",
      tags = "automationsWorkflow",
      description = "Trigger a workflow run by id.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Workflow trigger status code",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(responseCode = "404", description = "Workflow for instance {id} is not found")
      })
  public Response runAutomationsWorkflow(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the Workflow", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Context SecurityContext securityContext)
      throws IOException {
    EntityUtil.Fields fields = getFields(FIELD_OWNER);
    Workflow workflow = dao.get(uriInfo, id, fields);
    return pipelineServiceClient.runAutomationsWorkflow(workflow);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchWorkflow",
      summary = "Update a Workflow",
      tags = "automationsWorkflow",
      description = "Update an existing Workflow using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Workflow", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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

  @PUT
  @Operation(
      operationId = "createOrUpdateWorkflow",
      summary = "Update Workflow",
      tags = "automationsWorkflow",
      description = "Create a Workflow, if it does not exist, or update an existing Workflow.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated Workflow ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Workflow.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateWorkflow create)
      throws IOException {
    Workflow workflow = getWorkflow(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, workflow);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteWorkflow",
      summary = "Delete a Workflow",
      tags = "automationsWorkflow",
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
      @Parameter(description = "Id of the Workflow", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteWorkflowByName",
      summary = "Delete a Workflow",
      tags = "automationsWorkflow",
      description = "Delete a Workflow by `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Workflow for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the Workflow", schema = @Schema(type = "string")) @PathParam("name")
          String name)
      throws IOException {
    return deleteByName(uriInfo, securityContext, name, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted Workflow",
      tags = "automationsWorkflow",
      description = "Restore a soft deleted Workflow.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Workflow. ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Workflow.class)))
      })
  public Response restoreWorkflow(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private Workflow getWorkflow(CreateWorkflow create, String user) throws IOException {
    OpenMetadataConnection openMetadataServerConnection =
        new OpenMetadataConnectionBuilder(openMetadataApplicationConfig).build();
    return copy(new Workflow(), create, user)
        .withDescription(create.getDescription())
        .withRequest(create.getRequest())
        .withWorkflowType(create.getWorkflowType())
        .withDisplayName(create.getDisplayName())
        .withOpenMetadataServerConnection(openMetadataServerConnection)
        .withName(create.getName());
  }
}
