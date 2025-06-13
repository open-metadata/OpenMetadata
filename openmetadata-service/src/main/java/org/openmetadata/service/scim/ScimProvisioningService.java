package org.openmetadata.service.scim;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import org.openmetadata.schema.api.scim.ScimGroup;
import org.openmetadata.schema.api.scim.ScimPatchOp;
import org.openmetadata.schema.api.scim.ScimUser;

public interface ScimProvisioningService {

  Response listUsers(UriInfo uriInfo);

  Response createUser(ScimUser user, UriInfo uriInfo, SecurityContext securityContext);

  Response getUser(String id, UriInfo uriInfo);

  Response patchUser(
      String id, ScimPatchOp request, UriInfo uriInfo, SecurityContext securityContext);

  Response updateUser(String id, ScimUser user, UriInfo uriInfo);

  Response deleteUser(String id, UriInfo uriInfo, SecurityContext securityContext);

  Response listGroups(UriInfo uriInfo);

  Response createGroup(ScimGroup group, UriInfo uriInfo, SecurityContext securityContext);

  Response updateGroup(
      String id, ScimGroup group, UriInfo uriInfo, SecurityContext securityContext);

  Response deleteGroup(String id, UriInfo uriInfo, SecurityContext securityContext);

  Response getGroup(String id, UriInfo uriInfo);

  Response patchGroup(
      String id, ScimPatchOp request, UriInfo uriInfo, SecurityContext securityContext);

  Response getSchemas();

  Response getServiceProviderConfig();
}
