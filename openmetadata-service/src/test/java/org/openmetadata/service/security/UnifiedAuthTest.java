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

package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.BufferedReader;
import java.io.PrintWriter;
import java.io.StringReader;
import java.io.StringWriter;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.AuthenticationException;
import org.openmetadata.service.security.auth.AuthenticatorHandler;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

/**
 * Comprehensive test suite for unified authentication flow
 */
@ExtendWith(MockitoExtension.class)
public class UnifiedAuthTest {

  @Mock private HttpServletRequest mockRequest;
  @Mock private HttpServletResponse mockResponse;
  @Mock private HttpSession mockSession;
  @Mock private AuthenticatorHandler mockAuthenticator;
  @Mock private SecurityConfigurationManager mockSecurityManager;
  @Mock private OpenMetadataApplicationConfig mockConfig;

  private BasicAuthHandler basicAuthHandler;
  private StringWriter responseWriter;

  @BeforeEach
  void setUp() throws Exception {
    basicAuthHandler = new BasicAuthHandler();
    responseWriter = new StringWriter();

    // Setup common mocks
    when(mockRequest.getSession(anyBoolean())).thenReturn(mockSession);
    when(mockSession.getId()).thenReturn("test-session-id");
    when(mockResponse.getWriter()).thenReturn(new PrintWriter(responseWriter));
  }

  @Test
  void testBasicAuthLoginSuccess() throws Exception {
    // Prepare test data
    String username = "testuser";
    String password = Base64.getEncoder().encodeToString("password123".getBytes());
    String loginJson =
        String.format("{\"username\":\"%s\",\"password\":\"%s\"}", username, password);

    // Mock request body
    BufferedReader reader = new BufferedReader(new StringReader(loginJson));
    when(mockRequest.getReader()).thenReturn(reader);

    // Mock authenticator response
    JwtResponse jwtResponse = new JwtResponse();
    jwtResponse.setAccessToken("test-access-token");
    jwtResponse.setRefreshToken("test-refresh-token");
    jwtResponse.setTokenType("Bearer");
    jwtResponse.setExpiryDuration(3600L);

    when(mockSecurityManager.getAuthenticatorHandler()).thenReturn(mockAuthenticator);
    when(mockAuthenticator.loginUser(any(LoginRequest.class))).thenReturn(jwtResponse);

    // Execute
    basicAuthHandler.handleLogin(mockRequest, mockResponse);

    // Verify
    verify(mockSession).setAttribute("jwtResponse", jwtResponse);
    verify(mockResponse).sendRedirect(contains("id_token=test-access-token"));
  }

  @Test
  void testBasicAuthLoginFailure() throws Exception {
    // Prepare test data with invalid password
    String loginJson = "{\"username\":\"testuser\",\"password\":\"invalid-base64\"}";
    BufferedReader reader = new BufferedReader(new StringReader(loginJson));
    when(mockRequest.getReader()).thenReturn(reader);

    // Execute
    basicAuthHandler.handleLogin(mockRequest, mockResponse);

    // Verify error response
    verify(mockResponse).setStatus(HttpServletResponse.SC_BAD_REQUEST);
    verify(mockResponse).setContentType("application/json");
    assertTrue(responseWriter.toString().contains("INVALID_REQUEST"));
  }

  @Test
  void testTokenRefresh() throws Exception {
    // Prepare refresh request
    String refreshJson = "{\"refreshToken\":\"test-refresh-token\"}";
    BufferedReader reader = new BufferedReader(new StringReader(refreshJson));
    when(mockRequest.getReader()).thenReturn(reader);

    // Mock new token response
    JwtResponse newTokenResponse = new JwtResponse();
    newTokenResponse.setAccessToken("new-access-token");
    newTokenResponse.setRefreshToken("new-refresh-token");

    when(mockSecurityManager.getAuthenticatorHandler()).thenReturn(mockAuthenticator);
    when(mockAuthenticator.getNewAccessToken(any())).thenReturn(newTokenResponse);

    // Execute
    basicAuthHandler.handleRefresh(mockRequest, mockResponse);

    // Verify
    assertTrue(responseWriter.toString().contains("new-access-token"));
  }

  @Test
  void testLogout() throws Exception {
    // Prepare logout request
    String logoutJson = "{\"username\":\"testuser\",\"token\":\"test-token\"}";
    BufferedReader reader = new BufferedReader(new StringReader(logoutJson));
    when(mockRequest.getReader()).thenReturn(reader);

    // Execute
    basicAuthHandler.handleLogout(mockRequest, mockResponse);

    // Verify
    verify(mockSession).invalidate();
    verify(mockResponse).setStatus(HttpServletResponse.SC_OK);
    assertTrue(responseWriter.toString().contains("Logout Successful"));
  }

  @Test
  void testAuthServletFactoryRouting() {
    // Test Basic Auth routing
    AuthenticationConfiguration basicConfig = new AuthenticationConfiguration();
    basicConfig.setProvider(AuthProvider.BASIC);
    when(mockSecurityManager.getCurrentAuthConfig()).thenReturn(basicConfig);

    AuthServeletHandler handler = AuthServeletHandlerFactory.getHandler();
    assertTrue(handler instanceof BasicAuthHandler);

    // Test SAML routing
    AuthenticationConfiguration samlConfig = new AuthenticationConfiguration();
    samlConfig.setProvider(AuthProvider.SAML);
    when(mockSecurityManager.getCurrentAuthConfig()).thenReturn(samlConfig);

    handler = AuthServeletHandlerFactory.getHandler();
    assertTrue(handler instanceof SamlAuthHandler);

    // Test OIDC Confidential routing
    AuthenticationConfiguration oidcConfig = new AuthenticationConfiguration();
    oidcConfig.setProvider(AuthProvider.GOOGLE);
    oidcConfig.setClientType(ClientType.CONFIDENTIAL);
    when(mockSecurityManager.getCurrentAuthConfig()).thenReturn(oidcConfig);

    handler = AuthServeletHandlerFactory.getHandler();
    assertTrue(handler instanceof AuthenticationCodeFlowHandler);

    // Test OIDC Public routing
    oidcConfig.setClientType(ClientType.PUBLIC);
    handler = AuthServeletHandlerFactory.getHandler();
    assertTrue(handler instanceof NoopAuthServeletHandler);
  }

  @Test
  void testSessionManagement() {
    UnifiedSessionManager sessionManager = UnifiedSessionManager.getInstance();

    // Test storing auth session
    User testUser = new User();
    testUser.setId(UUID.randomUUID());
    testUser.setName("testuser");

    JwtResponse jwtResponse = new JwtResponse();
    jwtResponse.setAccessToken("test-token");
    jwtResponse.setRefreshToken(UUID.randomUUID().toString());

    sessionManager.storeAuthSession(mockRequest, testUser, jwtResponse, "BASIC");

    // Verify session attributes were set
    verify(mockSession).setAttribute("jwtResponse", jwtResponse);
    verify(mockSession).setAttribute("authenticatedUser", testUser);
    verify(mockSession).setAttribute("authType", "BASIC");
  }

  @Test
  void testBackwardCompatibility() {
    // Test legacy endpoint routing
    AuthenticationConfiguration basicConfig = new AuthenticationConfiguration();
    basicConfig.setProvider(AuthProvider.BASIC);
    when(mockSecurityManager.getCurrentAuthConfig()).thenReturn(basicConfig);

    // Test legacy basic login
    LegacyAuthCompatibilityHandler.handleLegacyBasicLogin(mockRequest, mockResponse);
    // Should not throw exception

    // Test legacy SAML login with wrong config
    LegacyAuthCompatibilityHandler.handleLegacySamlLogin(mockRequest, mockResponse);
    verify(mockResponse).setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
  }

  @Test
  void testErrorHandling() {
    // Test authentication error
    Exception authError = new AuthenticationException("Invalid credentials");
    AuthErrorHandler.handleAuthError(mockResponse, authError, "TEST");

    verify(mockResponse).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    verify(mockResponse).setContentType("application/json");
    assertTrue(responseWriter.toString().contains("AUTHENTICATION_FAILED"));

    // Test authorization error
    responseWriter = new StringWriter();
    Exception authzError = new AuthorizationException("Access denied");
    AuthErrorHandler.handleAuthError(mockResponse, authzError, "TEST");

    verify(mockResponse).setStatus(HttpServletResponse.SC_FORBIDDEN);
    assertTrue(responseWriter.toString().contains("AUTHORIZATION_FAILED"));
  }
}
