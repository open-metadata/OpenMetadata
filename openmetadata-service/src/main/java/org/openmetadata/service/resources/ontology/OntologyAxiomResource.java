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
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.api.data.OntologyProfileReport;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.OntologyAxiomRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;

@Path("/v1/ontologyAxioms")
@Tag(name = "Ontology Axioms", description = "Governed OWL axioms authored in Ontology Studio.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "ontologyAxioms", order = 3)
public class OntologyAxiomResource extends EntityResource<OntologyAxiom, OntologyAxiomRepository> {
  public static final String COLLECTION_PATH = "/v1/ontologyAxioms/";
  private final OntologyAxiomMapper mapper = new OntologyAxiomMapper();

  public OntologyAxiomResource(final Authorizer authorizer, final Limits limits) {
    super(Entity.ONTOLOGY_AXIOM, authorizer, limits);
  }

  public static class OntologyAxiomList extends ResultList<OntologyAxiom> {}

  @GET
  @Operation(operationId = "listOntologyAxioms", summary = "List ontology axioms")
  public ResultList<OntologyAxiom> list(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @QueryParam("fields") final String fields,
      @QueryParam("glossary") final String glossary,
      @QueryParam("limit") @DefaultValue("50") @Min(0) @Max(1000000) final int limit,
      @QueryParam("before") final String before,
      @QueryParam("after") final String after,
      @QueryParam("include") @DefaultValue("non-deleted") final Include include) {
    final ListFilter filter = ontologyFilter(include, glossary);
    return listInternal(uriInfo, securityContext, fields, filter, limit, before, after);
  }

  private static ListFilter ontologyFilter(final Include include, final String glossary) {
    final ListFilter filter = new ListFilter(include);
    if (glossary != null) {
      final EntityReference reference =
          Entity.getEntityReferenceByName(Entity.GLOSSARY, glossary, Include.NON_DELETED);
      filter.addQueryParam("glossaryId", reference.getId().toString());
    }
    return filter;
  }

  @GET
  @Path("/{id}")
  @Operation(operationId = "getOntologyAxiomById", summary = "Get an ontology axiom")
  public OntologyAxiom get(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @QueryParam("fields") final String fields,
      @QueryParam("include") @DefaultValue("non-deleted") final Include include) {
    return getInternal(uriInfo, securityContext, id, fields, include, null);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(operationId = "getOntologyAxiomByName", summary = "Get an ontology axiom by name")
  public OntologyAxiom getByName(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("fqn") final String fqn,
      @QueryParam("fields") final String fields,
      @QueryParam("include") @DefaultValue("non-deleted") final Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fields, include, null);
  }

  @POST
  @Operation(operationId = "createOntologyAxiom", summary = "Create an ontology axiom")
  public Response create(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @Valid final CreateOntologyAxiom request) {
    final OntologyAxiom entity = mapper.createToEntity(request, user(securityContext));
    return create(uriInfo, securityContext, entity);
  }

  @POST
  @Path("/validate")
  @Operation(operationId = "validateOntologyAxiom", summary = "Validate an OWL axiom")
  public OntologyProfileReport validate(
      @Context final SecurityContext securityContext, @Valid final CreateOntologyAxiom request) {
    final OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.CREATE);
    authorizer.authorize(securityContext, operationContext, getResourceContext());
    final OntologyAxiom entity = mapper.createToEntity(request, user(securityContext));
    return repository.validate(entity);
  }

  @PUT
  @Operation(operationId = "createOrUpdateOntologyAxiom", summary = "Create or update an axiom")
  public Response createOrUpdate(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @Valid final CreateOntologyAxiom request) {
    final OntologyAxiom entity = mapper.createToEntity(request, user(securityContext));
    return createOrUpdate(uriInfo, securityContext, entity);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(operationId = "patchOntologyAxiom", summary = "Patch an ontology axiom")
  public Response patch(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      final JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(operationId = "listOntologyAxiomVersions", summary = "List axiom versions")
  public EntityHistory listVersions(
      @Context final SecurityContext securityContext, @PathParam("id") final UUID id) {
    return listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(operationId = "getOntologyAxiomVersion", summary = "Get an axiom version")
  public OntologyAxiom getVersion(
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @PathParam("version") final String version) {
    return getVersionInternal(securityContext, id, version);
  }

  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deleteOntologyAxiom", summary = "Delete an ontology axiom")
  public Response delete(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @QueryParam("hardDelete") @DefaultValue("false") final boolean hardDelete) {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(operationId = "restoreOntologyAxiom", summary = "Restore an ontology axiom")
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
