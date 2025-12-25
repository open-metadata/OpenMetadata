package org.openmetadata.sdk.services.teams;

import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class UserService extends EntityServiceBase<User> {
  public UserService(HttpClient httpClient) {
    super(httpClient, "/v1/users");
  }

  @Override
  protected Class<User> getEntityClass() {
    return User.class;
  }

  // Create user using CreateUser request
  public User create(CreateUser request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, User.class);
  }
}
