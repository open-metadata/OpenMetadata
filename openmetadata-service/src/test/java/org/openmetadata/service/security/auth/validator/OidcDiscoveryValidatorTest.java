package org.openmetadata.service.security.auth.validator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mockStatic;

import java.io.IOException;
import java.lang.reflect.Method;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.system.FieldError;
import org.openmetadata.service.util.ValidationErrorBuilder;
import org.openmetadata.service.util.ValidationHttpUtil;

public class OidcDiscoveryValidatorTest {
  private OidcDiscoveryValidator validator;
  private AuthenticationConfiguration authConfig;

  @BeforeEach
  void setUp() {
    validator = new OidcDiscoveryValidator();
    authConfig = new AuthenticationConfiguration();
    authConfig.setProvider(AuthProvider.CUSTOM_OIDC);
  }

  @Test
  void testAutoPopulatePublicKeyUrls_Success() throws Exception {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    String mockDiscoveryResponse =
        "{"
            + "\"issuer\": \"https://accounts.google.com\","
            + "\"jwks_uri\": \"https://www.googleapis.com/oauth2/v3/certs\""
            + "}";

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(200, mockDiscoveryResponse);
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      validator.autoPopulatePublicKeyUrls(discoveryUri, authConfig);

      assertNotNull(authConfig.getPublicKeyUrls());
      assertEquals(1, authConfig.getPublicKeyUrls().size());
      assertEquals(
          "https://www.googleapis.com/oauth2/v3/certs", authConfig.getPublicKeyUrls().get(0));
    }
  }

  @Test
  void testAutoPopulatePublicKeyUrls_SkipWhenAlreadyPopulated() throws Exception {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    authConfig.setPublicKeyUrls(java.util.List.of("https://existing.com/keys"));

    validator.autoPopulatePublicKeyUrls(discoveryUri, authConfig);

    assertEquals(1, authConfig.getPublicKeyUrls().size());
    assertEquals("https://existing.com/keys", authConfig.getPublicKeyUrls().get(0));
  }

  @Test
  void testAutoPopulatePublicKeyUrls_NullDiscoveryUri_ThrowsIOException() {
    IOException exception =
        assertThrows(
            IOException.class, () -> validator.autoPopulatePublicKeyUrls(null, authConfig));

    assertTrue(exception.getMessage().contains("Discovery URI is required"));
  }

  @Test
  void testAutoPopulatePublicKeyUrls_EmptyDiscoveryUri_ThrowsIOException() {
    IOException exception =
        assertThrows(IOException.class, () -> validator.autoPopulatePublicKeyUrls("", authConfig));

    assertTrue(exception.getMessage().contains("Discovery URI is required"));
  }

  @Test
  void testAutoPopulatePublicKeyUrls_HttpFailure_ThrowsIOException() {
    String discoveryUri = "https://invalid.example.com/.well-known/openid-configuration";

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(404, "Not Found");
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      IOException exception =
          assertThrows(
              IOException.class,
              () -> validator.autoPopulatePublicKeyUrls(discoveryUri, authConfig));

      assertTrue(exception.getMessage().contains("Failed to fetch discovery document"));
      assertTrue(exception.getMessage().contains("HTTP 404"));
    }
  }

  @Test
  void testAutoPopulatePublicKeyUrls_MissingJwksUri_ThrowsIOException() {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    String mockDiscoveryResponse = "{\"issuer\": \"https://accounts.google.com\"}";

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(200, mockDiscoveryResponse);
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      IOException exception =
          assertThrows(
              IOException.class,
              () -> validator.autoPopulatePublicKeyUrls(discoveryUri, authConfig));

      assertTrue(
          exception.getMessage().contains("Discovery document missing required 'jwks_uri' field"));
    }
  }

  @Test
  void testAutoPopulatePublicKeyUrls_EmptyJwksUri_ThrowsIOException() {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    String mockDiscoveryResponse =
        "{" + "\"issuer\": \"https://accounts.google.com\"," + "\"jwks_uri\": \"\"" + "}";

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(200, mockDiscoveryResponse);
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      IOException exception =
          assertThrows(
              IOException.class,
              () -> validator.autoPopulatePublicKeyUrls(discoveryUri, authConfig));

      assertTrue(
          exception.getMessage().contains("Discovery document contains empty 'jwks_uri' field"));
    }
  }

  @Test
  void testAutoPopulatePublicKeyUrls_Http500_ThrowsIOException() {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(500, "Internal Server Error");
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      IOException exception =
          assertThrows(
              IOException.class,
              () -> validator.autoPopulatePublicKeyUrls(discoveryUri, authConfig));

      assertTrue(exception.getMessage().contains("Failed to fetch discovery document"));
      assertTrue(exception.getMessage().contains("HTTP 500"));
    }
  }

  @Test
  void testAutoPopulatePublicKeyUrls_InvalidJson_ThrowsException() {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    String mockDiscoveryResponse = "{ invalid json }";

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(200, mockDiscoveryResponse);
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      assertThrows(
          Exception.class, () -> validator.autoPopulatePublicKeyUrls(discoveryUri, authConfig));
    }
  }

  @Test
  void testFetchDiscoveryDocument_Success() throws Exception {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    String mockDiscoveryResponse =
        "{"
            + "\"issuer\": \"https://accounts.google.com\","
            + "\"authorization_endpoint\": \"https://accounts.google.com/o/oauth2/v2/auth\","
            + "\"token_endpoint\": \"https://oauth2.googleapis.com/token\","
            + "\"jwks_uri\": \"https://www.googleapis.com/oauth2/v3/certs\","
            + "\"response_types_supported\": [\"code\", \"id_token\"],"
            + "\"scopes_supported\": [\"openid\", \"email\", \"profile\"]"
            + "}";

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(200, mockDiscoveryResponse);
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      OidcDiscoveryValidator.DiscoveryDocument doc =
          OidcDiscoveryValidator.fetchDiscoveryDocument(discoveryUri);

      assertNotNull(doc);
      assertEquals("https://accounts.google.com", doc.issuer);
      assertEquals("https://www.googleapis.com/oauth2/v3/certs", doc.jwksUri);
      assertTrue(doc.scopesSupported.contains("openid"));
      assertTrue(doc.responseTypesSupported.contains("code"));
    }
  }

  @Test
  void testFetchDiscoveryDocument_HttpError_ThrowsRuntimeException() {
    String discoveryUri = "https://invalid.example.com/.well-known/openid-configuration";

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(404, "Not Found");
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      RuntimeException exception =
          assertThrows(
              RuntimeException.class,
              () -> OidcDiscoveryValidator.fetchDiscoveryDocument(discoveryUri));

      assertTrue(exception.getMessage().contains("Failed to fetch discovery document"));
      assertTrue(exception.getMessage().contains("Status: 404"));
    }
  }

  @Test
  void testValidateAgainstDiscovery_NullDiscoveryUri_SkipsValidation() {
    FieldError error = validator.validateAgainstDiscovery(null, authConfig, new OidcClientConfig());

    assertNull(error);
  }

  @Test
  void testValidateAgainstDiscovery_MissingOpenIdScope_ReturnsError() {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    String mockDiscoveryResponse =
        "{"
            + "\"issuer\": \"https://accounts.google.com\","
            + "\"authorization_endpoint\": \"https://accounts.google.com/o/oauth2/v2/auth\","
            + "\"token_endpoint\": \"https://oauth2.googleapis.com/token\","
            + "\"jwks_uri\": \"https://www.googleapis.com/oauth2/v3/certs\","
            + "\"response_types_supported\": [\"code\"],"
            + "\"scopes_supported\": [\"openid\", \"email\", \"profile\"]"
            + "}";

    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("email profile");

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(200, mockDiscoveryResponse);
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      FieldError error = validator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);

      assertNotNull(error);
      assertTrue(error.getError().contains("openid"));
      assertTrue(error.getError().contains("must include"));
    }
  }

  @Test
  void testValidateAgainstDiscovery_EmptyScope_ReturnsError() {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    String mockDiscoveryResponse =
        "{"
            + "\"issuer\": \"https://accounts.google.com\","
            + "\"authorization_endpoint\": \"https://accounts.google.com/o/oauth2/v2/auth\","
            + "\"token_endpoint\": \"https://oauth2.googleapis.com/token\","
            + "\"jwks_uri\": \"https://www.googleapis.com/oauth2/v3/certs\","
            + "\"response_types_supported\": [\"code\"],"
            + "\"scopes_supported\": [\"openid\", \"email\", \"profile\"]"
            + "}";

    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("");

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(200, mockDiscoveryResponse);
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      FieldError error = validator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);

      assertNotNull(error);
      assertTrue(error.getError().contains("Scope is required"));
      assertTrue(error.getError().contains("openid"));
    }
  }

  @Test
  void testValidateAgainstDiscovery_ValidOpenIdScope_ReturnsNull() {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    String mockDiscoveryResponse =
        "{"
            + "\"issuer\": \"https://accounts.google.com\","
            + "\"authorization_endpoint\": \"https://accounts.google.com/o/oauth2/v2/auth\","
            + "\"token_endpoint\": \"https://oauth2.googleapis.com/token\","
            + "\"jwks_uri\": \"https://www.googleapis.com/oauth2/v3/certs\","
            + "\"response_types_supported\": [\"code\"],"
            + "\"scopes_supported\": [\"openid\", \"email\", \"profile\"],"
            + "\"token_endpoint_auth_methods_supported\": [\"client_secret_basic\"],"
            + "\"id_token_signing_alg_values_supported\": [\"RS256\"]"
            + "}";

    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("openid email profile");

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(200, mockDiscoveryResponse);
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      FieldError error = validator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void testValidateAgainstDiscovery_OnlyOpenIdScope_ReturnsNull() {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    String mockDiscoveryResponse =
        "{"
            + "\"issuer\": \"https://accounts.google.com\","
            + "\"authorization_endpoint\": \"https://accounts.google.com/o/oauth2/v2/auth\","
            + "\"token_endpoint\": \"https://oauth2.googleapis.com/token\","
            + "\"jwks_uri\": \"https://www.googleapis.com/oauth2/v3/certs\","
            + "\"response_types_supported\": [\"code\"],"
            + "\"scopes_supported\": [\"openid\", \"email\", \"profile\"],"
            + "\"token_endpoint_auth_methods_supported\": [\"client_secret_basic\"],"
            + "\"id_token_signing_alg_values_supported\": [\"RS256\"]"
            + "}";

    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("openid");

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(200, mockDiscoveryResponse);
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      FieldError error = validator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void testValidateAgainstDiscovery_InvalidPromptCombinationForConfidentialClient_ReturnsError() {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    String mockDiscoveryResponse =
        "{"
            + "\"issuer\": \"https://accounts.google.com\","
            + "\"authorization_endpoint\": \"https://accounts.google.com/o/oauth2/v2/auth\","
            + "\"token_endpoint\": \"https://oauth2.googleapis.com/token\","
            + "\"jwks_uri\": \"https://www.googleapis.com/oauth2/v3/certs\","
            + "\"response_types_supported\": [\"code\"],"
            + "\"scopes_supported\": [\"openid\", \"email\", \"profile\"],"
            + "\"id_token_signing_alg_values_supported\": [\"RS256\"]"
            + "}";

    authConfig.setClientType(ClientType.CONFIDENTIAL);
    authConfig.setOidcConfiguration(new OidcClientConfig().withPrompt("none login"));

    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("openid");

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(200, mockDiscoveryResponse);
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      FieldError error = validator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);

      assertNotNull(error);
      assertTrue(error.getError().contains("Prompt value 'none' cannot be combined"));
    }
  }

  @Test
  void testValidateAgainstDiscovery_UnsupportedResponseType_ReturnsError() {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    String mockDiscoveryResponse =
        "{"
            + "\"issuer\": \"https://accounts.google.com\","
            + "\"authorization_endpoint\": \"https://accounts.google.com/o/oauth2/v2/auth\","
            + "\"token_endpoint\": \"https://oauth2.googleapis.com/token\","
            + "\"jwks_uri\": \"https://www.googleapis.com/oauth2/v3/certs\","
            + "\"response_types_supported\": [\"code\"],"
            + "\"scopes_supported\": [\"openid\", \"email\", \"profile\"]"
            + "}";

    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("openid");
    oidcConfig.setResponseType("token");

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(200, mockDiscoveryResponse);
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      FieldError error = validator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);

      assertNotNull(error);
      assertTrue(error.getError().contains("Response type 'token' is not supported"));
    }
  }

  @Test
  void testValidateAgainstDiscovery_UnsupportedPreferredJwsAlgorithm_ReturnsError() {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    String mockDiscoveryResponse =
        "{"
            + "\"issuer\": \"https://accounts.google.com\","
            + "\"authorization_endpoint\": \"https://accounts.google.com/o/oauth2/v2/auth\","
            + "\"token_endpoint\": \"https://oauth2.googleapis.com/token\","
            + "\"jwks_uri\": \"https://www.googleapis.com/oauth2/v3/certs\","
            + "\"response_types_supported\": [\"code\"],"
            + "\"scopes_supported\": [\"openid\", \"email\", \"profile\"],"
            + "\"id_token_signing_alg_values_supported\": [\"RS256\"]"
            + "}";

    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("openid");
    oidcConfig.setPreferredJwsAlgorithm("ES256");

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(200, mockDiscoveryResponse);
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      FieldError error = validator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);

      assertNotNull(error);
      assertTrue(error.getError().contains("JWS algorithm 'ES256' is not supported"));
    }
  }

  @Test
  void testValidateAgainstDiscovery_HttpFailure_ReturnsFetchError() {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("openid");

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(503, "Service unavailable");
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      FieldError error = validator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);

      assertNotNull(error);
      assertTrue(error.getError().contains("Failed to fetch OIDC discovery document. Status: 503"));
    }
  }

  @Test
  void testValidateAgainstDiscovery_InvalidPromptValueMapsToPromptField() {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    String mockDiscoveryResponse =
        "{"
            + "\"issuer\": \"https://accounts.google.com\","
            + "\"authorization_endpoint\": \"https://accounts.google.com/o/oauth2/v2/auth\","
            + "\"token_endpoint\": \"https://oauth2.googleapis.com/token\","
            + "\"jwks_uri\": \"https://www.googleapis.com/oauth2/v3/certs\","
            + "\"response_types_supported\": [\"code\"],"
            + "\"scopes_supported\": [\"openid\", \"email\", \"profile\"],"
            + "\"id_token_signing_alg_values_supported\": [\"RS256\"]"
            + "}";

    authConfig.setClientType(ClientType.CONFIDENTIAL);
    authConfig.setOidcConfiguration(new OidcClientConfig().withPrompt("invalid login"));

    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("openid");

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(200, mockDiscoveryResponse);
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      FieldError error = validator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.OIDC_PROMPT, error.getField());
      assertTrue(error.getError().contains("Invalid prompt value(s)"));
    }
  }

  @Test
  void testValidateAgainstDiscovery_UnsupportedScopesMapToScopeField() {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    String mockDiscoveryResponse =
        "{"
            + "\"issuer\": \"https://accounts.google.com\","
            + "\"authorization_endpoint\": \"https://accounts.google.com/o/oauth2/v2/auth\","
            + "\"token_endpoint\": \"https://oauth2.googleapis.com/token\","
            + "\"jwks_uri\": \"https://www.googleapis.com/oauth2/v3/certs\","
            + "\"response_types_supported\": [\"code\"],"
            + "\"scopes_supported\": [\"openid\", \"email\", \"profile\"]"
            + "}";

    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("openid email offline_access");

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(200, mockDiscoveryResponse);
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      FieldError error = validator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.OIDC_SCOPE, error.getField());
      assertTrue(error.getError().contains("offline_access"));
    }
  }

  @Test
  void testValidateAgainstDiscovery_UsesDefaultRs256WhenJwtPrincipalClaimsConfigured() {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    String mockDiscoveryResponse =
        "{"
            + "\"issuer\": \"https://accounts.google.com\","
            + "\"authorization_endpoint\": \"https://accounts.google.com/o/oauth2/v2/auth\","
            + "\"token_endpoint\": \"https://oauth2.googleapis.com/token\","
            + "\"jwks_uri\": \"https://www.googleapis.com/oauth2/v3/certs\","
            + "\"response_types_supported\": [\"code\"],"
            + "\"scopes_supported\": [\"openid\", \"email\", \"profile\"],"
            + "\"id_token_signing_alg_values_supported\": [\"HS256\"]"
            + "}";

    authConfig.setJwtPrincipalClaims(java.util.List.of("email"));

    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("openid");

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(200, mockDiscoveryResponse);
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      FieldError error = validator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI, error.getField());
      assertTrue(error.getError().contains("JWS algorithm 'RS256' is not supported"));
    }
  }

  @Test
  void testValidateAgainstDiscovery_GrantTypeWarningsRemainLenient() {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    String mockDiscoveryResponse =
        "{"
            + "\"issuer\": \"https://accounts.google.com\","
            + "\"authorization_endpoint\": \"https://accounts.google.com/o/oauth2/v2/auth\","
            + "\"token_endpoint\": \"https://oauth2.googleapis.com/token\","
            + "\"jwks_uri\": \"https://www.googleapis.com/oauth2/v3/certs\","
            + "\"response_types_supported\": [\"code\"],"
            + "\"scopes_supported\": [\"openid\", \"email\", \"profile\"],"
            + "\"grant_types_supported\": [\"client_credentials\"],"
            + "\"id_token_signing_alg_values_supported\": [\"RS256\"]"
            + "}";

    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("openid");

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(200, mockDiscoveryResponse);
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      FieldError error = validator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void testValidateAgainstDiscovery_UnsupportedClientAuthenticationMethodRemainsLenient() {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    String mockDiscoveryResponse =
        "{"
            + "\"issuer\": \"https://accounts.google.com\","
            + "\"authorization_endpoint\": \"https://accounts.google.com/o/oauth2/v2/auth\","
            + "\"token_endpoint\": \"https://oauth2.googleapis.com/token\","
            + "\"jwks_uri\": \"https://www.googleapis.com/oauth2/v3/certs\","
            + "\"response_types_supported\": [\"code\"],"
            + "\"scopes_supported\": [\"openid\", \"email\", \"profile\"],"
            + "\"token_endpoint_auth_methods_supported\": [\"client_secret_basic\"],"
            + "\"id_token_signing_alg_values_supported\": [\"RS256\"]"
            + "}";

    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("openid");
    oidcConfig.setClientAuthenticationMethod(
        OidcClientConfig.ClientAuthenticationMethod.CLIENT_SECRET_POST);

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(200, mockDiscoveryResponse);
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      FieldError error = validator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void testPrivateMappings_NormalizeAuthMethodsAndRouteFieldErrors() throws Exception {
    assertEquals("client_secret_basic", invokeMapClientAuthMethod("CLIENT_SECRET_BASIC"));
    assertEquals("client_secret_post", invokeMapClientAuthMethod("client_secret_post"));
    assertEquals("client_secret_jwt", invokeMapClientAuthMethod("CLIENT_SECRET_JWT"));
    assertEquals("private_key_jwt", invokeMapClientAuthMethod("PRIVATE_KEY_JWT"));
    assertEquals("none", invokeMapClientAuthMethod("none"));
    assertEquals("custom_method", invokeMapClientAuthMethod("Custom_Method"));

    assertEquals(
        ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET,
        invokeDetermineFieldPath(List.of("Token auth method mismatch")));
    assertEquals(
        ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
        invokeDetermineFieldPath(List.of("JWS signing mismatch")));
    assertEquals(
        ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
        invokeDetermineFieldPath(List.of("General validation mismatch")));
  }

  @Test
  void testValidateAgainstDiscovery_InvalidJsonReturnsDiscoveryUriError() {
    String discoveryUri = "https://accounts.google.com/.well-known/openid-configuration";
    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("openid");

    try (MockedStatic<ValidationHttpUtil> mockedHttp = mockStatic(ValidationHttpUtil.class)) {
      ValidationHttpUtil.HttpResponseData mockResponse =
          new ValidationHttpUtil.HttpResponseData(200, "{ invalid json }");
      mockedHttp.when(() -> ValidationHttpUtil.safeGet(anyString())).thenReturn(mockResponse);

      FieldError error = validator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI, error.getField());
      assertTrue(error.getError().contains("Failed to validate against discovery document"));
    }
  }

  private String invokeMapClientAuthMethod(String method) throws Exception {
    Method mapMethod =
        OidcDiscoveryValidator.class.getDeclaredMethod("mapClientAuthMethod", String.class);
    mapMethod.setAccessible(true);
    return (String) mapMethod.invoke(validator, method);
  }

  private String invokeDetermineFieldPath(List<String> errors) throws Exception {
    Method fieldMethod =
        OidcDiscoveryValidator.class.getDeclaredMethod("determineFieldPathFromErrors", List.class);
    fieldMethod.setAccessible(true);
    return (String) fieldMethod.invoke(validator, errors);
  }
}
