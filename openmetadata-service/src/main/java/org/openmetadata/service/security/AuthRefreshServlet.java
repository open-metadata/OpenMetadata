package org.openmetadata.service.security;

import static org.openmetadata.service.security.AuthLoginServlet.writeJsonResponse;
import static org.openmetadata.service.security.SecurityUtil.getErrorMessage;
import static org.openmetadata.service.security.SecurityUtil.getUserCredentialsFromSession;

import java.util.Optional;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.util.JsonUtils;
import org.pac4j.core.exception.TechnicalException;
import org.pac4j.oidc.client.OidcClient;
import org.pac4j.oidc.credentials.OidcCredentials;

@WebServlet("/api/v1/auth/refresh")
@Slf4j
public class AuthRefreshServlet extends HttpServlet {
  private final OidcClient client;

  public AuthRefreshServlet(OidcClient oidcClient) {
    this.client = oidcClient;
  }

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
    try {
      Optional<OidcCredentials> credentials = getUserCredentialsFromSession(req, client);
      if (credentials.isPresent()) {
        JwtResponse jwtResponse = new JwtResponse();
        jwtResponse.setAccessToken(credentials.get().getIdToken().getParsedString());
        jwtResponse.setExpiryDuration(
            credentials
                .get()
                .getIdToken()
                .getJWTClaimsSet()
                .getExpirationTime()
                .toInstant()
                .getEpochSecond());
        writeJsonResponse(resp, JsonUtils.pojoToJson(jwtResponse));
      } else {
        throw new TechnicalException("No credentials found in session.");
      }
    } catch (Exception e) {
      getErrorMessage(resp, new TechnicalException(e));
    }
  }
}
