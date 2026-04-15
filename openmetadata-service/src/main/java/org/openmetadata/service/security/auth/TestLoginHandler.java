/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.security.auth;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.nimbusds.jwt.JWT;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.oauth2.sdk.AuthorizationCode;
import com.nimbusds.oauth2.sdk.AuthorizationCodeGrant;
import com.nimbusds.oauth2.sdk.TokenRequest;
import com.nimbusds.oauth2.sdk.auth.ClientAuthentication;
import com.nimbusds.oauth2.sdk.auth.ClientSecretBasic;
import com.nimbusds.oauth2.sdk.auth.ClientSecretPost;
import com.nimbusds.oauth2.sdk.auth.Secret;
import com.nimbusds.oauth2.sdk.http.HTTPRequest;
import com.nimbusds.oauth2.sdk.http.HTTPResponse;
import com.nimbusds.oauth2.sdk.id.ClientID;
import com.nimbusds.openid.connect.sdk.AuthenticationRequest;
import com.nimbusds.openid.connect.sdk.OIDCTokenResponse;
import com.nimbusds.openid.connect.sdk.OIDCTokenResponseParser;
import com.nimbusds.openid.connect.sdk.op.OIDCProviderMetadata;
import com.nimbusds.openid.connect.sdk.token.OIDCTokens;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.ws.rs.core.Response;
import java.net.URI;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.pac4j.oidc.config.OidcConfiguration;

@Slf4j
public class TestLoginHandler {

  private static final String TEST_LOGIN_STATE = "testLoginState";
  private static final String TEST_LOGIN_CLIENT_ID = "testLoginClientId";
  private static final String TEST_LOGIN_CLIENT_SECRET = "testLoginClientSecret";
  private static final String TEST_LOGIN_DISCOVERY_URI = "testLoginDiscoveryUri";
  private static final String TEST_LOGIN_CALLBACK_URL = "testLoginCallbackUrl";
  private static final String TEST_LOGIN_STATE_PREFIX = "test-login:";
  private static final String DEFAULT_CALLBACK_PATH = "/callback";

  private TestLoginHandler() {}

  public static Response handleInitiate(HttpServletRequest req) {
    try {
      String discoveryUri = req.getParameter("discoveryUri");
      String clientId = req.getParameter("clientId");
      String clientSecret = req.getParameter("clientSecret");
      String scope = req.getParameter("scope");
      String prompt = req.getParameter("prompt");
      String maxAge = req.getParameter("maxAge");
      String clientAuthMethod = req.getParameter("clientAuthenticationMethod");

      if (nullOrEmpty(discoveryUri)) {
        return buildHtmlErrorResponse("Discovery URI is required for Test Login.");
      }
      if (nullOrEmpty(clientId)) {
        return buildHtmlErrorResponse("Client ID is required for Test Login.");
      }

      if (nullOrEmpty(scope)) {
        scope = "openid email profile";
      }

      OidcConfiguration oidcConfig = new OidcConfiguration();
      oidcConfig.setClientId(clientId);
      if (!nullOrEmpty(clientSecret)) {
        oidcConfig.setSecret(clientSecret);
      }
      oidcConfig.setDiscoveryURI(discoveryUri);
      oidcConfig.setScope(scope);
      oidcConfig.setResponseType("code");

      OIDCProviderMetadata providerMetadata =
          OIDCProviderMetadata.parse(
              new HTTPRequest(HTTPRequest.Method.GET, new URI(discoveryUri).toURL())
                  .send()
                  .getContent());
      if (providerMetadata == null || providerMetadata.getAuthorizationEndpointURI() == null) {
        return buildHtmlErrorResponse(
            "Could not fetch OIDC discovery document from: " + discoveryUri);
      }

      HttpSession session = req.getSession(true);

      // Use the registered callback URL (same one registered in the IdP)
      // so we don't need customers to register a separate redirect URI
      String callbackUrl = req.getParameter("callbackUrl");
      if (nullOrEmpty(callbackUrl)) {
        String serverUrl =
            req.getScheme()
                + "://"
                + req.getServerName()
                + (req.getServerPort() != 80 && req.getServerPort() != 443
                    ? ":" + req.getServerPort()
                    : "");
        callbackUrl = serverUrl + DEFAULT_CALLBACK_PATH;
      }

      session.setAttribute(TEST_LOGIN_CLIENT_ID, clientId);
      session.setAttribute(TEST_LOGIN_CLIENT_SECRET, clientSecret != null ? clientSecret : "");
      session.setAttribute(TEST_LOGIN_DISCOVERY_URI, discoveryUri);
      session.setAttribute(TEST_LOGIN_CALLBACK_URL, callbackUrl);
      session.setAttribute(
          "testLoginClientAuthMethod", clientAuthMethod != null ? clientAuthMethod : "");

      Map<String, String> params = new HashMap<>();
      params.put(OidcConfiguration.SCOPE, scope);
      params.put(OidcConfiguration.RESPONSE_TYPE, "code");
      params.put(OidcConfiguration.RESPONSE_MODE, "query");
      params.put(OidcConfiguration.CLIENT_ID, clientId);
      params.put(OidcConfiguration.REDIRECT_URI, callbackUrl);
      params.put("access_type", "offline");

      if (!nullOrEmpty(prompt)) {
        params.put(OidcConfiguration.PROMPT, prompt);
      }
      if (!nullOrEmpty(maxAge)) {
        params.put(OidcConfiguration.MAX_AGE, maxAge);
      }

      // Prefix state with "test-login:" so AuthCallbackServlet routes to us
      String state = TEST_LOGIN_STATE_PREFIX + java.util.UUID.randomUUID().toString();
      params.put("state", state);
      session.setAttribute(TEST_LOGIN_STATE, state);

      String nonce = java.util.UUID.randomUUID().toString();
      params.put("nonce", nonce);

      String queryString =
          AuthenticationRequest.parse(
                  params.entrySet().stream()
                      .collect(
                          Collectors.toMap(
                              Map.Entry::getKey, e -> Collections.singletonList(e.getValue()))))
              .toQueryString();

      String authUrl =
          providerMetadata.getAuthorizationEndpointURI().toString() + "?" + queryString;
      LOG.info(
          "[Test Login] Redirecting to IdP: {}", providerMetadata.getAuthorizationEndpointURI());

      return Response.temporaryRedirect(new URI(authUrl)).build();
    } catch (Exception e) {
      LOG.error("[Test Login] Failed to initiate", e);

      return buildHtmlErrorResponse("Failed to initiate Test Login: " + e.getMessage());
    }
  }

  public static Response handleCallback(HttpServletRequest req) {
    try {
      HttpSession session = req.getSession(false);
      if (session == null) {
        return buildPostMessageResponse(false, "Session expired. Please try again.", null);
      }

      String error = req.getParameter("error");
      if (!nullOrEmpty(error)) {
        String errorDesc = req.getParameter("error_description");

        return buildPostMessageResponse(
            false, "IdP returned error: " + error + " - " + errorDesc, null);
      }

      String expectedState = (String) session.getAttribute(TEST_LOGIN_STATE);
      String receivedState = req.getParameter("state");
      if (expectedState != null && !expectedState.equals(receivedState)) {
        return buildPostMessageResponse(
            false, "Invalid state parameter. Possible CSRF attack.", null);
      }

      String code = req.getParameter("code");
      if (nullOrEmpty(code)) {
        return buildPostMessageResponse(false, "No authorization code received from IdP.", null);
      }

      String clientId = (String) session.getAttribute(TEST_LOGIN_CLIENT_ID);
      String clientSecret = (String) session.getAttribute(TEST_LOGIN_CLIENT_SECRET);
      String discoveryUri = (String) session.getAttribute(TEST_LOGIN_DISCOVERY_URI);
      String callbackUrl = (String) session.getAttribute(TEST_LOGIN_CALLBACK_URL);
      String clientAuthMethod = (String) session.getAttribute("testLoginClientAuthMethod");

      if (nullOrEmpty(clientId) || nullOrEmpty(discoveryUri)) {
        return buildPostMessageResponse(
            false, "Session data missing. Please try Test Login again.", null);
      }

      OIDCProviderMetadata providerMetadata =
          OIDCProviderMetadata.parse(
              new HTTPRequest(HTTPRequest.Method.GET, new URI(discoveryUri).toURL())
                  .send()
                  .getContent());
      URI tokenEndpoint = providerMetadata.getTokenEndpointURI();

      AuthorizationCodeGrant grant =
          new AuthorizationCodeGrant(new AuthorizationCode(code), new URI(callbackUrl));

      TokenRequest tokenRequest;
      if (!nullOrEmpty(clientSecret)) {
        ClientAuthentication clientAuth =
            buildClientAuthentication(clientId, clientSecret, clientAuthMethod);
        tokenRequest = new TokenRequest(tokenEndpoint, clientAuth, grant);
      } else {
        tokenRequest = new TokenRequest(tokenEndpoint, new ClientID(clientId), grant);
      }

      HTTPRequest httpRequest = tokenRequest.toHTTPRequest();
      HTTPResponse httpResponse = httpRequest.send();

      if (httpResponse.getStatusCode() != 200) {
        return buildPostMessageResponse(
            false,
            "Token exchange failed (HTTP "
                + httpResponse.getStatusCode()
                + "). Check Client ID and Secret.",
            null);
      }

      OIDCTokenResponse tokenResponse =
          (OIDCTokenResponse) OIDCTokenResponseParser.parse(httpResponse);
      OIDCTokens tokens = tokenResponse.getOIDCTokens();
      JWT idToken = tokens.getIDToken();

      if (idToken == null) {
        return buildPostMessageResponse(
            false, "No id_token received from IdP. Check your scope configuration.", null);
      }

      JWTClaimsSet claimsSet = idToken.getJWTClaimsSet();
      Map<String, Object> claims = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
      claims.putAll(claimsSet.getClaims());

      Map<String, Object> result = buildTestLoginResult(claims, tokens.getRefreshToken() != null);

      session.removeAttribute(TEST_LOGIN_STATE);
      session.removeAttribute(TEST_LOGIN_CLIENT_ID);
      session.removeAttribute(TEST_LOGIN_CLIENT_SECRET);
      session.removeAttribute(TEST_LOGIN_DISCOVERY_URI);
      session.removeAttribute(TEST_LOGIN_CALLBACK_URL);
      session.removeAttribute("testLoginClientAuthMethod");
      LOG.info("[Test Login] Callback successful, {} claims extracted", claims.size());

      return buildPostMessageResponse(true, null, result);
    } catch (Exception e) {
      LOG.error("[Test Login] Callback failed", e);

      return buildPostMessageResponse(false, "Token exchange failed: " + e.getMessage(), null);
    }
  }

  public static Map<String, Object> handleLdapTestLogin(String email, String password) {
    try {
      SecurityConfigurationManager configManager = SecurityConfigurationManager.getInstance();
      AuthenticatorHandler authenticatorHandler = configManager.getAuthenticatorHandler();
      if (authenticatorHandler == null) {
        return Map.of("success", false, "error", "LDAP authenticator not configured");
      }

      org.openmetadata.schema.entity.teams.User user =
          authenticatorHandler.lookUserInProvider(email, password);

      Map<String, Object> result = new LinkedHashMap<>();
      result.put("success", true);
      result.put("email", user.getEmail());
      result.put("username", user.getName());
      result.put(
          "derivedPrincipalDomain",
          user.getEmail().contains("@") ? user.getEmail().split("@")[1] : "");
      result.put("suggestedAdminPrincipal", user.getEmail());

      return result;
    } catch (Exception e) {
      LOG.error("[Test Login] LDAP test login failed", e);

      return Map.of("success", false, "error", "LDAP authentication failed: " + e.getMessage());
    }
  }

  private static ClientAuthentication buildClientAuthentication(
      String clientId, String clientSecret, String method) {
    if ("client_secret_post".equals(method)) {
      return new ClientSecretPost(new ClientID(clientId), new Secret(clientSecret));
    }

    return new ClientSecretBasic(new ClientID(clientId), new Secret(clientSecret));
  }

  private static Map<String, Object> buildTestLoginResult(
      Map<String, Object> claims, boolean hasRefreshToken) {
    Map<String, Object> result = new LinkedHashMap<>();

    Map<String, String> claimMap = new LinkedHashMap<>();
    for (Map.Entry<String, Object> entry : claims.entrySet()) {
      String key = entry.getKey();
      if ("iat".equals(key) || "exp".equals(key) || "nbf".equals(key) || "auth_time".equals(key)) {
        continue;
      }
      Object value = entry.getValue();
      claimMap.put(key, value != null ? value.toString() : "");
    }
    result.put("claims", claimMap);

    String suggestedEmail = null;
    for (Map.Entry<String, String> entry : claimMap.entrySet()) {
      if (entry.getValue() != null && entry.getValue().contains("@")) {
        suggestedEmail = entry.getKey();

        break;
      }
    }
    result.put("suggestedEmailClaim", suggestedEmail);

    if (suggestedEmail != null) {
      String emailValue = claimMap.get(suggestedEmail);
      if (emailValue != null && emailValue.contains("@")) {
        result.put("derivedPrincipalDomain", emailValue.split("@")[1]);
        result.put("suggestedAdminPrincipal", emailValue);
      }
    }

    result.put("hasRefreshToken", hasRefreshToken);

    return result;
  }

  private static Response buildPostMessageResponse(
      boolean success, String error, Map<String, Object> data) {
    return TestLoginResponses.buildPostMessageResponse(success, error, data);
  }

  private static Response buildHtmlErrorResponse(String message) {
    return TestLoginResponses.buildHtmlErrorResponse(message);
  }
}
