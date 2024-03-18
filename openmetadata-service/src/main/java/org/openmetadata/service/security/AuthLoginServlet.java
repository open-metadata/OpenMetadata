package org.openmetadata.service.security;

import static org.openmetadata.service.security.SecurityUtil.getErrorMessage;
import static org.openmetadata.service.security.SecurityUtil.getUserCredentialsFromSession;
import static org.openmetadata.service.security.SecurityUtil.sendRedirectWithToken;

import com.nimbusds.oauth2.sdk.id.State;
import com.nimbusds.oauth2.sdk.pkce.CodeChallenge;
import com.nimbusds.oauth2.sdk.pkce.CodeChallengeMethod;
import com.nimbusds.oauth2.sdk.pkce.CodeVerifier;
import com.nimbusds.openid.connect.sdk.AuthenticationRequest;
import com.nimbusds.openid.connect.sdk.Nonce;
import java.io.IOException;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.pac4j.core.exception.TechnicalException;
import org.pac4j.core.util.CommonHelper;
import org.pac4j.oidc.client.OidcClient;
import org.pac4j.oidc.config.OidcConfiguration;
import org.pac4j.oidc.credentials.OidcCredentials;

@WebServlet("/api/v1/auth/login")
@Slf4j
public class AuthLoginServlet extends HttpServlet {
  public static final String OIDC_CREDENTIAL_PROFILE = "oidcCredentialProfile";
  private final OidcClient client;
  private final List<String> claimsOrder;
  private final String serverUrl;

  public AuthLoginServlet(OidcClient oidcClient, String serverUrl, List<String> claimsOrder) {
    this.client = oidcClient;
    this.serverUrl = serverUrl;
    this.claimsOrder = claimsOrder;
  }

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
    try {
      Optional<OidcCredentials> credentials = getUserCredentialsFromSession(req, client);
      if (credentials.isPresent()) {
        sendRedirectWithToken(resp, credentials.get(), serverUrl, claimsOrder);
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

  public static void writeJsonResponse(HttpServletResponse response, String message)
      throws IOException {
    response.setContentType("application/json");
    response.setCharacterEncoding("UTF-8");
    response.getOutputStream().print(message);
    response.getOutputStream().flush();
    response.setStatus(HttpServletResponse.SC_OK);
  }
}
