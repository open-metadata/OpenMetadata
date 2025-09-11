package org.openmetadata.service.resources.scim;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.scim.ScimGroup;
import org.openmetadata.schema.api.scim.ScimPatchOp;
import org.openmetadata.schema.api.scim.ScimUser;
import org.openmetadata.schema.security.scim.ScimConfiguration;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.scim.ScimProvisioningService;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

@Path("/v1/scim")
@Tag(name = "SCIM", description = "SCIM 2.0 compliant user and group provisioning endpoints.")
@Produces({"application/json", "application/scim+json"})
@Consumes({"application/json", "application/scim+json"})
public class ScimResource {

  private static final String SCIM_RESOURCE_NAME = "scim";
  private final ScimProvisioningService provisioningService;
  protected final Authorizer authorizer;

  public ScimResource(ScimProvisioningService provisioningService, Authorizer authorizer) {
    this.provisioningService = provisioningService;
    this.authorizer = authorizer;
  }

  private void checkScimEnabled() {
    ScimConfiguration scimConfig =
        SettingsCache.getSetting(SettingsType.SCIM_CONFIGURATION, ScimConfiguration.class);
    if (scimConfig == null || !Boolean.TRUE.equals(scimConfig.getEnabled())) {
      throw new CustomExceptionMessage(
          Response.Status.FORBIDDEN.getStatusCode(),
          "SCIM_DISABLED",
          "SCIM provisioning is not enabled. Please enable SCIM in the application settings.");
    }
  }

  @GET
  @Path("/")
  @Operation(
      operationId = "getServiceProviderConfig",
      summary = "Get SCIM Service Provider Config",
      description = "Returns the SCIM service provider configuration.",
      responses =
          @ApiResponse(responseCode = "200", description = "SCIM Service Provider Configuration"))
  public Response getServiceProviderConfig(@Context SecurityContext securityContext) {
    checkScimEnabled();
    authorizer.authorize(
        securityContext,
        new OperationContext(SCIM_RESOURCE_NAME, MetadataOperation.VIEW_SCIM),
        new ScimResourceContext());
    return provisioningService.getServiceProviderConfig();
  }

  @GET
  @Path("/ServiceProviderConfig")
  @Operation(
      operationId = "getServiceProviderConfigAlias",
      summary = "Alias endpoint for SCIM Service Provider Config",
      description = "Alias endpoint for service provider configuration.",
      responses =
          @ApiResponse(responseCode = "200", description = "SCIM Service Provider Configuration"))
  public Response getServiceProviderConfigAlias(@Context SecurityContext securityContext) {
    return getServiceProviderConfig(securityContext);
  }

  @GET
  @Path("/Users")
  @Operation(
      operationId = "listScimUsers",
      summary = "List SCIM users",
      description = "Lists SCIM users based on optional filters.",
      responses = @ApiResponse(responseCode = "200", description = "List of SCIM Users"))
  public Response listUsers(@Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    checkScimEnabled();
    authorizer.authorize(
        securityContext,
        new OperationContext(SCIM_RESOURCE_NAME, MetadataOperation.VIEW_SCIM),
        new ScimResourceContext());
    return provisioningService.listUsers(uriInfo);
  }

  @POST
  @Path("/Users")
  @Operation(
      operationId = "createScimUser",
      summary = "Create SCIM user",
      description = "Creates a new SCIM user.",
      responses = {
        @ApiResponse(responseCode = "201", description = "User created"),
        @ApiResponse(responseCode = "400", description = "Invalid user input")
      })
  public Response createUser(
      ScimUser user, @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    checkScimEnabled();
    authorizer.authorize(
        securityContext,
        new OperationContext(SCIM_RESOURCE_NAME, MetadataOperation.CREATE_SCIM),
        new ScimResourceContext());
    return provisioningService.createUser(user, uriInfo, securityContext);
  }

  @PUT
  @Path("/Users/{id}")
  @Operation(
      operationId = "updateScimUser",
      summary = "Update SCIM user",
      description = "Updates a SCIM user identified by ID.",
      responses = {
        @ApiResponse(responseCode = "200", description = "User updated"),
        @ApiResponse(responseCode = "404", description = "User not found")
      })
  public Response updateUser(
      @Parameter(description = "SCIM User ID") @PathParam("id") String id,
      ScimUser user,
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext) {
    checkScimEnabled();
    authorizer.authorize(
        securityContext,
        new OperationContext(SCIM_RESOURCE_NAME, MetadataOperation.EDIT_SCIM),
        new ScimResourceContext());
    return provisioningService.updateUser(id, user, uriInfo);
  }

  @DELETE
  @Path("/Users/{id}")
  @Operation(
      operationId = "deleteScimUser",
      summary = "Delete SCIM user",
      description = "Deletes a SCIM user identified by ID.",
      responses = {
        @ApiResponse(responseCode = "204", description = "User deleted"),
        @ApiResponse(responseCode = "404", description = "User not found")
      })
  public Response deleteUser(
      @Parameter(description = "SCIM User ID") @PathParam("id") String id,
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext) {
    checkScimEnabled();
    authorizer.authorize(
        securityContext,
        new OperationContext(SCIM_RESOURCE_NAME, MetadataOperation.DELETE_SCIM),
        new ScimResourceContext());
    return provisioningService.deleteUser(id, uriInfo, securityContext);
  }

  @PATCH
  @Path("/Users/{id}")
  @Operation(
      operationId = "patchScimUser",
      summary = "Patch SCIM user",
      description = "Patch updates to a SCIM user identified by ID.",
      responses = {
        @ApiResponse(responseCode = "200", description = "User patched"),
        @ApiResponse(responseCode = "404", description = "User not found")
      })
  public Response patchUser(
      @Parameter(description = "SCIM User ID") @PathParam("id") String id,
      ScimPatchOp request,
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext) {
    checkScimEnabled();
    authorizer.authorize(
        securityContext,
        new OperationContext(SCIM_RESOURCE_NAME, MetadataOperation.EDIT_SCIM),
        new ScimResourceContext());
    return provisioningService.patchUser(id, request, uriInfo, securityContext);
  }

  @GET
  @Path("/Users/{id}")
  @Operation(
      operationId = "getScimUser",
      summary = "Get SCIM user by ID",
      description = "Retrieves a SCIM user identified by ID.",
      responses = {
        @ApiResponse(responseCode = "200", description = "User found"),
        @ApiResponse(responseCode = "404", description = "User not found")
      })
  public Response getUser(
      @Parameter(description = "SCIM User ID") @PathParam("id") String id,
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext) {
    checkScimEnabled();
    authorizer.authorize(
        securityContext,
        new OperationContext(SCIM_RESOURCE_NAME, MetadataOperation.VIEW_SCIM),
        new ScimResourceContext());
    return provisioningService.getUser(id, uriInfo);
  }

  @GET
  @Path("/Groups")
  @Operation(
      operationId = "listScimGroups",
      summary = "List SCIM groups",
      description = "Lists SCIM groups based on optional filters.",
      responses = @ApiResponse(responseCode = "200", description = "List of SCIM Groups"))
  public Response listGroups(@Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    checkScimEnabled();
    authorizer.authorize(
        securityContext,
        new OperationContext(SCIM_RESOURCE_NAME, MetadataOperation.VIEW_SCIM),
        new ScimResourceContext());
    return provisioningService.listGroups(uriInfo);
  }

  @POST
  @Path("/Groups")
  @Operation(
      operationId = "createScimGroup",
      summary = "Create SCIM group",
      description = "Creates a new SCIM group.",
      responses = {
        @ApiResponse(responseCode = "201", description = "Group created"),
        @ApiResponse(responseCode = "400", description = "Invalid group input")
      })
  public Response createGroup(
      ScimGroup group, @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    checkScimEnabled();
    authorizer.authorize(
        securityContext,
        new OperationContext(SCIM_RESOURCE_NAME, MetadataOperation.CREATE_SCIM),
        new ScimResourceContext());
    return provisioningService.createGroup(group, uriInfo, securityContext);
  }

  @PUT
  @Path("/Groups/{id}")
  @Operation(
      operationId = "updateScimGroup",
      summary = "Update SCIM group",
      description = "Updates a SCIM group identified by ID.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Group updated"),
        @ApiResponse(responseCode = "404", description = "Group not found")
      })
  public Response updateGroup(
      @Parameter(description = "SCIM Group ID") @PathParam("id") String id,
      ScimGroup group,
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext) {
    checkScimEnabled();
    authorizer.authorize(
        securityContext,
        new OperationContext(SCIM_RESOURCE_NAME, MetadataOperation.EDIT_SCIM),
        new ScimResourceContext());
    return provisioningService.updateGroup(id, group, uriInfo, securityContext);
  }

  @GET
  @Path("/Groups/{id}")
  @Operation(
      operationId = "getScimGroup",
      summary = "Get SCIM group by ID",
      description = "Retrieves a SCIM group identified by ID.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Group found"),
        @ApiResponse(responseCode = "404", description = "Group not found")
      })
  public Response getGroup(
      @Parameter(description = "SCIM Group ID") @PathParam("id") String id,
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext) {
    checkScimEnabled();
    authorizer.authorize(
        securityContext,
        new OperationContext(SCIM_RESOURCE_NAME, MetadataOperation.VIEW_SCIM),
        new ScimResourceContext());
    return provisioningService.getGroup(id, uriInfo);
  }

  @PATCH
  @Path("/Groups/{id}")
  @Operation(
      operationId = "patchScimGroup",
      summary = "Patch SCIM group",
      description = "Patch updates to a SCIM group identified by ID.",
      responses = {
        @ApiResponse(responseCode = "204", description = "Group patched"),
        @ApiResponse(responseCode = "404", description = "Group not found")
      })
  public Response patchGroup(
      @Parameter(description = "SCIM Group ID") @PathParam("id") String id,
      ScimPatchOp request,
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext) {
    checkScimEnabled();
    authorizer.authorize(
        securityContext,
        new OperationContext(SCIM_RESOURCE_NAME, MetadataOperation.EDIT_SCIM),
        new ScimResourceContext());
    return provisioningService.patchGroup(id, request, uriInfo, securityContext);
  }

  @DELETE
  @Path("/Groups/{id}")
  @Operation(
      operationId = "deleteScimGroup",
      summary = "Delete SCIM group",
      description = "Deletes a SCIM group identified by ID.",
      responses = {
        @ApiResponse(responseCode = "204", description = "Group deleted"),
        @ApiResponse(responseCode = "404", description = "Group not found")
      })
  public Response deleteGroup(
      @Parameter(description = "SCIM Group ID") @PathParam("id") String id,
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext) {
    checkScimEnabled();
    authorizer.authorize(
        securityContext,
        new OperationContext(SCIM_RESOURCE_NAME, MetadataOperation.DELETE_SCIM),
        new ScimResourceContext());
    return provisioningService.deleteGroup(id, uriInfo, securityContext);
  }

  @GET
  @Path("/Schemas")
  @Operation(
      operationId = "getScimSchemas",
      summary = "Get SCIM schemas",
      description = "Returns supported SCIM schemas.",
      responses = @ApiResponse(responseCode = "200", description = "SCIM schemas"))
  public Response getSchemas(@Context SecurityContext securityContext) {
    checkScimEnabled();
    authorizer.authorize(
        securityContext,
        new OperationContext(SCIM_RESOURCE_NAME, MetadataOperation.VIEW_SCIM),
        new ScimResourceContext());
    return provisioningService.getSchemas();
  }

  static class ScimResourceContext implements ResourceContextInterface {

    @Override
    public String getResource() {
      return SCIM_RESOURCE_NAME;
    }

    @Override
    public List<EntityReference> getOwners() {
      return null;
    }

    @Override
    public List<TagLabel> getTags() {
      return null;
    }

    @Override
    public EntityInterface getEntity() {
      return null;
    }

    @Override
    public List<EntityReference> getDomains() {
      return null;
    }
  }
}
