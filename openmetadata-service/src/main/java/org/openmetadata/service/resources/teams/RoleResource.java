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

package org.openmetadata.service.resources.teams;

import io.dropwizard.jersey.PATCH;
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
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Path("/v1/roles")
@Tag(
    name = "Roles",
    description =
        "A `Role` is a collection of `Policies` that provides access control. A user or a "
            + "team can be assigned one or multiple roles that provide privileges to a user and members of a team to perform the job function.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(
    name = "roles",
    order = 1,
    requiredForOps = true) // Load roles after PolicyResource are loaded at Order 0
@Slf4j
public class RoleResource extends EntityResource<Role, RoleRepository> {
  private final RoleMapper mapper = new RoleMapper();
  public static final String COLLECTION_PATH = "/v1/roles/";
  public static final String FIELDS = "policies,teams,users";

  @Override
  public Role addHref(UriInfo uriInfo, Role role) {
    super.addHref(uriInfo, role);
    Entity.withHref(uriInfo, role.getPolicies());
    Entity.withHref(uriInfo, role.getTeams());
    Entity.withHref(uriInfo, role.getUsers());
    return role;
  }

  public RoleResource(Authorizer authorizer, Limits limits) {
    super(Entity.ROLE, authorizer, limits);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("policies,teams,users", MetadataOperation.VIEW_BASIC);
    return null;
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    List<Role> roles = repository.getEntitiesFromSeedData();
    for (Role role : roles) {
      role.setFullyQualifiedName(role.getName());
      List<EntityReference> policies = role.getPolicies();
      for (EntityReference policy : policies) {
        EntityReference ref =
            Entity.getEntityReferenceByName(Entity.POLICY, policy.getName(), Include.NON_DELETED);
        policy.setId(ref.getId());
      }
      repository.initializeEntity(role);
    }
  }

  public static class RoleList extends ResultList<Role> {
    /* Required for serde */
  }

  @GET
  @Valid
  @Operation(
      operationId = "listRoles",
      summary = "List roles",
      description =
          "Get a list of roles. Use cursor-based pagination to limit the number of entries in the list using `limit`"
              + " and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of roles",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = RoleList.class)))
      })
  public ResultList<Role> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "List only default role(s)",
              schema = @Schema(type = "boolean", example = "true"))
          @QueryParam("default")
          boolean defaultParam,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number tables returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of tables before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of tables after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    RestUtil.validateCursors(before, after);
    Fields fields = getFields(fieldsParam);
    ListFilter filter = new ListFilter(include);

    ResultList<Role> roles;
    if (before != null) { // Reverse paging
      roles =
          repository.listBefore(
              uriInfo, fields, filter, limitParam, before); // Ask for one extra entry
    } else { // Forward paging or first page
      roles = repository.listAfter(uriInfo, fields, filter, limitParam, after);
    }
    return addHref(uriInfo, roles);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllRoleVersion",
      summary = "List role versions",
      description = "Get a list of all the versions of a role identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of role versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the role", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Valid
  @Path("/{id}")
  @Operation(
      operationId = "getRoleByID",
      summary = "Get a role by id",
      description = "Get a role by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The role",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Role.class))),
        @ApiResponse(responseCode = "404", description = "Role for instance {id} is not found")
      })
  public Role get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the role", schema = @Schema(type = "UUID")) @PathParam("id")
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
  @Valid
  @Path("/name/{name}")
  @Operation(
      operationId = "getRoleByFQN",
      summary = "Get a role by name",
      description = "Get a role by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The role",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Role.class))),
        @ApiResponse(responseCode = "404", description = "Role for instance {name} is not found")
      })
  public Role getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the role", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
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
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificRoleVersion",
      summary = "Get a version of the role",
      description = "Get a version of the role by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "role",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Role.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Role for instance {id} and version {version} is not found")
      })
  public Role getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the role", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Role version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createRole",
      summary = "Create a role",
      description = "Create a new role.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The role",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Role.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateRole createRole) {
    Role role = mapper.createToEntity(createRole, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, role);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateRole",
      summary = "Update role",
      description = "Create or Update a role.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The role ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Role.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdateRole(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateRole createRole) {
    Role role = mapper.createToEntity(createRole, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, role);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(
      operationId = "patchRole",
      summary = "Update a role",
      description = "Update an existing role with JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the role", schema = @Schema(type = "UUID")) @PathParam("id")
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
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(
      operationId = "patchRole",
      summary = "Update a role using name.",
      description = "Update an existing role with JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the role", schema = @Schema(type = "string"))
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

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteRole",
      summary = "Delete a role",
      description = "Delete a role by given `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Role for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the role", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    // A role has a strong relationship with a policy. Recursively delete the policy that the role
    // contains, to avoid leaving a dangling policy without a role.
    return delete(uriInfo, securityContext, id, true, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteRoleAsync",
      summary = "Asynchronously delete a role",
      description = "Asynchronously delete a role by given `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Role for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the role", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    // A role has a strong relationship with a policy. Recursively delete the policy that the role
    // contains, to avoid leaving a dangling policy without a role.
    return deleteByIdAsync(uriInfo, securityContext, id, true, hardDelete);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteRoleByName",
      summary = "Delete a role",
      description = "Delete a role by given `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Role for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the role", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    return deleteByName(uriInfo, securityContext, name, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted role",
      description = "Restore a soft deleted role.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Role. ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Role.class)))
      })
  public Response restoreRole(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }
}
