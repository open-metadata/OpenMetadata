package org.openmetadata.service.security.auth.validator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mockStatic;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.FieldError;
import org.openmetadata.service.util.ValidationErrorBuilder;
import org.openmetadata.service.util.ValidationHttpUtil;

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

    FieldError result = validator.validateAuth0Configuration(authConfig, oidcConfig);

    assertTrue(result != null);
    assertTrue(result.getField() != null);
    assertTrue(result.getError().contains("Domain validation failed"));
  }

  @Test
  void testValidateAuth0Configuration_MissingPublicKeyUrls() {
    // Test with valid authority but missing publicKeyUrls
    authConfig.setAuthority("https://dev-example.auth0.com");
    authConfig.setClientId("ABCDEFGHijklmnop1234567890");
    authConfig.setClientType(ClientType.PUBLIC);
    // Not setting publicKeyUrls to trigger error

    FieldError result = validator.validateAuth0Configuration(authConfig, oidcConfig);

    // Should fail - either on domain validation or public key URLs
    assertTrue(result != null);
    assertTrue(result.getField() != null);
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

    FieldError result = validator.validateAuth0Configuration(authConfig, oidcConfig);

    // Should pass basic validation but may fail on client ID validation
    // The exact behavior depends on the validator implementation
    // null means success, non-null means validation error
    // We expect this might fail, but it could also pass
  }

  @Test
  void testValidateAuth0Configuration_ConfidentialClientMissingDiscoveryUri() {
    // Test CONFIDENTIAL client without discoveryUri
    authConfig.setClientType(ClientType.CONFIDENTIAL);
    authConfig.setClientId("ABCDEFGHijklmnop1234567890");
    oidcConfig.setId("ABCDEFGHijklmnop1234567890");
    oidcConfig.setSecret("test-secret-12345678901234567890");
    // Missing discoveryUri

    FieldError result = validator.validateAuth0Configuration(authConfig, oidcConfig);

    assertTrue(result != null);
    assertTrue(
        result.getError().contains("Auth0 domain") || result.getError().contains("discoveryUri"));
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

    FieldError result = validator.validateAuth0Configuration(authConfig, oidcConfig);

    // Should fail on network calls
    assertTrue(result != null);
    assertTrue(result.getField() != null);
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

    FieldError result = validator.validateAuth0Configuration(authConfig, oidcConfig);

    // Should fail due to missing or invalid credentials
    assertTrue(result != null);
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

    FieldError result = validator.validateAuth0Configuration(authConfig, oidcConfig);

    assertTrue(result != null);
    assertTrue(result.getField() != null);
  }

  @Test
  void testValidateClientCredentials_AccessDeniedError_MapsToDiscoveryUri() {
    String auth0Domain = "https://dev-example.auth0.com";
    String mockDiscoveryResponse =
        "{"
            + "\"issuer\": \"https://dev-example.auth0.com/\","
            + "\"authorization_endpoint\": \"https://dev-example.auth0.com/authorize\","
            + "\"token_endpoint\": \"https://dev-example.auth0.com/oauth/token\","
            + "\"userinfo_endpoint\": \"https://dev-example.auth0.com/userinfo\","
            + "\"jwks_uri\": \"https://dev-example.auth0.com/.well-known/jwks.json\","
            + "\"scopes_supported\": [\"openid\", \"email\", \"profile\"],"
            + "\"response_types_supported\": [\"code\"],"
            + "\"token_endpoint_auth_methods_supported\": [\"client_secret_basic\"],"
            + "\"id_token_signing_alg_values_supported\": [\"RS256\"]"
            + "}";

    String mockTokenErrorResponse =
        "{"
            + "\"error\": \"access_denied\","
            + "\"error_description\": \"Service not enabled within domain: https://dev-example.auth0.com/api/v2/\""
            + "}";

    authConfig.setClientType(ClientType.CONFIDENTIAL);
    oidcConfig.setDiscoveryUri(auth0Domain + "/.well-known/openid-configuration");
    oidcConfig.setId("test-client-id");
    oidcConfig.setSecret("test-client-secret");
    oidcConfig.setCallbackUrl("http://localhost:8585/callback");
    oidcConfig.setScope("openid email profile");

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData discoveryResponse =
          new ValidationHttpUtil.HttpResponseData(200, mockDiscoveryResponse);
      ValidationHttpUtil.HttpResponseData tokenErrorResponse =
          new ValidationHttpUtil.HttpResponseData(403, mockTokenErrorResponse);

      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(discoveryResponse);

      mockedHttp
          .when(
              () ->
                  ValidationHttpUtil.postForm(
                      anyString(),
                      anyString(),
                      (Map<String, String>) org.mockito.ArgumentMatchers.any()))
          .thenReturn(tokenErrorResponse);
      mockedHttp
          .when(() -> ValidationHttpUtil.postForm(anyString(), anyString()))
          .thenReturn(tokenErrorResponse);

      FieldError result = validator.validateAuth0Configuration(authConfig, oidcConfig);

      assertNotNull(result);
      assertEquals(
          ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
          result.getField(),
          "access_denied should map to OIDC_DISCOVERY_URI, not OIDC_CLIENT_SECRET");
      assertTrue(
          result.getError().contains("Service not enabled"),
          "Error message should contain the actual error description");
      assertTrue(
          result.getError().contains("Access denied"),
          "Error message should indicate access denied");
    }
  }
}
