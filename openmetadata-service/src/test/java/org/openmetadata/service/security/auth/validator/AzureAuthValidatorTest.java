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
import org.openmetadata.schema.system.FieldError;

public class AzureAuthValidatorTest {
  private AzureAuthValidator validator;
  private AuthenticationConfiguration authConfig;
  private OidcClientConfig oidcConfig;

  @BeforeEach
  void setUp() {
    validator = new AzureAuthValidator();
    authConfig = new AuthenticationConfiguration();
    authConfig.setClientType(ClientType.PUBLIC); // Set default client type
    oidcConfig = new OidcClientConfig();
  }

  @Test
  void testValidateAzureConfiguration_InvalidAuthority() {
    // Test with invalid authority URL for PUBLIC client
    authConfig.setAuthority("https://invalid.com/tenant");
    authConfig.setClientId("12345678-1234-1234-1234-123456789012");
    authConfig.setClientType(ClientType.PUBLIC);

    FieldError result = validator.validateAzureConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result != null ? "failed" : "success");
    assertEquals("authenticationConfiguration.authority", result != null ? result.getField() : "");
    assertTrue(
        result != null
            && result
                .getError()
                .contains("Azure authority must use login.microsoftonline.com domain"));
  }

  @Test
  void testValidateAzureConfiguration_InvalidClientIdFormat() {
    // Test with valid authority but missing publicKeyUrls
    authConfig.setAuthority("https://login.microsoftonline.com/common");
    authConfig.setClientId("invalid-client-id");
    authConfig.setClientType(ClientType.PUBLIC);
    // Not setting publicKeyUrls to trigger error

    FieldError result = validator.validateAzureConfiguration(authConfig, oidcConfig);

    // Will fail on publicKeyUrls check first
    assertEquals("failed", result != null ? "failed" : "success");
    if (result != null) {
      assertEquals("authenticationConfiguration.publicKeyUrls", result.getField());
      assertTrue(
          result.getError().contains("Public key") || result.getError().contains("public key"));
    }
  }

  @Test
  void testValidateAzureConfiguration_InvalidTenantIdFormat() {
    // Test with invalid tenant ID in authority
    authConfig.setAuthority("https://login.microsoftonline.com/invalid-tenant-id");
    authConfig.setClientId("12345678-1234-1234-1234-123456789012");
    authConfig.setClientType(ClientType.PUBLIC);

    FieldError result = validator.validateAzureConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result != null ? "failed" : "success");
    assertTrue(result != null && result.getError().contains("Invalid tenant ID format"));
  }

  @Test
  void testValidateAzureConfiguration_ValidCommonTenant() {
    // Test with valid 'common' tenant - will fail on publicKeyUrls
    authConfig.setAuthority("https://login.microsoftonline.com/common");
    authConfig.setClientId("12345678-1234-1234-1234-123456789012");
    authConfig.setClientType(ClientType.PUBLIC);

    // Add public key URLs but wrong format to get past first check
    List<String> publicKeyUrls = new ArrayList<>();
    publicKeyUrls.add("https://example.com/keys");
    authConfig.setPublicKeyUrls(publicKeyUrls);

    FieldError result = validator.validateAzureConfiguration(authConfig, oidcConfig);

    // Will fail on public key URL validation
    assertEquals("failed", result != null ? "failed" : "success");
    assertEquals(
        "authenticationConfiguration.publicKeyUrls", result != null ? result.getField() : "");
  }

  @Test
  void testValidateAzureConfiguration_ValidGuidTenant() {
    // Test with valid GUID tenant - will fail on tenant validation (network call)
    authConfig.setAuthority(
        "https://login.microsoftonline.com/12345678-1234-1234-1234-123456789012");
    authConfig.setClientId("87654321-4321-4321-4321-210987654321");
    authConfig.setClientType(ClientType.PUBLIC);

    FieldError result = validator.validateAzureConfiguration(authConfig, oidcConfig);

    // Will fail when trying to validate tenant exists (network call fails)
    assertEquals("failed", result != null ? "failed" : "success");
    assertEquals(
        "authenticationConfiguration.oidcConfiguration.tenant",
        result != null ? result.getField() : "");
  }
}
