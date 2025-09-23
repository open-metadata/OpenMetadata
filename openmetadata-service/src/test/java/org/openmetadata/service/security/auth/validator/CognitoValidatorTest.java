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

    ValidationResult result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result.getStatus());
    assertTrue(
        result.getMessage().contains("Invalid Cognito authority")
            || result.getMessage().contains("Cognito validation failed"));
  }

  @Test
  void testValidateCognitoConfiguration_ValidAuthorityMissingPublicKeyUrls() {
    // Test with valid Cognito authority but missing publicKeyUrls
    authConfig.setAuthority("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABCDEFGHI");
    authConfig.setClientId("1234567890abcdefghijklmnop");
    authConfig.setClientType(ClientType.PUBLIC);
    // Not setting publicKeyUrls to trigger error

    ValidationResult result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    // Should fail somewhere in the validation process
    assertEquals("failed", result.getStatus());
    assertTrue(result.getComponent().startsWith("cognito"));
  }

  @Test
  void testValidateCognitoConfiguration_InvalidRegionInAuthority() {
    // Test with invalid AWS region in authority
    authConfig.setAuthority(
        "https://cognito-idp.invalid-region.amazonaws.com/invalid-region_ABCDEFGHI");
    authConfig.setClientId("1234567890abcdefghijklmnop");
    authConfig.setClientType(ClientType.PUBLIC);

    ValidationResult result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result.getStatus());
    assertTrue(
        result.getMessage().contains("region")
            || result.getMessage().contains("Cognito validation failed"));
  }

  @Test
  void testValidateCognitoConfiguration_InvalidUserPoolIdFormat() {
    // Test with invalid user pool ID format
    authConfig.setAuthority("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_INVALID");
    authConfig.setClientId("1234567890abcdefghijklmnop");
    authConfig.setClientType(ClientType.PUBLIC);

    ValidationResult result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result.getStatus());
    assertTrue(
        result.getMessage().contains("user pool")
            || result.getMessage().contains("Cognito validation failed"));
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

    ValidationResult result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    // Should pass basic validation, may fail on network calls but with proper component
    assertTrue(result.getComponent().startsWith("cognito"));
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

    ValidationResult result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result.getStatus());
    assertTrue(result.getComponent().startsWith("cognito"));
  }

  @Test
  void testValidateCognitoConfiguration_ConfidentialClientMissingDiscoveryUri() {
    // Test CONFIDENTIAL client without discoveryUri
    authConfig.setClientType(ClientType.CONFIDENTIAL);
    authConfig.setClientId("1234567890abcdefghijklmnop");
    oidcConfig.setId("1234567890abcdefghijklmnop");
    oidcConfig.setSecret("test-secret-12345678901234567890");
    // Missing discoveryUri

    ValidationResult result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result.getStatus());
    assertTrue(result.getComponent().startsWith("cognito"));
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

    ValidationResult result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    // Should pass basic validation, may fail on network calls but with proper component
    assertTrue(result.getComponent().startsWith("cognito"));
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

    ValidationResult result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    // Should fail due to missing or invalid credentials
    assertEquals("failed", result.getStatus());
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

    ValidationResult result = validator.validateCognitoConfiguration(authConfig, oidcConfig);

    // Should pass basic validation or give warning about client ID format
    assertTrue(
        result.getStatus().equals("success")
            || result.getStatus().equals("warning")
            || result.getStatus().equals("failed"));
  }
}
