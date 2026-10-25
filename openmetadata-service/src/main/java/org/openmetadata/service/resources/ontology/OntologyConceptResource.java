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
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
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
import java.util.UUID;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.data.UpdateOntologyConceptBinding;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyConceptBindingsResponse;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.OntologyConceptBindingStore;
import org.openmetadata.service.jdbi3.OntologyConceptRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.ontology.OntologyConceptBindingService;
import org.openmetadata.service.ontology.OntologyConceptBindingService.Access;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;

@Path("/v1/ontologyConcepts")
@Tag(
    name = "Ontology Concepts",
    description = "Independent ontology definitions governed through approval workflows.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "ontologyConcepts", order = 3)
public class OntologyConceptResource
    extends EntityResource<OntologyConcept, OntologyConceptRepository> {
  public static final String COLLECTION_PATH = "/v1/ontologyConcepts/";
  private final OntologyConceptMapper mapper = new OntologyConceptMapper();
  private final OntologyConceptBindingService bindings;

  public OntologyConceptResource(final Authorizer authorizer, final Limits limits) {
    super(Entity.ONTOLOGY_CONCEPT, authorizer, limits);
    addViewOperation("lifecycleStatus", MetadataOperation.VIEW_BASIC);
    bindings =
        new OntologyConceptBindingService(
            new OntologyConceptBindingStore(Entity.getCollectionDAO()),
            authorizer,
            Entity::getEntityRepository);
  }

  public static class OntologyConceptList extends ResultList<OntologyConcept> {}

  @GET
  @Operation(operationId = "listOntologyConcepts", summary = "List ontology concept definitions")
  public ResultList<OntologyConcept> list(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @QueryParam("fields") final String fields,
      @QueryParam("ontology") final String ontology,
      @QueryParam("limit") @DefaultValue("50") @Min(0) @Max(1000000) final int limit,
      @QueryParam("before") final String before,
      @QueryParam("after") final String after,
      @QueryParam("include") @DefaultValue("non-deleted") final Include include) {
    final ListFilter filter = ontologyFilter(include, ontology);
    return listInternal(uriInfo, securityContext, fields, filter, limit, before, after);
  }

  private static ListFilter ontologyFilter(final Include include, final String ontology) {
    final ListFilter filter = new ListFilter(include);
    if (ontology != null) {
      final EntityReference reference =
          Entity.getEntityReferenceByName(Entity.ONTOLOGY, ontology, Include.NON_DELETED);
      filter.addQueryParam("ontologyId", reference.getId().toString());
    }
    return filter;
  }

  @GET
  @Path("/{id}")
  @Operation(operationId = "getOntologyConceptById", summary = "Get an ontology concept")
  public OntologyConcept get(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @QueryParam("fields") final String fields,
      @QueryParam("include") @DefaultValue("non-deleted") final Include include) {
    return getInternal(uriInfo, securityContext, id, fields, include, null);
  }

  @GET
  @Path("/{id}/bindings")
  @Operation(
      operationId = "getOntologyConceptBindings",
      summary = "Get authorized catalog bindings for a concept")
  public OntologyConceptBindingsResponse getBindings(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id) {
    return bindings.get(new Access(uriInfo, securityContext), id);
  }

  @PUT
  @Path("/{id}/bindings")
  @Operation(
      operationId = "updateOntologyConceptBinding",
      summary = "Replace one concept catalog association")
  public OntologyConceptBindingsResponse updateBinding(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @Valid final UpdateOntologyConceptBinding request) {
    return bindings.put(new Access(uriInfo, securityContext), id, request);
  }

  @DELETE
  @Path("/{id}/bindings/{assetType}/{assetId}")
  @Operation(
      operationId = "deleteOntologyConceptBinding",
      summary = "Remove one concept catalog association")
  public OntologyConceptBindingsResponse deleteBinding(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @PathParam("assetType") final String assetType,
      @PathParam("assetId") final UUID assetId,
      @QueryParam("expectedRevision") @Min(0) final Long expectedRevision) {
    return bindings.remove(
        new Access(uriInfo, securityContext), id, assetType, assetId, expectedRevision);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(operationId = "getOntologyConceptByName", summary = "Get an ontology concept by name")
  public OntologyConcept getByName(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("fqn") final String fqn,
      @QueryParam("fields") final String fields,
      @QueryParam("include") @DefaultValue("non-deleted") final Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fields, include, null);
  }

  @POST
  @Operation(operationId = "createOntologyConcept", summary = "Create an ontology concept")
  public Response create(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @Valid final CreateOntologyConcept request) {
    final OntologyConcept entity = mapper.createToEntity(request, user(securityContext));
    return create(uriInfo, securityContext, entity);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateOntologyConcept",
      summary = "Create or update an ontology concept")
  public Response createOrUpdate(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @Valid final CreateOntologyConcept request) {
    final OntologyConcept entity = mapper.createToEntity(request, user(securityContext));
    return createOrUpdate(uriInfo, securityContext, entity);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(operationId = "patchOntologyConcept", summary = "Patch an ontology concept")
  public Response patch(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      final JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listOntologyConceptVersions",
      summary = "List ontology concept versions")
  public EntityHistory listVersions(
      @Context final SecurityContext securityContext, @PathParam("id") final UUID id) {
    return listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(operationId = "getOntologyConceptVersion", summary = "Get an ontology concept version")
  public OntologyConcept getVersion(
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @PathParam("version") final String version) {
    return getVersionInternal(securityContext, id, version);
  }

  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deleteOntologyConcept", summary = "Delete an ontology concept")
  public Response delete(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @QueryParam("hardDelete") @DefaultValue("false") final boolean hardDelete) {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteOntologyConceptByName",
      summary = "Delete an ontology definition by name")
  public Response deleteByName(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("fqn") final String fqn,
      @QueryParam("recursive") @DefaultValue("false") final boolean recursive,
      @QueryParam("hardDelete") @DefaultValue("false") final boolean hardDelete) {
    return super.deleteByName(uriInfo, securityContext, fqn, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(operationId = "restoreOntologyConcept", summary = "Restore an ontology concept")
  public Response restore(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @Valid final RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private static String user(final SecurityContext securityContext) {
    return securityContext.getUserPrincipal().getName();
  }
}
