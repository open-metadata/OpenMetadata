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
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
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
import jakarta.ws.rs.core.UriInfo;
import java.time.Clock;
import java.util.UUID;
import org.openmetadata.schema.api.data.ApplyOntologyChangeSet;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.OntologyChangeSetCommand;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.data.UpdateOntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyEditLeaseToken;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.OntologyAxiomRepository;
import org.openmetadata.service.jdbi3.OntologyChangeSetRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.ontology.OntologyChangeApplicationService;
import org.openmetadata.service.ontology.OntologyEditLeasePolicy;
import org.openmetadata.service.ontology.OntologyEditLockService;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.RestUtil.PutResponse;

@Path("/v1/ontologyChangeSets")
@Tag(
    name = "Ontology Change Sets",
    description = "Durable, reversible Ontology Studio authoring sessions.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "ontologyChangeSets", order = 4)
public class OntologyChangeSetResource
    extends EntityResource<OntologyChangeSet, OntologyChangeSetRepository> {
  public static final String COLLECTION_PATH = "/v1/ontologyChangeSets/";
  private static final String FIELDS = "operations,applicationResult";
  private final OntologyChangeSetMapper mapper = new OntologyChangeSetMapper();
  private final OntologyChangeApplicationService applicationService;
  private final OntologyEditLockService lockService;

  public OntologyChangeSetResource(final Authorizer authorizer, final Limits limits) {
    super(Entity.ONTOLOGY_CHANGE_SET, authorizer, limits);
    final Clock clock = Clock.systemUTC();
    applicationService =
        new OntologyChangeApplicationService(
            repository,
            (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM),
            (OntologyAxiomRepository) Entity.getEntityRepository(Entity.ONTOLOGY_AXIOM),
            clock);
    lockService =
        new OntologyEditLockService(Entity.getJdbi(), clock, new OntologyEditLeasePolicy());
  }

  public static class OntologyChangeSetList extends ResultList<OntologyChangeSet> {}

  @GET
  @Operation(operationId = "listOntologyChangeSets", summary = "List ontology change sets")
  public ResultList<OntologyChangeSet> list(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @QueryParam("fields") final String fields,
      @QueryParam("state") final OntologyChangeSetState state,
      @QueryParam("limit") @DefaultValue("50") @Min(0) @Max(1000000) final int limit,
      @QueryParam("before") final String before,
      @QueryParam("after") final String after,
      @QueryParam("include") @DefaultValue("non-deleted") final Include include) {
    final ListFilter filter = new ListFilter(include);
    if (state != null) {
      filter.addQueryParam("state", state.value());
    }
    return listInternal(uriInfo, securityContext, fields, filter, limit, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(operationId = "getOntologyChangeSetById", summary = "Get an ontology change set")
  public OntologyChangeSet get(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @QueryParam("fields") final String fields,
      @QueryParam("include") @DefaultValue("non-deleted") final Include include) {
    return getInternal(uriInfo, securityContext, id, fields, include, null);
  }

  @POST
  @Operation(operationId = "createOntologyChangeSet", summary = "Create a change set")
  public Response create(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @Valid final CreateOntologyChangeSet request) {
    final OntologyChangeSet entity = mapper.createToEntity(request, user(securityContext));
    authorizeGlossaries(securityContext, entity, MetadataOperation.EDIT_GLOSSARY_TERMS);
    return create(uriInfo, securityContext, entity);
  }

  @PUT
  @Path("/{id}/operations")
  @Operation(operationId = "replaceOntologyChangeOperations", summary = "Replace draft operations")
  public Response replaceOperations(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @Valid final UpdateOntologyChangeSet request) {
    authorizeChangeSet(securityContext, id);
    requireLease(id, request.getLease(), securityContext);
    return repository
        .replaceOperations(
            uriInfo, user(securityContext), id, request.getOperations(), request.getUndoCursor())
        .toResponse();
  }

  @POST
  @Path("/{id}/undo")
  @Operation(operationId = "undoOntologyChange", summary = "Move the draft cursor backward")
  public Response undo(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @Valid final OntologyChangeSetCommand request) {
    authorizeChangeSet(securityContext, id);
    requireLease(id, request.getLease(), securityContext);
    return repository.moveCursor(uriInfo, user(securityContext), id, -1).toResponse();
  }

  @POST
  @Path("/{id}/redo")
  @Operation(operationId = "redoOntologyChange", summary = "Move the draft cursor forward")
  public Response redo(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @Valid final OntologyChangeSetCommand request) {
    authorizeChangeSet(securityContext, id);
    requireLease(id, request.getLease(), securityContext);
    return repository.moveCursor(uriInfo, user(securityContext), id, 1).toResponse();
  }

  @POST
  @Path("/{id}/submit")
  @Operation(operationId = "submitOntologyChangeSet", summary = "Submit a draft for review")
  public Response submit(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @Valid final OntologyChangeSetCommand request) {
    final OntologyChangeSet changeSet = scopedChangeSet(id);
    authorizeGlossaries(securityContext, changeSet, MetadataOperation.EDIT_GLOSSARY_TERMS);
    requireLease(id, request.getLease(), securityContext);
    return repository
        .transition(uriInfo, user(securityContext), id, OntologyChangeSetState.SUBMITTED, null)
        .toResponse();
  }

  @POST
  @Path("/{id}/apply")
  @Operation(operationId = "applyOntologyChangeSet", summary = "Apply active operations")
  public Response apply(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @Valid final ApplyOntologyChangeSet request) {
    final OntologyChangeSet changeSet = scopedChangeSet(id);
    authorizeGlossaries(securityContext, changeSet, MetadataOperation.EDIT_ALL);
    requireLease(id, request.getLease(), securityContext);
    final PutResponse<OntologyChangeSet> response =
        applicationService.apply(uriInfo, id, user(securityContext));
    releaseAppliedLease(response.getEntity(), request.getLease(), securityContext);
    return response.toResponse();
  }

  @POST
  @Path("/{id}/discard")
  @Operation(operationId = "discardOntologyChangeSet", summary = "Discard a change set")
  public Response discard(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @Valid final OntologyChangeSetCommand request) {
    authorizeChangeSet(securityContext, id);
    requireLease(id, request.getLease(), securityContext);
    return repository
        .transition(uriInfo, user(securityContext), id, OntologyChangeSetState.DISCARDED, null)
        .toResponse();
  }

  @GET
  @Path("/{id}/versions")
  @Operation(operationId = "listOntologyChangeSetVersions", summary = "List change-set versions")
  public EntityHistory listVersions(
      @Context final SecurityContext securityContext, @PathParam("id") final UUID id) {
    return listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(operationId = "getOntologyChangeSetVersion", summary = "Get a change-set version")
  public OntologyChangeSet getVersion(
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @PathParam("version") final String version) {
    return getVersionInternal(securityContext, id, version);
  }

  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deleteOntologyChangeSet", summary = "Delete a change set")
  public Response delete(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @QueryParam("hardDelete") @DefaultValue("false") final boolean hardDelete) {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(operationId = "restoreOntologyChangeSet", summary = "Restore a change set")
  public Response restore(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @Valid final RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private OntologyChangeSet scopedChangeSet(final UUID id) {
    return repository.get(null, id, repository.getFields(FIELDS), Include.NON_DELETED, false);
  }

  private void authorizeChangeSet(final SecurityContext securityContext, final UUID changeSetId) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.EDIT_ALL),
        getResourceContextById(changeSetId));
  }

  private void authorizeGlossaries(
      final SecurityContext securityContext,
      final OntologyChangeSet changeSet,
      final MetadataOperation operation) {
    for (final EntityReference glossary : changeSet.getGlossaries()) {
      authorizer.authorize(
          securityContext,
          new OperationContext(Entity.GLOSSARY, operation),
          new ResourceContext<>(Entity.GLOSSARY, glossary.getId(), null));
    }
  }

  private void requireLease(
      final UUID changeSetId,
      final OntologyEditLeaseToken lease,
      final SecurityContext securityContext) {
    lockService.requireOwned(
        Entity.ONTOLOGY_CHANGE_SET,
        changeSetId,
        lease.getSessionId(),
        lease.getVersion(),
        user(securityContext));
  }

  private void releaseAppliedLease(
      final OntologyChangeSet changeSet,
      final OntologyEditLeaseToken lease,
      final SecurityContext securityContext) {
    if (changeSet.getState() == OntologyChangeSetState.APPLIED) {
      lockService.release(
          Entity.ONTOLOGY_CHANGE_SET,
          changeSet.getId(),
          lease.getSessionId(),
          user(securityContext));
    }
  }

  private static String user(final SecurityContext securityContext) {
    return securityContext.getUserPrincipal().getName();
  }
}
