package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.AfterEach;
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
import org.openmetadata.service.security.AuthServeletHandlerRegistry;
import org.openmetadata.service.security.NoopAuthServeletHandler;
import org.openmetadata.service.security.session.SessionService;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class UnifiedAuthTest {

  @Mock private OpenMetadataApplicationConfig mockConfig;
  @Mock private AuthenticationConfiguration mockAuthConfig;
  @Mock private AuthorizerConfiguration mockAuthzConfig;
  @Mock private SessionService sessionService;

  @BeforeEach
  void setUp() {}

  @AfterEach
  void tearDown() {
    SecurityConfigurationManager.getInstance().setCurrentAuthConfig(null);
    SecurityConfigurationManager.getInstance().setCurrentAuthzConfig(null);
    AuthServeletHandlerRegistry.setSessionService(null, null);
  }

  @Test
  void testFactoryReturnsCorrectHandlerForBasicAuth() {
    // Setup
    when(mockAuthConfig.getProvider()).thenReturn(AuthProvider.BASIC);
    SecurityConfigurationManager.getInstance().setCurrentAuthConfig(mockAuthConfig);
    SecurityConfigurationManager.getInstance().setCurrentAuthzConfig(mockAuthzConfig);

    // Execute
    AuthServeletHandler handler = AuthServeletHandlerFactory.getHandler(mockConfig, sessionService);

    // Verify
    assertNotNull(handler);
    assertInstanceOf(BasicAuthServletHandler.class, handler);
  }

  @Test
  void testFactoryReturnsCorrectHandlerForLdapAuth() {
    // Setup
    when(mockAuthConfig.getProvider()).thenReturn(AuthProvider.LDAP);
    SecurityConfigurationManager.getInstance().setCurrentAuthConfig(mockAuthConfig);
    SecurityConfigurationManager.getInstance().setCurrentAuthzConfig(mockAuthzConfig);

    // Execute
    AuthServeletHandler handler = AuthServeletHandlerFactory.getHandler(mockConfig, sessionService);

    // Verify
    assertNotNull(handler);
    assertInstanceOf(LdapAuthServletHandler.class, handler);
  }

  @Test
  void testUnifiedLoginEndpoint() {
    when(mockAuthConfig.getProvider()).thenReturn(AuthProvider.BASIC);
    when(mockAuthConfig.getCallbackUrl()).thenReturn("http://localhost:8585");
    SecurityConfigurationManager.getInstance().setCurrentAuthConfig(mockAuthConfig);
    SecurityConfigurationManager.getInstance().setCurrentAuthzConfig(mockAuthzConfig);

    AuthServeletHandler handler = AuthServeletHandlerFactory.getHandler(mockConfig, sessionService);

    // Verify handler exists and is of correct type
    assertNotNull(handler);
    assertTrue(
        handler instanceof BasicAuthServletHandler || handler instanceof NoopAuthServeletHandler);
  }

  @Test
  void testAuthConfigSwitching() {
    // Test that switching auth config works correctly

    // Start with Basic auth
    when(mockAuthConfig.getProvider()).thenReturn(AuthProvider.BASIC);
    SecurityConfigurationManager.getInstance().setCurrentAuthConfig(mockAuthConfig);

    AuthServeletHandler handler1 =
        AuthServeletHandlerFactory.getHandler(mockConfig, sessionService);
    assertTrue(handler1 instanceof BasicAuthServletHandler);

    // Switch to LDAP
    when(mockAuthConfig.getProvider()).thenReturn(AuthProvider.LDAP);
    SecurityConfigurationManager.getInstance().setCurrentAuthConfig(mockAuthConfig);

    AuthServeletHandler handler2 =
        AuthServeletHandlerFactory.getHandler(mockConfig, sessionService);
    assertTrue(handler2 instanceof LdapAuthServletHandler);
  }

  @Test
  void testFactoryRequiresRegisteredSessionService() {
    when(mockAuthConfig.getProvider()).thenReturn(AuthProvider.BASIC);
    SecurityConfigurationManager.getInstance().setCurrentAuthConfig(mockAuthConfig);
    SecurityConfigurationManager.getInstance().setCurrentAuthzConfig(mockAuthzConfig);
    AuthServeletHandlerRegistry.setSessionService(null, null);

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class, () -> AuthServeletHandlerFactory.getHandler(mockConfig));

    assertTrue(exception.getMessage().contains("SessionService must be initialized"));
  }
}
