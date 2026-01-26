package org.openmetadata.service.resources.audit;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.audit.AuditLogEntry;
import org.openmetadata.service.audit.AuditLogRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.CSVExportResponse;
import org.openmetadata.service.util.WebsocketNotificationHandler;

@Path("/v1/audit/logs")
@Tag(
    name = "Audit Logs",
    description = "APIs for listing user initiated change events persisted for auditing")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "auditLogs")
@RequiredArgsConstructor
@Slf4j
public class AuditLogResource {

  private final Authorizer authorizer;
  private final AuditLogRepository repository;

  @GET
  @Operation(
      operationId = "listAuditLogs",
      summary = "List audit log events",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of audit log events",
            content =
                @Content(
                    mediaType = MediaType.APPLICATION_JSON,
                    schema = @Schema(implementation = ResultList.class)))
      })
  public ResultList<AuditLogEntry> listAuditLogs(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Limit the number of results returned. (1 to 200)",
              schema = @Schema(type = "integer"))
          @QueryParam("limit")
          @DefaultValue("25")
          @Min(1)
          @Max(200)
          int limit,
      @Parameter(
              description = "Returns results after this cursor (for forward pagination)",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Returns results before this cursor (for backward pagination)",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Filter by username", schema = @Schema(type = "string"))
          @QueryParam("userName")
          String userName,
      @Parameter(
              description = "Filter by actor type (USER, BOT, AGENT)",
              schema = @Schema(type = "string"))
          @QueryParam("actorType")
          String actorType,
      @Parameter(description = "Filter by service name", schema = @Schema(type = "string"))
          @QueryParam("serviceName")
          String serviceName,
      @Parameter(description = "Filter by entity type", schema = @Schema(type = "string"))
          @QueryParam("entityType")
          String entityType,
      @Parameter(
              description = "Filter by entity fully qualified name",
              schema = @Schema(type = "string"))
          @QueryParam("entityFQN")
          String entityFqn,
      @Parameter(description = "Filter by event type", schema = @Schema(type = "string"))
          @QueryParam("eventType")
          String eventType,
      @Parameter(
              description = "Filter events after this timestamp (ms)",
              schema = @Schema(type = "integer"))
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter events before this timestamp (ms)",
              schema = @Schema(type = "integer"))
          @QueryParam("endTs")
          Long endTs,
      @Parameter(
              description =
                  "Search term to filter audit logs (searches across user_name, entity_fqn, "
                      + "service_name, entity_type)",
              schema = @Schema(type = "string"))
          @QueryParam("q")
          String searchTerm) {

    // Authorization: service-level, entity-level, or global based on filters provided
    authorizeAuditLogAccess(securityContext, serviceName, entityType, entityFqn);

    return repository.list(
        userName,
        actorType,
        serviceName,
        entityType,
        entityFqn,
        eventType,
        startTs,
        endTs,
        searchTerm,
        limit,
        before,
        after);
  }

  private static final int EXPORT_MAX_LIMIT = 100000;
  private static final int EXPORT_DEFAULT_LIMIT = 10000;

  @GET
  @Path("/export")
  @Operation(
      operationId = "exportAuditLogs",
      summary = "Export audit log events as JSON (async)",
      description =
          "Initiates an asynchronous export of audit log events. "
              + "Returns a job ID immediately. When the export is complete, "
              + "the data will be sent via WebSocket on the csvExportChannel.",
      responses = {
        @ApiResponse(
            responseCode = "202",
            description = "Export job initiated",
            content =
                @Content(
                    mediaType = MediaType.APPLICATION_JSON,
                    schema = @Schema(implementation = CSVExportResponse.class))),
        @ApiResponse(responseCode = "400", description = "Invalid parameters")
      })
  @Produces(MediaType.APPLICATION_JSON)
  public Response exportAuditLogs(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Start timestamp in milliseconds (required)",
              schema = @Schema(type = "integer"),
              required = true)
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "End timestamp in milliseconds (required)",
              schema = @Schema(type = "integer"),
              required = true)
          @QueryParam("endTs")
          Long endTs,
      @Parameter(
              description = "Maximum number of records to export (default 10000, max 100000)",
              schema = @Schema(type = "integer"))
          @QueryParam("limit")
          @DefaultValue("10000")
          @Min(1)
          @Max(100000)
          int limit,
      @Parameter(description = "Filter by username", schema = @Schema(type = "string"))
          @QueryParam("userName")
          String userName,
      @Parameter(
              description = "Filter by actor type (USER, BOT, AGENT)",
              schema = @Schema(type = "string"))
          @QueryParam("actorType")
          String actorType,
      @Parameter(description = "Filter by service name", schema = @Schema(type = "string"))
          @QueryParam("serviceName")
          String serviceName,
      @Parameter(description = "Filter by entity type", schema = @Schema(type = "string"))
          @QueryParam("entityType")
          String entityType,
      @Parameter(description = "Filter by event type", schema = @Schema(type = "string"))
          @QueryParam("eventType")
          String eventType,
      @Parameter(
              description =
                  "Search term to filter audit logs (searches across user_name, entity_fqn, "
                      + "service_name, entity_type)",
              schema = @Schema(type = "string"))
          @QueryParam("q")
          String searchTerm) {

    // Require global audit log permission for export (admin-only)
    OperationContext operationContext =
        new OperationContext(Entity.AUDIT_LOG, MetadataOperation.AUDIT_LOGS);
    authorizer.authorize(securityContext, operationContext, AuditLogResourceContext.INSTANCE);

    // Validate required parameters
    if (startTs == null || endTs == null) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("Both startTs and endTs are required for export")
          .build();
    }

    if (startTs > endTs) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("startTs must be less than or equal to endTs")
          .build();
    }

    // Apply limit constraints
    int effectiveLimit = Math.min(Math.max(limit, 1), EXPORT_MAX_LIMIT);

    // Generate job ID and start async export
    String jobId = UUID.randomUUID().toString();
    ExecutorService executorService = AsyncService.getInstance().getExecutorService();

    executorService.submit(
        () -> {
          try {
            // Use batched export to avoid long-running queries that could cause
            // resource contention with concurrent writes to the audit_log table.
            // Progress updates are sent via websocket for long-running exports.
            List<AuditLogEntry> results =
                repository.exportInBatches(
                    userName,
                    actorType,
                    serviceName,
                    entityType,
                    eventType,
                    startTs,
                    endTs,
                    searchTerm,
                    effectiveLimit,
                    (fetched, total, message) ->
                        WebsocketNotificationHandler.sendCsvExportProgressNotification(
                            jobId, securityContext, fetched, total, message));

            String json = JsonUtils.pojoToJson(results);
            WebsocketNotificationHandler.sendCsvExportCompleteNotification(
                jobId, securityContext, json);
          } catch (Exception e) {
            LOG.error("Encountered exception while exporting audit logs.", e);
            WebsocketNotificationHandler.sendCsvExportFailedNotification(
                jobId, securityContext, e.getMessage() == null ? e.toString() : e.getMessage());
          }
        });

    CSVExportResponse response = new CSVExportResponse(jobId, "Export initiated successfully.");
    return Response.accepted().entity(response).type(MediaType.APPLICATION_JSON).build();
  }

  /**
   * Authorize audit log access based on service-level, entity-level, or global permissions.
   *
   * <p>Authorization model (checked in order):
   *
   * <ul>
   *   <li>If entityFQN AND entityType are provided: Check VIEW_BASIC on the specific entity
   *   <li>If serviceName AND entityType are provided: Check VIEW_BASIC on the service
   *   <li>Otherwise: Require global AUDIT_LOGS permission (admin-only)
   * </ul>
   */
  private void authorizeAuditLogAccess(
      SecurityContext securityContext, String serviceName, String entityType, String entityFqn) {
    if (!nullOrEmpty(entityFqn) && !nullOrEmpty(entityType)) {
      // Entity-level authorization: user needs VIEW_BASIC on the specific entity
      ResourceContext<?> entityContext = new ResourceContext<>(entityType, null, entityFqn);
      OperationContext viewOp = new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
      authorizer.authorize(securityContext, viewOp, entityContext);
    } else if (!nullOrEmpty(serviceName) && !nullOrEmpty(entityType)) {
      // Service-level authorization: user needs VIEW_BASIC on the service
      String serviceType = Entity.getServiceType(entityType);
      ResourceContext<?> serviceContext = new ResourceContext<>(serviceType, null, serviceName);
      OperationContext viewOp = new OperationContext(serviceType, MetadataOperation.VIEW_BASIC);
      authorizer.authorize(securityContext, viewOp, serviceContext);
    } else {
      // Global audit log access: requires AUDIT_LOGS permission (admin-only)
      OperationContext operationContext =
          new OperationContext(Entity.AUDIT_LOG, MetadataOperation.AUDIT_LOGS);
      authorizer.authorize(securityContext, operationContext, AuditLogResourceContext.INSTANCE);
    }
  }

  /**
   * Resource context for audit log permission checks. Uses singleton pattern since audit logs have
   * no owners, tags, or domains - just a resource type for policy evaluation.
   */
  private enum AuditLogResourceContext implements ResourceContextInterface {
    INSTANCE;

    @Override
    public String getResource() {
      return Entity.AUDIT_LOG;
    }

    @Override
    public List<EntityReference> getOwners() {
      return List.of();
    }

    @Override
    public List<TagLabel> getTags() {
      return List.of();
    }

    @Override
    public EntityInterface getEntity() {
      return null;
    }

    @Override
    public List<EntityReference> getDomains() {
      return List.of();
    }
  }
}
