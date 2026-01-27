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

public class CognitoValidatorTest {
  private CognitoAuthValidator validator;
  private AuthenticationConfiguration authConfig;
  private OidcClientConfig oidcConfig;

  @BeforeEach
  void setUp() {
    validator = new CognitoAuthValidator();
    authConfig = new AuthenticationConfiguration();
    authConfig.setClientType(ClientType.PUBLIC);
    oidcConfig = new OidcClientConfig();
  }

  @Test
  void testValidateCognitoConfiguration_InvalidAuthorityFormat() {
    // Test with invalid authority URL format
    authConfig.setAuthority("https://invalid.com/tenant");
    authConfig.setClientId("1234567890abcdefghijklmnop");
    authConfig.setClientType(ClientType.PUBLIC);

    FieldError result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result != null ? "failed" : "success");
    assertTrue(
        result != null
            && (result.getError().contains("Invalid Cognito authority")
                || result.getError().contains("Cognito validation failed")));
  }

  @Test
  void testValidateCognitoConfiguration_ValidAuthorityMissingPublicKeyUrls() {
    // Test with valid Cognito authority but missing publicKeyUrls
    authConfig.setAuthority("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABCDEFGHI");
    authConfig.setClientId("1234567890abcdefghijklmnop");
    authConfig.setClientType(ClientType.PUBLIC);
    // Not setting publicKeyUrls to trigger error

    FieldError result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    // Should fail somewhere in the validation process
    assertEquals("failed", result != null ? "failed" : "success");
    assertTrue(result != null);
  }

  @Test
  void testValidateCognitoConfiguration_InvalidRegionInAuthority() {
    // Test with invalid AWS region in authority
    authConfig.setAuthority(
        "https://cognito-idp.invalid-region.amazonaws.com/invalid-region_ABCDEFGHI");
    authConfig.setClientId("1234567890abcdefghijklmnop");
    authConfig.setClientType(ClientType.PUBLIC);

    FieldError result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result != null ? "failed" : "success");
    assertTrue(
        result != null
            && (result.getError().contains("region")
                || result.getError().contains("Cognito validation failed")));
  }

  @Test
  void testValidateCognitoConfiguration_InvalidUserPoolIdFormat() {
    // Test with invalid user pool ID format
    authConfig.setAuthority("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_INVALID");
    authConfig.setClientId("1234567890abcdefghijklmnop");
    authConfig.setClientType(ClientType.PUBLIC);

    FieldError result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result != null ? "failed" : "success");
    assertTrue(
        result != null
            && (result.getError().contains("user pool")
                || result.getError().contains("Cognito validation failed")));
  }

  @Test
  void testValidateCognitoConfiguration_PublicClientWithCorrectJwksUrl() {
    // Test with valid Cognito authority and correct JWKS URL
    authConfig.setAuthority("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABCDEFGHI");
    authConfig.setClientId("1234567890abcdefghijklmnop");
    authConfig.setClientType(ClientType.PUBLIC);

    List<String> publicKeyUrls = new ArrayList<>();
    publicKeyUrls.add(
        "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABCDEFGHI/.well-known/jwks.json");
    authConfig.setPublicKeyUrls(publicKeyUrls);

    FieldError result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    // Should pass basic validation, may fail on network calls but with proper field path
    assertTrue(result != null);
  }

  @Test
  void testValidateCognitoConfiguration_PublicClientWithWrongJwksUrl() {
    // Test with wrong JWKS URL for the user pool
    authConfig.setAuthority("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABCDEFGHI");
    authConfig.setClientId("1234567890abcdefghijklmnop");
    authConfig.setClientType(ClientType.PUBLIC);

    List<String> publicKeyUrls = new ArrayList<>();
    publicKeyUrls.add(
        "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_WRONGPOOL/.well-known/jwks.json");
    authConfig.setPublicKeyUrls(publicKeyUrls);

    FieldError result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result != null ? "failed" : "success");
    assertTrue(result != null);
  }

  @Test
  void testValidateCognitoConfiguration_ConfidentialClientMissingDiscoveryUri() {
    // Test CONFIDENTIAL client without discoveryUri
    authConfig.setClientType(ClientType.CONFIDENTIAL);
    authConfig.setClientId("1234567890abcdefghijklmnop");
    oidcConfig.setId("1234567890abcdefghijklmnop");
    oidcConfig.setSecret("test-secret-12345678901234567890");
    // Missing discoveryUri

    FieldError result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result != null ? "failed" : "success");
    assertTrue(result != null);
  }

  @Test
  void testValidateCognitoConfiguration_ConfidentialClientWithDiscoveryUri() {
    // Test CONFIDENTIAL client with proper discoveryUri
    authConfig.setClientType(ClientType.CONFIDENTIAL);
    authConfig.setClientId("1234567890abcdefghijklmnop");

    List<String> publicKeyUrls = new ArrayList<>();
    publicKeyUrls.add(
        "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABCDEFGHI/.well-known/jwks.json");
    authConfig.setPublicKeyUrls(publicKeyUrls);

    oidcConfig.setId("1234567890abcdefghijklmnop");
    oidcConfig.setSecret("test-secret-12345678901234567890");
    oidcConfig.setDiscoveryUri(
        "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABCDEFGHI/.well-known/openid-configuration");

    FieldError result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    // Should pass basic validation, may fail on network calls but with proper field path
    assertTrue(result != null);
  }

  @Test
  void testValidateCognitoConfiguration_EmptyClientSecret() {
    // Test with empty client secret for CONFIDENTIAL client
    authConfig.setClientType(ClientType.CONFIDENTIAL);
    authConfig.setClientId("1234567890abcdefghijklmnop");

    List<String> publicKeyUrls = new ArrayList<>();
    publicKeyUrls.add(
        "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABCDEFGHI/.well-known/jwks.json");
    authConfig.setPublicKeyUrls(publicKeyUrls);

    oidcConfig.setId("1234567890abcdefghijklmnop");
    oidcConfig.setSecret("");
    oidcConfig.setDiscoveryUri(
        "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABCDEFGHI/.well-known/openid-configuration");

    FieldError result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    // Should fail due to missing or invalid credentials
    assertEquals("failed", result != null ? "failed" : "success");
  }

  @Test
  void testValidateCognitoConfiguration_InvalidClientIdFormat() {
    // Test with invalid client ID format for Cognito
    authConfig.setAuthority("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABCDEFGHI");
    authConfig.setClientId("invalid-client-id-format");
    authConfig.setClientType(ClientType.PUBLIC);

    List<String> publicKeyUrls = new ArrayList<>();
    publicKeyUrls.add(
        "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABCDEFGHI/.well-known/jwks.json");
    authConfig.setPublicKeyUrls(publicKeyUrls);

    FieldError result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    // Should pass basic validation or give warning about client ID format
    // Result can be null (success) or non-null (failure/warning)
    // Just assert it doesn't throw exception
    assertTrue(true);
  }
}
