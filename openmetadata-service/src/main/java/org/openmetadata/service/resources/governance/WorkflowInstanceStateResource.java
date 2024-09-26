package org.openmetadata.service.resources.governance;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.governance.CreateWorkflowInstanceState;
import org.openmetadata.schema.governanceWorkflows.WorkflowDefinition;
import org.openmetadata.schema.governanceWorkflows.WorkflowInstanceState;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityTimeSeriesResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ReportDataContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/governance/workflowInstanceStates")
@Tag(
    name = "Workflow Instance States",
    description = "A Workflow Instance State is a specific instance of a Workflow Definition.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "governanceWorkflows")
public class WorkflowInstanceStateResource
    extends EntityTimeSeriesResource<WorkflowInstanceState, WorkflowInstanceStateRepository> {
  public static final String COLLECTION_PATH = "/v1/governance/workflowInstanceStates";

  public WorkflowInstanceStateResource(Authorizer authorizer) {
    super(Entity.WORKFLOW_INSTANCE_STATE, authorizer);
  }

  public static class WorkflowInstanceStateResultList extends ResultList<WorkflowInstanceState> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listWorkflowInstanceStates",
      summary = "List the Workflow Instance States",
      description =
          "Get a list of all the workflow instances states, filtered by `startTs` and `endTs` of the creation, "
              + "and Workflow Definition FQN. "
              + "Use cursor-based pagination to limit the number of "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Workflow Instances",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WorkflowInstanceStateResultList.class)))
      })
  public ResultList<WorkflowInstanceState> list(
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "Limit the number of Workflow Instance States returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(
              description = "Returns list of Workflow Instance States at the offset",
              schema = @Schema(type = "string"))
          @QueryParam("offset")
          String offset,
      @Parameter(
              description = "Filter Workflow Instance States after the given start timestamp",
              schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter Workflow Instance States before the given end timestamp",
              schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("endTs")
          Long endTs,
      @Parameter(
              description = "Only list the latest Workflow Instance States",
              schema = @Schema(type = "Boolean"))
          @DefaultValue("false")
          @QueryParam("latest")
          Boolean latest,
      @Parameter(
              description = "Workflow Definition fully qualified name",
              schema = @Schema(type = "String"))
          @QueryParam("workflowDefinitionFQN")
          String workflowDefinitionFQN) {
    OperationContext operationContext =
        new OperationContext(Entity.WORKFLOW_DEFINITION, MetadataOperation.VIEW_ALL);
    ResourceContextInterface resourceContext = ReportDataContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);

    ListFilter filter = new ListFilter(null);
    filter.addQueryParam("entityFQNHash", workflowDefinitionFQN);

    return repository.list(offset, startTs, endTs, limitParam, filter, latest);
  }

  @GET
  @Path("/workflowInstanceId/{workflowInstanceId}")
  @Operation(
      operationId = "getWorkflowInstanceStatesForAWorkflowInstanceId",
      summary = "Get all the Workflow Instance States for a Workflow Instance id",
      description = "Get all the Workflow Instance States for a Workflow Instancee id",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Workflow Instance States",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WorkflowInstanceStateResultList.class)))
      })
  public ResultList<WorkflowInstanceState> listForStateId(
      @Context SecurityContext securityContext,
      @Parameter(description = "Workflow Instance ID", schema = @Schema(type = "String"))
          @PathParam("workflowInstanceId")
          String workflowInstanceId) {
    OperationContext operationContext =
        new OperationContext(Entity.WORKFLOW_DEFINITION, MetadataOperation.VIEW_ALL);
    ResourceContextInterface resourceContext = ReportDataContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);

    return repository.listWorkflowInstanceStatesForWorkflowInstanceId(workflowInstanceId);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getWorkflowInstanceStateById",
      summary = "Get a Workflow Instance State by id",
      description = "Get a Workflow Instance State by id",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Workflow Instance State",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WorkflowInstanceState.class)))
      })
  public WorkflowInstanceState get(
      @Context SecurityContext securityContext,
      @Parameter(description = "Workflow Instance State ID", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID workflowInstanceStateId) {
    OperationContext operationContext =
        new OperationContext(Entity.WORKFLOW_DEFINITION, MetadataOperation.VIEW_ALL);
    ResourceContextInterface resourceContext = ReportDataContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);

    return repository.getById(workflowInstanceStateId);
  }

//  @POST
//  @Operation(
//      operationId = "createWorkflowInstanceState",
//      summary = "Create a new Workflow Instance State",
//      description = "Create a new Workflow Instance State",
//      responses = {
//        @ApiResponse(
//            responseCode = "200",
//            description = "The created Workflow Instance State",
//            content =
//                @Content(
//                    mediaType = "application/json",
//                    schema = @Schema(implementation = WorkflowInstanceState.class)))
//      })
//  public Response create(
//      @Context UriInfo uriInfo,
//      @Context SecurityContext securityContext,
//      @Valid CreateWorkflowInstanceState createWorkflowInstanceState) {
//    OperationContext operationContext =
//        new OperationContext(Entity.TEST_CASE, MetadataOperation.EDIT_TESTS);
//    ResourceContextInterface resourceContext = ReportDataContext.builder().build();
//    authorizer.authorize(securityContext, operationContext, resourceContext);
//
//    WorkflowDefinition workflowDefinitionEntity =
//        Entity.getEntityByName(
//            Entity.WORKFLOW_DEFINITION,
//            createWorkflowInstanceState.getWorkflowDefinitionReference(),
//            null,
//            Include.ALL);
//    WorkflowInstanceState workflowInstanceState =
//        getWorkflowInstanceState(
//            workflowDefinitionEntity, securityContext.getUserPrincipal().getName());
//
//    return create(workflowInstanceState, workflowDefinitionEntity.getFullyQualifiedName());
//  }
//
//  private WorkflowInstanceState getWorkflowInstanceState(
//      WorkflowDefinition workflowDefinitionEntity, String userName) {
//
//    return new WorkflowInstanceState()
//        .withWorkflowInstanceId()
//        .withTimestamp(System.currentTimeMillis())
//        .withUpdatedBy(userName)
//        .withUpdatedAt(System.currentTimeMillis())
//        .withWorkflowDefinitionReference(workflowDefinitionEntity.getEntityReference());
//  }
}
