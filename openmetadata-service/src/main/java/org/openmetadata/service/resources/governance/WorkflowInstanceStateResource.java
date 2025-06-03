package org.openmetadata.service.resources.governance;

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
import java.util.UUID;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;
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
    description = "A Workflow Instance State is a specific state of a Workflow Instance.")
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
          "Get a list of all the workflow instances states, filtered by `startTs` and `endTs` of the creation. "
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
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
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
          Boolean latest) {
    OperationContext operationContext =
        new OperationContext(Entity.WORKFLOW_DEFINITION, MetadataOperation.VIEW_ALL);
    ResourceContextInterface resourceContext = ReportDataContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);

    ListFilter filter = new ListFilter(null);

    return repository.list(offset, startTs, endTs, limitParam, filter, latest);
  }

  @GET
  @Path("/{workflowDefinitionName}/{workflowInstanceId}")
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
      @Parameter(description = "Workflow Definition Name", schema = @Schema(type = "String"))
          @PathParam("workflowDefinitionName")
          String workflowDefinitionName,
      @Parameter(description = "Workflow Instance ID", schema = @Schema(type = "UUID"))
          @PathParam("workflowInstanceId")
          UUID workflowInstanceId,
      @Parameter(
              description =
                  "Limit the number of Workflow Instance States returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
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
          Boolean latest) {
    OperationContext operationContext =
        new OperationContext(Entity.WORKFLOW_DEFINITION, MetadataOperation.VIEW_ALL);
    ResourceContextInterface resourceContext = ReportDataContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return repository.listWorkflowInstanceStateForInstance(
        workflowDefinitionName, workflowInstanceId, offset, startTs, endTs, limitParam, latest);
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
}
