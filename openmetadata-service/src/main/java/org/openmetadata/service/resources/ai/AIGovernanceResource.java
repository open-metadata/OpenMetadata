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
import java.util.UUID;
import org.openmetadata.schema.api.ai.AIGovernanceBulkTriageRequest;
import org.openmetadata.schema.api.ai.AIGovernanceTransitionRequest;
import org.openmetadata.schema.api.ai.IntakeChecksResponse;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;

@Path("/v1/aiGovernance")
@Tag(
    name = "AI Governance",
    description =
        "Cross-asset AI governance endpoints: intake checks, submitForReview, approve, reject, shadow triage.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "aiGovernance")
public class AIGovernanceResource {

  private final AIGovernanceWorkflowService service;

  public AIGovernanceResource(Authorizer authorizer, Limits limits) {
    this.service = new AIGovernanceWorkflowService(authorizer);
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
    return Response.ok(service.getIntakeChecksByFqn(securityContext, entityType, fqn)).build();
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
    return Response.ok(
            service.submitForReview(
                securityContext, entityType, id, securityContext.getUserPrincipal().getName()))
        .build();
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
      @Valid AIGovernanceTransitionRequest request) {
    return Response.ok(
            service.approve(
                securityContext,
                entityType,
                id,
                securityContext.getUserPrincipal().getName(),
                request == null ? null : request.getComment()))
        .build();
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
      @Valid AIGovernanceTransitionRequest request) {
    return Response.ok(
            service.reject(
                securityContext,
                entityType,
                id,
                securityContext.getUserPrincipal().getName(),
                request == null ? null : request.getComment()))
        .build();
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
      @QueryParam("entityType") String entityType,
      @QueryParam("entityId") String entityId,
      @QueryParam("limit") @DefaultValue("50") int limit) {
    return Response.ok(service.getActivity(securityContext, entityType, entityId, limit)).build();
  }

  @GET
  @Path("/dashboard")
  @Operation(
      operationId = "getAIGovernanceDashboard",
      summary = "Rollup of AI governance state",
      description =
          "Returns the dashboard widgets in one shot: estate stats, risk × impact matrix counts, framework readiness percentages, top-N Shadow AI detections, top-N pending approvals. Computes from the AI Application / LLM Model / MCP Server entities directly so the UI can render in a single round-trip.")
  public Response getDashboard(@Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    return Response.ok(service.getDashboard(securityContext)).build();
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
    return Response.ok(service.getPolicyStatus(securityContext, entityType, id)).build();
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
    return Response.ok(service.getPolicyViolations(securityContext, policyId, since, limit))
        .build();
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
      @Valid AIGovernanceBulkTriageRequest request) {
    return Response.ok(service.bulkTriage(securityContext, request)).build();
  }
}
