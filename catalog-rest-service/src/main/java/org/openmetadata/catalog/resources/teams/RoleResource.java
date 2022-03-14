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

package org.openmetadata.catalog.resources.teams;

import static org.openmetadata.catalog.security.SecurityUtil.ADMIN;
import static org.openmetadata.catalog.security.SecurityUtil.BOT;

import io.dropwizard.jersey.PATCH;
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
import java.util.List;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
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
import org.openmetadata.catalog.api.teams.CreateRole;
import org.openmetadata.catalog.entity.teams.Role;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.jdbi3.RoleRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.resources.EntityResource;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/roles")
@Api(value = "Roles collection", tags = "Roles collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "roles")
public class RoleResource extends EntityResource<Role, RoleRepository> {
  public static final String COLLECTION_PATH = "/v1/roles/";

  @Override
  public Role addHref(UriInfo uriInfo, Role role) {
    Entity.withHref(uriInfo, role.getPolicy());
    Entity.withHref(uriInfo, role.getTeams());
    Entity.withHref(uriInfo, role.getUsers());
    return role;
  }

  public RoleResource(CollectionDAO dao, Authorizer authorizer) {
    super(Role.class, new RoleRepository(dao), authorizer);
  }

  @SuppressWarnings("unused") // Method used for reflection
  public void initialize(CatalogApplicationConfig config) throws IOException {
    dao.initSeedDataFromResources();
  }

  public static class RoleList extends ResultList<Role> {
    @SuppressWarnings("unused") /* Required for tests */
    RoleList() {}

    public RoleList(List<Role> roles, String beforeCursor, String afterCursor, int total) {
      super(roles, beforeCursor, afterCursor, total);
    }
  }

  public static final String FIELDS = "policy,teams,users";

  @GET
  @Valid
  @Operation(
      summary = "List roles",
      tags = "roles",
      description =
          "Get a list of roles. Use cursor-based pagination to limit the number of entries in the list using `limit`"
              + " and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of roles",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = RoleList.class)))
      })
  public ResultList<Role> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "List only default role(s)", schema = @Schema(type = "boolean", example = "true"))
          @QueryParam("default")
          boolean defaultParam,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number tables returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of tables before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of tables after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    RestUtil.validateCursors(before, after);
    Fields fields = getFields(fieldsParam);
    ListFilter filter = new ListFilter(include);

    ResultList<Role> roles;
    if (defaultParam) {
      // The number of default roles is usually 1, and hence does not require pagination.
      roles = dao.getDefaultRolesResultList(uriInfo, fields);
    } else if (before != null) { // Reverse paging
      roles = dao.listBefore(uriInfo, fields, filter, limitParam, before); // Ask for one extra entry
    } else { // Forward paging or first page
      roles = dao.listAfter(uriInfo, fields, filter, limitParam, after);
    }
    return addHref(uriInfo, roles);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      summary = "List role versions",
      tags = "roles",
      description = "Get a list of all the versions of a role identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of role versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "role Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    return dao.listVersions(id);
  }

  @GET
  @Valid
  @Path("/{id}")
  @Operation(
      summary = "Get a role",
      tags = "roles",
      description = "Get a role by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The role",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Role.class))),
        @ApiResponse(responseCode = "404", description = "Role for instance {id} is not found")
      })
  public Role get(
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
      throws IOException {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Valid
  @Path("/name/{name}")
  @Operation(
      summary = "Get a role by name",
      tags = "roles",
      description = "Get a role by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The role",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Role.class))),
        @ApiResponse(responseCode = "404", description = "Role for instance {name} is not found")
      })
  public Role getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("name") String name,
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
      throws IOException {
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      summary = "Get a version of the role",
      tags = "roles",
      description = "Get a version of the role by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "role",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Role.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Role for instance {id} and version {version} is " + "not found")
      })
  public Role getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Role Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "Role version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(
      summary = "Create a role",
      tags = "roles",
      description = "Create a new role.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The role",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreateRole.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateRole createRole)
      throws IOException {
    Role role = getRole(createRole, securityContext);
    return create(uriInfo, securityContext, role, ADMIN | BOT);
  }

  @PUT
  @Operation(
      summary = "Update role",
      tags = "roles",
      description = "Create or Update a role.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The role ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreateRole.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdateRole(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateRole createRole)
      throws IOException {
    Role role = getRole(createRole, securityContext);
    return createOrUpdate(uriInfo, securityContext, role, ADMIN | BOT);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(
      summary = "Update a role",
      tags = "roles",
      description = "Update an existing role with JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
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
      throws IOException {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      summary = "Delete a role",
      tags = "roles",
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
      @PathParam("id") String id)
      throws IOException {
    // A role has a strong relationship with a policy. Recursively delete the policy that the role contains, to avoid
    // leaving a dangling policy without a role.
    return delete(uriInfo, securityContext, id, true, hardDelete, ADMIN | BOT);
  }

  private Role getRole(CreateRole cr, SecurityContext securityContext) {
    return new Role()
        .withId(UUID.randomUUID())
        .withName(cr.getName())
        .withDescription(cr.getDescription())
        .withDisplayName(cr.getDisplayName())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }
}
