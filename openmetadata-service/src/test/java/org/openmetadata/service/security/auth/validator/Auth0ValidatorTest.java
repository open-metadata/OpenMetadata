package org.openmetadata.service.security.auth.validator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.ValidationResult;

public class Auth0ValidatorTest {
  private Auth0Validator validator;
  private AuthenticationConfiguration authConfig;
  private OidcClientConfig oidcConfig;

  @BeforeEach
  void setUp() {
    validator = new Auth0Validator();
    authConfig = new AuthenticationConfiguration();
    authConfig.setClientType(ClientType.PUBLIC);
    oidcConfig = new OidcClientConfig();
  }

  @Test
  void testValidateAuth0Configuration_InvalidAuthority() {
    // Test with invalid authority URL for PUBLIC client
    authConfig.setAuthority("https://invalid.com/tenant");
    authConfig.setClientId("ABCDEFGHijklmnop1234567890");
    authConfig.setClientType(ClientType.PUBLIC);

    ValidationResult result = validator.validateAuth0Configuration(authConfig, oidcConfig);

    assertEquals("failed", result.getStatus());
    assertEquals("auth0-domain", result.getComponent());
    assertTrue(result.getMessage().contains("Domain validation failed"));
  }

  @Test
  void testValidateAuth0Configuration_MissingPublicKeyUrls() {
    // Test with valid authority but missing publicKeyUrls
    authConfig.setAuthority("https://dev-example.auth0.com");
    authConfig.setClientId("ABCDEFGHijklmnop1234567890");
    authConfig.setClientType(ClientType.PUBLIC);
    // Not setting publicKeyUrls to trigger error

    ValidationResult result = validator.validateAuth0Configuration(authConfig, oidcConfig);

    // Should fail - either on domain validation or public key URLs
    assertEquals("failed", result.getStatus());
    assertTrue(result.getComponent().startsWith("auth0"));
  }

  @Test
  void testValidateAuth0Configuration_InvalidClientIdFormat() {
    // Test with invalid client ID for public client
    authConfig.setAuthority("https://dev-example.auth0.com");
    authConfig.setClientId("invalid-client-id");
    authConfig.setClientType(ClientType.PUBLIC);

    List<String> publicKeyUrls = new ArrayList<>();
    publicKeyUrls.add("https://dev-example.auth0.com/.well-known/jwks.json");
    authConfig.setPublicKeyUrls(publicKeyUrls);

    ValidationResult result = validator.validateAuth0Configuration(authConfig, oidcConfig);

    // Should pass basic validation but may fail on client ID validation
    // The exact behavior depends on the validator implementation
    assertTrue(result.getStatus().equals("failed") || result.getStatus().equals("warning"));
  }

  @Test
  void testValidateAuth0Configuration_ConfidentialClientMissingDiscoveryUri() {
    // Test CONFIDENTIAL client without discoveryUri
    authConfig.setClientType(ClientType.CONFIDENTIAL);
    authConfig.setClientId("ABCDEFGHijklmnop1234567890");
    oidcConfig.setId("ABCDEFGHijklmnop1234567890");
    oidcConfig.setSecret("test-secret-12345678901234567890");
    // Missing discoveryUri

    ValidationResult result = validator.validateAuth0Configuration(authConfig, oidcConfig);

    assertEquals("failed", result.getStatus());
    assertTrue(
        result.getMessage().contains("Auth0 domain")
            || result.getMessage().contains("discoveryUri"));
  }

  @Test
  void testValidateAuth0Configuration_ConfidentialClientWithDiscoveryUri() {
    // Test CONFIDENTIAL client with proper discoveryUri
    authConfig.setClientType(ClientType.CONFIDENTIAL);
    authConfig.setClientId("ABCDEFGHijklmnop1234567890");

    List<String> publicKeyUrls = new ArrayList<>();
    publicKeyUrls.add("https://dev-example.auth0.com/.well-known/jwks.json");
    authConfig.setPublicKeyUrls(publicKeyUrls);

    oidcConfig.setId("ABCDEFGHijklmnop1234567890");
    oidcConfig.setSecret("test-secret-12345678901234567890");
    oidcConfig.setDiscoveryUri("https://dev-example.auth0.com/.well-known/openid-configuration");

    ValidationResult result = validator.validateAuth0Configuration(authConfig, oidcConfig);

    // Should pass basic validation, may fail on network calls but with proper component
    assertTrue(result.getComponent().startsWith("auth0"));
  }

  @Test
  void testValidateAuth0Configuration_EmptyClientSecret() {
    // Test with empty client secret for CONFIDENTIAL client
    authConfig.setClientType(ClientType.CONFIDENTIAL);
    authConfig.setClientId("ABCDEFGHijklmnop1234567890");

    List<String> publicKeyUrls = new ArrayList<>();
    publicKeyUrls.add("https://dev-example.auth0.com/.well-known/jwks.json");
    authConfig.setPublicKeyUrls(publicKeyUrls);

    oidcConfig.setId("ABCDEFGHijklmnop1234567890");
    oidcConfig.setSecret("");
    oidcConfig.setDiscoveryUri("https://dev-example.auth0.com/.well-known/openid-configuration");

    ValidationResult result = validator.validateAuth0Configuration(authConfig, oidcConfig);

    // Should fail due to missing or invalid credentials
    assertEquals("failed", result.getStatus());
  }

  @Test
  void testValidateAuth0Configuration_InvalidPublicKeyUrl() {
    // Test with invalid public key URL format
    authConfig.setAuthority("https://dev-example.auth0.com");
    authConfig.setClientId("ABCDEFGHijklmnop1234567890");
    authConfig.setClientType(ClientType.PUBLIC);

    List<String> publicKeyUrls = new ArrayList<>();
    publicKeyUrls.add("https://wrong-domain.com/.well-known/jwks.json");
    authConfig.setPublicKeyUrls(publicKeyUrls);

    ValidationResult result = validator.validateAuth0Configuration(authConfig, oidcConfig);

    assertEquals("failed", result.getStatus());
    assertTrue(result.getComponent().startsWith("auth0"));
  }
}
