package org.openmetadata.service.security.auth.validator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mockStatic;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.FieldError;
import org.openmetadata.service.util.ValidationHttpUtil;
import org.openmetadata.service.util.ValidationHttpUtil.HttpResponseData;

public class AzureAuthValidatorTest {
  private static final String AZURE_LOGIN = "https://login.microsoftonline.com/";
  private static final String TENANT_ID = "8f1c2a4b-1d2e-4f3a-9b8c-7d6e5f4a3b2c";

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
    // Public client IDs are GUIDs in Azure AD, so malformed IDs should fail locally.
    authConfig.setAuthority("https://login.microsoftonline.com/common");
    authConfig.setClientId("invalid-client-id");
    authConfig.setClientType(ClientType.PUBLIC);

    FieldError result = validator.validateAzureConfiguration(authConfig, oidcConfig);

    assertEquals("failed", result != null ? "failed" : "success");
    if (result != null) {
      assertEquals("authenticationConfiguration.clientId", result.getField());
      assertTrue(result.getError().contains("valid GUID"));
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

  @ParameterizedTest
  @ValueSource(
      strings = {
        AZURE_LOGIN + "common/discovery/keys",
        AZURE_LOGIN + "common/discovery/v2.0/keys",
        AZURE_LOGIN + TENANT_ID + "/discovery/keys",
        AZURE_LOGIN + TENANT_ID + "/discovery/v2.0/keys"
      })
  void acceptsEachAzureSigningKeyEndpoint(String jwksUrl) {
    authConfig.setPublicKeyUrls(List.of(jwksUrl));

    assertNull(validatePublicClientAgainstStubbedAzure());
  }

  @Test
  void rejectsPublicKeyUrlsWithoutAnAzureSigningKeyEndpoint() {
    authConfig.setPublicKeyUrls(
        List.of("https://openmetadata.example.com/api/v1/system/config/jwks"));

    FieldError result = validatePublicClientAgainstStubbedAzure();

    assertEquals("authenticationConfiguration.publicKeyUrls", result.getField());
    assertTrue(result.getError().contains(AZURE_LOGIN + TENANT_ID + "/discovery/v2.0/keys"));
  }

  private FieldError validatePublicClientAgainstStubbedAzure() {
    authConfig.setAuthority(AZURE_LOGIN + TENANT_ID);
    authConfig.setClientId("0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d");
    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(anyString()))
          .thenReturn(new HttpResponseData(200, "{\"keys\":[{\"kid\":\"signing-key\"}]}"));
      http.when(
              () ->
                  ValidationHttpUtil.safeGet(
                      AZURE_LOGIN + TENANT_ID + "/.well-known/openid-configuration"))
          .thenReturn(
              new HttpResponseData(200, "{\"issuer\":\"azure\",\"token_endpoint\":\"token\"}"));
      http.when(() -> ValidationHttpUtil.postForm(anyString(), anyString()))
          .thenReturn(new HttpResponseData(400, "{\"error\":\"unsupported_grant_type\"}"));
      return validator.validateAzureConfiguration(authConfig, oidcConfig);
    }
  }
}
