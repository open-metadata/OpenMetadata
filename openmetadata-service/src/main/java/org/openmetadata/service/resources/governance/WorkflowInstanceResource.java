package org.openmetadata.service.resources.governance;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
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
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityTimeSeriesResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ReportDataContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.ResultList;

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
          @Min(0)
          @Max(1000000)
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
  @Path("/{id}/retry")
  @Operation(
      operationId = "retryWorkflowInstanceFromStep",
      summary = "Retry a Workflow Instance from a given Step",
      description = "Retry a Workflow Instance from a given Step.",
      responses = {@ApiResponse(responseCode = "200", description = "Retry Message sent")})
  public Response redeploy(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the Workflow Definition", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Workflow Definition Name", schema = @Schema(type = "String"))
          @QueryParam("workflowDefinitionName")
          String workflowDefinitionName,
      @Parameter(description = "Step to Retry", schema = @Schema(type = "string"))
          @QueryParam("stepToRetry")
          String stepToRetry,
      @Context SecurityContext securityContext) {
    WorkflowHandler.getInstance().retryWorkflowInstance(workflowDefinitionName, id, stepToRetry);
    return Response.status(Response.Status.OK).build();
  }
}
