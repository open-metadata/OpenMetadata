package org.openmetadata.service.security;

import static org.openmetadata.service.security.SecurityUtil.getErrorMessage;

import com.nimbusds.oauth2.sdk.id.State;
import com.nimbusds.oauth2.sdk.pkce.CodeChallenge;
import com.nimbusds.oauth2.sdk.pkce.CodeChallengeMethod;
import com.nimbusds.oauth2.sdk.pkce.CodeVerifier;
import com.nimbusds.oauth2.sdk.token.RefreshToken;
import com.nimbusds.openid.connect.sdk.AuthenticationRequest;
import com.nimbusds.openid.connect.sdk.Nonce;
import java.io.IOException;
import java.text.ParseException;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.util.JsonUtils;
import org.pac4j.core.exception.TechnicalException;
import org.pac4j.core.util.CommonHelper;
import org.pac4j.oidc.client.OidcClient;
import org.pac4j.oidc.config.OidcConfiguration;
import org.pac4j.oidc.credentials.OidcCredentials;
import org.pac4j.oidc.credentials.authenticator.OidcAuthenticator;

@WebServlet("/api/v1/auth/login")
@Slf4j
public class AuthLoginServlet extends HttpServlet {
  public static final String OIDC_CREDENTIAL_PROFILE = "oidcCredentialProfile";
  private final OidcClient client;

  public AuthLoginServlet(OidcClient oidcClient) {
    this.client = oidcClient;
  }

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
    try {
      Optional<OidcCredentials> credentials = getUserCredentialsFromSession(req);
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
        Map<String, String> params = buildParams();

        params.put(OidcConfiguration.REDIRECT_URI, client.getCallbackUrl());

        addStateAndNonceParameters(req, params);

        // This is always used to prompt the user to login
        params.put(OidcConfiguration.PROMPT, "login");
        params.put(OidcConfiguration.MAX_AGE, "0");

        String location = buildAuthenticationRequestUrl(params);
        LOG.debug("Authentication request url: {}", location);

        resp.sendRedirect(location);
      }
    } catch (Exception e) {
      getErrorMessage(resp, new TechnicalException(e));
    }
  }

  protected Map<String, String> buildParams() {
    Map<String, String> authParams = new HashMap<>();
    authParams.put(OidcConfiguration.SCOPE, client.getConfiguration().getScope());
    authParams.put(OidcConfiguration.RESPONSE_TYPE, client.getConfiguration().getResponseType());
    authParams.put(OidcConfiguration.RESPONSE_MODE, "query");
    authParams.putAll(client.getConfiguration().getCustomParams());
    authParams.put(OidcConfiguration.CLIENT_ID, client.getConfiguration().getClientId());

    return new HashMap<>(authParams);
  }

  protected void addStateAndNonceParameters(
      final HttpServletRequest request, final Map<String, String> params) {
    // Init state for CSRF mitigation
    if (client.getConfiguration().isWithState()) {
      State state = new State(CommonHelper.randomString(10));
      params.put(OidcConfiguration.STATE, state.getValue());
      request.getSession().setAttribute(client.getStateSessionAttributeName(), state);
    }

    // Init nonce for replay attack mitigation
    if (client.getConfiguration().isUseNonce()) {
      Nonce nonce = new Nonce();
      params.put(OidcConfiguration.NONCE, nonce.getValue());
      request.getSession().setAttribute(client.getNonceSessionAttributeName(), nonce.getValue());
    }

    CodeChallengeMethod pkceMethod = client.getConfiguration().findPkceMethod();
    if (pkceMethod != null) {
      CodeVerifier verfifier = new CodeVerifier(CommonHelper.randomString(10));
      request.getSession().setAttribute(client.getCodeVerifierSessionAttributeName(), verfifier);
      params.put(
          OidcConfiguration.CODE_CHALLENGE,
          CodeChallenge.compute(pkceMethod, verfifier).getValue());
      params.put(OidcConfiguration.CODE_CHALLENGE_METHOD, pkceMethod.getValue());
    }
  }

  protected String buildAuthenticationRequestUrl(final Map<String, String> params) {
    // Build authentication request query string
    String queryString;
    try {
      queryString =
          AuthenticationRequest.parse(
                  params.entrySet().stream()
                      .collect(
                          Collectors.toMap(
                              Map.Entry::getKey, e -> Collections.singletonList(e.getValue()))))
              .toQueryString();
    } catch (Exception e) {
      throw new TechnicalException(e);
    }
    return client.getConfiguration().getProviderMetadata().getAuthorizationEndpointURI().toString()
        + '?'
        + queryString;
  }

  private Optional<OidcCredentials> getUserCredentialsFromSession(HttpServletRequest request)
      throws ParseException {
    OidcCredentials credentials =
        (OidcCredentials) request.getSession().getAttribute(OIDC_CREDENTIAL_PROFILE);
    if (credentials != null) {
      removeOrRenewOidcCredentials(request, credentials);
      return Optional.of(credentials);
    }
    return Optional.empty();
  }

  private void removeOrRenewOidcCredentials(HttpServletRequest request, OidcCredentials credentials)
      throws ParseException {
    boolean profilesUpdated = false;
    if (SecurityUtil.isCredentialsExpired(credentials)) {
      LOG.debug("Expired credentials found, trying to renew.");
      RefreshToken refreshToken = credentials.getRefreshToken();
      if (refreshToken != null) {
        profilesUpdated = true;
        OidcAuthenticator authenticator =
            new OidcAuthenticator(client.getConfiguration(), this.client);
        authenticator.refresh(credentials);
      } else {
        LOG.error("No refresh token found in credentials.");
        throw new RuntimeException("No refresh token found in credentials.");
      }
    }
    if (profilesUpdated) {
      request.getSession().setAttribute(OIDC_CREDENTIAL_PROFILE, credentials);
    }
  }

  public static void writeJsonResponse(HttpServletResponse response, String message)
      throws IOException {
    response.setContentType("application/json");
    response.setCharacterEncoding("UTF-8");
    response.getOutputStream().print(message);
    response.getOutputStream().flush();
    response.setStatus(HttpServletResponse.SC_OK);
  }
}
