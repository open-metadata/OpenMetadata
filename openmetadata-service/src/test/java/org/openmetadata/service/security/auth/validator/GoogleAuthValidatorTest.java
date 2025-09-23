package org.openmetadata.service.security.auth.validator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.ValidationResult;

public class GoogleAuthValidatorTest {
  private GoogleAuthValidator validator;
  private AuthenticationConfiguration authConfig;
  private OidcClientConfig oidcConfig;

  @BeforeEach
  void setUp() {
    validator = new GoogleAuthValidator();
    authConfig = new AuthenticationConfiguration();
    authConfig.setClientType(ClientType.PUBLIC); // Set default client type
    oidcConfig = new OidcClientConfig();
  }

  @Test
  void testValidateGoogleConfiguration_InvalidClientIdFormat() {
    // Test with invalid client ID format for PUBLIC client
    authConfig.setClientId("invalid-client-id");
    authConfig.setClientType(ClientType.PUBLIC);

    ValidationResult result = validator.validateGoogleConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result.getStatus());
    assertEquals("google-client-id", result.getComponent());
    assertTrue(result.getMessage().contains("Invalid Google client ID format"));
  }

  @Test
  void testValidateGoogleConfiguration_InvalidClientIdProjectFormat() {
    // Test with valid client ID format (no specific project format validation in new code)
    authConfig.setClientId("invalid-project.apps.googleusercontent.com");
    authConfig.setClientType(ClientType.PUBLIC);

    ValidationResult result = validator.validateGoogleConfiguration(authConfig, oidcConfig);

    // The new validator only checks suffix, not project format
    assertEquals("success", result.getStatus());
  }

  @Test
  void testValidateGoogleConfiguration_ValidClientId() {
    // Test with valid client ID format
    authConfig.setClientId(
        "123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com");
    authConfig.setClientType(ClientType.PUBLIC);

    ValidationResult result = validator.validateGoogleConfiguration(authConfig, oidcConfig);

    // Should pass for public client with valid client ID
    assertEquals("success", result.getStatus());
    assertEquals("google-public", result.getComponent());
  }

  @Test
  void testValidateGoogleConfiguration_InvalidAuthority() {
    // Test with invalid authority for PUBLIC client
    authConfig.setClientId(
        "123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com");
    authConfig.setAuthority("https://invalid.com");
    authConfig.setClientType(ClientType.PUBLIC);

    ValidationResult result = validator.validateGoogleConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result.getStatus());
    assertEquals("google-authority", result.getComponent());
    assertTrue(result.getMessage().contains("Google authority must be exactly"));
  }

  @Test
  void testValidateGoogleConfiguration_EmptyClientSecret() {
    // Test with empty client secret for CONFIDENTIAL client
    authConfig.setClientType(ClientType.CONFIDENTIAL);
    oidcConfig.setId("123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com");
    oidcConfig.setSecret("");

    ValidationResult result = validator.validateGoogleConfiguration(authConfig, oidcConfig);

    // The validator requires both client ID and secret for confidential clients
    assertEquals("failed", result.getStatus());
    assertEquals("google-credentials", result.getComponent());
    assertTrue(result.getMessage().contains("Client ID and Client Secret are required"));
  }

  @Test
  void testValidateGoogleConfiguration_ShortClientSecret() {
    // Test with short client secret for CONFIDENTIAL client
    authConfig.setClientType(ClientType.CONFIDENTIAL);
    oidcConfig.setId("123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com");
    oidcConfig.setSecret("short");
    oidcConfig.setCallbackUrl("http://localhost:8585/callback/google");

    ValidationResult result = validator.validateGoogleConfiguration(authConfig, oidcConfig);

    // The validator will try to validate the credentials and likely fail due to invalid secret
    assertEquals("failed", result.getStatus());
    assertEquals("google-credentials", result.getComponent());
  }
}
