package org.openmetadata.sdk.services.teams;

import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class UserService extends EntityServiceBase<User> {
  public UserService(HttpClient httpClient) {
    super(httpClient, "/v1/users");
  }

  @Override
  protected Class<User> getEntityClass() {
    return User.class;
  }
}
