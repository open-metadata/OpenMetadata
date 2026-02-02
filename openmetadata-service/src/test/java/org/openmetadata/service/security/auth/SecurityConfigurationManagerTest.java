package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;

public class SecurityConfigurationManagerTest {

  private SecurityConfigurationManager manager;

  @BeforeEach
  void setUp() {
    manager = SecurityConfigurationManager.getInstance();
    manager.setCurrentAuthConfig(null);
    manager.setCurrentAuthzConfig(null);
  }

  @AfterEach
  void tearDown() {
    manager.setCurrentAuthConfig(null);
    manager.setCurrentAuthzConfig(null);
  }

  @Test
  void testGetInstance_ReturnsSingleton() {
    SecurityConfigurationManager instance1 = SecurityConfigurationManager.getInstance();
    SecurityConfigurationManager instance2 = SecurityConfigurationManager.getInstance();

    assertNotNull(instance1);
    assertSame(instance1, instance2);
  }

  @Test
  void testIsSaml_WithSamlProvider() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withProvider(AuthProvider.SAML);
    manager.setCurrentAuthConfig(authConfig);

    assertTrue(SecurityConfigurationManager.isSaml());
  }

  @Test
  void testIsSaml_WithNonSamlProvider() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withProvider(AuthProvider.BASIC);
    manager.setCurrentAuthConfig(authConfig);

    assertFalse(SecurityConfigurationManager.isSaml());
  }

  @Test
  void testIsSaml_WithNullConfig() {
    manager.setCurrentAuthConfig(null);

    assertFalse(SecurityConfigurationManager.isSaml());
  }

  @Test
  void testIsBasicAuth_WithBasicProvider() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withProvider(AuthProvider.BASIC);
    manager.setCurrentAuthConfig(authConfig);

    assertTrue(SecurityConfigurationManager.isBasicAuth());
  }

  @Test
  void testIsBasicAuth_WithNonBasicProvider() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withProvider(AuthProvider.GOOGLE);
    manager.setCurrentAuthConfig(authConfig);

    assertFalse(SecurityConfigurationManager.isBasicAuth());
  }

  @Test
  void testIsLdap_WithLdapProvider() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withProvider(AuthProvider.LDAP);
    manager.setCurrentAuthConfig(authConfig);

    assertTrue(SecurityConfigurationManager.isLdap());
  }

  @Test
  void testIsLdap_WithNonLdapProvider() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withProvider(AuthProvider.OKTA);
    manager.setCurrentAuthConfig(authConfig);

    assertFalse(SecurityConfigurationManager.isLdap());
  }

  @Test
  void testIsOidc_WithGoogleProvider() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withProvider(AuthProvider.GOOGLE);
    manager.setCurrentAuthConfig(authConfig);

    assertTrue(SecurityConfigurationManager.isOidc());
  }

  @Test
  void testIsOidc_WithOktaProvider() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withProvider(AuthProvider.OKTA);
    manager.setCurrentAuthConfig(authConfig);

    assertTrue(SecurityConfigurationManager.isOidc());
  }

  @Test
  void testIsOidc_WithAuth0Provider() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withProvider(AuthProvider.AUTH_0);
    manager.setCurrentAuthConfig(authConfig);

    assertTrue(SecurityConfigurationManager.isOidc());
  }

  @Test
  void testIsOidc_WithAzureProvider() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withProvider(AuthProvider.AZURE);
    manager.setCurrentAuthConfig(authConfig);

    assertTrue(SecurityConfigurationManager.isOidc());
  }

  @Test
  void testIsOidc_WithCustomOidcProvider() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withProvider(AuthProvider.CUSTOM_OIDC);
    manager.setCurrentAuthConfig(authConfig);

    assertTrue(SecurityConfigurationManager.isOidc());
  }

  @Test
  void testIsOidc_WithAwsCognitoProvider() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withProvider(AuthProvider.AWS_COGNITO);
    manager.setCurrentAuthConfig(authConfig);

    assertTrue(SecurityConfigurationManager.isOidc());
  }

  @Test
  void testIsOidc_WithNonOidcProvider() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withProvider(AuthProvider.SAML);
    manager.setCurrentAuthConfig(authConfig);

    assertFalse(SecurityConfigurationManager.isOidc());
  }

  @Test
  void testIsOidc_WithNullConfig() {
    manager.setCurrentAuthConfig(null);

    assertFalse(SecurityConfigurationManager.isOidc());
  }

  @Test
  void testIsConfidentialClient_WithConfidentialType() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withClientType(ClientType.CONFIDENTIAL);
    manager.setCurrentAuthConfig(authConfig);

    assertTrue(SecurityConfigurationManager.isConfidentialClient());
  }

  @Test
  void testIsConfidentialClient_WithPublicType() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withClientType(ClientType.PUBLIC);
    manager.setCurrentAuthConfig(authConfig);

    assertFalse(SecurityConfigurationManager.isConfidentialClient());
  }

  @Test
  void testIsConfidentialClient_WithNullConfig() {
    manager.setCurrentAuthConfig(null);

    assertFalse(SecurityConfigurationManager.isConfidentialClient());
  }

  @Test
  void testGetCurrentAuthConfig_ReturnsSetValue() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withProvider(AuthProvider.GOOGLE);
    manager.setCurrentAuthConfig(authConfig);

    AuthenticationConfiguration result = SecurityConfigurationManager.getCurrentAuthConfig();

    assertNotNull(result);
    assertEquals(AuthProvider.GOOGLE, result.getProvider());
  }

  @Test
  void testGetCurrentAuthConfig_ReturnsNull_WhenNotSet() {
    manager.setCurrentAuthConfig(null);

    AuthenticationConfiguration result = SecurityConfigurationManager.getCurrentAuthConfig();

    assertNull(result);
  }

  @Test
  void testGetCurrentAuthzConfig_ReturnsSetValue() {
    AuthorizerConfiguration authzConfig = new AuthorizerConfiguration();
    manager.setCurrentAuthzConfig(authzConfig);

    AuthorizerConfiguration result = SecurityConfigurationManager.getCurrentAuthzConfig();

    assertNotNull(result);
    assertSame(authzConfig, result);
  }

  @Test
  void testGetCurrentAuthzConfig_ReturnsNull_WhenNotSet() {
    manager.setCurrentAuthzConfig(null);

    AuthorizerConfiguration result = SecurityConfigurationManager.getCurrentAuthzConfig();

    assertNull(result);
  }

  @Test
  void testGetCurrentSecurityConfig_CombinesBothConfigs() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withProvider(AuthProvider.BASIC);
    AuthorizerConfiguration authzConfig = new AuthorizerConfiguration();

    manager.setCurrentAuthConfig(authConfig);
    manager.setCurrentAuthzConfig(authzConfig);

    SecurityConfiguration securityConfig = manager.getCurrentSecurityConfig();

    assertNotNull(securityConfig);
    assertEquals(AuthProvider.BASIC, securityConfig.getAuthenticationConfiguration().getProvider());
    assertSame(authzConfig, securityConfig.getAuthorizerConfiguration());
  }
}
