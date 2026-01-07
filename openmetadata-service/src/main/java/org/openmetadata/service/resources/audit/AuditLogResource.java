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
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.audit.AuditLogEntry;
import org.openmetadata.service.audit.AuditLogRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

@Path("/v1/audit/logs")
@Tag(
    name = "Audit Logs",
    description = "APIs for listing user initiated change events persisted for auditing")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "auditLogs")
@RequiredArgsConstructor
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
          Long endTs) {

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
        limit,
        before,
        after);
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
