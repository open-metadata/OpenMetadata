/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.resources.policies;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
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
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Function;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ResourceDescriptor;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.FunctionList;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.ResourceRegistry;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.RuleEvaluator;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/policies")
@Tag(
    name = "Policies",
    description =
        "A `Policy` defines control that needs to be applied across different Data Entities.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "policies", order = 0, requiredForOps = true)
public class PolicyResource extends EntityResource<Policy, PolicyRepository> {
  private final PolicyMapper mapper = new PolicyMapper();
  public static final String COLLECTION_PATH = "v1/policies/";
  public static final String FIELDS = "owners,location,teams,roles";

  @Override
  public Policy addHref(UriInfo uriInfo, Policy policy) {
    super.addHref(uriInfo, policy);
    Entity.withHref(uriInfo, policy.getTeams());
    Entity.withHref(uriInfo, policy.getRoles());
    return policy;
  }

  public PolicyResource(Authorizer authorizer, Limits limits) {
    super(Entity.POLICY, authorizer, limits);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("location,teams,roles", MetadataOperation.VIEW_BASIC);
    return null;
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    // Load any existing rules from database, before loading seed data.
    repository.initSeedDataFromResources();
  }

  @Override
  public void upgrade() {
    // 1.2.0 upgrade only - Add Create operation to OrganizationPolicy Owner Rule
    try {
      Policy organizationPolicy = repository.findByName("OrganizationPolicy", Include.NON_DELETED);
      String originalJson = JsonUtils.pojoToJson(organizationPolicy);
      for (Rule rule : organizationPolicy.getRules()) {
        if (rule.getName().equals("OrganizationPolicy-Owner-Rule")
            && !rule.getOperations().contains(MetadataOperation.ALL)) {
          rule.getOperations().clear();
          rule.getOperations().add(MetadataOperation.ALL);
        }
      }
      String updatedJson = JsonUtils.pojoToJson(organizationPolicy);
      JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);
      repository.patch(null, organizationPolicy.getId(), "admin", patch);
    } catch (Exception e) {
      LOG.error("Failed to update OrganizationPolicy", e);
    }
  }

  public static class PolicyList extends ResultList<Policy> {
    /* Required for serde */
  }

  public static class ResourceDescriptorList extends ResultList<ResourceDescriptor> {
    /* Required for serde */
  }

  @GET
  @Valid
  @Operation(
      operationId = "listPolicies",
      summary = "List policies",
      description =
          "Get a list of policies. Use `fields` parameter to get only necessary fields. "
              + "Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of policies",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PolicyList.class)))
      })
  public ResultList<Policy> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number policies returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of policies before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of policies after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include);
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getPolicyByID",
      summary = "Get a policy by id",
      description = "Get a policy by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The policy",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Policy.class))),
        @ApiResponse(responseCode = "404", description = "Policy for instance {id} is not found")
      })
  public Policy get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the policy", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getPolicyByFQN",
      summary = "Get a policy by fully qualified name",
      description = "Get a policy by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The policy",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Policy.class))),
        @ApiResponse(responseCode = "404", description = "Policy for instance {fqn} is not found")
      })
  public Policy getByName(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fully qualified name of the policy",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllPolicyVersion",
      summary = "List policy versions",
      description = "Get a list of all the versions of a policy identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of policy versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the policy", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificPolicyVersion",
      summary = "Get a version of the policy by Id",
      description = "Get a version of the policy by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "policy",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Policy.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Policy for instance {id} and version {version} is not found")
      })
  public Policy getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the policy", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "policy version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @GET
  @Path("/resources")
  @Operation(
      operationId = "listPolicyResources",
      summary = "Get list of policy resources used in authoring a policy",
      description = "Get list of policy resources used in authoring a policy.")
  public ResultList<ResourceDescriptor> listPolicyResources(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    return new ResultList<>(ResourceRegistry.listResourceDescriptors());
  }

  @GET
  @Path("/functions")
  @Operation(
      operationId = "listPolicyFunctions",
      summary = "Get list of policy functions used in authoring conditions in policy rules.",
      description = "Get list of policy functions used in authoring conditions in policy rules.")
  public ResultList<Function> listPolicyFunctions(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    return new FunctionList(CollectionRegistry.getInstance().getFunctions(RuleEvaluator.class));
  }

  @POST
  @Operation(
      operationId = "createPolicy",
      summary = "Create a policy",
      description = "Create a new policy.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The policy",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Policy.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreatePolicy create) {
    Policy policy = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, policy);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchPolicy",
      summary = "Update a policy",
      description = "Update an existing policy using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the policy", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchPolicy",
      summary = "Update a policy by name.",
      description = "Update an existing policy using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the policy", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, fqn, patch);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdatePolicy",
      summary = "Create or update a policy",
      description = "Create a new policy, if it does not exist or update an existing policy.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The policy",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Policy.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreatePolicy create) {
    Policy policy = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, policy);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deletePolicy",
      summary = "Delete a policy by Id",
      description = "Delete a policy by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "policy for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the policy", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deletePolicyAsync",
      summary = "Asynchronously delete a policy by Id",
      description = "Asynchronously delete a policy by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "policy for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the policy", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deletePolicyByFQN",
      summary = "Delete a policy by fully qualified name",
      description = "Delete a policy by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "policy for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Fully qualified name of the policy",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted policy",
      description = "Restore a soft deleted policy.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Policy ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Policy.class)))
      })
  public Response restorePolicy(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @GET
  @Path("/validation/condition/{expression}")
  @Operation(
      operationId = "validateCondition",
      summary = "Validate a given condition",
      description = "Validate a given condition expression used in authoring rules.",
      responses = {
        @ApiResponse(responseCode = "204", description = "No value is returned"),
        @ApiResponse(responseCode = "400", description = "Invalid expression")
      })
  public void validateCondition(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Expression of validating rule", schema = @Schema(type = "string"))
          @PathParam("expression")
          String expression) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContext());
    CompiledRule.validateExpression(expression, Boolean.class);
  }
}
