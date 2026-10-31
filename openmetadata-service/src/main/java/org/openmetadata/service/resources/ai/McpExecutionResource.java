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
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.ai.McpExecution;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.McpExecutionRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityTimeSeriesResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ViewPermissionFilter;
import org.openmetadata.service.security.policyevaluator.McpExecutionContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

@Slf4j
@Path("/v1/mcpExecutions")
@Tag(
    name = "MCP Executions",
    description =
        "`MCP Executions` are time-series records of MCP server execution sessions, capturing tool calls, "
            + "resource accesses, data lineage, compliance checks, and audit trails for AI governance.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "mcpExecutions")
public class McpExecutionResource
    extends EntityTimeSeriesResource<McpExecution, McpExecutionRepository> {
  public static final String COLLECTION_PATH = "/v1/mcpExecutions/";

  private final ViewPermissionFilter viewPermissionFilter;

  public McpExecutionResource(Authorizer authorizer) {
    super(Entity.MCP_EXECUTION, authorizer);
    this.viewPermissionFilter = new ViewPermissionFilter(authorizer);
  }

  public static class McpExecutionList extends ResultList<McpExecution> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listMcpExecutions",
      summary = "List MCP executions",
      description =
          "Get a list of MCP executions, optionally filtered by serverId, startTs and endTs.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of MCP executions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = McpExecutionList.class)))
      })
  public ResultList<McpExecution> list(
      @Context SecurityContext securityContext,
      @Parameter(description = "Filter by MCP server ID", schema = @Schema(type = "UUID"))
          @QueryParam("serverId")
          UUID serverId,
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
      @Parameter(description = "Limit the number of executions returned")
          @DefaultValue("10")
          @QueryParam("limit")
          int limitParam) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    ResourceContextInterface resourceContext = McpExecutionContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);
    if (serverId != null) {
      authorizeServer(securityContext, MetadataOperation.VIEW_BASIC, serverId);
    }

    if ((startTs == null) != (endTs == null)) {
      throw new IllegalArgumentException("Both startTs and endTs must be provided together");
    }

    ListFilter filter = new ListFilter(org.openmetadata.schema.type.Include.ALL);
    if (serverId != null) {
      filter.addQueryParam("serverId", serverId.toString());
    }

    ResultList<McpExecution> result =
        (startTs != null && endTs != null)
            ? repository.listWithOffset(null, filter, limitParam, startTs, endTs, false, false)
            : repository.listWithOffset(null, filter, limitParam, false);
    return viewableOnly(securityContext, result);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getMcpExecutionByID",
      summary = "Get an MCP execution by Id",
      description = "Get an MCP execution by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The execution",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = McpExecution.class))),
        @ApiResponse(responseCode = "404", description = "Execution for instance {id} is not found")
      })
  public McpExecution get(
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the MCP Execution", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    McpExecution execution = repository.getByIdOrNotFound(id);
    authorizeServer(securityContext, MetadataOperation.VIEW_BASIC, execution.getServerId());
    return execution;
  }

  @POST
  @Operation(
      operationId = "createMcpExecution",
      summary = "Create an MCP execution",
      description = "Create a new MCP execution record.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "MCP Execution",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = McpExecution.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context SecurityContext securityContext, @Valid McpExecution mcpExecution) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.CREATE);
    ResourceContextInterface resourceContext = McpExecutionContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);
    authorizeServer(securityContext, MetadataOperation.EDIT_ALL, mcpExecution.getServerId());
    return create(mcpExecution, mcpExecution.getServerId().toString());
  }

  @DELETE
  @Path("/{serverId}/{timestamp}")
  @Operation(
      operationId = "deleteMcpExecutionData",
      summary = "Delete MCP execution data at a timestamp",
      description = "Delete MCP execution data for a server at a specific timestamp.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Successfully deleted MCP Execution Data")
      })
  public Response deleteMcpExecutionData(
      @Context SecurityContext securityContext,
      @Parameter(description = "ID of the MCP Server", schema = @Schema(type = "UUID"))
          @PathParam("serverId")
          @NonNull
          UUID serverId,
      @Parameter(
              description = "Timestamp of the execution to delete",
              schema = @Schema(type = "long"))
          @PathParam("timestamp")
          @NonNull
          Long timestamp) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    ResourceContextInterface resourceContext = McpExecutionContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);
    authorizeServer(securityContext, MetadataOperation.EDIT_ALL, serverId);
    repository.deleteExecutionData(serverId, timestamp);
    return Response.ok().build();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteMcpExecution",
      summary = "Delete an MCP execution by Id",
      description = "Delete an MCP execution by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Execution for instance {id} is not found")
      })
  public Response delete(
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the MCP Execution", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          boolean hardDelete) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    ResourceContextInterface resourceContext = McpExecutionContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);
    McpExecution execution = repository.getByIdOrNotFound(id);
    authorizeServer(securityContext, MetadataOperation.EDIT_ALL, execution.getServerId());
    repository.deleteById(id, hardDelete);
    return Response.ok().build();
  }

  /**
   * An execution record carries the tool calls run through the server — names, parameters, results —
   * so every handler authorizes the MCP server the record belongs to. The type-level context used
   * above has no entity, owners, tags or domains, so a policy denying the server itself — by domain
   * or by tag — could never fire on it.
   */
  private void authorizeServer(
      SecurityContext securityContext, MetadataOperation operation, UUID serverId) {
    OperationContext operationContext = new OperationContext(Entity.MCP_SERVER, operation);
    ResourceContextInterface resourceContext =
        new ResourceContext<>(Entity.MCP_SERVER, serverId, null);
    authorizer.authorize(securityContext, operationContext, resourceContext);
  }

  /**
   * A listing answers 200 rather than refusing the page, so each record is kept only if the caller
   * may view its MCP server. Dropped records shorten the page while {@code paging.total} still
   * counts them — the same post-filter trade-off {@code ActivityResource} accepts — and paging
   * cursors are kept because they point at the last row of the unfiltered page. A record whose
   * server no longer resolves is dropped for every caller.
   */
  private ResultList<McpExecution> viewableOnly(
      SecurityContext securityContext, ResultList<McpExecution> executions) {
    List<EntityReference> servers =
        executions.getData().stream()
            .map(McpExecution::getServerId)
            .filter(Objects::nonNull)
            .distinct()
            .map(id -> new EntityReference().withId(id).withType(Entity.MCP_SERVER))
            .toList();
    Set<UUID> viewable = viewPermissionFilter.viewableIds(securityContext, servers);
    executions.setData(
        executions.getData().stream()
            .filter(record -> viewable.contains(record.getServerId()))
            .toList());
    return executions;
  }
}
