package org.openmetadata.service.security.auth;

import com.nimbusds.jwt.JWT;
import freemarker.template.TemplateException;
import java.io.IOException;
import javax.ws.rs.core.UriInfo;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.auth.RegistrationRequest;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.auth.TokenRefreshRequest;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.security.AuthenticationException;

public abstract class SSOAuthenticator implements AuthenticatorHandler {
  protected SSOAuthMechanism ssoAuthMechanism;

  @Override
  public void init(OpenMetadataApplicationConfig config) {
    SSOAuthMechanism mechanism = new SSOAuthMechanism();
    mechanism.setSsoServiceType(
        SSOAuthMechanism.SsoServiceType.valueOf(
            config.getAuthenticationConfiguration().getProvider().value().toUpperCase()));
    this.ssoAuthMechanism = mechanism;
  }

  protected abstract void validateGroupAndRoleMapping(JWT jwt, String accessToken)
      throws AuthenticationException;

  @Override
  public JwtResponse loginUser(LoginRequest loginRequest) throws IOException, TemplateException {
    throw new UnsupportedOperationException("Login through SSO provider");
  }

  @Override
  public void checkIfLoginBlocked(String userName) {
    // Not applicable for SSO
  }

  @Override
  public void recordFailedLoginAttempt(String email, String userName)
      throws TemplateException, IOException {
    // Not applicable for SSO
  }

  @Override
  public void validatePassword(String providedIdentity, String reqPassword, User omUser)
      throws TemplateException, IOException {
    throw new UnsupportedOperationException("Password validation through SSO provider");
  }

  @Override
  public User lookUserInProvider(String email, String pwd) throws TemplateException, IOException {
    throw new UnsupportedOperationException("User lookup through SSO provider");
  }

  @Override
  public User registerUser(RegistrationRequest newRegistrationRequest) {
    throw new UnsupportedOperationException("Registration through SSO provider");
  }

  @Override
  public void confirmEmailRegistration(UriInfo uriInfo, String emailToken) {
    throw new UnsupportedOperationException("Email confirmation through SSO provider");
  }

  @Override
  public void resendRegistrationToken(UriInfo uriInfo, User user) throws IOException {
    throw new UnsupportedOperationException("Token resend through SSO provider");
  }

  @Override
  public void sendEmailVerification(UriInfo uriInfo, User user) throws IOException {
    throw new UnsupportedOperationException("Email verification through SSO provider");
  }

  @Override
  public JwtResponse getNewAccessToken(TokenRefreshRequest request) {
    throw new UnsupportedOperationException("Access token through SSO provider");
  }
}
