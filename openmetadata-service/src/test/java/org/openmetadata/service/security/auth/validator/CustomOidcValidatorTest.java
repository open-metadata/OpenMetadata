package org.openmetadata.service.security.auth.validator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mockStatic;

import java.lang.reflect.Method;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
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

class CustomOidcValidatorTest {

  private static final String AUTHORITY = "https://issuer.example";
  private static final String DISCOVERY_URI = AUTHORITY + "/.well-known/openid-configuration";
  private static final String AUTHORIZATION_ENDPOINT = AUTHORITY + "/authorize";
  private static final String TOKEN_ENDPOINT = AUTHORITY + "/token";
  private static final String JWKS_URI = AUTHORITY + "/keys";
  private static final String BACKUP_JWKS_URI = AUTHORITY + "/backup-keys";
  private static final String DISCOVERY_RESPONSE =
      "{"
          + "\"issuer\":\""
          + AUTHORITY
          + "\","
          + "\"authorization_endpoint\":\""
          + AUTHORIZATION_ENDPOINT
          + "\","
          + "\"token_endpoint\":\""
          + TOKEN_ENDPOINT
          + "\","
          + "\"jwks_uri\":\""
          + JWKS_URI
          + "\","
          + "\"response_types_supported\":[\"code\"],"
          + "\"scopes_supported\":[\"openid\",\"profile\",\"email\"],"
          + "\"token_endpoint_auth_methods_supported\":[\"client_secret_post\"],"
          + "\"id_token_signing_alg_values_supported\":[\"RS256\"],"
          + "\"grant_types_supported\":[\"authorization_code\",\"refresh_token\",\"client_credentials\"]"
          + "}";
  private static final String JWKS_RESPONSE = "{\"keys\":[{\"kty\":\"RSA\",\"kid\":\"1\"}]}";

  private CustomOidcValidator validator;

  @BeforeEach
  void setUp() {
    validator = new CustomOidcValidator();
  }

  @Test
  void validateCustomOidcConfigurationWrapsUnexpectedTopLevelErrors() {
    FieldError error = validator.validateCustomOidcConfiguration(null, new OidcClientConfig());

    assertNotNull(error);
    assertTrue(error.getError().contains("Custom OIDC validation failed"));
  }

  @Test
  void validateCustomOidcPublicClientRequiresDiscoveryUriFromAnySupportedSource() {
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setClientType(ClientType.PUBLIC);

    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("openid profile");

    FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

    assertNotNull(error);
    assertTrue(error.getError().contains("Discovery URI is required"));
  }

  @Test
  void validateCustomOidcPublicClientSucceedsWhenDiscoveryJwksAndAuthorizationFlowAreReachable() {
    AuthenticationConfiguration authConfig = publicAuthConfig();
    OidcClientConfig oidcConfig = publicOidcConfig();

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));
      http.when(() -> ValidationHttpUtil.getNoRedirect(expectedAuthorizationValidationUrl()))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(302, ""));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void validateCustomOidcPublicClientRejectsMismatchedPublicKeyUrls() {
    AuthenticationConfiguration authConfig = publicAuthConfig();
    authConfig.setPublicKeyUrls(List.of("https://other.example/keys"));
    OidcClientConfig oidcConfig = publicOidcConfig();

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNotNull(error);
      assertTrue(error.getError().contains("publicKeyUrls must include the JWKS URI"));
    }
  }

  @Test
  void validateCustomOidcPublicClientReturnsDiscoveryValidationErrorsImmediately() {
    AuthenticationConfiguration authConfig = publicAuthConfig();
    OidcClientConfig oidcConfig = publicOidcConfig();
    oidcConfig.setScope("profile");

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.OIDC_SCOPE, error.getField());
      assertTrue(error.getError().contains("must include 'openid'"));
    }
  }

  @Test
  void validateCustomOidcPublicClientUsesServerUrlFallbackWhenAuthorityIsMissing() {
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setClientType(ClientType.PUBLIC);
    authConfig.setClientId("public-client");

    OidcClientConfig oidcConfig = publicOidcConfig();
    oidcConfig.setServerUrl(AUTHORITY);

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));
      http.when(() -> ValidationHttpUtil.getNoRedirect(expectedAuthorizationValidationUrl()))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, ""));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void validateCustomOidcPublicClientFailsWhenDiscoveryDocumentLacksRequiredEndpoints() {
    AuthenticationConfiguration authConfig = publicAuthConfig();
    OidcClientConfig oidcConfig = publicOidcConfig();
    String incompleteDiscoveryResponse =
        "{"
            + "\"issuer\":\""
            + AUTHORITY
            + "\","
            + "\"response_types_supported\":[\"code\"],"
            + "\"scopes_supported\":[\"openid\",\"profile\"]"
            + "}";

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, incompleteDiscoveryResponse));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI, error.getField());
      assertTrue(error.getError().contains("Failed to extract required endpoints"));
    }
  }

  @Test
  void validateCustomOidcPublicClientRejectsUnavailableJwksEndpoint() {
    AuthenticationConfiguration authConfig = publicAuthConfig();
    OidcClientConfig oidcConfig = publicOidcConfig();

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(503, "unavailable"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS, error.getField());
      assertTrue(error.getError().contains("JWKS endpoint is not accessible"));
    }
  }

  @Test
  void validateCustomOidcPublicClientRejectsEmptyJwksKeys() {
    AuthenticationConfiguration authConfig = publicAuthConfig();
    OidcClientConfig oidcConfig = publicOidcConfig();

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, "{\"keys\":[]}"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS, error.getField());
      assertTrue(error.getError().contains("invalid or empty keys"));
    }
  }

  @Test
  void validateCustomOidcPublicClientWrapsJwksLookupExceptionsAsFieldErrors() {
    AuthenticationConfiguration authConfig = publicAuthConfig();
    OidcClientConfig oidcConfig = publicOidcConfig();

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenThrow(new IllegalStateException("jwks boom"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS, error.getField());
      assertTrue(error.getError().contains("JWKS validation failed"));
    }
  }

  @Test
  void validateCustomOidcPublicClientRejectsUnreachableConfiguredPublicKeyUrl() {
    AuthenticationConfiguration authConfig = publicAuthConfig();
    authConfig.setPublicKeyUrls(List.of(JWKS_URI, BACKUP_JWKS_URI));
    OidcClientConfig oidcConfig = publicOidcConfig();

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(BACKUP_JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(404, "missing"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS, error.getField());
      assertTrue(error.getError().contains("Public key URL is not accessible"));
      assertTrue(error.getError().contains(BACKUP_JWKS_URI));
    }
  }

  @Test
  void validateCustomOidcPublicClientRejectsConfiguredPublicKeyUrlWithInvalidJwksFormat() {
    AuthenticationConfiguration authConfig = publicAuthConfig();
    authConfig.setPublicKeyUrls(List.of(JWKS_URI));
    OidcClientConfig oidcConfig = publicOidcConfig();

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE),
              new ValidationHttpUtil.HttpResponseData(200, "{\"unexpected\":true}"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS, error.getField());
      assertTrue(error.getError().contains("does not return valid JWKS format"));
    }
  }

  @Test
  void validateCustomOidcPublicClientTreatsAuthorizationEndpoint400AsLenientSuccess() {
    AuthenticationConfiguration authConfig = publicAuthConfig();
    OidcClientConfig oidcConfig = publicOidcConfig();

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));
      http.when(() -> ValidationHttpUtil.getNoRedirect(expectedAuthorizationValidationUrl()))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(400, "bad request"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void validateCustomOidcPublicClientTreatsUnexpectedAuthorizationStatusAsLenientSuccess() {
    AuthenticationConfiguration authConfig = publicAuthConfig();
    OidcClientConfig oidcConfig = publicOidcConfig();

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));
      http.when(() -> ValidationHttpUtil.getNoRedirect(expectedAuthorizationValidationUrl()))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(418, "teapot"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void validateCustomOidcPublicClientTreatsAuthorizationFlowExceptionsAsLenientSuccess() {
    AuthenticationConfiguration authConfig = publicAuthConfig();
    OidcClientConfig oidcConfig = publicOidcConfig();

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));
      http.when(() -> ValidationHttpUtil.getNoRedirect(expectedAuthorizationValidationUrl()))
          .thenThrow(new IllegalStateException("auth flow boom"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void validateCustomOidcPublicClientRequiresAuthorizationEndpointInDiscoveryDocument() {
    AuthenticationConfiguration authConfig = publicAuthConfig();
    OidcClientConfig oidcConfig = publicOidcConfig();
    String discoveryWithoutAuthorizationEndpoint =
        "{"
            + "\"issuer\":\""
            + AUTHORITY
            + "\","
            + "\"token_endpoint\":\""
            + TOKEN_ENDPOINT
            + "\","
            + "\"jwks_uri\":\""
            + JWKS_URI
            + "\","
            + "\"response_types_supported\":[\"code\"],"
            + "\"scopes_supported\":[\"openid\",\"profile\"]"
            + "}";

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(200, discoveryWithoutAuthorizationEndpoint));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI, error.getField());
      assertTrue(error.getError().contains("Authorization endpoint is required"));
    }
  }

  @Test
  void validateCustomOidcPublicClientWrapsUnexpectedPublicClientExceptions() {
    FieldError error = validator.validateCustomOidcConfiguration(publicAuthConfig(), null);

    assertNotNull(error);
    assertEquals("authenticationConfiguration", error.getField());
    assertTrue(error.getError().contains("Custom OIDC public client validation failed"));
  }

  @Test
  void validateCustomOidcConfidentialClientRequiresDiscoveryUriWhenNoFallbackExists() {
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setClientType(ClientType.CONFIDENTIAL);

    OidcClientConfig oidcConfig = confidentialOidcConfig();
    oidcConfig.setDiscoveryUri(null);
    oidcConfig.setServerUrl(null);

    FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI, error.getField());
    assertTrue(error.getError().contains("Discovery URI is required"));
  }

  @Test
  void validateCustomOidcConfidentialClientReturnsDiscoveryValidationErrorsImmediately() {
    AuthenticationConfiguration authConfig = confidentialAuthConfig();
    OidcClientConfig oidcConfig = confidentialOidcConfig();
    oidcConfig.setScope("profile");

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.OIDC_SCOPE, error.getField());
      assertTrue(error.getError().contains("must include 'openid'"));
    }
  }

  @Test
  void validateCustomOidcConfidentialClientFailsWhenEndpointExtractionBreaksAfterDiscoveryCheck() {
    AuthenticationConfiguration authConfig = confidentialAuthConfig();
    OidcClientConfig oidcConfig = confidentialOidcConfig();

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE),
              new ValidationHttpUtil.HttpResponseData(503, "unavailable"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI, error.getField());
      assertTrue(error.getError().contains("Failed to extract required endpoints"));
    }
  }

  @Test
  void validateCustomOidcConfidentialClientReturnsJwksValidationErrors() {
    AuthenticationConfiguration authConfig = confidentialAuthConfig();
    OidcClientConfig oidcConfig = confidentialOidcConfig();

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(500, "unavailable"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS, error.getField());
      assertTrue(error.getError().contains("JWKS endpoint is not accessible"));
    }
  }

  @Test
  void validateCustomOidcConfidentialClientRequiresClientIdAfterDiscoveryValidationPasses() {
    AuthenticationConfiguration authConfig = confidentialAuthConfig();
    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("openid profile");
    oidcConfig.setSecret("client-secret");

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID, error.getField());
      assertTrue(error.getError().contains("Client ID is required"));
    }
  }

  @Test
  void validateCustomOidcConfidentialClientWrapsUnexpectedConfidentialExceptions() {
    AuthenticationConfiguration authConfig = confidentialAuthConfig();

    FieldError error = validator.validateCustomOidcConfiguration(authConfig, null);

    assertNotNull(error);
    assertEquals("authenticationConfiguration", error.getField());
    assertTrue(error.getError().contains("Custom OIDC confidential client validation failed"));
  }

  @Test
  void validateCustomOidcConfidentialClientRequiresSecretAfterDiscoveryValidationPasses() {
    AuthenticationConfiguration authConfig = confidentialAuthConfig();
    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("openid profile");
    oidcConfig.setId("client-id");

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNotNull(error);
      assertTrue(error.getError().contains("Client Secret is required"));
    }
  }

  @Test
  void validateCustomOidcConfidentialClientSucceedsOnTokenExchange() {
    AuthenticationConfiguration authConfig = confidentialAuthConfig();
    OidcClientConfig oidcConfig = confidentialOidcConfig();
    oidcConfig.setDiscoveryUri(DISCOVERY_URI);

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));
      http.when(
              () ->
                  ValidationHttpUtil.postForm(
                      TOKEN_ENDPOINT, scopedTokenRequestBody(), formHeaders()))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, "{\"access_token\":\"token\"}"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void validateClientCredentialsWithTokenExchangeUsesOpenIdDefaultScopeWhenScopeIsMissing()
      throws Exception {
    OidcClientConfig oidcConfig = confidentialOidcConfig();
    oidcConfig.setScope(null);
    Method method =
        CustomOidcValidator.class.getDeclaredMethod(
            "validateClientCredentialsWithTokenExchange",
            String.class,
            String.class,
            String.class,
            OidcClientConfig.class);
    method.setAccessible(true);

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(
              () ->
                  ValidationHttpUtil.postForm(
                      TOKEN_ENDPOINT, defaultScopeTokenRequestBody(), formHeaders()))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, "{\"access_token\":\"token\"}"));

      FieldError error =
          (FieldError)
              method.invoke(validator, TOKEN_ENDPOINT, "client-id", "client-secret", oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void validateCustomOidcConfidentialClientTreatsUnauthorizedTokenExchangeAsLenientSuccess() {
    AuthenticationConfiguration authConfig = confidentialAuthConfig();
    OidcClientConfig oidcConfig = confidentialOidcConfig();
    oidcConfig.setDiscoveryUri(DISCOVERY_URI);

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));
      http.when(
              () ->
                  ValidationHttpUtil.postForm(
                      TOKEN_ENDPOINT, scopedTokenRequestBody(), formHeaders()))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(
                  401, "{\"error\":\"invalid_client\",\"error_description\":\"bad secret\"}"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void validateCustomOidcConfidentialClientTreatsInvalidJsonSuccessPayloadAsLenientSuccess() {
    AuthenticationConfiguration authConfig = confidentialAuthConfig();
    OidcClientConfig oidcConfig = confidentialOidcConfig();
    oidcConfig.setDiscoveryUri(DISCOVERY_URI);

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));
      http.when(
              () ->
                  ValidationHttpUtil.postForm(
                      TOKEN_ENDPOINT, scopedTokenRequestBody(), formHeaders()))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, "{not-json"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void validateCustomOidcConfidentialClientTreatsUnsupportedGrantTypeAsLenientSuccess() {
    AuthenticationConfiguration authConfig = confidentialAuthConfig();
    OidcClientConfig oidcConfig = confidentialOidcConfig();
    oidcConfig.setDiscoveryUri(DISCOVERY_URI);

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));
      http.when(
              () ->
                  ValidationHttpUtil.postForm(
                      TOKEN_ENDPOINT, scopedTokenRequestBody(), formHeaders()))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(
                  400, "{\"error\":\"unsupported_grant_type\"}"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void validateCustomOidcConfidentialClientTreatsUnexpectedTokenStatusAsLenientSuccess() {
    AuthenticationConfiguration authConfig = confidentialAuthConfig();
    OidcClientConfig oidcConfig = confidentialOidcConfig();
    oidcConfig.setDiscoveryUri(DISCOVERY_URI);

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));
      http.when(
              () ->
                  ValidationHttpUtil.postForm(
                      TOKEN_ENDPOINT, scopedTokenRequestBody(), formHeaders()))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(429, "rate limited"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void validateCustomOidcConfidentialClientTreatsTokenResponseWithoutAccessTokenAsLenientSuccess() {
    AuthenticationConfiguration authConfig = confidentialAuthConfig();
    OidcClientConfig oidcConfig = confidentialOidcConfig();
    oidcConfig.setDiscoveryUri(DISCOVERY_URI);

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));
      http.when(
              () ->
                  ValidationHttpUtil.postForm(
                      TOKEN_ENDPOINT, scopedTokenRequestBody(), formHeaders()))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, "{\"token_type\":\"Bearer\"}"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void validateCustomOidcConfidentialClientTreatsNonJsonErrorBodiesAsLenientSuccess() {
    AuthenticationConfiguration authConfig = confidentialAuthConfig();
    OidcClientConfig oidcConfig = confidentialOidcConfig();
    oidcConfig.setDiscoveryUri(DISCOVERY_URI);

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));
      http.when(
              () ->
                  ValidationHttpUtil.postForm(
                      TOKEN_ENDPOINT, scopedTokenRequestBody(), formHeaders()))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(400, "not-json"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void validateCustomOidcConfidentialClientTreatsRetryWithoutScopeMissingTokenAsLenientSuccess() {
    AuthenticationConfiguration authConfig = confidentialAuthConfig();
    OidcClientConfig oidcConfig = confidentialOidcConfig();
    oidcConfig.setServerUrl(AUTHORITY);

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));
      http.when(
              () ->
                  ValidationHttpUtil.postForm(
                      TOKEN_ENDPOINT, scopedTokenRequestBody(), formHeaders()))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(
                  400,
                  "{\"error\":\"invalid_scope\",\"error_description\":\"scope unsupported\"}"));
      http.when(
              () ->
                  ValidationHttpUtil.postForm(
                      TOKEN_ENDPOINT, tokenRequestBodyWithoutScope(), formHeaders()))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, "{not-json"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void validateCustomOidcConfidentialClientRetriesWithoutScopeWhenProviderRejectsConfiguredScope() {
    AuthenticationConfiguration authConfig = confidentialAuthConfig();
    OidcClientConfig oidcConfig = confidentialOidcConfig();
    oidcConfig.setServerUrl(AUTHORITY);

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));
      http.when(
              () ->
                  ValidationHttpUtil.postForm(
                      TOKEN_ENDPOINT, scopedTokenRequestBody(), formHeaders()))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(
                  400,
                  "{\"error\":\"invalid_scope\",\"error_description\":\"scope unsupported\"}"));
      http.when(
              () ->
                  ValidationHttpUtil.postForm(
                      TOKEN_ENDPOINT, tokenRequestBodyWithoutScope(), formHeaders()))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, "{\"access_token\":\"token\"}"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void validateCustomOidcConfidentialClientTreatsRetryWithoutScopeExceptionsAsLenientSuccess() {
    AuthenticationConfiguration authConfig = confidentialAuthConfig();
    OidcClientConfig oidcConfig = confidentialOidcConfig();
    oidcConfig.setServerUrl(AUTHORITY);

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));
      http.when(
              () ->
                  ValidationHttpUtil.postForm(
                      TOKEN_ENDPOINT, scopedTokenRequestBody(), formHeaders()))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(
                  400,
                  "{\"error\":\"invalid_scope\",\"error_description\":\"scope unsupported\"}"));
      http.when(
              () ->
                  ValidationHttpUtil.postForm(
                      TOKEN_ENDPOINT, tokenRequestBodyWithoutScope(), formHeaders()))
          .thenThrow(new IllegalStateException("retry boom"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void validateCustomOidcConfidentialClientTreatsUnauthorizedRetryWithoutScopeAsLenientSuccess() {
    AuthenticationConfiguration authConfig = confidentialAuthConfig();
    OidcClientConfig oidcConfig = confidentialOidcConfig();
    oidcConfig.setServerUrl(AUTHORITY);

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));
      http.when(
              () ->
                  ValidationHttpUtil.postForm(
                      TOKEN_ENDPOINT, scopedTokenRequestBody(), formHeaders()))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(
                  400,
                  "{\"error\":\"invalid_scope\",\"error_description\":\"scope unsupported\"}"));
      http.when(
              () ->
                  ValidationHttpUtil.postForm(
                      TOKEN_ENDPOINT, tokenRequestBodyWithoutScope(), formHeaders()))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(
                  403, "{\"error\":\"invalid_client\",\"error_description\":\"bad secret\"}"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNull(error);
    }
  }

  @Test
  void validateCustomOidcConfidentialClientTreatsTokenExchangeExceptionsAsLenientSuccess() {
    AuthenticationConfiguration authConfig = confidentialAuthConfig();
    OidcClientConfig oidcConfig = confidentialOidcConfig();
    oidcConfig.setDiscoveryUri(DISCOVERY_URI);

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(DISCOVERY_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));
      http.when(() -> ValidationHttpUtil.safeGet(JWKS_URI))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, JWKS_RESPONSE));
      http.when(
              () ->
                  ValidationHttpUtil.postForm(
                      TOKEN_ENDPOINT, scopedTokenRequestBody(), formHeaders()))
          .thenThrow(new IllegalStateException("boom"));

      FieldError error = validator.validateCustomOidcConfiguration(authConfig, oidcConfig);

      assertNull(error);
    }
  }

  private static AuthenticationConfiguration publicAuthConfig() {
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setClientType(ClientType.PUBLIC);
    authConfig.setAuthority(AUTHORITY);
    authConfig.setClientId("public-client");
    return authConfig;
  }

  private static AuthenticationConfiguration confidentialAuthConfig() {
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setClientType(ClientType.CONFIDENTIAL);
    authConfig.setAuthority(AUTHORITY);
    authConfig.setClientId("public-client");
    return authConfig;
  }

  private static OidcClientConfig publicOidcConfig() {
    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("openid profile");
    oidcConfig.setResponseType("code");
    return oidcConfig;
  }

  private static OidcClientConfig confidentialOidcConfig() {
    OidcClientConfig oidcConfig = new OidcClientConfig();
    oidcConfig.setScope("openid profile");
    oidcConfig.setId("client-id");
    oidcConfig.setSecret("client-secret");
    return oidcConfig;
  }

  private static Map<String, String> formHeaders() {
    return Map.of("Content-Type", "application/x-www-form-urlencoded");
  }

  private static String expectedAuthorizationValidationUrl() {
    return AUTHORIZATION_ENDPOINT
        + "?client_id="
        + URLEncoder.encode("public-client", StandardCharsets.UTF_8)
        + "&response_type=code"
        + "&redirect_uri="
        + URLEncoder.encode("http://localhost:8585/callback", StandardCharsets.UTF_8)
        + "&state=test-validation"
        + "&scope=openid+profile+email";
  }

  private static String scopedTokenRequestBody() {
    return "grant_type=client_credentials"
        + "&client_id="
        + URLEncoder.encode("client-id", StandardCharsets.UTF_8)
        + "&client_secret="
        + URLEncoder.encode("client-secret", StandardCharsets.UTF_8)
        + "&scope="
        + URLEncoder.encode("openid profile", StandardCharsets.UTF_8);
  }

  private static String defaultScopeTokenRequestBody() {
    return "grant_type=client_credentials"
        + "&client_id="
        + URLEncoder.encode("client-id", StandardCharsets.UTF_8)
        + "&client_secret="
        + URLEncoder.encode("client-secret", StandardCharsets.UTF_8)
        + "&scope=openid";
  }

  private static String tokenRequestBodyWithoutScope() {
    return "grant_type=client_credentials"
        + "&client_id="
        + URLEncoder.encode("client-id", StandardCharsets.UTF_8)
        + "&client_secret="
        + URLEncoder.encode("client-secret", StandardCharsets.UTF_8);
  }
}
