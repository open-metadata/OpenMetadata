package org.openmetadata.service.resources.ai;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
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
import org.openmetadata.schema.entity.ai.AgentExecution;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AgentExecutionRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityTimeSeriesResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.AgentExecutionContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

@Slf4j
@Path("/v1/agentExecutions")
@Tag(
    name = "Agent Executions",
    description =
        "`Agent Executions` are time-series records of AI agent execution runs, capturing observability metrics, governance checks, and performance data.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "agentExecutions")
public class AgentExecutionResource
    extends EntityTimeSeriesResource<AgentExecution, AgentExecutionRepository> {
  public static final String COLLECTION_PATH = "/v1/agentExecutions/";

  public AgentExecutionResource(Authorizer authorizer) {
    super(Entity.AGENT_EXECUTION, authorizer);
  }

  public static class AgentExecutionList extends ResultList<AgentExecution> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listAgentExecutions",
      summary = "List agent executions",
      description =
          "Get a list of agent executions, optionally filtered by agentId, startTs and endTs.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of agent executions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AgentExecutionList.class)))
      })
  public ResultList<AgentExecution> list(
      @Context SecurityContext securityContext,
      @Parameter(description = "Filter by agent ID", schema = @Schema(type = "UUID"))
          @QueryParam("agentId")
          UUID agentId,
      @Parameter(
              description = "Filter executions after the given start timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter executions before the given end timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("endTs")
          Long endTs,
      @Parameter(description = "Limit the number of executions returned") @QueryParam("limit")
          int limitParam) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    ResourceContextInterface resourceContext = AgentExecutionContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);

    ListFilter filter = new ListFilter(org.openmetadata.schema.type.Include.ALL);
    if (agentId != null) {
      filter.addQueryParam("agentId", agentId.toString());
    }

    if (startTs != null && endTs != null) {
      return repository.listWithOffset(null, filter, limitParam, startTs, endTs, false, false);
    } else {
      return repository.listWithOffset(null, filter, limitParam, false);
    }
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getAgentExecutionByID",
      summary = "Get an agent execution by Id",
      description = "Get an agent execution by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The execution",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AgentExecution.class))),
        @ApiResponse(responseCode = "404", description = "Execution for instance {id} is not found")
      })
  public AgentExecution get(
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Agent Execution", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    ResourceContextInterface resourceContext = AgentExecutionContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return repository.getById(id);
  }

  @POST
  @Operation(
      operationId = "createAgentExecution",
      summary = "Create an agent execution",
      description = "Create a new agent execution record.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Agent Execution",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AgentExecution.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context SecurityContext securityContext, @Valid AgentExecution agentExecution) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.CREATE);
    ResourceContextInterface resourceContext = AgentExecutionContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return create(agentExecution, agentExecution.getAgentId().toString());
  }

  @DELETE
  @Path("/{agentId}/{timestamp}")
  @Operation(
      operationId = "deleteAgentExecutionData",
      summary = "Delete agent execution data at a timestamp",
      description = "Delete agent execution data for an agent at a specific timestamp.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully deleted Agent Execution Data")
      })
  public Response deleteAgentExecutionData(
      @Context SecurityContext securityContext,
      @Parameter(description = "ID of the AI Agent", schema = @Schema(type = "UUID"))
          @PathParam("agentId")
          @NonNull
          UUID agentId,
      @Parameter(
              description = "Timestamp of the execution to delete",
              schema = @Schema(type = "long"))
          @PathParam("timestamp")
          @NonNull
          Long timestamp) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    ResourceContextInterface resourceContext = AgentExecutionContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);
    repository.deleteExecutionData(agentId, timestamp);
    return Response.ok().build();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteAgentExecution",
      summary = "Delete an agent execution by Id",
      description = "Delete an agent execution by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "execution for instance {id} is not found")
      })
  public Response delete(
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Agent Execution", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          boolean hardDelete) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    ResourceContextInterface resourceContext = AgentExecutionContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);
    repository.deleteById(id, hardDelete);
    return Response.ok().build();
  }
}
