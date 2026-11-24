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
import java.io.IOException;
import java.util.UUID;
import org.openmetadata.schema.api.data.CreateRelationshipType;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.RelationshipTypeRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;

@Path("/v1/relationshipTypes")
@Tag(
    name = "Ontology Relationship Types",
    description = "Governed semantic predicates used to connect ontology concepts.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "relationshipTypes", order = 2)
public class RelationshipTypeResource
    extends EntityResource<RelationshipType, RelationshipTypeRepository> {
  public static final String COLLECTION_PATH = "/v1/relationshipTypes/";
  private static final String FIELDS = "owners,reviewers";
  private final RelationshipTypeMapper mapper = new RelationshipTypeMapper();

  public RelationshipTypeResource(final Authorizer authorizer, final Limits limits) {
    super(Entity.RELATIONSHIP_TYPE, authorizer, limits);
  }

  @Override
  public void initialize(final OpenMetadataApplicationConfig config) throws IOException {
    RelationshipTypeSeedLoader.load(repository);
  }

  public static class RelationshipTypeList extends ResultList<RelationshipType> {}

  @GET
  @Operation(operationId = "listRelationshipTypes", summary = "List relationship types")
  public ResultList<RelationshipType> list(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @QueryParam("fields") final String fields,
      @QueryParam("limit") @DefaultValue("50") @Min(0) @Max(1000000) final int limit,
      @QueryParam("before") final String before,
      @QueryParam("after") final String after,
      @QueryParam("include") @DefaultValue("non-deleted") final Include include) {
    final ListFilter filter = new ListFilter(include);
    return listInternal(uriInfo, securityContext, fields, filter, limit, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(operationId = "getRelationshipTypeById", summary = "Get a relationship type")
  public RelationshipType get(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @QueryParam("fields") final String fields,
      @QueryParam("include") @DefaultValue("non-deleted") final Include include) {
    return getInternal(uriInfo, securityContext, id, fields, include, null);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(operationId = "getRelationshipTypeByName", summary = "Get a relationship type by name")
  public RelationshipType getByName(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("fqn") final String fqn,
      @QueryParam("fields") final String fields,
      @QueryParam("include") @DefaultValue("non-deleted") final Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fields, include, null);
  }

  @POST
  @Operation(operationId = "createRelationshipType", summary = "Create a relationship type")
  public Response create(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @Valid final CreateRelationshipType request) {
    final RelationshipType entity = mapper.createToEntity(request, user(securityContext));
    return create(uriInfo, securityContext, entity);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateRelationshipType",
      summary = "Create or update a relationship type")
  public Response createOrUpdate(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @Valid final CreateRelationshipType request) {
    final RelationshipType entity = updateEntity(request, user(securityContext));
    return createOrUpdate(uriInfo, securityContext, entity);
  }

  private RelationshipType updateEntity(final CreateRelationshipType request, final String user) {
    final RelationshipType entity = mapper.createToEntity(request, user);
    final RelationshipType existing = repository.findByNameOrNull(request.getName(), Include.ALL);
    entity.setId(existing == null ? entity.getId() : existing.getId());
    entity.setSystemDefined(existing == null ? false : existing.getSystemDefined());
    entity.setProvider(existing == null ? entity.getProvider() : existing.getProvider());
    return entity;
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(operationId = "patchRelationshipType", summary = "Patch a relationship type")
  public Response patch(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      final JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(operationId = "listRelationshipTypeVersions", summary = "List versions")
  public EntityHistory listVersions(
      @Context final SecurityContext securityContext, @PathParam("id") final UUID id) {
    return listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(operationId = "getRelationshipTypeVersion", summary = "Get a version")
  public RelationshipType getVersion(
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @PathParam("version") final String version) {
    return getVersionInternal(securityContext, id, version);
  }

  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deleteRelationshipType", summary = "Delete a relationship type")
  public Response delete(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @QueryParam("hardDelete") @DefaultValue("false") final boolean hardDelete) {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(operationId = "restoreRelationshipType", summary = "Restore a relationship type")
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
