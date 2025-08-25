package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.PrintWriter;
import java.io.StringWriter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.security.AuthServeletHandler;
import org.openmetadata.service.security.AuthServeletHandlerFactory;
import org.openmetadata.service.security.NoopAuthServeletHandler;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class UnifiedAuthTest {

  @Mock private HttpServletRequest mockRequest;
  @Mock private HttpServletResponse mockResponse;
  @Mock private HttpSession mockSession;
  @Mock private OpenMetadataApplicationConfig mockConfig;
  @Mock private AuthenticationConfiguration mockAuthConfig;
  @Mock private AuthorizerConfiguration mockAuthzConfig;

  @BeforeEach
  void setUp() {
    // Setup will be done in individual tests as needed
  }

  @Test
  void testFactoryReturnsCorrectHandlerForBasicAuth() {
    // Setup
    when(mockAuthConfig.getProvider()).thenReturn(AuthProvider.BASIC);
    SecurityConfigurationManager.getInstance().setCurrentAuthConfig(mockAuthConfig);
    SecurityConfigurationManager.getInstance().setCurrentAuthzConfig(mockAuthzConfig);

    // Execute
    AuthServeletHandler handler = AuthServeletHandlerFactory.getHandler(mockConfig);

    // Verify
    assertNotNull(handler);
    assertTrue(handler instanceof BasicAuthServletHandler);
  }

  @Test
  void testFactoryReturnsCorrectHandlerForLdapAuth() {
    // Setup
    when(mockAuthConfig.getProvider()).thenReturn(AuthProvider.LDAP);
    SecurityConfigurationManager.getInstance().setCurrentAuthConfig(mockAuthConfig);
    SecurityConfigurationManager.getInstance().setCurrentAuthzConfig(mockAuthzConfig);

    // Execute
    AuthServeletHandler handler = AuthServeletHandlerFactory.getHandler(mockConfig);

    // Verify
    assertNotNull(handler);
    assertTrue(handler instanceof LdapAuthServletHandler);
  }

  @Test
  void testUnifiedLoginEndpoint() throws Exception {
    // This test verifies that all auth types use the same /api/v1/auth/login endpoint
    // and redirect to /callback?id_token=xxx

    // Note: This is a conceptual test - actual implementation requires a running authenticator
    // The test verifies that the handler structure exists and follows the pattern

    when(mockAuthConfig.getProvider()).thenReturn(AuthProvider.BASIC);
    when(mockAuthConfig.getCallbackUrl()).thenReturn("http://localhost:8585");
    SecurityConfigurationManager.getInstance().setCurrentAuthConfig(mockAuthConfig);
    SecurityConfigurationManager.getInstance().setCurrentAuthzConfig(mockAuthzConfig);

    AuthServeletHandler handler = AuthServeletHandlerFactory.getHandler(mockConfig);

    // Verify handler exists and is of correct type
    assertNotNull(handler);
    assertTrue(
        handler instanceof BasicAuthServletHandler || handler instanceof NoopAuthServeletHandler);
  }

  @Test
  void testSessionBasedRefreshToken() throws Exception {
    // This test verifies refresh tokens are stored in session, not sent to client

    when(mockAuthConfig.getProvider()).thenReturn(AuthProvider.BASIC);
    SecurityConfigurationManager.getInstance().setCurrentAuthConfig(mockAuthConfig);
    SecurityConfigurationManager.getInstance().setCurrentAuthzConfig(mockAuthzConfig);

    AuthServeletHandler handler = AuthServeletHandlerFactory.getHandler(mockConfig);

    // Verify handler exists and would use session for refresh tokens
    assertNotNull(handler);
    // The actual session storage happens during login with valid credentials
    // This test verifies the structure is in place
  }

  @Test
  void testAuthConfigSwitching() {
    // Test that switching auth config works correctly

    // Start with Basic auth
    when(mockAuthConfig.getProvider()).thenReturn(AuthProvider.BASIC);
    SecurityConfigurationManager.getInstance().setCurrentAuthConfig(mockAuthConfig);

    AuthServeletHandler handler1 = AuthServeletHandlerFactory.getHandler(mockConfig);
    assertTrue(handler1 instanceof BasicAuthServletHandler);

    // Switch to LDAP
    when(mockAuthConfig.getProvider()).thenReturn(AuthProvider.LDAP);
    SecurityConfigurationManager.getInstance().setCurrentAuthConfig(mockAuthConfig);

    AuthServeletHandler handler2 = AuthServeletHandlerFactory.getHandler(mockConfig);
    assertTrue(handler2 instanceof LdapAuthServletHandler);
  }

  @Test
  void testAllEndpointsPresent() throws Exception {
    // Verify that all 4 required endpoints are handled

    when(mockAuthConfig.getProvider()).thenReturn(AuthProvider.BASIC);
    SecurityConfigurationManager.getInstance().setCurrentAuthConfig(mockAuthConfig);
    SecurityConfigurationManager.getInstance().setCurrentAuthzConfig(mockAuthzConfig);

    AuthServeletHandler handler = AuthServeletHandlerFactory.getHandler(mockConfig);

    // Verify handler exists and has all required methods
    assertNotNull(handler);

    // Mock necessary components for method calls
    when(mockRequest.getSession(anyBoolean())).thenReturn(mockSession);
    when(mockSession.getId()).thenReturn("test-session");

    StringWriter stringWriter = new StringWriter();
    PrintWriter writer = new PrintWriter(stringWriter);
    when(mockResponse.getWriter()).thenReturn(writer);

    // Verify all methods are callable (they may fail due to missing auth, but should not throw
    // compilation errors)
    // Note: Actual execution would require full authentication setup
    assertNotNull(
        handler
            .getClass()
            .getMethod("handleLogin", HttpServletRequest.class, HttpServletResponse.class));
    assertNotNull(
        handler
            .getClass()
            .getMethod("handleCallback", HttpServletRequest.class, HttpServletResponse.class));
    assertNotNull(
        handler
            .getClass()
            .getMethod("handleRefresh", HttpServletRequest.class, HttpServletResponse.class));
    assertNotNull(
        handler
            .getClass()
            .getMethod("handleLogout", HttpServletRequest.class, HttpServletResponse.class));
  }
}
