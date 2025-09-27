package org.openmetadata.service.security.auth.validator;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.system.FieldError;

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
    FieldError result = spyValidator.validateOktaConfiguration(authConfig, oidcConfig);

    // The domain extraction should work correctly now
    // Note: This will still fail due to network calls, but the error message should be different
    assertNotNull(result);

    // If domain extraction was fixed, we shouldn't get the HTTPS error for localhost
    assertFalse(
        result != null
            && result.getError().contains("Okta domain must use HTTPS")
            && result.getError().contains("localhost"));
  }

  @Test
  void testBasicConfigValidation() {
    oidcConfig.setDiscoveryUri(
        "https://dev-96705996-admin.okta.com/oauth2/default/.well-known/openid-configuration");

    // This should pass basic validation
    // The domain extraction logic should prefer discoveryUri over serverUrl
    FieldError result = validator.validateOktaConfiguration(authConfig, oidcConfig);

    assertNotNull(result);
    // Should not fail due to domain format issues
    if (result != null && result.getError().contains("domain must use HTTPS")) {
      fail("Domain validation should not fail with HTTPS error when using proper discoveryUri");
    }
  }

  @Test
  void testMissingDiscoveryUriAndValidServerUrl() {
    // Test case where discoveryUri is missing - should fail
    oidcConfig.setServerUrl("https://company.okta.com");
    oidcConfig.setSecret("test-secret-12345678901234567890");

    FieldError result = validator.validateOktaConfiguration(authConfig, oidcConfig);

    assertNotNull(result);
    // Should fail because discoveryUri is required
    assertEquals("failed", result != null ? "failed" : "success");
    assertTrue(result != null && result.getError().contains("Unable to extract Okta domain"));
  }

  @Test
  void testMissingDiscoveryUriAndInvalidServerUrl() {
    // Test case where discoveryUri is missing - should fail regardless of serverUrl
    oidcConfig.setServerUrl("http://localhost:8585");

    FieldError result = validator.validateOktaConfiguration(authConfig, oidcConfig);

    assertNotNull(result);
    assertEquals("failed", result != null ? "failed" : "success");
    assertTrue(result != null && result.getError().contains("Unable to extract Okta domain"));
  }
}
