package org.openmetadata.sdk.services.teams;

import java.util.UUID;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.GenerateTokenRequest;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
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

  /**
   * Generate a JWT token for a user.
   *
   * <p>For bot users, the caller must have EDIT permission on the bot. For regular users, only the
   * user themselves can generate their own token.
   *
   * @param userId the user ID
   * @param expiry the token expiry
   * @return the JWT auth mechanism with the generated token
   */
  public JWTAuthMechanism generateToken(UUID userId, JWTTokenExpiry expiry)
      throws OpenMetadataException {
    GenerateTokenRequest request =
        new GenerateTokenRequest().withId(userId).withJWTTokenExpiry(expiry);
    return httpClient.execute(
        HttpMethod.POST, basePath + "/generateToken", request, JWTAuthMechanism.class);
  }

  /**
   * Generate a JWT token for a user using the GenerateTokenRequest.
   *
   * @param request the generate token request containing user ID and expiry
   * @return the JWT auth mechanism with the generated token
   */
  public JWTAuthMechanism generateToken(GenerateTokenRequest request) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, basePath + "/generateToken", request, JWTAuthMechanism.class);
  }
}
