package org.openmetadata.service.resources.scim;

import io.swagger.v3.oas.annotations.tags.Tag;
import javax.ws.rs.*;
import javax.ws.rs.core.*;
import org.openmetadata.schema.api.scim.ScimGroup;
import org.openmetadata.schema.api.scim.ScimPatchOp;
import org.openmetadata.schema.api.scim.ScimUser;
import org.openmetadata.service.scim.ScimProvisioningService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Path("/v1/scim")
@Tag(name = "SCIM")
@Produces({ "application/json", "application/scim+json" })
@Consumes({ "application/json", "application/scim+json" })
public class ScimResource {

  private final ScimProvisioningService provisioningService;

  public ScimResource(ScimProvisioningService provisioningService) {
    this.provisioningService = provisioningService;
  }

  @GET
  @Path("/")
  public Response getServiceProviderConfig() {
    Map<String, Object> response = new HashMap<>();
    response.put("schemas", List.of("urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"));
    response.put("patch", Map.of("supported", true));
    response.put("bulk", Map.of("supported", false));
    response.put("filter", Map.of("supported", false));
    response.put("changePassword", Map.of("supported", false));
    response.put("sort", Map.of("supported", false));
    response.put("etag", Map.of("supported", false));
    response.put("authenticationSchemes", List.of(
            Map.of(
                    "type", "oauthbearer",
                    "name", "OAuth Bearer Token",
                    "description", "Authentication scheme using the OAuth Bearer Token Standard",
                    "specUri", "http://www.rfc-editor.org/info/rfc6750",
                    "primary", true
            )
    ));
    return Response.ok(response).build();
  }

  @GET
  @Path("/ServiceProviderConfig")
  public Response getServiceProviderConfigAlias() {
    return getServiceProviderConfig();
  }


  @GET
  @Path("/Users")
  public Response listUsers(@Context UriInfo uriInfo) {
    return provisioningService.listUsers(uriInfo);
  }

  @POST
  @Path("/Users")
  public Response createUser(ScimUser user, @Context UriInfo uriInfo) {
    return provisioningService.createUser(user, uriInfo);
  }

  @PUT
  @Path("/Users/{id}")
  public Response updateUser(@PathParam("id") String id, ScimUser user, @Context UriInfo uriInfo) {
    return provisioningService.updateUser(id, user, uriInfo);
  }

  @DELETE
  @Path("/Users/{id}")
  public Response deleteUser(@PathParam("id") String id, @Context UriInfo uriInfo) {
    return provisioningService.deleteUser(id, uriInfo);
  }

  @PATCH
  @Path("/Users/{id}")
  public Response patchUser(@PathParam("id") String id, ScimPatchOp request, @Context UriInfo uriInfo) {
    return provisioningService.patchUser(id, request, uriInfo);
  }


  @GET
  @Path("/Groups")
  public Response listGroups(@Context UriInfo uriInfo) {
    return provisioningService.listGroups(uriInfo);
  }

  @POST
  @Path("/Groups")
  public Response createGroup(ScimGroup group, @Context UriInfo uriInfo) {
    return provisioningService.createGroup(group, uriInfo);
  }

  @PUT
  @Path("/Groups/{id}")
  public Response updateGroup(@PathParam("id") String id, ScimGroup group, @Context UriInfo uriInfo) {
    return provisioningService.updateGroup(id, group , uriInfo);
  }

  @GET
  @Path("/Groups/{id}")
  public Response getGroup(@PathParam("id") String id, @Context UriInfo uriInfo) {
    return provisioningService.getGroup(id, uriInfo);
  }


  @PATCH
  @Path("/Groups/{id}")
  public Response patchGroup(@PathParam("id") String id, ScimPatchOp request, @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    return provisioningService.patchGroup(id, request, uriInfo, securityContext);
  }


  @DELETE
  @Path("/Groups/{id}")
  public Response deleteGroup(@PathParam("id") String id , @Context UriInfo uriInfo) {
    return provisioningService.deleteGroup(id, uriInfo);
  }

  @GET
  @Path("/Users/{id}")
  public Response getUser(@PathParam("id") String id, @Context UriInfo uriInfo) {
    return provisioningService.getUser(id, uriInfo);
  }
}
