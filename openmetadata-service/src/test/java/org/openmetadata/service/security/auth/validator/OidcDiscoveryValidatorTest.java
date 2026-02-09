package org.openmetadata.service.security.auth.validator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mockStatic;

import java.io.IOException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
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
}
