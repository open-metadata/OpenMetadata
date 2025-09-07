package org.openmetadata.sdk.services.teams;

import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class RoleService extends EntityServiceBase<Role> {
  public RoleService(HttpClient httpClient) {
    super(httpClient, "/v1/roles");
  }

  @Override
  protected Class<Role> getEntityClass() {
    return Role.class;
  }
}
