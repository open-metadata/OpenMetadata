/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.policies;

import com.google.inject.Inject;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.openmetadata.catalog.api.policies.CreatePolicy;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.PolicyRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.CatalogAuthorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

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
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Path("/v1/policies")
@Api(value = "Policies collection", tags = "Policies collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "policies")
public class PolicyResource {
    public static final String POLICY_COLLECTION_PATH = "v1/policies/";
    private final PolicyRepository dao;
    private final CatalogAuthorizer authorizer;

    public static void addHref(UriInfo uriInfo, EntityReference ref) {
        ref.withHref(RestUtil.getHref(uriInfo, POLICY_COLLECTION_PATH, ref.getId()));
    }

    public static List<Policy> addHref(UriInfo uriInfo, List<Policy> policies) {
        Optional.ofNullable(policies).orElse(Collections.emptyList()).forEach(i -> addHref(uriInfo, i));
        return policies;
    }

    public static Policy addHref(UriInfo uriInfo, Policy policy) {
        policy.setHref(RestUtil.getHref(uriInfo, POLICY_COLLECTION_PATH, policy.getId()));
        EntityUtil.addHref(uriInfo, policy.getOwner());
        return policy;
    }

    @Inject
    public PolicyResource(CollectionDAO dao, CatalogAuthorizer authorizer) {
        Objects.requireNonNull(dao, "PolicyRepository must not be null");
        this.dao = new PolicyRepository(dao);
        this.authorizer = authorizer;
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

    static final String FIELDS = "displayName,description,owner,policyUrl,enabled";
    public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replaceAll(" ", "")
            .split(","));

    @GET
    @Valid
    @Operation(summary = "List Policies", tags = "policies",
            description = "Get a list of policies. Use `fields` parameter to get only necessary fields. " +
                    "Use cursor-based pagination to limit the number " +
                    "entries in the list using `limit` and `before` or `after` query params.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "List of policies",
                            content = @Content(mediaType = "application/json",
                                    schema = @Schema(implementation = PolicyList.class)))
            })
    public ResultList<Policy> list(@Context UriInfo uriInfo,
                                   @Context SecurityContext securityContext,
                                   @Parameter(description = "Fields requested in the returned resource",
                                           schema = @Schema(type = "string", example = FIELDS))
                                   @QueryParam("fields") String fieldsParam,
                                   @Parameter(description = "Limit the number policies returned. (1 to 1000000, " +
                                           "default = 10)")
                                   @DefaultValue("10")
                                   @Min(1)
                                   @Max(1000000)
                                   @QueryParam("limit") int limitParam,
                                   @Parameter(description = "Returns list of policies before this cursor",
                                           schema = @Schema(type = "string"))
                                   @QueryParam("before") String before,
                                   @Parameter(description = "Returns list of policies after this cursor",
                                           schema = @Schema(type = "string"))
                                   @QueryParam("after") String after
    ) throws IOException, GeneralSecurityException, ParseException {
        RestUtil.validateCursors(before, after);
        Fields fields = new Fields(FIELD_LIST, fieldsParam);

        ResultList<Policy> policies;
        if (before != null) { // Reverse paging
            policies = dao.listBefore(fields, null, limitParam, before); // Ask for one extra entry
        } else { // Forward paging or first page
            policies = dao.listAfter(fields, null, limitParam, after);
        }
        addHref(uriInfo, policies.getData());
        return policies;
    }

    @GET
    @Path("/{id}")
    @Operation(summary = "Get a policy", tags = "policies",
            description = "Get a policy by `id`.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "The policy",
                            content = @Content(mediaType = "application/json",
                                    schema = @Schema(implementation = Policy.class))),
                    @ApiResponse(responseCode = "404", description = "Policy for instance {id} is not found")
            })
    public Policy get(@Context UriInfo uriInfo,
                      @Context SecurityContext securityContext,
                      @PathParam("id") String id,
                      @Parameter(description = "Fields requested in the returned resource",
                              schema = @Schema(type = "string", example = FIELDS))
                      @QueryParam("fields") String fieldsParam) throws IOException, ParseException {
        Fields fields = new Fields(FIELD_LIST, fieldsParam);
        return addHref(uriInfo, dao.get(id, fields));
    }

    @GET
    @Path("/name/{fqn}")
    @Operation(summary = "Get a policy by name", tags = "policies",
            description = "Get a policy by fully qualified name.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "The policy",
                            content = @Content(mediaType = "application/json",
                                    schema = @Schema(implementation = Policy.class))),
                    @ApiResponse(responseCode = "404", description = "Policy for instance {id} is not found")
            })
    public Policy getByName(@Context UriInfo uriInfo, @PathParam("fqn") String fqn,
                            @Context SecurityContext securityContext,
                            @Parameter(description = "Fields requested in the returned resource",
                                    schema = @Schema(type = "string", example = FIELDS))
                            @QueryParam("fields") String fieldsParam) throws IOException, ParseException {
        Fields fields = new Fields(FIELD_LIST, fieldsParam);
        Policy policy = dao.getByName(fqn, fields);
        return addHref(uriInfo, policy);
    }


    @POST
    @Operation(summary = "Create a policy", tags = "policies",
            description = "Create a new policy.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "The policy",
                            content = @Content(mediaType = "application/json",
                                    schema = @Schema(implementation = CreatePolicy.class))),
                    @ApiResponse(responseCode = "400", description = "Bad request")
            })
    public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext,
                           @Valid CreatePolicy create) throws IOException, ParseException {
        SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
        Policy policy = new Policy()
                .withId(UUID.randomUUID())
                .withName(create.getName())
                .withDisplayName(create.getDisplayName())
                .withDescription(create.getDescription())
                .withOwner(create.getOwner())
                .withPolicyUrl(create.getPolicyUrl())
                .withPolicyType(create.getPolicyType())
                .withUpdatedBy(securityContext.getUserPrincipal().getName())
                .withUpdatedAt(new Date());
        policy = addHref(uriInfo, dao.create(policy));
        return Response.created(policy.getHref()).entity(policy).build();
    }

    @PATCH
    @Path("/{id}")
    @Operation(summary = "Update a policy", tags = "policies",
            description = "Update an existing policy using JsonPatch.",
            externalDocs = @ExternalDocumentation(description = "JsonPatch RFC",
                    url = "https://tools.ietf.org/html/rfc6902"))
    @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
    public Policy updateDescription(@Context UriInfo uriInfo,
                                    @Context SecurityContext securityContext,
                                    @PathParam("id") String id,
                                    @RequestBody(description = "JsonPatch with array of operations",
                                            content = @Content(mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                                                    examples = {@ExampleObject("[" +
                                                            "{op:remove, path:/a}," +
                                                            "{op:add, path: /b, value: val}" +
                                                            "]")}))
                                            JsonPatch patch) throws IOException, ParseException {
        Fields fields = new Fields(FIELD_LIST, FIELDS);
        Policy policy = dao.get(id, fields);
        SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext, dao.getOwnerReference(policy));
        policy = dao.patch(UUID.fromString(id), securityContext.getUserPrincipal().getName(), patch);
        return addHref(uriInfo, policy);
    }

    @PUT
    @Operation(summary = "Create or update a policy", tags = "policies",
            description = "Create a new policy, if it does not exist or update an existing policy.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "The policy",
                            content = @Content(mediaType = "application/json",
                                    schema = @Schema(implementation = Policy.class))),
                    @ApiResponse(responseCode = "400", description = "Bad request")
            })
    public Response createOrUpdate(@Context UriInfo uriInfo,
                                   @Context SecurityContext securityContext,
                                   @Valid CreatePolicy create) throws IOException, ParseException {
        Policy policy = new Policy()
                .withId(UUID.randomUUID())
                .withName(create.getName())
                .withDisplayName(create.getDisplayName())
                .withDescription(create.getDescription())
                .withOwner(create.getOwner())
                .withPolicyUrl(create.getPolicyUrl())
                .withPolicyType(create.getPolicyType())
                .withUpdatedBy(securityContext.getUserPrincipal().getName())
                .withUpdatedAt(new Date());

        PutResponse<Policy> response = dao.createOrUpdate(policy);
        policy = addHref(uriInfo, response.getEntity());
        return Response.status(response.getStatus()).entity(policy).build();
    }

    @DELETE
    @Path("/{id}")
    @Operation(summary = "Delete a Policy", tags = "policy",
            description = "Delete a policy by `id`.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "OK"),
                    @ApiResponse(responseCode = "404", description = "policy for instance {id} is not found")
            })
    public Response delete(@Context UriInfo uriInfo, @PathParam("id") String id) {
        dao.delete(UUID.fromString(id));
        return Response.ok().build();
    }
}
