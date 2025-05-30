package org.openmetadata.service.scim;

import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import org.openmetadata.schema.api.scim.ScimGroup;
import org.openmetadata.schema.api.scim.ScimPatchOp;
import org.openmetadata.schema.api.scim.ScimUser;

public interface ScimProvisioningService {

  Response listUsers(UriInfo uriInfo);

  Response createUser(ScimUser user, UriInfo uriInfo);

  Response updateUser(String id, ScimUser user, UriInfo uriInfo);

  Response deleteUser(String id, UriInfo uriInfo, SecurityContext securityContext);

  Response listGroups(UriInfo uriInfo);

  Response createGroup(ScimGroup group, UriInfo uriInfo);

  Response updateGroup(String id, ScimGroup group, UriInfo uriInfo);

  Response deleteGroup(String id, UriInfo uriInfo);
  Response getUser(String id, UriInfo uriInfo);

  Response patchUser(String id, ScimPatchOp request, UriInfo uriInfo);

  Response getGroup(String id, UriInfo uriInfo);  // For GET /Groups/{id}

  Response patchGroup(String id, ScimPatchOp request, UriInfo uriInfo, SecurityContext securityContext);  // For PATCH /Groups/{id}


  default Response bulkOperation() {
    return Response.status(Response.Status.NOT_IMPLEMENTED)
            .entity("Bulk operation not supported")
            .build();
  }

  default Response changePassword(String id, String newPassword) {
    return Response.status(Response.Status.NOT_IMPLEMENTED)
            .entity("Change password not supported")
            .build();
  }

  default Response searchUsers(String filter) {
    return Response.status(Response.Status.NOT_IMPLEMENTED)
            .entity("User filtering not supported")
            .build();
  }

  default Response sortUsers(String sortBy) {
    return Response.status(Response.Status.NOT_IMPLEMENTED)
            .entity("User sorting not supported")
            .build();
  }
}
