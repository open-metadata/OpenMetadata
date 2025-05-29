package org.openmetadata.service.scim.impl;

import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import org.openmetadata.schema.api.scim.ScimGroup;
import org.openmetadata.schema.api.scim.ScimPatchOp;
import org.openmetadata.schema.api.scim.ScimUser;
import org.openmetadata.service.scim.ScimProvisioningService;

public class DefaultScimProvisioningService implements ScimProvisioningService {

  private static final String MSG = "SCIM is not implemented in OpenMetadata.";

  public Response notImplemented() {
    return Response.status(Response.Status.NOT_IMPLEMENTED).entity(MSG).build();
  }

  public Response listUsers(UriInfo uriInfo) {
    return notImplemented();
  }

  public Response createUser(ScimUser user, UriInfo uriInfo) {
    return notImplemented();
  }

  public Response getUser(String id, UriInfo uriInfo) {
    return notImplemented();
  }

  @Override
  public Response patchUser(String id, ScimPatchOp request, UriInfo uriInfo) {
    return notImplemented();
  }

  @Override
  public Response getGroup(String id, UriInfo uriInfo) {
    return notImplemented();
  }

  @Override
  public Response patchGroup(String id, ScimPatchOp request, UriInfo uriInfo) {
    return notImplemented();
  }

  public Response updateUser(String id, ScimUser user, UriInfo uriInfo) {
    return notImplemented();
  }

  public Response deleteUser(String id, UriInfo uriInfo) {
    return notImplemented();
  }

  public Response listGroups(UriInfo uriInfo) {
    return notImplemented();
  }

  public Response createGroup(ScimGroup group, UriInfo uriInfo) {
    return notImplemented();
  }

  public Response updateGroup(String id, ScimGroup group, UriInfo uriInfo) {
    return notImplemented();
  }

  public Response deleteGroup(String id, UriInfo uriInfo) {
    return notImplemented();
  }
}
