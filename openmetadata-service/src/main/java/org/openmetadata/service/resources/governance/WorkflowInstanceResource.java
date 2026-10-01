package org.openmetadata.service.resources.governance;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.util.UUID;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowInstanceTerminator;
import org.openmetadata.service.governance.workflows.WorkflowInstanceTerminator.TerminationOutcome;
import org.openmetadata.service.governance.workflows.WorkflowInstanceTerminator.TerminationRequest;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityTimeSeriesResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ReportDataContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Path("/v1/governance/workflowInstances")
@Tag(
    name = "Workflow Instances",
    description = "A Workflow Instance is a specific instance of a Workflow Definition.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "governanceWorkflows")
public class WorkflowInstanceResource
    extends EntityTimeSeriesResource<WorkflowInstance, WorkflowInstanceRepository> {
  public static final String COLLECTION_PATH = "/v1/governance/workflowInstances";
  private static final int MAX_TERMINATION_REASON_LENGTH = 1000;

  public WorkflowInstanceResource(Authorizer authorizer) {
    super(Entity.WORKFLOW_INSTANCE, authorizer);
  }

  public static class WorkflowInstanceResultList extends ResultList<WorkflowInstanceState> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listWorkflowInstances",
      summary = "List the Workflow Instances",
      description =
          "Get a list of all the workflow instances, filtered by `startTs` and `endTs` of the creation, "
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
                    schema =
                        @Schema(
                            implementation =
                                WorkflowInstanceResource.WorkflowInstanceResultList.class)))
      })
  public ResultList<WorkflowInstance> list(
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "Limit the number of Workflow Instances returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limitParam,
      @Parameter(
              description = "Returns list of Workflow Instances at the offset",
              schema = @Schema(type = "string"))
          @QueryParam("offset")
          String offset,
      @Parameter(
              description = "Filter Workflow Instances after the given start timestamp",
              schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter Workflow Instances before the given end timestamp",
              schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("endTs")
          Long endTs,
      @Parameter(
              description = "Only list the latest Workflow Instance",
              schema = @Schema(type = "Boolean"))
          @DefaultValue("false")
          @QueryParam("latest")
          Boolean latest,
      @Parameter(description = "Workflow Definition Name", schema = @Schema(type = "String"))
          @QueryParam("workflowDefinitionName")
          String workflowDefinitionName,
      @Parameter(description = "Entity Link", schema = @Schema(type = "String"))
          @QueryParam("entityLink")
          String entityLink) {
    OperationContext operationContext =
        new OperationContext(Entity.WORKFLOW_DEFINITION, MetadataOperation.VIEW_ALL);
    ResourceContextInterface resourceContext = ReportDataContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);

    ListFilter filter = new ListFilter(null);
    filter.addQueryParam("entityFQNHash", FullyQualifiedName.buildHash(workflowDefinitionName));
    if (entityLink != null) {
      filter.addQueryParam("entityLink", entityLink);
    }
    return repository.list(offset, startTs, endTs, limitParam, filter, latest);
  }

  @POST
  @Path("/{id}/terminate")
  @Operation(
      operationId = "terminateWorkflowInstance",
      summary = "Terminate a Workflow Instance",
      description =
          "Delete every running process of a Workflow Instance, including one left locked by a "
              + "server that stopped mid-job, and record the instance as FAILURE. When a job of "
              + "the instance is executing now, a stop request is recorded instead: a batch sink "
              + "stops before its next sub-batch and a periodic-batch trigger before its next "
              + "batch, after which the instance is recorded as FAILURE. Any other job runs to "
              + "its end first. Admin only.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The terminated Workflow Instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WorkflowInstance.class))),
        @ApiResponse(
            responseCode = "202",
            description =
                "A job of the instance is executing now; a stop request is recorded and the "
                    + "still running Workflow Instance is returned",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WorkflowInstance.class))),
        @ApiResponse(responseCode = "403", description = "Caller is not an admin"),
        @ApiResponse(responseCode = "404", description = "Workflow Instance for `id` not found"),
        @ApiResponse(
            responseCode = "409",
            description =
                "The instance has already ended, and has no running process or one whose job "
                    + "is executing now")
      })
  public Response terminate(
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Workflow Instance", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Reason recorded on the terminated Workflow Instance")
          @QueryParam("reason")
          @Size(max = MAX_TERMINATION_REASON_LENGTH)
          String reason) {
    authorizer.authorizeAdmin(securityContext);
    TerminationRequest request =
        new TerminationRequest(id, reason, securityContext.getUserPrincipal().getName());
    TerminationOutcome outcome =
        WorkflowInstanceTerminator.forCurrentEngine(repository).terminate(request);
    Response.ResponseBuilder response =
        outcome.stopRequested() ? Response.accepted() : Response.ok();
    return response.entity(outcome.workflowInstance()).build();
  }
}
