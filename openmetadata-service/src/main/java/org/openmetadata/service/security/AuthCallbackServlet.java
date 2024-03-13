package org.openmetadata.service.security;

import static org.openmetadata.service.security.SecurityUtil.getClientAuthentication;
import static org.openmetadata.service.security.SecurityUtil.getErrorMessage;

import com.nimbusds.jwt.JWT;
import com.nimbusds.oauth2.sdk.AuthorizationCode;
import com.nimbusds.oauth2.sdk.AuthorizationCodeGrant;
import com.nimbusds.oauth2.sdk.AuthorizationGrant;
import com.nimbusds.oauth2.sdk.ErrorObject;
import com.nimbusds.oauth2.sdk.ParseException;
import com.nimbusds.oauth2.sdk.TokenErrorResponse;
import com.nimbusds.oauth2.sdk.TokenRequest;
import com.nimbusds.oauth2.sdk.TokenResponse;
import com.nimbusds.oauth2.sdk.auth.ClientAuthentication;
import com.nimbusds.oauth2.sdk.http.HTTPRequest;
import com.nimbusds.oauth2.sdk.http.HTTPResponse;
import com.nimbusds.oauth2.sdk.id.ClientID;
import com.nimbusds.oauth2.sdk.id.State;
import com.nimbusds.oauth2.sdk.pkce.CodeVerifier;
import com.nimbusds.oauth2.sdk.token.AccessToken;
import com.nimbusds.openid.connect.sdk.AuthenticationErrorResponse;
import com.nimbusds.openid.connect.sdk.AuthenticationResponse;
import com.nimbusds.openid.connect.sdk.AuthenticationResponseParser;
import com.nimbusds.openid.connect.sdk.AuthenticationSuccessResponse;
import com.nimbusds.openid.connect.sdk.OIDCTokenResponse;
import com.nimbusds.openid.connect.sdk.OIDCTokenResponseParser;
import com.nimbusds.openid.connect.sdk.op.OIDCProviderMetadata;
import com.nimbusds.openid.connect.sdk.token.OIDCTokens;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.pac4j.core.exception.TechnicalException;
import org.pac4j.core.util.CommonHelper;
import org.pac4j.oidc.client.OidcClient;
import org.pac4j.oidc.credentials.OidcCredentials;

@WebServlet("/callback")
@Slf4j
public class AuthCallbackServlet extends HttpServlet {
  private final OidcClient client;
  private final ClientAuthentication clientAuthentication;
  private final List<String> claimsOrder;

  public AuthCallbackServlet(OidcClient oidcClient, List<String> claimsOrder) {
    this.client = oidcClient;
    this.claimsOrder = claimsOrder;
    this.clientAuthentication = getClientAuthentication(client.getConfiguration());
  }

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
    try {
      String computedCallbackUrl = client.getCallbackUrl();
      Map<String, List<String>> parameters = retrieveParameters(req);
      AuthenticationResponse response =
          AuthenticationResponseParser.parse(new URI(computedCallbackUrl), parameters);

      if (response instanceof AuthenticationErrorResponse authenticationErrorResponse) {
        LOG.error(
            "Bad authentication response, error={}", authenticationErrorResponse.getErrorObject());
        getErrorMessage(resp, new TechnicalException("Bad authentication response"));
        return;
      }

      LOG.debug("Authentication response successful");
      AuthenticationSuccessResponse successResponse = (AuthenticationSuccessResponse) response;

      OIDCProviderMetadata metadata = client.getConfiguration().getProviderMetadata();
      if (metadata.supportsAuthorizationResponseIssuerParam()
          && !metadata.getIssuer().equals(successResponse.getIssuer())) {
        throw new TechnicalException("Issuer mismatch, possible mix-up attack.");
      }

      // Optional state validation
      validateStateIfRequired(req, resp, successResponse);

      // Build Credentials
      OidcCredentials credentials = buildCredentials(successResponse);

      // Verfiy Response , Create Request And Get Token
      validateAndSendTokenRequest(req, credentials, computedCallbackUrl);

      // Redirect
      sendRedirectWithToken(resp, credentials);
    } catch (Exception e) {
      getErrorMessage(resp, e);
    }
  }

  private OidcCredentials buildCredentials(AuthenticationSuccessResponse successResponse) {
    OidcCredentials credentials = new OidcCredentials();
    // get authorization code
    AuthorizationCode code = successResponse.getAuthorizationCode();
    if (code != null) {
      credentials.setCode(code);
    }
    // get ID token
    JWT idToken = successResponse.getIDToken();
    if (idToken != null) {
      credentials.setIdToken(idToken);
    }
    // get access token
    AccessToken accessToken = successResponse.getAccessToken();
    if (accessToken != null) {
      credentials.setAccessToken(accessToken);
    }

    return credentials;
  }

  private void validateStateIfRequired(
      HttpServletRequest req,
      HttpServletResponse resp,
      AuthenticationSuccessResponse successResponse) {
    if (client.getConfiguration().isWithState()) {
      // Validate state for CSRF mitigation
      State requestState =
          (State) req.getSession().getAttribute(client.getStateSessionAttributeName());
      if (requestState == null || CommonHelper.isBlank(requestState.getValue())) {
        getErrorMessage(resp, new TechnicalException("Missing state parameter"));
        return;
      }

      State responseState = successResponse.getState();
      if (responseState == null) {
        throw new TechnicalException("Missing state parameter");
      }

      LOG.debug("Request state: {}/response state: {}", requestState, responseState);
      if (!requestState.equals(responseState)) {
        throw new TechnicalException(
            "State parameter is different from the one sent in authentication request.");
      }
    }
  }

  private void validateAndSendTokenRequest(
      HttpServletRequest req, OidcCredentials oidcCredentials, String computedCallbackUrl)
      throws IOException, ParseException, URISyntaxException {
    if (oidcCredentials.getCode() != null) {
      CodeVerifier verifier =
          (CodeVerifier)
              req.getSession().getAttribute(client.getCodeVerifierSessionAttributeName());
      // Token request
      TokenRequest request =
          createTokenRequest(
              new AuthorizationCodeGrant(
                  oidcCredentials.getCode(), new URI(computedCallbackUrl), verifier));
      executeTokenRequest(request, oidcCredentials);
    }
  }

  private void sendRedirectWithToken(HttpServletResponse response, OidcCredentials credentials)
      throws IOException, java.text.ParseException {
    JWT jwt = credentials.getIdToken();
    Map<String, Object> claims = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    claims.putAll(jwt.getJWTClaimsSet().getClaims());
    String preferredJwtClaim =
        claimsOrder.stream()
            .filter(claims::containsKey)
            .findFirst()
            .map(claims::get)
            .map(String.class::cast)
            .orElseThrow(
                () ->
                    new AuthenticationException(
                        "Invalid JWT token, none of the following claims are present "
                            + claimsOrder));

    String email = (String) jwt.getJWTClaimsSet().getClaim("email");
    String userName;
    if (preferredJwtClaim.contains("@")) {
      userName = preferredJwtClaim.split("@")[0];
    } else {
      userName = preferredJwtClaim;
    }

    String url =
        String.format(
            "%s?id_token=%s&email=%s&name=%s",
            "http://localhost:8585", credentials.getIdToken().getParsedString(), email, userName);
    response.sendRedirect(url);
  }

  protected Map<String, List<String>> retrieveParameters(HttpServletRequest request) {
    Map<String, String[]> requestParameters = request.getParameterMap();
    Map<String, List<String>> map = new HashMap<>();
    for (var entry : requestParameters.entrySet()) {
      map.put(entry.getKey(), Arrays.asList(entry.getValue()));
    }
    return map;
  }

  protected TokenRequest createTokenRequest(final AuthorizationGrant grant) {
    if (client.getConfiguration().getClientAuthenticationMethod() != null) {
      return new TokenRequest(
          client.getConfiguration().findProviderMetadata().getTokenEndpointURI(),
          this.clientAuthentication,
          grant);
    } else {
      return new TokenRequest(
          client.getConfiguration().findProviderMetadata().getTokenEndpointURI(),
          new ClientID(client.getConfiguration().getClientId()),
          grant);
    }
  }

  private void executeTokenRequest(TokenRequest request, OidcCredentials credentials)
      throws IOException, ParseException {
    HTTPRequest tokenHttpRequest = request.toHTTPRequest();
    client.getConfiguration().configureHttpRequest(tokenHttpRequest);

    HTTPResponse httpResponse = tokenHttpRequest.send();
    LOG.debug(
        "Token response: status={}, content={}",
        httpResponse.getStatusCode(),
        httpResponse.getContent());

    TokenResponse response = OIDCTokenResponseParser.parse(httpResponse);
    if (response instanceof TokenErrorResponse tokenErrorResponse) {
      ErrorObject errorObject = tokenErrorResponse.getErrorObject();
      throw new TechnicalException(
          "Bad token response, error="
              + errorObject.getCode()
              + ","
              + " description="
              + errorObject.getDescription());
    }
    LOG.debug("Token response successful");
    OIDCTokenResponse tokenSuccessResponse = (OIDCTokenResponse) response;

    OIDCTokens oidcTokens = tokenSuccessResponse.getOIDCTokens();
    credentials.setAccessToken(oidcTokens.getAccessToken());
    credentials.setRefreshToken(oidcTokens.getRefreshToken());
    if (oidcTokens.getIDToken() != null) {
      credentials.setIdToken(oidcTokens.getIDToken());
    }
  }
}
