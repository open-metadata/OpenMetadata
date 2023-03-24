package org.openmetadata.service.security.auth;

import static org.openmetadata.service.exception.CatalogExceptionMessage.NOT_IMPLEMENTED_METHOD;

import com.fasterxml.jackson.core.JsonProcessingException;
import freemarker.template.TemplateException;
import java.io.IOException;
import java.util.UUID;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.ChangePasswordRequest;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.auth.PasswordResetRequest;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.schema.auth.RegistrationRequest;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.auth.TokenRefreshRequest;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

public interface AuthenticatorHandler {
  void init(OpenMetadataApplicationConfig config, Jdbi jdbi);

  JwtResponse loginUser(LoginRequest loginRequest) throws IOException, TemplateException;

  void checkIfLoginBlocked(String userName);

  void recordFailedLoginAttempt(User user) throws TemplateException, IOException;

  void validatePassword(User storedUser, String reqPassword) throws TemplateException, IOException;

  User lookUserInProvider(String userName);

  default User registerUser(RegistrationRequest registrationRequest) throws IOException {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default void sendEmailVerification(UriInfo uriInfo, User user) throws IOException {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default void confirmEmailRegistration(UriInfo uriInfo, String emailToken) throws IOException {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default void resendRegistrationToken(UriInfo uriInfo, User registeredUser) throws IOException {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default void sendPasswordResetLink(UriInfo uriInfo, User user, String subject, String templateFilePath)
      throws IOException {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default void resetUserPasswordWithToken(UriInfo uriInfo, PasswordResetRequest req) throws IOException {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default void changeUserPwdWithOldPwd(UriInfo uriInfo, String userName, ChangePasswordRequest req) throws IOException {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default RefreshToken createRefreshTokenForLogin(UUID currentUserId) throws JsonProcessingException {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default JwtResponse getNewAccessToken(TokenRefreshRequest request) throws IOException {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default void sendInviteMailToUser(
      UriInfo uriInfo, User user, String subject, CreateUser.CreatePasswordType requestType, String pwd)
      throws IOException {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default JwtResponse getJwtResponse(User storedUser, long expireInSeconds) throws JsonProcessingException {
    RefreshToken refreshToken = createRefreshTokenForLogin(storedUser.getId());
    JWTAuthMechanism jwtAuthMechanism =
        JWTTokenGenerator.getInstance()
            .generateJWTToken(
                storedUser.getName(), storedUser.getEmail(), expireInSeconds, false, ServiceTokenType.OM_USER);

    JwtResponse response = new JwtResponse();
    response.setTokenType("Bearer");
    response.setAccessToken(jwtAuthMechanism.getJWTToken());
    response.setRefreshToken(refreshToken.getToken().toString());
    response.setExpiryDuration(jwtAuthMechanism.getJWTTokenExpiresAt());
    return response;
  }
}
