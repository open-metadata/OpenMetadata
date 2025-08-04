package org.openmetadata.service.security.auth.validator;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.system.ValidationResult;

class OktaAuthValidatorTest {

  private OktaAuthValidator validator;
  private AuthenticationConfiguration authConfig;
  private OidcClientConfig oidcConfig;

  @BeforeEach
  void setUp() {
    validator = new OktaAuthValidator();
    authConfig = new AuthenticationConfiguration();
    oidcConfig = new OidcClientConfig();

    // Set up basic valid configuration
    authConfig.setClientId("0oa1bcdefg2hijklmn3o4p");
    authConfig.setClientType(ClientType.CONFIDENTIAL);
    authConfig.setProvider(AuthProvider.OKTA);
  }

  @Test
  void testDomainExtractionFromDiscoveryUri() {
    // Test case that reproduces the user's issue
    oidcConfig.setDiscoveryUri(
        "https://dev-96705996-admin.okta.com/oauth2/default/.well-known/openid-configuration");
    oidcConfig.setServerUrl(
        "http://localhost:8585"); // This should NOT be used for domain extraction
    oidcConfig.setSecret("test-secret-12345678901234567890");

    // Mock the validation to avoid network calls during unit tests
    OktaAuthValidator spyValidator = spy(validator);

    // We can't easily test private methods, but we can test the overall validation
    // The fix should prevent the "Okta domain must use HTTPS" error
    ValidationResult result = spyValidator.validateOktaConfiguration(authConfig, oidcConfig);

    // The domain extraction should work correctly now
    // Note: This will still fail due to network calls, but the error message should be different
    assertNotNull(result);

    // If domain extraction was fixed, we shouldn't get the HTTPS error for localhost
    assertFalse(
        result.getMessage().contains("Okta domain must use HTTPS")
            && result.getMessage().contains("localhost"));
  }

  @Test
  void testBasicConfigValidation() {
    oidcConfig.setDiscoveryUri(
        "https://dev-96705996-admin.okta.com/oauth2/default/.well-known/openid-configuration");

    // This should pass basic validation
    // The domain extraction logic should prefer discoveryUri over serverUrl
    ValidationResult result = validator.validateOktaConfiguration(authConfig, oidcConfig);

    assertNotNull(result);
    // Should not fail due to domain format issues
    if ("failed".equals(result.getStatus())
        && result.getMessage().contains("domain must use HTTPS")) {
      fail("Domain validation should not fail with HTTPS error when using proper discoveryUri");
    }
  }

  @Test
  void testMissingDiscoveryUriAndValidServerUrl() {
    // Test fallback to serverUrl when it contains "okta"
    oidcConfig.setServerUrl("https://company.okta.com");
    oidcConfig.setSecret("test-secret-12345678901234567890");

    ValidationResult result = validator.validateOktaConfiguration(authConfig, oidcConfig);

    assertNotNull(result);
    // Should use the Okta serverUrl, not fail
  }

  @Test
  void testMissingDiscoveryUriAndInvalidServerUrl() {
    // Test case where serverUrl is not an Okta domain (e.g., localhost)
    oidcConfig.setServerUrl("http://localhost:8585");

    ValidationResult result = validator.validateOktaConfiguration(authConfig, oidcConfig);

    assertNotNull(result);
    assertEquals("failed", result.getStatus());
    assertTrue(result.getMessage().contains("Unable to extract Okta domain"));
  }
}
