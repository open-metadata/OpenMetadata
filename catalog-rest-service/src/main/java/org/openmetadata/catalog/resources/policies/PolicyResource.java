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

package org.openmetadata.catalog.resources.policies;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.PATCH;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.policies.CreatePolicy;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.PolicyRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.DeleteResponse;
import org.openmetadata.catalog.util.RestUtil.PatchResponse;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/policies")
@Api(value = "Policies collection", tags = "Policies collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "policies")
public class PolicyResource {
  public static final String COLLECTION_PATH = "v1/policies/";
  private final PolicyRepository dao;
  private final Authorizer authorizer;

  public static ResultList<Policy> addHref(UriInfo uriInfo, ResultList<Policy> policies) {
    Optional.ofNullable(policies.getData()).orElse(Collections.emptyList()).forEach(i -> addHref(uriInfo, i));
    return policies;
  }

  public static Policy addHref(UriInfo uriInfo, Policy policy) {
    Entity.withHref(uriInfo, policy.getOwner());
    return policy;
  }

  public PolicyResource(CollectionDAO dao, Authorizer authorizer) {
    Objects.requireNonNull(dao, "PolicyRepository must not be null");
    this.dao = new PolicyRepository(dao);
    this.authorizer = authorizer;
  }

  @SuppressWarnings("unused") // Method is used for reflection
  public void initialize(CatalogApplicationConfig config) throws IOException {
    // Set up the PolicyEvaluator, before loading seed data.
    PolicyEvaluator policyEvaluator = PolicyEvaluator.getInstance();
    policyEvaluator.setPolicyRepository(dao);
    // Load any existing rules from database, before loading seed data.
    policyEvaluator.refreshRules();
    dao.initSeedDataFromResources();
  }

  public static class PolicyList extends ResultList<Policy> {
    @SuppressWarnings("unused")
    PolicyList() {
      // Empty constructor needed for deserialization
    }

    public PolicyList(List<Policy> data, String beforeCursor, String afterCursor, int total)
        throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  public static final String FIELDS = "displayName,description,owner,policyUrl,enabled,rules,location";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replace(" ", "").split(","));

  @GET
  @Valid
  @Operation(
      summary = "List Policies",
      tags = "policies",
      description =
          "Get a list of policies. Use `fields` parameter to get only necessary fields. "
              + "Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of policies",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = PolicyList.class)))
      })
  public ResultList<Policy> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number policies returned. (1 to 1000000, " + "default = 10)")
          @DefaultValue("10")
          @Min(1)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of policies before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of policies after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException, GeneralSecurityException, ParseException {
    RestUtil.validateCursors(before, after);
    Fields fields = new Fields(FIELD_LIST, fieldsParam);

    ResultList<Policy> policies;
    if (before != null) { // Reverse paging
      policies = dao.listBefore(uriInfo, fields, null, limitParam, before, include); // Ask for one extra entry
    } else { // Forward paging or first page
      policies = dao.listAfter(uriInfo, fields, null, limitParam, after, include);
    }
    return addHref(uriInfo, policies);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a policy",
      tags = "policies",
      description = "Get a policy by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The policy",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Policy.class))),
        @ApiResponse(responseCode = "404", description = "Policy for instance {id} is not found")
      })
  public Policy get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
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
          Include include)
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.get(uriInfo, id, fields, include));
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      summary = "Get a policy by name",
      tags = "policies",
      description = "Get a policy by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The policy",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Policy.class))),
        @ApiResponse(responseCode = "404", description = "Policy for instance {id} is not found")
      })
  public Policy getByName(
      @Context UriInfo uriInfo,
      @PathParam("fqn") String fqn,
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
          Include include)
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    Policy policy = dao.getByName(uriInfo, fqn, fields, include);
    return addHref(uriInfo, policy);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      summary = "List policy versions",
      tags = "policies",
      description = "Get a list of all the versions of a policy identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of policy versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "policy Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException, ParseException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      summary = "Get a version of the policy",
      tags = "policies",
      description = "Get a version of the policy by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "policy",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Policy.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Policy for instance {id} and version {version} is" + " " + "not found")
      })
  public Policy getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "policy Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "policy version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException, ParseException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(
      summary = "Create a policy",
      tags = "policies",
      description = "Create a new policy.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The policy",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreatePolicy.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreatePolicy create)
      throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Policy policy = getPolicy(securityContext, create);
    policy = addHref(uriInfo, dao.create(uriInfo, policy));
    return Response.created(policy.getHref()).entity(policy).build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      summary = "Update a policy",
      tags = "policies",
      description = "Update an existing policy using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[" + "{op:remove, path:/a}," + "{op:add, path: /b, value: val}" + "]")
                      }))
          JsonPatch patch)
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, FIELDS);
    Policy policy = dao.get(uriInfo, id, fields);
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext, dao.getOwnerReference(policy));

    PatchResponse<Policy> response =
        dao.patch(uriInfo, UUID.fromString(id), securityContext.getUserPrincipal().getName(), patch);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @PUT
  @Operation(
      summary = "Create or update a policy",
      tags = "policies",
      description = "Create a new policy, if it does not exist or update an existing policy.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The policy",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Policy.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreatePolicy create)
      throws IOException, ParseException {
    Policy policy = getPolicy(securityContext, create);
    PutResponse<Policy> response = dao.createOrUpdate(uriInfo, policy);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      summary = "Delete a Policy",
      tags = "policy",
      description = "Delete a policy by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "policy for instance {id} is not found")
      })
  public Response delete(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @PathParam("id") String id)
      throws IOException {
    DeleteResponse<Policy> response = dao.delete(securityContext.getUserPrincipal().getName(), id);
    return response.toResponse();
  }

  private Policy getPolicy(SecurityContext securityContext, CreatePolicy create) {
    Policy policy =
        new Policy()
            .withId(UUID.randomUUID())
            .withName(create.getName())
            .withDisplayName(create.getDisplayName())
            .withDescription(create.getDescription())
            .withOwner(create.getOwner())
            .withPolicyUrl(create.getPolicyUrl())
            .withPolicyType(create.getPolicyType())
            .withUpdatedBy(securityContext.getUserPrincipal().getName())
            .withUpdatedAt(System.currentTimeMillis())
            .withRules(create.getRules())
            .withEnabled(create.getEnabled());
    if (create.getLocation() != null) {
      policy = policy.withLocation(new EntityReference().withId(create.getLocation()));
    }
    return policy;
  }
}
