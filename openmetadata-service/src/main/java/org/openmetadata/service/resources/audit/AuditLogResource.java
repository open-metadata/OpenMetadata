package org.openmetadata.service.resources.audit;

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
import jakarta.ws.rs.core.UriInfo;
import java.util.Collections;
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
      @Context UriInfo uriInfo,
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
              description = "Returns results with cursor after this value",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
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

    OperationContext operationContext =
        new OperationContext(Entity.AUDIT_LOG, MetadataOperation.AUDIT_LOGS);
    authorizer.authorize(securityContext, operationContext, new AuditLogResourceContext());

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
        after);
  }

  static class AuditLogResourceContext implements ResourceContextInterface {

    @Override
    public String getResource() {
      return Entity.AUDIT_LOG;
    }

    @Override
    public List<EntityReference> getOwners() {
      return Collections.emptyList();
    }

    @Override
    public List<TagLabel> getTags() {
      return Collections.emptyList();
    }

    @Override
    public EntityInterface getEntity() {
      return null;
    }

    @Override
    public List<EntityReference> getDomains() {
      return Collections.emptyList();
    }
  }
}
