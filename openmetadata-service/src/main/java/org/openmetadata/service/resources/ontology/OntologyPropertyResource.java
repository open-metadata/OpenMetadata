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
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.OntologyPropertyRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;

@Path("/v1/ontologyProperties")
@Tag(
    name = "Ontology Properties",
    description = "Independent ontology definitions governed through approval workflows.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "ontologyProperties", order = 3)
public class OntologyPropertyResource
    extends EntityResource<OntologyProperty, OntologyPropertyRepository> {
  public static final String COLLECTION_PATH = "/v1/ontologyProperties/";
  private final OntologyPropertyMapper mapper = new OntologyPropertyMapper();

  public OntologyPropertyResource(final Authorizer authorizer, final Limits limits) {
    super(Entity.ONTOLOGY_PROPERTY, authorizer, limits);
  }

  public static class OntologyPropertyList extends ResultList<OntologyProperty> {}

  @GET
  @Operation(operationId = "listOntologyPropertys", summary = "List ontology property definitions")
  public ResultList<OntologyProperty> list(
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
  @Operation(operationId = "getOntologyPropertyById", summary = "Get an ontology property")
  public OntologyProperty get(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @QueryParam("fields") final String fields,
      @QueryParam("include") @DefaultValue("non-deleted") final Include include) {
    return getInternal(uriInfo, securityContext, id, fields, include, null);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getOntologyPropertyByName",
      summary = "Get an ontology property by name")
  public OntologyProperty getByName(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("fqn") final String fqn,
      @QueryParam("fields") final String fields,
      @QueryParam("include") @DefaultValue("non-deleted") final Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fields, include, null);
  }

  @POST
  @Operation(operationId = "createOntologyProperty", summary = "Create an ontology property")
  public Response create(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @Valid final CreateOntologyProperty request) {
    final OntologyProperty entity = mapper.createToEntity(request, user(securityContext));
    return create(uriInfo, securityContext, entity);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateOntologyProperty",
      summary = "Create or update an ontology property")
  public Response createOrUpdate(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @Valid final CreateOntologyProperty request) {
    final OntologyProperty entity = mapper.createToEntity(request, user(securityContext));
    return createOrUpdate(uriInfo, securityContext, entity);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(operationId = "patchOntologyProperty", summary = "Patch an ontology property")
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
      operationId = "listOntologyPropertyVersions",
      summary = "List ontology property versions")
  public EntityHistory listVersions(
      @Context final SecurityContext securityContext, @PathParam("id") final UUID id) {
    return listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getOntologyPropertyVersion",
      summary = "Get an ontology property version")
  public OntologyProperty getVersion(
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @PathParam("version") final String version) {
    return getVersionInternal(securityContext, id, version);
  }

  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deleteOntologyProperty", summary = "Delete an ontology property")
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
      operationId = "deleteOntologyPropertyByName",
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
  @Operation(operationId = "restoreOntologyProperty", summary = "Restore an ontology property")
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
