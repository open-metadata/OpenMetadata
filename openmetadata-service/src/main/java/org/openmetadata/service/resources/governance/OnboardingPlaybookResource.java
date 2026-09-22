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
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
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
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.governance.CreateOnboardingPlaybook;
import org.openmetadata.schema.entity.governance.OnboardingPlaybook;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.onboarding.OnboardingConfigurationValidator;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.OnboardingPlaybookRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Slf4j
@Path("/v1/governance/onboardingPlaybooks")
@Tag(
    name = "OnboardingPlaybooks",
    description =
        "One playbook per asset type. It declares the lifecycle an asset moves through and what "
            + "must be true to leave each stage. Creation-gate checks are enforced at the API and "
            + "UI layers; every later gate hands off to a governance workflow, which owns the "
            + "approval and the resulting status change.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "onboardingPlaybooks", order = 6)
public class OnboardingPlaybookResource
    extends EntityResource<OnboardingPlaybook, OnboardingPlaybookRepository> {
  public static final String COLLECTION_PATH = "/v1/governance/onboardingPlaybooks/";
  static final String FIELDS = "owners,entityType,onboarding,intakeForm";
  private final OnboardingPlaybookMapper mapper = new OnboardingPlaybookMapper();

  public OnboardingPlaybookResource(Authorizer authorizer, Limits limits) {
    super(Entity.ONBOARDING_PLAYBOOK, authorizer, limits);
  }

  public static class OnboardingPlaybookList extends ResultList<OnboardingPlaybook> {
    /* Swagger model */
  }

  @GET
  @Operation(
      operationId = "listOnboardingPlaybooks",
      summary = "List onboarding playbooks",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Paginated list of onboarding playbooks",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = OnboardingPlaybookList.class)))
      })
  public ResultList<OnboardingPlaybook> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number of playbooks returned")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Offset for pagination") @QueryParam("before") String before,
      @Parameter(description = "Offset for pagination") @QueryParam("after") String after,
      @Parameter(description = "Include soft-deleted entities")
          @DefaultValue("non-deleted")
          @QueryParam("include")
          Include include) {
    return listInternal(
        uriInfo, securityContext, fieldsParam, new ListFilter(include), limitParam, before, after);
  }

  @GET
  @Path("/fields/{entityType}")
  @Operation(
      operationId = "listOnboardingFields",
      summary = "List the fields a playbook can require on an asset type",
      description =
          "Native fields resolved from the asset type itself, so a check can only ever be added "
              + "for a field the playbook validator will accept. Custom properties are listed by "
              + "the custom-property API and are addressed as `extension.<name>`.")
  public List<String> fields(
      @Context SecurityContext securityContext, @PathParam("entityType") String entityType) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC),
        new ResourceContext<>(entityType));
    return OnboardingConfigurationValidator.onboardingFields(entityType);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getOnboardingPlaybookByID",
      summary = "Get an onboarding playbook by Id")
  public OnboardingPlaybook get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Include soft-deleted entities")
          @DefaultValue("non-deleted")
          @QueryParam("include")
          Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getOnboardingPlaybookByName",
      summary = "Get an onboarding playbook by name")
  public OnboardingPlaybook getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("name") String name,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Include soft-deleted entities")
          @DefaultValue("non-deleted")
          @QueryParam("include")
          Include include) {
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }

  @GET
  @Path("/entityType/{entityType}")
  @Operation(
      operationId = "getOnboardingPlaybookByEntityType",
      summary = "Get the playbook that governs an asset type",
      description =
          "Returns the single playbook configured for this asset type, or 404 if none is.")
  public OnboardingPlaybook getByEntityType(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("entityType") String entityType,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam) {
    OnboardingPlaybook playbook = repository.findEnabledForEntityType(entityType);
    if (playbook == null) {
      throw new jakarta.ws.rs.NotFoundException(
          String.format("No onboarding playbook is configured for %s", entityType));
    }
    return fieldsParam == null
        ? playbook
        : repository.setFieldsInternal(playbook, getFields(fieldsParam));
  }

  @POST
  @Operation(operationId = "createOnboardingPlaybook", summary = "Create an onboarding playbook")
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateOnboardingPlaybook create) {
    OnboardingPlaybook playbook =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, playbook);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateOnboardingPlaybook",
      summary = "Create or update an onboarding playbook")
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateOnboardingPlaybook create) {
    OnboardingPlaybook playbook =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, playbook);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(operationId = "patchOnboardingPlaybook", summary = "Update an onboarding playbook")
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Valid JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deleteOnboardingPlaybook", summary = "Delete an onboarding playbook")
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id) {
    return delete(uriInfo, securityContext, id, false, true);
  }
}
