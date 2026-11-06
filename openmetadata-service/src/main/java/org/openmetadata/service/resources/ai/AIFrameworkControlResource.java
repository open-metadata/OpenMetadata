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
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
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
import org.openmetadata.schema.api.ai.CreateAIFrameworkControl;
import org.openmetadata.schema.entity.ai.AIFrameworkControl;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AIFrameworkControlRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;

@Path("/v1/aiFrameworkControls")
@Tag(
    name = "AI Framework Controls",
    description = "Controls within an AI Governance Framework (e.g. EU AI Act Article 10).")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "aiFrameworkControls")
public class AIFrameworkControlResource
    extends EntityResource<AIFrameworkControl, AIFrameworkControlRepository> {
  public static final String COLLECTION_PATH = "/v1/aiFrameworkControls/";
  private final AIFrameworkControlMapper mapper = new AIFrameworkControlMapper();
  static final String FIELDS = "owners,tags,extension,domains,framework,evidenceRequirements";

  public AIFrameworkControlResource(Authorizer authorizer, Limits limits) {
    super(Entity.AI_FRAMEWORK_CONTROL, authorizer, limits);
  }

  public static class AIFrameworkControlList extends ResultList<AIFrameworkControl> {
    /* Required for serde */
  }

  @GET
  @Operation(operationId = "listAIFrameworkControls", summary = "List controls")
  public ResultList<AIFrameworkControl> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @QueryParam("fields") String fieldsParam,
      @QueryParam("limit") @DefaultValue("50") int limitParam,
      @QueryParam("before") String before,
      @QueryParam("after") String after,
      @QueryParam("framework") String frameworkFqn,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    ListFilter filter = new ListFilter(include);
    if (frameworkFqn != null && !frameworkFqn.isBlank()) {
      filter.addQueryParam("framework", frameworkFqn);
    }
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(operationId = "getAIFrameworkControlById", summary = "Get a control by id")
  public AIFrameworkControl get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @QueryParam("fields") String fieldsParam,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include, null);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(operationId = "getAIFrameworkControlByFqn", summary = "Get a control by FQN")
  public AIFrameworkControl getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("fqn") String fqn,
      @QueryParam("fields") String fieldsParam,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include, null);
  }

  @POST
  @Operation(operationId = "createAIFrameworkControl", summary = "Create a control")
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateAIFrameworkControl create) {
    AIFrameworkControl control =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());

    return create(uriInfo, securityContext, control);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateAIFrameworkControl",
      summary = "Create or update a control")
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateAIFrameworkControl create) {
    AIFrameworkControl control =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());

    return createOrUpdate(uriInfo, securityContext, control);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(operationId = "patchAIFrameworkControl", summary = "Update a control")
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deleteAIFrameworkControl", summary = "Delete a control")
  public Response deleteById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @QueryParam("hardDelete") @DefaultValue("false") boolean hardDelete,
      @QueryParam("recursive") @DefaultValue("false") boolean recursive) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }
}
