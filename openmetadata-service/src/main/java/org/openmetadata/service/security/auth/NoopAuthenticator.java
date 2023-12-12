package org.openmetadata.service.security.auth;

import static org.openmetadata.service.exception.CatalogExceptionMessage.FORBIDDEN_AUTHENTICATOR_OP;

import javax.ws.rs.core.Response;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.CustomExceptionMessage;

public class NoopAuthenticator implements AuthenticatorHandler {

  @Override
  public void init(OpenMetadataApplicationConfig config) {
    /* deprecated unused */
  }

  @Override
  public JwtResponse loginUser(LoginRequest loginRequest) {
    throw new CustomExceptionMessage(Response.Status.FORBIDDEN, FORBIDDEN_AUTHENTICATOR_OP);
  }

  @Override
  public void checkIfLoginBlocked(String userName) {
    throw new CustomExceptionMessage(Response.Status.FORBIDDEN, FORBIDDEN_AUTHENTICATOR_OP);
  }

  @Override
  public void recordFailedLoginAttempt(String providedIdentity, User user) {
    throw new CustomExceptionMessage(Response.Status.FORBIDDEN, FORBIDDEN_AUTHENTICATOR_OP);
  }

  @Override
  public void validatePassword(String providedIdentity, User storedUser, String reqPassword) {
    throw new CustomExceptionMessage(Response.Status.FORBIDDEN, FORBIDDEN_AUTHENTICATOR_OP);
  }

  @Override
  public User lookUserInProvider(String userName) {
    throw new CustomExceptionMessage(Response.Status.FORBIDDEN, FORBIDDEN_AUTHENTICATOR_OP);
  }
}
