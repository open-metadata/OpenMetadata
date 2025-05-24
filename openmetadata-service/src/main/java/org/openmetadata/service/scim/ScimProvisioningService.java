package org.openmetadata.service.scim;

import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import org.openmetadata.schema.api.scim.ScimUser;
import org.openmetadata.schema.api.scim.ScimGroup;

public interface ScimProvisioningService {

    Response listUsers(UriInfo uriInfo);
    Response createUser(ScimUser user);
    Response updateUser(String id, ScimUser user);
    Response deleteUser(String id);

    Response listGroups(UriInfo uriInfo);
    Response createGroup(ScimGroup group);
    Response updateGroup(String id, ScimGroup group);
    Response deleteGroup(String id);
}
