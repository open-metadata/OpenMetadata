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
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.api.ai.CreateAIGovernanceFramework;
import org.openmetadata.schema.entity.ai.AIFrameworkControl;
import org.openmetadata.schema.entity.ai.AIGovernanceFramework;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.AIFrameworkControlRepository;
import org.openmetadata.service.jdbi3.AIGovernanceFrameworkRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;

@Path("/v1/aiGovernanceFrameworks")
@Tag(
    name = "AI Governance Frameworks",
    description =
        "Workspace-level AI governance frameworks (EU AI Act, NIST AI RMF, ISO/IEC 42001, custom). Enabled frameworks drive per-asset compliance assessments.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "aiGovernanceFrameworks")
public class AIGovernanceFrameworkResource
    extends EntityResource<AIGovernanceFramework, AIGovernanceFrameworkRepository> {
  public static final String COLLECTION_PATH = "/v1/aiGovernanceFrameworks/";
  private final AIGovernanceFrameworkMapper mapper = new AIGovernanceFrameworkMapper();
  static final String FIELDS = "owners,tags,extension,domains,stewards,autoApply";
  private static final int CONTROL_PAGE_SIZE = 1000;

  public AIGovernanceFrameworkResource(Authorizer authorizer, Limits limits) {
    super(Entity.AI_GOVERNANCE_FRAMEWORK, authorizer, limits);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    FrameworkSeedLoader.loadFromResources(repository, FrameworkSeedLoader.controlRepository());
  }

  public static class AIGovernanceFrameworkList extends ResultList<AIGovernanceFramework> {
    /* Required for serde */
  }

  @GET
  @Operation(operationId = "listAIGovernanceFrameworks", summary = "List frameworks")
  public ResultList<AIGovernanceFramework> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @QueryParam("fields") String fieldsParam,
      @QueryParam("limit") @DefaultValue("50") int limitParam,
      @QueryParam("before") String before,
      @QueryParam("after") String after,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, new ListFilter(include), limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(operationId = "getAIGovernanceFrameworkById", summary = "Get a framework by id")
  public AIGovernanceFramework get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @QueryParam("fields") String fieldsParam,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include, null);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(operationId = "getAIGovernanceFrameworkByFqn", summary = "Get a framework by FQN")
  public AIGovernanceFramework getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("fqn") String fqn,
      @QueryParam("fields") String fieldsParam,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include, null);
  }

  @POST
  @Operation(operationId = "createAIGovernanceFramework", summary = "Create a framework")
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateAIGovernanceFramework create) {
    AIGovernanceFramework framework =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());

    return create(uriInfo, securityContext, framework);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateAIGovernanceFramework",
      summary = "Create or update a framework")
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateAIGovernanceFramework create) {
    AIGovernanceFramework framework =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());

    return createOrUpdate(uriInfo, securityContext, framework);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(operationId = "patchAIGovernanceFramework", summary = "Update a framework")
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @GET
  @Path("/{id}/coverage")
  @Operation(
      operationId = "getFrameworkCoverage",
      summary = "Per-control coverage roll-up for a framework",
      description =
          "Returns each control under the framework with its current status / affectedAssetCount / evidenceCount. Computed in-memory from AIFrameworkControl entries + compliance records on in-scope AI assets.")
  public Response getCoverage(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id) {
    AIGovernanceFramework framework =
        getInternal(uriInfo, securityContext, id, "", Include.NON_DELETED, null);
    AIFrameworkControlRepository controlRepo =
        (AIFrameworkControlRepository) Entity.getEntityRepository(Entity.AI_FRAMEWORK_CONTROL);
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    List<AIFrameworkControl> allControls = listControls(uriInfo, controlRepo, "", filter);
    String frameworkName = framework.getName();
    List<AIFrameworkControl> controls = new ArrayList<>();
    for (AIFrameworkControl control : allControls) {
      if (control.getFramework() != null
          && frameworkName.equals(control.getFramework().getName())) {
        controls.add(control);
      }
    }

    Map<String, Object> response = FrameworkCoverageComputer.compute(framework, controls);

    return Response.ok(response).build();
  }

  @POST
  @Path("/{id}/fork")
  @Operation(
      operationId = "forkAIGovernanceFramework",
      summary = "Fork a built-in framework into a Custom framework",
      description =
          "Deep-copies every control from the source framework into a new Custom framework. The new framework starts disabled and uses 'ForkedFrom' as its source.")
  public Response fork(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      ForkRequest request) {
    AIGovernanceFramework source =
        getInternal(uriInfo, securityContext, id, FIELDS, Include.NON_DELETED, null);
    String user = securityContext.getUserPrincipal().getName();
    String newName =
        request != null && request.getName() != null && !request.getName().isBlank()
            ? request.getName()
            : source.getName() + "_fork";

    AIGovernanceFramework copy = new AIGovernanceFramework();
    copy.setId(UUID.randomUUID());
    copy.setName(newName);
    copy.setDisplayName(
        request != null && request.getDisplayName() != null
            ? request.getDisplayName()
            : "Fork of "
                + (source.getDisplayName() == null ? source.getName() : source.getDisplayName()));
    copy.setDescription(source.getDescription());
    copy.setReference(source.getReference());
    copy.setRegion(source.getRegion());
    copy.setSource(org.openmetadata.schema.entity.ai.FrameworkSource.ForkedFrom);
    copy.setForkedFrom(source.getEntityReference());
    copy.setEnabled(false);
    copy.setAssessmentCadence(source.getAssessmentCadence());
    copy.setAutoApply(source.getAutoApply());
    copy.setUpdatedAt(System.currentTimeMillis());
    copy.setUpdatedBy(user);
    AIGovernanceFramework created = repository.create(uriInfo, copy);

    AIFrameworkControlRepository controlRepo =
        (AIFrameworkControlRepository) Entity.getEntityRepository(Entity.AI_FRAMEWORK_CONTROL);
    ListFilter controlFilter = new ListFilter(Include.NON_DELETED);
    if (source.getFullyQualifiedName() != null) {
      controlFilter.addQueryParam("framework", source.getFullyQualifiedName());
    }
    List<AIFrameworkControl> sourceControls =
        listControls(uriInfo, controlRepo, FIELDS, controlFilter);

    List<Map<String, Object>> copiedControls = new ArrayList<>();
    for (AIFrameworkControl original : sourceControls) {
      AIFrameworkControl childCopy = JsonUtils.deepCopy(original, AIFrameworkControl.class);
      childCopy.setId(UUID.randomUUID());
      childCopy.setFullyQualifiedName(null);
      childCopy.setVersion(null);
      childCopy.setFramework(created.getEntityReference());
      childCopy.setUpdatedAt(System.currentTimeMillis());
      childCopy.setUpdatedBy(user);
      controlRepo.create(uriInfo, childCopy);
      Map<String, Object> entry = new LinkedHashMap<>();
      entry.put("code", childCopy.getCode());
      entry.put("name", childCopy.getName());
      copiedControls.add(entry);
    }

    Map<String, Object> response = new LinkedHashMap<>();
    response.put("framework", created);
    response.put("copiedControlsCount", copiedControls.size());

    return Response.ok(response).build();
  }

  private List<AIFrameworkControl> listControls(
      UriInfo uriInfo, AIFrameworkControlRepository controlRepo, String fields, ListFilter filter) {
    List<AIFrameworkControl> result = new ArrayList<>();
    String after = null;
    do {
      ResultList<AIFrameworkControl> page =
          controlRepo.listAfter(
              uriInfo, controlRepo.getFields(fields), filter, CONTROL_PAGE_SIZE, after);
      result.addAll(page.getData());
      after = page.getPaging() == null ? null : page.getPaging().getAfter();
    } while (after != null);

    return result;
  }

  public static class ForkRequest {
    private String name;
    private String displayName;

    public String getName() {
      return name;
    }

    public void setName(String name) {
      this.name = name;
    }

    public String getDisplayName() {
      return displayName;
    }

    public void setDisplayName(String displayName) {
      this.displayName = displayName;
    }
  }

  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deleteAIGovernanceFramework", summary = "Delete a framework")
  public Response deleteById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @QueryParam("hardDelete") @DefaultValue("false") boolean hardDelete,
      @QueryParam("recursive") @DefaultValue("false") boolean recursive) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }
}
