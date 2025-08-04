package org.openmetadata.service.security.auth.validator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.ValidationResult;

public class AzureAuthValidatorTest {
  private AzureAuthValidator validator;
  private AuthenticationConfiguration authConfig;
  private OidcClientConfig oidcConfig;

  @BeforeEach
  void setUp() {
    validator = new AzureAuthValidator();
    authConfig = new AuthenticationConfiguration();
    oidcConfig = new OidcClientConfig();
  }

  @Test
  void testValidateAzureConfiguration_InvalidAuthority() {
    // Test with invalid authority URL
    authConfig.setAuthority("https://invalid.com/tenant");
    authConfig.setClientId("12345678-1234-1234-1234-123456789012");

    ValidationResult result = validator.validateAzureConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result.getStatus());
    assertEquals("azure-basic", result.getComponent());
    assertTrue(
        result.getMessage().contains("Azure authority must use login.microsoftonline.com domain"));
  }

  @Test
  void testValidateAzureConfiguration_InvalidClientIdFormat() {
    // Test with invalid client ID format
    authConfig.setAuthority("https://login.microsoftonline.com/common");
    authConfig.setClientId("invalid-client-id");

    ValidationResult result = validator.validateAzureConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result.getStatus());
    assertEquals("azure-basic", result.getComponent());
    assertTrue(result.getMessage().contains("Invalid Azure client ID format"));
  }

  @Test
  void testValidateAzureConfiguration_InvalidTenantIdFormat() {
    // Test with invalid tenant ID in authority
    authConfig.setAuthority("https://login.microsoftonline.com/invalid-tenant-id");
    authConfig.setClientId("12345678-1234-1234-1234-123456789012");

    ValidationResult result = validator.validateAzureConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result.getStatus());
    assertTrue(result.getMessage().contains("Invalid tenant ID format"));
  }

  @Test
  void testValidateAzureConfiguration_ValidCommonTenant() {
    // Test with valid 'common' tenant
    authConfig.setAuthority("https://login.microsoftonline.com/common");
    authConfig.setClientId("12345678-1234-1234-1234-123456789012");

    // This will fail at the network level, but should pass basic validation
    ValidationResult result = validator.validateAzureConfiguration(authConfig, oidcConfig);

    // It will fail when trying to access the discovery endpoint
    assertEquals("failed", result.getStatus());
    assertEquals("azure-tenant", result.getComponent());
  }

  @Test
  void testValidateAzureConfiguration_ValidGuidTenant() {
    // Test with valid GUID tenant
    authConfig.setAuthority(
        "https://login.microsoftonline.com/12345678-1234-1234-1234-123456789012");
    authConfig.setClientId("87654321-4321-4321-4321-210987654321");

    // This will fail at the network level (unless you have a real tenant), but should pass format
    // validation
    ValidationResult result = validator.validateAzureConfiguration(authConfig, oidcConfig);

    // It will fail when trying to access the discovery endpoint
    assertEquals("failed", result.getStatus());
    assertEquals("azure-tenant", result.getComponent());
  }
}
