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
import com.nimbusds.oauth2.sdk.http.HTTPResponse;
import com.nimbusds.openid.connect.sdk.AuthenticationRequest;
import com.nimbusds.openid.connect.sdk.OIDCTokenResponse;
import com.nimbusds.openid.connect.sdk.OIDCTokenResponseParser;
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
import org.openmetadata.service.security.AuthenticationCodeFlowHandler;
import org.pac4j.oidc.client.OidcClient;
import org.pac4j.oidc.config.OidcConfiguration;

@Slf4j
public class TestLoginHandler {

  private static final String TEST_LOGIN_STATE = "testLoginState";
  private static final String TEST_LOGIN_NONCE = "testLoginNonce";
  private static final String TEST_LOGIN_CALLBACK_PATH =
      "/api/v1/system/config/auth/test-login/callback";

  private TestLoginHandler() {}

  public static Response handleInitiate(HttpServletRequest req) {
    try {
      AuthenticationCodeFlowHandler codeFlowHandler = AuthenticationCodeFlowHandler.getInstance();
      OidcClient client = codeFlowHandler.getClient();

      if (client == null || client.getConfiguration() == null) {
        return buildHtmlErrorResponse(
            "OIDC client is not configured. Save your SSO configuration first.");
      }

      HttpSession session = req.getSession(true);

      String serverUrl =
          client
              .getConfiguration()
              .getCustomParams()
              .getOrDefault(
                  "serverUrl",
                  req.getScheme()
                      + "://"
                      + req.getServerName()
                      + (req.getServerPort() != 80 && req.getServerPort() != 443
                          ? ":" + req.getServerPort()
                          : ""));

      String testCallbackUrl = serverUrl + TEST_LOGIN_CALLBACK_PATH;

      Map<String, String> params = new HashMap<>();
      params.put(OidcConfiguration.SCOPE, "openid email profile");
      params.put(OidcConfiguration.RESPONSE_TYPE, "code");
      params.put(OidcConfiguration.RESPONSE_MODE, "query");
      params.put(OidcConfiguration.CLIENT_ID, client.getConfiguration().getClientId());
      params.put(OidcConfiguration.REDIRECT_URI, testCallbackUrl);
      params.put("access_type", "offline");

      String state = java.util.UUID.randomUUID().toString();
      params.put("state", state);
      session.setAttribute(TEST_LOGIN_STATE, state);
      session.setAttribute("testLoginCallbackUrl", testCallbackUrl);

      if (client.getConfiguration().isUseNonce()) {
        String nonce = java.util.UUID.randomUUID().toString();
        params.put("nonce", nonce);
        session.setAttribute(TEST_LOGIN_NONCE, nonce);
      }

      String queryString =
          AuthenticationRequest.parse(
                  params.entrySet().stream()
                      .collect(
                          Collectors.toMap(
                              Map.Entry::getKey, e -> Collections.singletonList(e.getValue()))))
              .toQueryString();

      String authorizationEndpoint =
          client.getConfiguration().findProviderMetadata().getAuthorizationEndpointURI().toString();

      String authUrl = authorizationEndpoint + "?" + queryString;
      LOG.info("[Test Login] Redirecting to IdP: {}", authorizationEndpoint);

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

      AuthenticationCodeFlowHandler codeFlowHandler = AuthenticationCodeFlowHandler.getInstance();

      String callbackUrl = (String) session.getAttribute("testLoginCallbackUrl");
      if (nullOrEmpty(callbackUrl)) {
        callbackUrl = req.getRequestURL().toString();
      }

      AuthorizationCodeGrant grant =
          new AuthorizationCodeGrant(new AuthorizationCode(code), new URI(callbackUrl));

      TokenRequest tokenRequest = codeFlowHandler.createTokenRequest(grant);
      HTTPResponse httpResponse = codeFlowHandler.executeTokenHttpRequest(tokenRequest);

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
      session.removeAttribute(TEST_LOGIN_NONCE);
      session.removeAttribute("testLoginCallbackUrl");
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
    Map<String, Object> message = new LinkedHashMap<>();
    message.put("type", "sso-test-login");
    message.put("success", success);
    if (error != null) {
      message.put("error", error);
    }
    if (data != null) {
      message.putAll(data);
    }

    String json = JsonUtils.pojoToJson(message);

    String html =
        "<!DOCTYPE html><html><body>"
            + "<p>"
            + (success ? "Authentication successful. This window will close." : "Error: " + error)
            + "</p>"
            + "<script>"
            + "if (window.opener) {"
            + "  window.opener.postMessage("
            + json
            + ", window.location.origin);"
            + "}"
            + "if ("
            + success
            + ") { setTimeout(function() { window.close(); }, 1000); }"
            + "</script>"
            + "</body></html>";

    return Response.ok(html, "text/html").build();
  }

  private static Response buildHtmlErrorResponse(String message) {
    String html =
        "<!DOCTYPE html><html><body>"
            + "<p>Test Login Error: "
            + message
            + "</p>"
            + "<script>"
            + "if (window.opener) {"
            + "  window.opener.postMessage({type: 'sso-test-login', success: false, error: '"
            + message.replace("'", "\\'")
            + "'}, window.location.origin);"
            + "}"
            + "</script>"
            + "</body></html>";

    return Response.status(Response.Status.BAD_REQUEST).entity(html).type("text/html").build();
  }
}
