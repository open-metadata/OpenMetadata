/*
 *  Copyright 2026 Collate.
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
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
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
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

/**
 * Cross-cutting convenience endpoints that power the AI Governance Studio. The
 * canonical CRUD endpoints for AIApplication / LLMModel / McpServer live in their
 * own Resource classes; this resource is the one front door the Studio UI calls
 * for actions that span asset types (intake check rollups, shadow triage,
 * registration-state transitions, etc).
 */
@Slf4j
@SuppressWarnings("unchecked")
@Path("/v1/aiGovernance")
@Tag(
    name = "AI Governance",
    description =
        "Cross-asset AI governance endpoints: intake checks, submitForReview, approve, reject, shadow triage.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "aiGovernance")
public class AIGovernanceResource {

  private static final Set<String> SUPPORTED_TYPES =
      Set.of(Entity.AI_APPLICATION, Entity.LLM_MODEL, Entity.MCP_SERVER);

  private final Authorizer authorizer;

  public AIGovernanceResource(Authorizer authorizer, Limits limits) {
    this.authorizer = authorizer;
  }

  @GET
  @Path("/intakeChecks/{entityType}/name/{fqn}")
  @Operation(
      operationId = "getIntakeChecksByFqn",
      summary = "Return the AI governance intake checks for an asset",
      description =
          "Computes the 5 intake checks the Approvals queue surfaces (owner assigned, risk classified, fairness evidence attached, DPIA referenced, transparency disclosure). Each check returns a passing boolean and an evidence reference where applicable.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Intake check results",
            content =
                @io.swagger.v3.oas.annotations.media.Content(
                    schema = @Schema(implementation = IntakeChecksResponse.class)))
      })
  public Response getIntakeChecksByFqn(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "AI asset type", schema = @Schema(implementation = String.class))
          @PathParam("entityType")
          String entityType,
      @Parameter(description = "Fully qualified name of the asset") @PathParam("fqn") String fqn) {
    authorizeViewByFqn(securityContext, entityType, fqn);
    EntityInterface entity = loadEntityByFqn(entityType, fqn);
    return Response.ok(IntakeChecks.compute(entity)).build();
  }

  @POST
  @Path("/{entityType}/{id}/submitForReview")
  @Operation(
      operationId = "submitForReview",
      summary = "Flip an AI asset's registrationStatus to PendingApproval",
      description =
          "Convenience endpoint used by the Intake Wizard. Loads the entity, sets registrationStatus to PendingApproval (with registeredBy / registeredAt), and PATCHes back. The intake workflow picks up the change-event and creates a Risk Council approval task.")
  public Response submitForReview(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("entityType") String entityType,
      @PathParam("id") String id) {
    EntityInterface entity =
        transitionRegistration(
            securityContext,
            entityType,
            id,
            "PendingApproval",
            securityContext.getUserPrincipal().getName(),
            null);

    return Response.ok(entity).build();
  }

  @POST
  @Path("/{entityType}/{id}/approve")
  @Operation(
      operationId = "approveAIAsset",
      summary = "Approve a PendingApproval AI asset",
      description = "Sets registrationStatus to Approved and stamps approvedBy / approvedAt.")
  public Response approve(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("entityType") String entityType,
      @PathParam("id") String id,
      @Valid TransitionRequest request) {
    EntityInterface entity =
        transitionRegistration(
            securityContext,
            entityType,
            id,
            "Approved",
            securityContext.getUserPrincipal().getName(),
            request == null ? null : request.getComment());

    return Response.ok(entity).build();
  }

  @POST
  @Path("/{entityType}/{id}/reject")
  @Operation(
      operationId = "rejectAIAsset",
      summary = "Reject a PendingApproval AI asset",
      description = "Sets registrationStatus to Rejected and records the comment.")
  public Response reject(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("entityType") String entityType,
      @PathParam("id") String id,
      @Valid TransitionRequest request) {
    EntityInterface entity =
        transitionRegistration(
            securityContext,
            entityType,
            id,
            "Rejected",
            securityContext.getUserPrincipal().getName(),
            request == null ? null : request.getComment());

    return Response.ok(entity).build();
  }

  @GET
  @Path("/activity")
  @Operation(
      operationId = "getAIGovernanceActivity",
      summary = "Curated AI governance activity feed",
      description =
          "Returns a chronological feed of governance-significant events (registered, approved, rejected, assessed, reassessment scheduled, shadow detected). Supports filtering to a single asset via entityType + entityId.")
  public Response getActivity(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @jakarta.ws.rs.QueryParam("entityType") String entityType,
      @jakarta.ws.rs.QueryParam("entityId") String entityId,
      @jakarta.ws.rs.QueryParam("limit") @jakarta.ws.rs.DefaultValue("50") int limit) {
    if (entityType != null && entityId != null) {
      authorizeViewById(securityContext, entityType, entityId);
    } else if (entityType != null) {
      authorizeViewResourceType(securityContext, entityType);
    } else {
      authorizeViewAcrossSupportedTypes(securityContext);
    }
    List<Map<String, Object>> events = GovernanceActivity.compute(entityType, entityId, limit);

    return Response.ok(Map.of("events", events)).build();
  }

  @GET
  @Path("/dashboard")
  @Operation(
      operationId = "getAIGovernanceDashboard",
      summary = "Rollup of AI governance state",
      description =
          "Returns the dashboard widgets in one shot: estate stats, risk × impact matrix counts, framework readiness percentages, top-N Shadow AI detections, top-N pending approvals. Computes from the AI Application / LLM Model / MCP Server entities directly so the UI can render in a single round-trip.")
  public Response getDashboard(@Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    authorizeViewAcrossSupportedTypes(securityContext);
    Map<String, Object> response = DashboardRollup.compute();

    return Response.ok(response).build();
  }

  @GET
  @Path("/{entityType}/{id}/policyStatus")
  @Operation(
      operationId = "getPolicyStatus",
      summary = "Evaluate AI governance policies attached to an asset",
      description =
          "Evaluates a small set of always-on synthetic policies (drift threshold, PII access requires DPIA, subgroup fairness quarterly, human oversight, audit log retention) plus any AIGovernancePolicy entries the asset references. Returns per-rule status: Passing | Breached | NotApplicable.")
  public Response getPolicyStatus(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("entityType") String entityType,
      @PathParam("id") String id) {
    authorizeViewById(securityContext, entityType, id);
    EntityInterface entity = loadEntity(entityType, id);
    List<Map<String, Object>> rules = PolicyEvaluator.evaluate(entity, entityType);

    return Response.ok(Map.of("rules", rules)).build();
  }

  @GET
  @Path("/policies/{policyId}/violations")
  @Operation(
      operationId = "getPolicyViolations",
      summary = "Recent breach events for a single AI governance policy",
      description =
          "Returns recent breach events scoped to this policy across the AI estate. Computed by re-evaluating PolicyEvaluator over in-scope AI assets and projecting rule names that match the policy name pattern. Optional since (epoch ms) bound and limit (default 50).")
  public Response getPolicyViolations(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("policyId") UUID policyId,
      @QueryParam("since") Long since,
      @QueryParam("limit") @DefaultValue("50") int limit) {
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.AI_GOVERNANCE_POLICY, MetadataOperation.VIEW_ALL),
        new ResourceContext<>(Entity.AI_GOVERNANCE_POLICY, policyId, null));
    authorizeViewAcrossSupportedTypes(securityContext);
    List<Map<String, Object>> violations = PolicyEvaluator.recentViolations(policyId, since, limit);

    return Response.ok(Map.of("data", violations)).build();
  }

  @POST
  @Path("/shadow/bulkTriage")
  @Operation(
      operationId = "shadowBulkTriage",
      summary = "Bulk-triage Shadow AI detections",
      description =
          "Bulk register or dismiss a set of Shadow AI detections. 'Register' flips registrationStatus to PendingApproval; 'Dismiss' flips to Rejected with the supplied reason.")
  public Response bulkTriage(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid BulkTriageRequest request) {
    List<Map<String, Object>> results = new ArrayList<>();
    if (request != null && request.getItems() != null) {
      String user = securityContext.getUserPrincipal().getName();
      String targetStatus =
          "Dismiss".equalsIgnoreCase(request.getAction()) ? "Rejected" : "PendingApproval";
      for (BulkTriageItem item : request.getItems()) {
        Map<String, Object> rowResult = new LinkedHashMap<>();
        rowResult.put("entityType", item.getEntityType());
        rowResult.put("id", item.getId());
        try {
          transitionRegistration(
              securityContext,
              item.getEntityType(),
              item.getId(),
              targetStatus,
              user,
              request.getReason());
          rowResult.put("status", "ok");
        } catch (Exception error) {
          rowResult.put("status", "error");
          rowResult.put("message", error.getMessage());
          LOG.warn("Bulk triage failed for {}:{}", item.getEntityType(), item.getId(), error);
        }
        results.add(rowResult);
      }
    }
    return Response.ok(Map.of("results", results)).build();
  }

  // ─── helpers ────────────────────────────────────────────────────────────

  private EntityInterface loadEntityByFqn(String entityType, String fqn) {
    assertSupported(entityType);
    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    return repository.getByName(null, fqn, repository.getFields("owners,tags,domains,extension"));
  }

  private EntityInterface loadEntity(String entityType, String id) {
    assertSupported(entityType);
    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    return repository.get(
        null, java.util.UUID.fromString(id), repository.getFields("owners,tags,domains,extension"));
  }

  private void assertSupported(String entityType) {
    if (!SUPPORTED_TYPES.contains(entityType)) {
      throw new IllegalArgumentException(
          "Unsupported AI governance entityType '"
              + entityType
              + "'. Supported types: "
              + SUPPORTED_TYPES);
    }
  }

  /**
   * Mutate an asset's registrationStatus and re-PATCH. Handles both the
   * AIApplication / McpServer governanceMetadata path and the LlmModel
   * flat governanceStatus enum.
   */
  private EntityInterface transitionRegistration(
      SecurityContext securityContext,
      String entityType,
      String id,
      String newStatus,
      String user,
      String comment) {
    EntityInterface entity = loadEntity(entityType, id);
    String originalJson = JsonUtils.pojoToJson(entity);
    applyStatusTransition(entity, newStatus, user, comment);
    String updatedJson = JsonUtils.pojoToJson(entity);
    JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);
    authorizePatch(securityContext, entityType, entity.getId(), patch);

    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    return repository.patch(null, entity.getId(), user, patch).entity();
  }

  private void authorizeViewByFqn(SecurityContext securityContext, String entityType, String fqn) {
    assertSupported(entityType);
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_ALL),
        new ResourceContext<>(entityType, null, fqn));
  }

  private void authorizeViewById(SecurityContext securityContext, String entityType, String id) {
    assertSupported(entityType);
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_ALL),
        new ResourceContext<>(entityType, UUID.fromString(id), null));
  }

  private void authorizeViewAcrossSupportedTypes(SecurityContext securityContext) {
    for (String entityType : SUPPORTED_TYPES) {
      authorizeViewResourceType(securityContext, entityType);
    }
  }

  private void authorizeViewResourceType(SecurityContext securityContext, String entityType) {
    assertSupported(entityType);
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_ALL),
        new ResourceContext<>(entityType));
  }

  private void authorizePatch(
      SecurityContext securityContext, String entityType, UUID id, JsonPatch patch) {
    assertSupported(entityType);
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, patch),
        new ResourceContext<>(entityType, id, null, ResourceContextInterface.Operation.PATCH));
  }

  @SuppressWarnings("unchecked")
  private void applyStatusTransition(
      EntityInterface entity, String newStatus, String user, String comment) {
    if (entity instanceof org.openmetadata.schema.entity.ai.LLMModel llm) {
      llm.setGovernanceStatus(mapToGovernanceStatus(newStatus));
      return;
    }
    Map<String, Object> governance = readGovernance(entity);
    if (governance == null) {
      governance = new LinkedHashMap<>();
    }
    long now = System.currentTimeMillis();
    governance.put("registrationStatus", newStatus);
    if ("PendingApproval".equals(newStatus)) {
      governance.putIfAbsent("registeredBy", user);
      governance.putIfAbsent("registeredAt", now);
    }
    if ("Approved".equals(newStatus)) {
      governance.put("approvedBy", user);
      governance.put("approvedAt", now);
    }
    if (comment != null && !comment.isBlank()) {
      governance.put("approvalComments", comment);
    }
    writeGovernance(entity, governance);
  }

  private static org.openmetadata.schema.entity.ai.LLMModel.GovernanceStatus mapToGovernanceStatus(
      String newStatus) {
    org.openmetadata.schema.entity.ai.LLMModel.GovernanceStatus result;
    switch (newStatus) {
      case "Approved":
        result = org.openmetadata.schema.entity.ai.LLMModel.GovernanceStatus.APPROVED;
        break;
      case "PendingApproval":
        result = org.openmetadata.schema.entity.ai.LLMModel.GovernanceStatus.PENDING_REVIEW;
        break;
      case "Rejected":
        result = org.openmetadata.schema.entity.ai.LLMModel.GovernanceStatus.REJECTED;
        break;
      default:
        result = org.openmetadata.schema.entity.ai.LLMModel.GovernanceStatus.UNAUTHORIZED;
    }
    return result;
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> readGovernance(EntityInterface entity) {
    if (entity instanceof org.openmetadata.schema.entity.ai.AIApplication app) {
      return JsonUtils.getObjectMapper().convertValue(app.getGovernanceMetadata(), Map.class);
    }
    if (entity instanceof org.openmetadata.schema.entity.ai.McpServer server) {
      return JsonUtils.getObjectMapper().convertValue(server.getGovernanceMetadata(), Map.class);
    }
    return null;
  }

  private void writeGovernance(EntityInterface entity, Map<String, Object> governance) {
    if (entity instanceof org.openmetadata.schema.entity.ai.AIApplication app) {
      app.setGovernanceMetadata(
          JsonUtils.getObjectMapper()
              .convertValue(
                  governance, org.openmetadata.schema.entity.ai.GovernanceMetadata.class));
      return;
    }
    if (entity instanceof org.openmetadata.schema.entity.ai.McpServer server) {
      server.setGovernanceMetadata(
          JsonUtils.getObjectMapper()
              .convertValue(
                  governance, org.openmetadata.schema.entity.ai.McpGovernanceMetadata.class));
    }
  }

  // ─── request / response payloads ────────────────────────────────────────

  public static class TransitionRequest {
    private String comment;

    public String getComment() {
      return comment;
    }

    public void setComment(String comment) {
      this.comment = comment;
    }
  }

  public static class BulkTriageRequest {
    private String action;
    private String reason;
    private List<BulkTriageItem> items;

    public String getAction() {
      return action;
    }

    public void setAction(String action) {
      this.action = action;
    }

    public String getReason() {
      return reason;
    }

    public void setReason(String reason) {
      this.reason = reason;
    }

    public List<BulkTriageItem> getItems() {
      return items;
    }

    public void setItems(List<BulkTriageItem> items) {
      this.items = items;
    }
  }

  public static class BulkTriageItem {
    private String entityType;
    private String id;

    public String getEntityType() {
      return entityType;
    }

    public void setEntityType(String entityType) {
      this.entityType = entityType;
    }

    public String getId() {
      return id;
    }

    public void setId(String id) {
      this.id = id;
    }
  }

  public static class IntakeChecksResponse {
    private List<IntakeCheck> checks;

    public List<IntakeCheck> getChecks() {
      return checks;
    }

    public void setChecks(List<IntakeCheck> checks) {
      this.checks = checks;
    }
  }

  public static class IntakeCheck {
    private String name;
    private boolean passing;
    private String evidenceRef;

    public IntakeCheck(String name, boolean passing, String evidenceRef) {
      this.name = name;
      this.passing = passing;
      this.evidenceRef = evidenceRef;
    }

    public String getName() {
      return name;
    }

    public boolean isPassing() {
      return passing;
    }

    public String getEvidenceRef() {
      return evidenceRef;
    }
  }
}
