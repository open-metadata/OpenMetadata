package org.openmetadata.service.security.auth;

import static org.openmetadata.service.exception.CatalogExceptionMessage.AUTHENTICATOR_OPERATION_NOT_SUPPORTED;
import static org.openmetadata.service.exception.CatalogExceptionMessage.FORBIDDEN_AUTHENTICATOR_OP;

import jakarta.ws.rs.core.Response;
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
    throw new CustomExceptionMessage(
        Response.Status.FORBIDDEN,
        AUTHENTICATOR_OPERATION_NOT_SUPPORTED,
        FORBIDDEN_AUTHENTICATOR_OP);
  }

  @Override
  public void checkIfLoginBlocked(String userName) {
    throw new CustomExceptionMessage(
        Response.Status.FORBIDDEN,
        AUTHENTICATOR_OPERATION_NOT_SUPPORTED,
        FORBIDDEN_AUTHENTICATOR_OP);
  }

  @Override
  public void recordFailedLoginAttempt(String providedIdentity, String userName) {
    throw new CustomExceptionMessage(
        Response.Status.FORBIDDEN,
        AUTHENTICATOR_OPERATION_NOT_SUPPORTED,
        FORBIDDEN_AUTHENTICATOR_OP);
  }

  @Override
  public void validatePassword(String providedIdentity, String reqPassword, User storedUser) {
    throw new CustomExceptionMessage(
        Response.Status.FORBIDDEN,
        AUTHENTICATOR_OPERATION_NOT_SUPPORTED,
        FORBIDDEN_AUTHENTICATOR_OP);
  }

  @Override
  public User lookUserInProvider(String email, String pwd) {
    throw new CustomExceptionMessage(
        Response.Status.FORBIDDEN,
        AUTHENTICATOR_OPERATION_NOT_SUPPORTED,
        FORBIDDEN_AUTHENTICATOR_OP);
  }
}
