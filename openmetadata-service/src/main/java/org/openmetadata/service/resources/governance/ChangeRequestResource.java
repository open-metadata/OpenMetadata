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
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
import java.util.UUID;
import org.openmetadata.schema.api.governance.WithdrawChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.governance.approval.ChangeRequestService;
import org.openmetadata.service.governance.approval.ChangeRequestVisibility;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;

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
      @QueryParam("limit") @DefaultValue("50") @Min(1) @Max(500) int limit) {
    return new ResultList<>(
        ChangeRequestVisibility.list(authorizer, securityContext, entityId, requestedBy, limit));
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
    ChangeRequest request = ChangeRequestService.get(id);
    ChangeRequestVisibility.requireVisible(authorizer, securityContext, request);
    return request;
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
    return ChangeRequestService.withdraw(
        id, withdraw, securityContext.getUserPrincipal().getName());
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
    return ChangeRequestService.finish(
        id, null, ChangeRequestStatus.CANCELLED, "Cancelled by %s".formatted(admin));
  }
}
