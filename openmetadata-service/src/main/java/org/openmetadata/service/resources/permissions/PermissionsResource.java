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

package org.openmetadata.service.resources.permissions;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.PermissionDebugInfo;
import org.openmetadata.service.security.policyevaluator.PermissionDebugService;
import org.openmetadata.service.security.policyevaluator.PermissionEvaluationDebugInfo;
import org.openmetadata.service.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;

@Path("/v1/permissions")
@Tag(name = "Permissions", description = "APIs related to getting access permission for a User.")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "permissions")
public class PermissionsResource {
  private final Authorizer authorizer;
  private final PermissionDebugService debugService;

  @SuppressWarnings("unused")
  public PermissionsResource(Authorizer authorizer) {
    this.authorizer = authorizer;
    this.debugService = new PermissionDebugService();
  }

  @GET
  @Operation(
      operationId = "getResourcePermissions",
      summary = "Get permissions for logged in user",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Permissions for logged in user",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ResourcePermissionList.class)))
      })
  public ResultList<ResourcePermission> getPermissions(
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "Permission for user specified in this query param. If not specified, the user is "
                      + "defaulted to the logged in user",
              schema = @Schema(type = "string", example = "john"))
          @QueryParam("user")
          String user) {
    return new ResultList<>(authorizer.listPermissions(securityContext, user));
  }

  @GET
  @Path("/{resource}")
  @Operation(
      operationId = "getResourceTypePermission",
      summary = "Get permissions a given resource/entity type for logged in user",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Permissions for logged in user",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ResourcePermissionList.class)))
      })
  public ResourcePermission getPermission(
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "Permission for user specified in this query param. If not specified, the user is "
                      + "defaulted to the logged in user",
              schema = @Schema(type = "string", example = "john"))
          @QueryParam("user")
          String user,
      @Parameter(description = "Type of the resource", schema = @Schema(type = "String"))
          @PathParam("resource")
          String resource) {
    return authorizer.getPermission(securityContext, user, resource);
  }

  @GET
  @Path("/{resource}/{id}")
  @Operation(
      operationId = "getResourcePermission",
      summary = "Get permissions for a given entity for a logged in user",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Permissions for logged in user",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ResourcePermissionList.class)))
      })
  public ResourcePermission getPermission(
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "Permission for user specified in this query param. If not specified, the user is "
                      + "defaulted to the logged in user",
              schema = @Schema(type = "string", example = "john"))
          @QueryParam("user")
          String user,
      @Parameter(description = "Type of the resource", schema = @Schema(type = "String"))
          @PathParam("resource")
          String resource,
      @Parameter(description = "Id of the entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    ResourceContext<?> resourceContext = new ResourceContext(resource, id, null);
    return authorizer.getPermission(securityContext, user, resourceContext);
  }

  @GET
  @Path("/{resource}/name/{name}")
  @Operation(
      operationId = "getResourcePermissionByName",
      summary = "Get permissions for a given entity name for a logged in user",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Permissions for logged in user",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ResourcePermissionList.class)))
      })
  public ResourcePermission getPermission(
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "Permission for user specified in this query param. If not specified, the user is "
                      + "defaulted to the logged in user",
              schema = @Schema(type = "string", example = "john"))
          @QueryParam("user")
          String user,
      @Parameter(description = "Type of the resource", schema = @Schema(type = "String"))
          @PathParam("resource")
          String resource,
      @Parameter(description = "Name of the entity", schema = @Schema(type = "String"))
          @PathParam("name")
          String name) {
    ResourceContext<?> resourceContext = new ResourceContext(resource, null, name);
    return authorizer.getPermission(securityContext, user, resourceContext);
  }

  @GET
  @Path("/policies")
  @Operation(
      operationId = "getPermissionsForPolicies",
      summary = "Get permissions for a set of policies",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Permissions for a set of policies",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ResourcePermissionList.class)))
      })
  public ResultList<ResourcePermission> getPermissionForPolicies(
      @Context SecurityContext securityContext,
      @Parameter(description = "List of policy of ids", schema = @Schema(type = "UUID"))
          @QueryParam("ids")
          List<UUID> ids) {
    // User must have read access to policies
    OperationContext operationContext =
        new OperationContext(Entity.POLICY, MetadataOperation.VIEW_ALL);
    for (UUID id : ids) {
      ResourceContext<?> resourceContext = new ResourceContext(Entity.POLICY, id, null);
      authorizer.authorize(securityContext, operationContext, resourceContext);
    }
    List<EntityReference> policies = EntityUtil.populateEntityReferencesById(ids, Entity.POLICY);
    return new ResultList<>(PolicyEvaluator.listPermission(policies));
  }

  static class ResourcePermissionList extends ResultList<ResourcePermission> {
    /* Required for serde */
  }

  @GET
  @Path("/debug/user/{username}")
  @Operation(
      operationId = "debugUserPermissions",
      summary = "Debug permissions for a user",
      description =
          "Get detailed information about a user's permissions including direct roles, "
              + "team-based permissions, and inherited permissions with their sources. "
              + "Only admins can debug other users' permissions.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Permission debug information",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PermissionDebugInfo.class))),
        @ApiResponse(responseCode = "403", description = "Forbidden - Admin access required"),
        @ApiResponse(responseCode = "404", description = "User not found")
      })
  public PermissionDebugInfo debugUserPermissions(
      @Context SecurityContext securityContext,
      @Parameter(description = "Username of the user", schema = @Schema(type = "string"))
          @PathParam("username")
          String username) {
    String currentUser = securityContext.getUserPrincipal().getName();

    // Only allow if user is checking their own permissions or is an admin
    if (!currentUser.equals(username)) {
      // Must be admin to check other users' permissions
      authorizer.authorizeAdmin(securityContext);
    }

    return debugService.debugUserPermissionsByName(username);
  }

  @GET
  @Path("/debug/me")
  @Operation(
      operationId = "debugMyPermissions",
      summary = "Debug permissions for the current user",
      description =
          "Get detailed information about your own permissions including direct roles, "
              + "team-based permissions, and inherited permissions with their sources",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Permission debug information",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PermissionDebugInfo.class)))
      })
  public PermissionDebugInfo debugMyPermissions(@Context SecurityContext securityContext) {
    String userName = securityContext.getUserPrincipal().getName();
    return debugService.debugUserPermissionsByName(userName);
  }

  @GET
  @Path("/debug/evaluate")
  @Operation(
      operationId = "debugPermissionEvaluation",
      summary = "Debug permission evaluation for a specific operation",
      description =
          "Get step-by-step evaluation of permissions for a user attempting a specific "
              + "operation on a resource, showing which policies were evaluated and why the decision was made. "
              + "Only admins can debug other users' permission evaluations.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Permission evaluation debug information",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PermissionEvaluationDebugInfo.class))),
        @ApiResponse(responseCode = "403", description = "Forbidden - Admin access required")
      })
  public PermissionEvaluationDebugInfo debugPermissionEvaluation(
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the user to evaluate permissions for", required = true)
          @QueryParam("user")
          String userName,
      @Parameter(
              description = "Type of resource (e.g., table, database, pipeline)",
              required = true)
          @QueryParam("resource")
          String resourceType,
      @Parameter(description = "ID of the specific resource instance (optional)")
          @QueryParam("resourceId")
          String resourceId,
      @Parameter(
              description = "Operation to check (e.g., VIEW_ALL, EDIT_ALL, DELETE)",
              required = true)
          @QueryParam("operation")
          MetadataOperation operation) {

    String currentUser = securityContext.getUserPrincipal().getName();

    // Only allow if user is checking their own permissions or is an admin
    if (!currentUser.equals(userName)) {
      // Must be admin to check other users' permissions
      authorizer.authorizeAdmin(securityContext);
    }

    return debugService.debugPermissionEvaluation(userName, resourceType, resourceId, operation);
  }
}
