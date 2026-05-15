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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.nimbusds.oauth2.sdk.auth.ClientAuthentication;
import com.nimbusds.oauth2.sdk.auth.ClientSecretBasic;
import com.nimbusds.oauth2.sdk.auth.ClientSecretPost;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.ws.rs.core.Response;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for {@link TestLoginHandler}. Focuses on validation branches
 * and pure helper methods. End-to-end IdP interaction (discovery doc fetch,
 * token exchange) is exercised via integration tests separately.
 */
class TestLoginHandlerTest {

  // ---------- handleInitiate: validation branches ----------

  @Test
  void handleInitiate_missingDiscoveryUri_returnsHtmlError() {
    HttpServletRequest req = mock(HttpServletRequest.class);
    Response resp =
        TestLoginHandler.handleInitiate(
            req, null, "client-id", "secret", null, null, null, null, null, null, null, null);

    assertEquals(400, resp.getStatus());
    String body = (String) resp.getEntity();
    assertTrue(body.contains("Discovery URI is required"));
  }

  @Test
  void handleInitiate_emptyDiscoveryUri_returnsHtmlError() {
    HttpServletRequest req = mock(HttpServletRequest.class);
    Response resp =
        TestLoginHandler.handleInitiate(
            req, "", "client-id", "secret", null, null, null, null, null, null, null, null);

    assertEquals(400, resp.getStatus());
    assertTrue(((String) resp.getEntity()).contains("Discovery URI is required"));
  }

  @Test
  void handleInitiate_missingClientId_returnsHtmlError() {
    HttpServletRequest req = mock(HttpServletRequest.class);
    Response resp =
        TestLoginHandler.handleInitiate(
            req,
            "https://example.com/.well-known/openid-configuration",
            null,
            "secret",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null);

    assertEquals(400, resp.getStatus());
    assertTrue(((String) resp.getEntity()).contains("Client ID is required"));
  }

  // ---------- handleCallback: validation branches ----------

  @Test
  void handleCallback_noSession_returnsPostMessageError() {
    HttpServletRequest req = mock(HttpServletRequest.class);
    when(req.getSession(false)).thenReturn(null);

    Response resp = TestLoginHandler.handleCallback(req);

    assertEquals(200, resp.getStatus());
    String body = (String) resp.getEntity();
    assertTrue(body.contains("Session expired"));
  }

  @Test
  void handleCallback_idpError_returnsPostMessageError() {
    HttpServletRequest req = mock(HttpServletRequest.class);
    HttpSession session = mock(HttpSession.class);
    when(req.getSession(false)).thenReturn(session);
    when(req.getParameter("error")).thenReturn("access_denied");
    when(req.getParameter("error_description")).thenReturn("User denied consent");

    Response resp = TestLoginHandler.handleCallback(req);

    String body = (String) resp.getEntity();
    assertTrue(body.contains("IdP returned error"));
    assertTrue(body.contains("access_denied"));
  }

  @Test
  void handleCallback_stateMismatch_returnsPostMessageError() {
    HttpServletRequest req = mock(HttpServletRequest.class);
    HttpSession session = mock(HttpSession.class);
    when(req.getSession(false)).thenReturn(session);
    when(req.getParameter("error")).thenReturn(null);
    when(session.getAttribute("testLoginState")).thenReturn("test-login:expected-uuid");
    when(req.getParameter("state")).thenReturn("test-login:different-uuid");

    Response resp = TestLoginHandler.handleCallback(req);

    String body = (String) resp.getEntity();
    assertTrue(body.contains("Invalid state parameter"));
  }

  @Test
  void handleCallback_missingCode_returnsPostMessageError() {
    HttpServletRequest req = mock(HttpServletRequest.class);
    HttpSession session = mock(HttpSession.class);
    when(req.getSession(false)).thenReturn(session);
    when(req.getParameter("error")).thenReturn(null);
    when(session.getAttribute("testLoginState")).thenReturn("test-login:uuid");
    when(req.getParameter("state")).thenReturn("test-login:uuid");
    when(req.getParameter("code")).thenReturn(null);

    Response resp = TestLoginHandler.handleCallback(req);

    String body = (String) resp.getEntity();
    assertTrue(body.contains("No authorization code received"));
  }

  @Test
  void handleCallback_missingSessionData_returnsPostMessageError() {
    HttpServletRequest req = mock(HttpServletRequest.class);
    HttpSession session = mock(HttpSession.class);
    when(req.getSession(false)).thenReturn(session);
    when(req.getParameter("error")).thenReturn(null);
    when(session.getAttribute("testLoginState")).thenReturn("test-login:uuid");
    when(req.getParameter("state")).thenReturn("test-login:uuid");
    when(req.getParameter("code")).thenReturn("auth-code-123");
    // clientId and discoveryUri missing from session
    when(session.getAttribute("testLoginClientId")).thenReturn(null);
    when(session.getAttribute("testLoginDiscoveryUri")).thenReturn(null);

    Response resp = TestLoginHandler.handleCallback(req);

    String body = (String) resp.getEntity();
    assertTrue(body.contains("Session data missing"));
  }

  // ---------- buildClientAuthentication: helper ----------

  @Test
  void buildClientAuthentication_defaultsToBasic() {
    ClientAuthentication auth =
        TestLoginHandler.buildClientAuthentication("client-id", "secret", null);

    assertInstanceOf(ClientSecretBasic.class, auth);
  }

  @Test
  void buildClientAuthentication_basicExplicit() {
    ClientAuthentication auth =
        TestLoginHandler.buildClientAuthentication("client-id", "secret", "client_secret_basic");

    assertInstanceOf(ClientSecretBasic.class, auth);
  }

  @Test
  void buildClientAuthentication_postWhenSpecified() {
    ClientAuthentication auth =
        TestLoginHandler.buildClientAuthentication("client-id", "secret", "client_secret_post");

    assertInstanceOf(ClientSecretPost.class, auth);
  }

  @Test
  void buildClientAuthentication_unknownMethodFallsBackToBasic() {
    ClientAuthentication auth =
        TestLoginHandler.buildClientAuthentication(
            "client-id", "secret", "private_key_jwt-unsupported");

    assertInstanceOf(ClientSecretBasic.class, auth);
  }

  // ---------- buildTestLoginResult: claim processing ----------

  @Test
  void buildTestLoginResult_filtersTimestampClaims() {
    Map<String, Object> claims = new LinkedHashMap<>();
    claims.put("email", "alice@company.com");
    claims.put("iat", 1700000000L);
    claims.put("exp", 1700003600L);
    claims.put("nbf", 1700000000L);
    claims.put("auth_time", 1700000000L);
    claims.put("sub", "user-123");

    Map<String, Object> result = TestLoginHandler.buildTestLoginResult(claims, false);

    @SuppressWarnings("unchecked")
    Map<String, String> claimMap = (Map<String, String>) result.get("claims");
    assertTrue(claimMap.containsKey("email"));
    assertTrue(claimMap.containsKey("sub"));
    assertFalse(claimMap.containsKey("iat"));
    assertFalse(claimMap.containsKey("exp"));
    assertFalse(claimMap.containsKey("nbf"));
    assertFalse(claimMap.containsKey("auth_time"));
  }

  @Test
  void buildTestLoginResult_detectsEmailClaimAndDerivesDomain() {
    Map<String, Object> claims = new LinkedHashMap<>();
    claims.put("sub", "user-123");
    claims.put("preferred_username", "alice");
    claims.put("email", "alice@company.com");

    Map<String, Object> result = TestLoginHandler.buildTestLoginResult(claims, true);

    assertEquals("email", result.get("suggestedEmailClaim"));
    assertEquals("company.com", result.get("derivedPrincipalDomain"));
    assertEquals("alice@company.com", result.get("suggestedAdminPrincipal"));
    assertEquals(true, result.get("hasRefreshToken"));
  }

  @Test
  void buildTestLoginResult_findsFirstEmailClaimInOrder() {
    Map<String, Object> claims = new LinkedHashMap<>();
    claims.put("upn", "alice@company.com");
    claims.put("email", "other@company.com");

    Map<String, Object> result = TestLoginHandler.buildTestLoginResult(claims, false);

    assertEquals("upn", result.get("suggestedEmailClaim"));
  }

  @Test
  void buildTestLoginResult_noEmailClaim_returnsNull() {
    Map<String, Object> claims = new LinkedHashMap<>();
    claims.put("sub", "user-123");
    claims.put("name", "Alice");

    Map<String, Object> result = TestLoginHandler.buildTestLoginResult(claims, false);

    assertNull(result.get("suggestedEmailClaim"));
    assertNull(result.get("derivedPrincipalDomain"));
    assertNull(result.get("suggestedAdminPrincipal"));
  }

  @Test
  void buildTestLoginResult_nullClaimValuesHandledGracefully() {
    Map<String, Object> claims = new LinkedHashMap<>();
    claims.put("email", "alice@company.com");
    claims.put("nullable", null);

    Map<String, Object> result = TestLoginHandler.buildTestLoginResult(claims, false);

    @SuppressWarnings("unchecked")
    Map<String, String> claimMap = (Map<String, String>) result.get("claims");
    assertEquals("alice@company.com", claimMap.get("email"));
    assertEquals("", claimMap.get("nullable"));
    assertNotNull(result.get("suggestedEmailClaim"));
  }
}
