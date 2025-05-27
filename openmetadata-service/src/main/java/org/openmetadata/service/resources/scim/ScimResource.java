package org.openmetadata.service.resources.scim;

import io.swagger.v3.oas.annotations.tags.Tag;
import javax.ws.rs.*;
import javax.ws.rs.core.*;
import org.openmetadata.schema.api.scim.ScimGroup;
import org.openmetadata.schema.api.scim.ScimUser;
import org.openmetadata.service.scim.ScimProvisioningService;

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
  public Response updateUser(@PathParam("id") String id, ScimUser user) {
    return provisioningService.updateUser(id, user);
  }

  @DELETE
  @Path("/Users/{id}")
  public Response deleteUser(@PathParam("id") String id) {
    return provisioningService.deleteUser(id);
  }

  @GET
  @Path("/Groups")
  public Response listGroups(@Context UriInfo uriInfo) {
    return provisioningService.listGroups(uriInfo);
  }

  @POST
  @Path("/Groups")
  public Response createGroup(ScimGroup group) {
    return provisioningService.createGroup(group);
  }

  @PUT
  @Path("/Groups/{id}")
  public Response updateGroup(@PathParam("id") String id, ScimGroup group) {
    return provisioningService.updateGroup(id, group);
  }

  @DELETE
  @Path("/Groups/{id}")
  public Response deleteGroup(@PathParam("id") String id) {
    return provisioningService.deleteGroup(id);
  }

  @GET
  @Path("/Users/{id}")
  public Response getUser(@PathParam("id") String id, @Context UriInfo uriInfo) {
    return provisioningService.getUser(id, uriInfo);
  }
}
