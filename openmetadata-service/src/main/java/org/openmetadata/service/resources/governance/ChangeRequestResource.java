/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.resources.governance;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.BadRequestException;
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
import jakarta.ws.rs.core.SecurityContext;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.governance.OverrideChangeRequest;
import org.openmetadata.schema.api.governance.WithdrawChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ApprovalDecision;
import org.openmetadata.schema.governance.changeRequest.ChangeLifecycleEvent;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestPreview;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.governance.changeRequest.ChangeRevision;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.governance.approval.ChangeRequestService;
import org.openmetadata.service.governance.approval.ChangeRequestVisibility;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.secrets.masker.McpServerMasker;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Path("/v1/changeRequests")
@Tag(
    name = "Change Requests",
    description = "Edits to approval-gated fields, waiting for or finished with review.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "changeRequests")
public class ChangeRequestResource {
  private final Authorizer authorizer;

  public ChangeRequestResource(Authorizer authorizer) {
    this.authorizer = authorizer;
  }

  @GET
  @Operation(
      operationId = "listChangeRequests",
      summary = "List change requests for an asset or a requester",
      responses = {
        @ApiResponse(responseCode = "200", description = "Visible change requests, newest first"),
        @ApiResponse(responseCode = "400", description = "Neither entityId nor requestedBy given")
      })
  public ResultList<ChangeRequest> list(
      @Context SecurityContext securityContext,
      @Parameter(description = "Asset id", schema = @Schema(type = "UUID")) @QueryParam("entityId")
          UUID entityId,
      @Parameter(description = "Requester user name") @QueryParam("requestedBy") String requestedBy,
      @Parameter(
              description =
                  "Filter by status, comma-separated (e.g. Pending,Approved). "
                      + "Allowed values: Pending, Approved, Applied, Rejected, Conflicted, Withdrawn,"
                      + " Cancelled, Superseded")
          @QueryParam("statuses")
          String statuses,
      @QueryParam("limit") @DefaultValue("50") @Min(1) @Max(500) int limit) {
    List<String> statusValues = parseStatuses(statuses);
    return new ResultList<>(
        ChangeRequestVisibility.list(
                authorizer, securityContext, entityId, requestedBy, statusValues, limit)
            .stream()
            .map(McpServerMasker::maskChangeRequest)
            .toList());
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getChangeRequest",
      summary = "Get a change request with its active revision",
      responses = {
        @ApiResponse(responseCode = "200", description = "The change request"),
        @ApiResponse(responseCode = "404", description = "Change request not found")
      })
  public ChangeRequest get(@Context SecurityContext securityContext, @PathParam("id") UUID id) {
    ChangeRequest request = ChangeRequestService.report(id);
    ChangeRequestVisibility.requireVisible(authorizer, securityContext, request);
    return McpServerMasker.maskChangeRequest(request);
  }

  @POST
  @Path("/{id}/withdraw")
  @Operation(
      operationId = "withdrawChangeRequest",
      summary = "Withdraw your own pending change request",
      responses = {
        @ApiResponse(responseCode = "200", description = "The withdrawn change request"),
        @ApiResponse(responseCode = "403", description = "Caller is not the requester"),
        @ApiResponse(responseCode = "409", description = "Revision moved or request not pending")
      })
  public ChangeRequest withdraw(
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Valid WithdrawChangeRequest withdraw) {
    return McpServerMasker.maskChangeRequest(
        ChangeRequestService.withdraw(id, withdraw, securityContext.getUserPrincipal().getName()));
  }

  @GET
  @Path("/{id}/revisions")
  @Operation(
      operationId = "listChangeRequestRevisions",
      summary = "List every revision of a change request, oldest first",
      responses = {
        @ApiResponse(responseCode = "200", description = "The revisions"),
        @ApiResponse(responseCode = "404", description = "Change request not found")
      })
  public ResultList<ChangeRevision> revisions(
      @Context SecurityContext securityContext, @PathParam("id") UUID id) {
    final ChangeRequest request = get(securityContext, id);
    return new ResultList<>(
        ChangeRequestService.revisions(id).stream()
            .map(revision -> McpServerMasker.maskRevision(request.getEntityType(), revision))
            .toList());
  }

  @GET
  @Path("/{id}/decisions")
  @Operation(
      operationId = "listChangeRequestDecisions",
      summary = "List the review decisions recorded on a change request, oldest first",
      responses = {
        @ApiResponse(responseCode = "200", description = "The decisions"),
        @ApiResponse(responseCode = "404", description = "Change request not found")
      })
  public ResultList<ApprovalDecision> decisions(
      @Context SecurityContext securityContext, @PathParam("id") UUID id) {
    get(securityContext, id);
    return new ResultList<>(ChangeRequestService.decisions(id));
  }

  @GET
  @Path("/{id}/events")
  @Operation(
      operationId = "listChangeRequestEvents",
      summary = "List the lifecycle history of a change request, in order",
      responses = {
        @ApiResponse(responseCode = "200", description = "The lifecycle events"),
        @ApiResponse(responseCode = "404", description = "Change request not found")
      })
  public ResultList<ChangeLifecycleEvent> events(
      @Context SecurityContext securityContext, @PathParam("id") UUID id) {
    get(securityContext, id);
    return new ResultList<>(ChangeRequestService.events(id));
  }

  @POST
  @Path("/preview/{entityType}/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(
      operationId = "previewChangeRequest",
      summary = "Preview whether a PATCH would be held for approval, without saving it",
      responses = {
        @ApiResponse(responseCode = "200", description = "What saving the patch would do"),
        @ApiResponse(responseCode = "403", description = "Caller cannot make this edit"),
        @ApiResponse(responseCode = "404", description = "Entity not found")
      })
  public ChangeRequestPreview preview(
      @Context SecurityContext securityContext,
      @Parameter(description = "Entity type, for example table") @PathParam("entityType")
          String entityType,
      @Parameter(description = "Entity id", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      JsonPatch patch) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, patch),
        new ResourceContext<>(entityType, id, null));
    return McpServerMasker.maskPreview(
        ChangeRequestService.preview(
            entityType, id, patch, securityContext.getUserPrincipal().getName()));
  }

  @POST
  @Path("/{id}/override")
  @Operation(
      operationId = "overrideChangeRequest",
      summary = "Publish a pending change request without review (admin only)",
      responses = {
        @ApiResponse(responseCode = "200", description = "The published or conflicted request"),
        @ApiResponse(
            responseCode = "403",
            description = "Caller is not an admin, or is the requester"),
        @ApiResponse(responseCode = "409", description = "Revision moved or request not open")
      })
  public ChangeRequest override(
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Valid OverrideChangeRequest override) {
    authorizer.authorizeAdmin(securityContext);
    return McpServerMasker.maskChangeRequest(
        ChangeRequestService.override(id, override, securityContext.getUserPrincipal().getName()));
  }

  @POST
  @Path("/{id}/cancel")
  @Operation(
      operationId = "cancelChangeRequest",
      summary = "Cancel a pending change request (admin only)",
      responses = {
        @ApiResponse(responseCode = "200", description = "The cancelled change request")
      })
  public ChangeRequest cancel(@Context SecurityContext securityContext, @PathParam("id") UUID id) {
    authorizer.authorizeAdmin(securityContext);
    String admin = securityContext.getUserPrincipal().getName();
    return McpServerMasker.maskChangeRequest(
        ChangeRequestService.finish(
            id, null, ChangeRequestStatus.CANCELLED, "Cancelled by %s".formatted(admin), admin));
  }

  /**
   * Parses the comma-separated {@code statuses} query param into the stored {@link
   * ChangeRequestStatus} values. Null or blank yields an empty list (no filter, legacy behavior);
   * an unknown token surfaces a 400 so callers see a clear error instead of an opaque empty
   * result.
   */
  static List<String> parseStatuses(String statuses) {
    if (statuses == null || statuses.isBlank()) {
      return List.of();
    }
    return Arrays.stream(statuses.split(","))
        .map(String::trim)
        .filter(token -> !token.isEmpty())
        .map(
            token -> {
              try {
                return ChangeRequestStatus.fromValue(token).value();
              } catch (IllegalArgumentException e) {
                throw new BadRequestException(
                    "Invalid 'statuses' value '"
                        + token
                        + "'. Allowed values: "
                        + Arrays.stream(ChangeRequestStatus.values())
                            .map(ChangeRequestStatus::value)
                            .toList());
              }
            })
        .distinct()
        .toList();
  }
}
