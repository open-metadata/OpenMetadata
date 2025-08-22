package org.openmetadata.service.security.auth.validator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
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
    oidcConfig = new OidcClientConfig();
  }

  @Test
  void testValidateGoogleConfiguration_InvalidClientIdFormat() {
    // Test with invalid client ID format
    authConfig.setClientId("invalid-client-id");

    ValidationResult result = validator.validateGoogleConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result.getStatus());
    assertEquals("google-basic", result.getComponent());
    assertTrue(result.getMessage().contains("Invalid Google client ID format"));
  }

  @Test
  void testValidateGoogleConfiguration_InvalidClientIdProjectFormat() {
    // Test with wrong project ID format in client ID
    authConfig.setClientId("invalid-project.apps.googleusercontent.com");

    ValidationResult result = validator.validateGoogleConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result.getStatus());
    assertEquals("google-basic", result.getComponent());
    assertTrue(result.getMessage().contains("project ID portion should match pattern"));
  }

  @Test
  void testValidateGoogleConfiguration_ValidClientId() {
    // Test with valid client ID format
    authConfig.setClientId(
        "123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com");

    // This will fail at the discovery endpoint check (unless run with internet access)
    ValidationResult result = validator.validateGoogleConfiguration(authConfig, oidcConfig);

    // Should pass basic validation but might fail on discovery endpoint
    if ("failed".equals(result.getStatus())) {
      assertEquals("google-discovery", result.getComponent());
    }
  }

  @Test
  void testValidateGoogleConfiguration_InvalidAuthority() {
    // Test with invalid authority
    authConfig.setClientId(
        "123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com");
    authConfig.setAuthority("https://invalid.com");

    ValidationResult result = validator.validateGoogleConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result.getStatus());
    assertEquals("google-basic", result.getComponent());
    assertTrue(result.getMessage().contains("Google authority must use accounts.google.com"));
  }

  @Test
  void testValidateGoogleConfiguration_EmptyClientSecret() {
    // Test with empty client secret
    authConfig.setClientId(
        "123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com");
    oidcConfig.setSecret("");

    ValidationResult result = validator.validateGoogleConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result.getStatus());
    assertTrue(result.getMessage().contains("Client secret is required"));
  }

  @Test
  void testValidateGoogleConfiguration_ShortClientSecret() {
    // Test with too short client secret
    authConfig.setClientId(
        "123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com");
    oidcConfig.setSecret("short");

    ValidationResult result = validator.validateGoogleConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result.getStatus());
    assertTrue(result.getMessage().contains("Client secret appears to be invalid"));
  }
}
