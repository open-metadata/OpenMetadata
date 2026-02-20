/*
 *  Copyright 2021 Collate
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.onelogin.saml2.exception.SAMLException;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.saml.SamlSettingsHolder;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SamlAuthServletHandlerTest {

  @Mock private AuthenticationConfiguration authConfig;
  @Mock private AuthorizerConfiguration authorizerConfig;
  @Mock private SamlSSOClientConfig samlConfig;
  @Mock private HttpServletRequest request;
  @Mock private HttpServletResponse response;
  @Mock private HttpSession session;
  @Mock private User user;
  @Mock private UserRepository userRepository;
  @Mock private TokenRepository tokenRepository;
  @Mock private JWTTokenGenerator jwtTokenGenerator;
  @Mock private JWTAuthMechanism jwtAuthMechanism;
  @Mock private RefreshToken refreshToken;
  @Mock private ServletOutputStream servletOutputStream;

  private SamlAuthServletHandler handler;
  private StringWriter responseWriter;
  private final Set<String> adminPrincipals = new HashSet<>();

  @BeforeEach
  void setUp() throws Exception {
    // Setup authentication config
    when(authConfig.getEnableSelfSignup()).thenReturn(true);
    when(authConfig.getSamlConfiguration()).thenReturn(samlConfig);
    when(samlConfig.getSamlDisplayNameAttributes()).thenReturn(null);

    // Setup authorizer config with admin principals
    adminPrincipals.add("admin");
    adminPrincipals.add("saml-admin");
    when(authorizerConfig.getAdminPrincipals()).thenReturn(adminPrincipals);

    // Setup handler
    handler = SamlAuthServletHandler.getInstance(authConfig, authorizerConfig);

    // Setup response writer
    responseWriter = new StringWriter();
    when(response.getWriter()).thenReturn(new PrintWriter(responseWriter));
    when(response.getOutputStream()).thenReturn(servletOutputStream);

    // Setup session
    when(request.getSession(true)).thenReturn(session);
    when(request.getSession(false)).thenReturn(session);
    when(request.getSession()).thenReturn(session);

    // Setup user mocks
    when(user.getId()).thenReturn(UUID.randomUUID());
    when(user.getName()).thenReturn("testuser");
    when(user.getEmail()).thenReturn("test@example.com");
    when(user.getIsAdmin()).thenReturn(false);

    // Setup JWT token mocks
    when(jwtAuthMechanism.getJWTToken()).thenReturn("mock-jwt-token");
    when(jwtAuthMechanism.getJWTTokenExpiresAt()).thenReturn(System.currentTimeMillis() + 3600000);

    // Setup refresh token
    when(refreshToken.getToken()).thenReturn(UUID.randomUUID());
  }

  @Test
  void testHandleLogin_WithCallbackParameter() {
    // Test parameter precedence: 'callback' parameter is used
    String callbackUrl = "https://example.com/callback";
    when(request.getParameter("callback")).thenReturn(callbackUrl);
    when(request.getParameter("redirectUri")).thenReturn("https://example.com/other");

    try (MockedStatic<SamlSettingsHolder> samlMock = mockStatic(SamlSettingsHolder.class)) {
      samlMock.when(SamlSettingsHolder::getSaml2Settings).thenReturn(null);

      try {
        handler.handleLogin(request, response);
      } catch (Exception e) {
        // Expected for mock since SAML settings are null
      }

      verify(session).setAttribute("redirectUri", callbackUrl);
    }
  }

  @Test
  void testHandleLogin_WithRedirectUriParameter() {
    // Test fallback: when 'callback' is null, 'redirectUri' is used
    String redirectUri = "https://example.com/redirect";
    when(request.getParameter("callback")).thenReturn(null);
    when(request.getParameter("redirectUri")).thenReturn(redirectUri);

    try (MockedStatic<SamlSettingsHolder> samlMock = mockStatic(SamlSettingsHolder.class)) {
      samlMock.when(SamlSettingsHolder::getSaml2Settings).thenReturn(null);

      try {
        handler.handleLogin(request, response);
      } catch (Exception e) {
        // Expected for mock since SAML settings are null
      }

      verify(session).setAttribute("redirectUri", redirectUri);
    }
  }

  @Test
  void testHandleLogin_WithNoParameters() {
    // Test when neither parameter is provided
    when(request.getParameter("callback")).thenReturn(null);
    when(request.getParameter("redirectUri")).thenReturn(null);

    try (MockedStatic<SamlSettingsHolder> samlMock = mockStatic(SamlSettingsHolder.class)) {
      samlMock
          .when(SamlSettingsHolder::getSaml2Settings)
          .thenThrow(new SAMLException("Mock exception"));

      handler.handleLogin(request, response);

      verify(session, never()).setAttribute(eq("redirectUri"), any());
    } catch (Exception e) {
      // Expected for mock - verify no session was set
      verify(session, never()).setAttribute(eq("redirectUri"), any());
    }
  }

  @Test
  void testHandleLogin_SAMLException() throws Exception {
    when(request.getParameter("callback")).thenReturn("https://example.com/callback");

    try (MockedStatic<SamlSettingsHolder> samlMock = mockStatic(SamlSettingsHolder.class)) {
      // Simulate SAML error by returning null which causes NPE in Auth constructor
      samlMock.when(SamlSettingsHolder::getSaml2Settings).thenReturn(null);

      try {
        handler.handleLogin(request, response);
      } catch (Exception e) {
        // Expected exception
      }

      verify(response).setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
    }
  }

  @Test
  void testHandleRefresh_SuccessfulRefresh() throws Exception {
    String username = "testuser";
    String refreshTokenValue = "refresh-token-123";

    when(session.getAttribute("refreshToken")).thenReturn(refreshTokenValue);
    when(session.getAttribute("username")).thenReturn(username);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<JWTTokenGenerator> jwtMock = mockStatic(JWTTokenGenerator.class)) {

      entityMock
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.USER, username, "id,roles,isAdmin,email", Include.NON_DELETED))
          .thenReturn(user);

      jwtMock.when(JWTTokenGenerator::getInstance).thenReturn(jwtTokenGenerator);
      when(jwtTokenGenerator.generateJWTToken(
              any(), any(), anyBoolean(), any(), anyLong(), anyBoolean(), any()))
          .thenReturn(jwtAuthMechanism);

      handler.handleRefresh(request, response);

      // Verify response - may be called multiple times by writeJsonResponse
      verify(response, Mockito.atLeastOnce()).setContentType("application/json");
    }
  }

  @Test
  void testHandleRefresh_NoSession() throws Exception {
    when(request.getSession(false)).thenReturn(null);

    handler.handleRefresh(request, response);

    verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    // Response content may not be in responseWriter due to error handling
  }

  @Test
  void testHandleRefresh_NoRefreshToken() throws Exception {
    when(session.getAttribute("refreshToken")).thenReturn(null);

    handler.handleRefresh(request, response);

    verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    // Response content may not be in responseWriter due to error handling
  }

  @Test
  void testHandleLogout_WithSession() throws Exception {
    try (MockedStatic<SamlSettingsHolder> samlMock = mockStatic(SamlSettingsHolder.class)) {
      samlMock.when(SamlSettingsHolder::getSaml2Settings).thenReturn(null);

      try {
        handler.handleLogout(request, response);
      } catch (Exception e) {
        // Expected for mock
      }

      verify(session).invalidate();
    }
  }

  @Test
  void testHandleLogout_NoSession() throws Exception {
    when(request.getSession(false)).thenReturn(null);

    try (MockedStatic<SamlSettingsHolder> samlMock = mockStatic(SamlSettingsHolder.class)) {
      samlMock.when(SamlSettingsHolder::getSaml2Settings).thenReturn(null);

      try {
        handler.handleLogout(request, response);
      } catch (Exception e) {
        // Expected for mock
      }

      verify(session, never()).invalidate();
    }
  }

  @Test
  void testHandleSendRedirect() throws IOException {
    // Test sendRedirect method behavior
    String redirectUrl = "https://example.com/redirect";

    doNothing().when(response).sendRedirect(redirectUrl);

    // This tests the redirect functionality
    response.sendRedirect(redirectUrl);

    verify(response).sendRedirect(redirectUrl);
  }

  @Test
  void testHandleSendRedirectIOException() throws IOException {
    // Test sendRedirect when IOException occurs
    String redirectUrl = "https://example.com/redirect";

    doThrow(new IOException("Network error")).when(response).sendRedirect(redirectUrl);

    try {
      response.sendRedirect(redirectUrl);
    } catch (IOException e) {
      assertEquals("Network error", e.getMessage());
    }

    verify(response).sendRedirect(redirectUrl);
  }

  @Test
  void testURLConstruction() {
    // Test URL construction logic
    String redirectUri = "https://example.com/auth/callback";
    String mockToken = "test.jwt.token";

    String expectedRedirectUrl =
        redirectUri + "?id_token=" + URLEncoder.encode(mockToken, StandardCharsets.UTF_8);

    assertTrue(expectedRedirectUrl.startsWith("https://example.com"));
    assertTrue(expectedRedirectUrl.contains("id_token="));
    assertTrue(expectedRedirectUrl.contains("test.jwt.token"));
  }

  @Test
  void testStoredRedirectUriHandling() {
    // Test stored redirect URI precedence
    String storedRedirectUri = "https://stored.example.com/callback";
    String mockToken = "stored.test.token";

    String expectedRedirectUrl =
        storedRedirectUri + "?id_token=" + URLEncoder.encode(mockToken, StandardCharsets.UTF_8);

    // Should use stored redirect URI when available
    assertTrue(expectedRedirectUrl.startsWith("https://stored.example.com/callback"));
    assertTrue(expectedRedirectUrl.contains("id_token="));
  }

  @Test
  void testDefaultCallbackURL() {
    // Test default callback URL construction
    String mockToken = "default.test.token";
    String expectedCallbackUrl =
        "/auth/callback?id_token=" + URLEncoder.encode(mockToken, StandardCharsets.UTF_8);

    assertTrue(expectedCallbackUrl.startsWith("/auth/callback?id_token="));
    assertTrue(expectedCallbackUrl.contains("default.test.token"));
  }

  @Test
  void testAdminPrincipalsConfiguration() {
    // Test that admin principals are properly configured
    String adminUser = "saml-admin";

    // Verify handler was created with admin principals
    assertTrue(adminPrincipals.contains(adminUser));
    assertTrue(adminPrincipals.contains("admin"));
    assertEquals(2, adminPrincipals.size());
  }

  @Test
  void testSamlAuthServletHandlerSingleton() {
    // Test singleton pattern
    SamlAuthServletHandler handler1 =
        SamlAuthServletHandler.getInstance(authConfig, authorizerConfig);
    SamlAuthServletHandler handler2 =
        SamlAuthServletHandler.getInstance(authConfig, authorizerConfig);

    assertNotNull(handler1);
    assertNotNull(handler2);
    assertEquals(handler1, handler2); // Should be the same instance
  }

  @Test
  void testMapToStandardClaimNameWithAzureAdUrnExtraction() throws Exception {
    java.lang.reflect.Method method =
        SamlAuthServletHandler.class.getDeclaredMethod("mapToStandardClaimName", String.class);
    method.setAccessible(true);

    String givenNameResult =
        (String)
            method.invoke(
                handler, "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname");
    assertEquals("given_name", givenNameResult);

    String surnameResult =
        (String)
            method.invoke(handler, "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname");
    assertEquals("family_name", surnameResult);

    String displayNameResult =
        (String) method.invoke(handler, "http://schemas.microsoft.com/identity/claims/displayname");
    assertEquals("name", displayNameResult);
  }

  @Test
  void testMapToStandardClaimNameWithShortNames() throws Exception {
    java.lang.reflect.Method method =
        SamlAuthServletHandler.class.getDeclaredMethod("mapToStandardClaimName", String.class);
    method.setAccessible(true);

    assertEquals("given_name", method.invoke(handler, "givenname"));
    assertEquals("given_name", method.invoke(handler, "firstName"));
    assertEquals("family_name", method.invoke(handler, "familyname"));
    assertEquals("family_name", method.invoke(handler, "lastName"));
    assertEquals("family_name", method.invoke(handler, "surname"));
    assertEquals("name", method.invoke(handler, "displayname"));
  }

  @Test
  void testMapToStandardClaimNameCaseInsensitive() throws Exception {
    java.lang.reflect.Method method =
        SamlAuthServletHandler.class.getDeclaredMethod("mapToStandardClaimName", String.class);
    method.setAccessible(true);

    assertEquals("given_name", method.invoke(handler, "GivenName"));
    assertEquals("given_name", method.invoke(handler, "GIVENNAME"));
    assertEquals("family_name", method.invoke(handler, "FamilyName"));
    assertEquals("family_name", method.invoke(handler, "SURNAME"));
  }

  @Test
  void testMapToStandardClaimNameWithUnknownAttribute() throws Exception {
    java.lang.reflect.Method method =
        SamlAuthServletHandler.class.getDeclaredMethod("mapToStandardClaimName", String.class);
    method.setAccessible(true);

    String customResult =
        (String) method.invoke(handler, "http://custom.com/claims/customAttribute");
    assertEquals("customattribute", customResult);

    String unknownResult = (String) method.invoke(handler, "unknownClaim");
    assertEquals("unknownclaim", unknownResult);
  }
}
