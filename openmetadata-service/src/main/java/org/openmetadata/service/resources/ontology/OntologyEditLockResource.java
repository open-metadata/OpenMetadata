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

package org.openmetadata.service.resources.ontology;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.time.Clock;
import java.util.UUID;
import org.openmetadata.schema.api.data.AcquireOntologyEditLock;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyEditLock;
import org.openmetadata.service.Entity;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.ontology.OntologyEditLeasePolicy;
import org.openmetadata.service.ontology.OntologyEditLockService;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Path("/v1/ontologyEditLocks")
@Tag(name = "Ontology Edit Locks", description = "Renewable Ontology Studio authoring leases.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "ontologyEditLocks", order = 5)
public class OntologyEditLockResource {
  private final Authorizer authorizer;
  private final OntologyEditLockService lockService;

  public OntologyEditLockResource(final Authorizer authorizer, final Limits limits) {
    this.authorizer = authorizer;
    lockService =
        new OntologyEditLockService(
            Entity.getJdbi(), Clock.systemUTC(), new OntologyEditLeasePolicy());
  }

  @POST
  @Path("/acquire")
  @Operation(operationId = "acquireOntologyEditLock", summary = "Acquire an authoring lease")
  public OntologyEditLock acquire(
      @Context final SecurityContext securityContext,
      @Valid final AcquireOntologyEditLock request) {
    authorizeEdit(securityContext, request.getResourceType(), request.getResourceId());
    return lockService.acquire(request, user(securityContext));
  }

  @PUT
  @Path("/renew")
  @Operation(operationId = "renewOntologyEditLock", summary = "Renew an authoring lease")
  public OntologyEditLock renew(
      @Context final SecurityContext securityContext,
      @Valid final AcquireOntologyEditLock request) {
    authorizeEdit(securityContext, request.getResourceType(), request.getResourceId());
    return lockService.acquire(request, user(securityContext));
  }

  @GET
  @Path("/{resourceType}/{resourceId}")
  @Operation(operationId = "getOntologyEditLock", summary = "Get the active authoring lease")
  public OntologyEditLock get(
      @Context final SecurityContext securityContext,
      @PathParam("resourceType") final String resourceType,
      @PathParam("resourceId") final UUID resourceId) {
    authorizeEdit(securityContext, resourceType, resourceId);
    return lockService.get(resourceType, resourceId);
  }

  @DELETE
  @Path("/{resourceType}/{resourceId}")
  @Operation(operationId = "releaseOntologyEditLock", summary = "Release an authoring lease")
  public Response release(
      @Context final SecurityContext securityContext,
      @PathParam("resourceType") final String resourceType,
      @PathParam("resourceId") final UUID resourceId,
      @QueryParam("sessionId") final String sessionId) {
    authorizeEdit(securityContext, resourceType, resourceId);
    lockService.release(resourceType, resourceId, sessionId, user(securityContext));
    return Response.noContent().build();
  }

  private void authorizeEdit(
      final SecurityContext securityContext, final String resourceType, final UUID resourceId) {
    final OperationContext operationContext =
        new OperationContext(resourceType, editOperation(resourceType));
    authorizer.authorize(
        securityContext, operationContext, new ResourceContext<>(resourceType, resourceId, null));
  }

  static MetadataOperation editOperation(final String resourceType) {
    return switch (resourceType) {
      case Entity.GLOSSARY, Entity.GLOSSARY_TERM -> MetadataOperation.EDIT_GLOSSARY_TERMS;
      default -> MetadataOperation.EDIT_ALL;
    };
  }

  private static String user(final SecurityContext securityContext) {
    return securityContext.getUserPrincipal().getName();
  }
}
