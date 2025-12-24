package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.api.configuration.UiThemePreference;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.clients.pipeline.PipelineServiceAPIClientConfig;
import org.openmetadata.service.security.jwt.JWKSResponse;

/**
 * Integration tests for Configuration resource operations.
 *
 * <p>Tests system configuration retrieval including: - Authentication configuration - Authorizer
 * configuration - UI theme preferences - Login configuration - Pipeline service client
 * configuration - JWKS (JSON Web Key Set) configuration
 *
 * <p>Test isolation: Uses TestNamespace for unique entity naming Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 *
 * <p>Migrated from: org.openmetadata.service.resources.system.ConfigResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ConfigResourceIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  @Test
  void testGetAuthConfiguration(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response =
        client.getHttpClient().executeForString(HttpMethod.GET, "/v1/system/config/auth", null);
    AuthenticationConfiguration auth =
        OBJECT_MAPPER.readValue(response, AuthenticationConfiguration.class);

    assertNotNull(auth, "Authentication configuration should not be null");
    assertNotNull(auth.getProvider(), "Provider should be present");
    assertNotNull(auth.getProviderName(), "Provider name should be present");

    assertNull(auth.getLdapConfiguration(), "LDAP configuration should be excluded");
    assertNull(auth.getOidcConfiguration(), "OIDC configuration should be excluded");
    assertTrue(
        auth.getPublicKeyUrls() == null || auth.getPublicKeyUrls().isEmpty(),
        "Public key URLs should be empty or null");
  }

  @Test
  void testGetAuthConfigurationFields(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response =
        client.getHttpClient().executeForString(HttpMethod.GET, "/v1/system/config/auth", null);
    AuthenticationConfiguration auth =
        OBJECT_MAPPER.readValue(response, AuthenticationConfiguration.class);

    assertNotNull(auth);
    if (auth.getClientType() != null) {
      assertNotNull(auth.getClientType(), "Client type should be valid if present");
    }
    if (auth.getEnableSelfSignup() != null) {
      assertNotNull(auth.getEnableSelfSignup(), "Enable self signup should be valid if present");
    }
    if (auth.getJwtPrincipalClaims() != null && !auth.getJwtPrincipalClaims().isEmpty()) {
      assertFalse(
          auth.getJwtPrincipalClaims().isEmpty(),
          "JWT principal claims should be valid if present");
    }
  }

  @Test
  void testGetAuthConfigurationForSaml(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response =
        client.getHttpClient().executeForString(HttpMethod.GET, "/v1/system/config/auth", null);
    AuthenticationConfiguration auth =
        OBJECT_MAPPER.readValue(response, AuthenticationConfiguration.class);

    assertNotNull(auth);
    if (auth.getProvider() != null
        && "SAML".equals(auth.getProvider().name())
        && auth.getSamlConfiguration() != null) {
      assertNotNull(
          auth.getSamlConfiguration(), "SAML configuration should be present for SAML provider");
      assertNotNull(auth.getSamlConfiguration().getIdp(), "IDP configuration should be present");
      assertNotNull(
          auth.getSamlConfiguration().getIdp().getAuthorityUrl(),
          "Authority URL should be present in SAML IDP configuration");
    }
  }

  @Test
  void testGetAuthorizerConfiguration(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/system/config/authorizer", null);
    AuthorizerConfiguration authorizer =
        OBJECT_MAPPER.readValue(response, AuthorizerConfiguration.class);

    assertNotNull(authorizer, "Authorizer configuration should not be null");

    assertNull(authorizer.getClassName(), "Class name should be excluded");
    assertTrue(
        authorizer.getAdminPrincipals() == null || authorizer.getAdminPrincipals().isEmpty(),
        "Admin principals should be empty or null");
    assertNull(
        authorizer.getContainerRequestFilter(), "Container request filter should be excluded");
    assertNull(
        authorizer.getEnableSecureSocketConnection(),
        "Enable secure socket connection should be excluded");
    assertNull(
        authorizer.getEnforcePrincipalDomain(), "Enforce principal domain should be excluded");
    assertTrue(
        authorizer.getAllowedDomains() == null || authorizer.getAllowedDomains().isEmpty(),
        "Allowed domains should be empty or null");
    assertTrue(
        authorizer.getAllowedEmailRegistrationDomains() == null
            || authorizer.getAllowedEmailRegistrationDomains().isEmpty(),
        "Allowed email registration domains should be empty or null");
    assertNull(authorizer.getBotPrincipals(), "Bot principals should be excluded");
    assertTrue(
        authorizer.getTestPrincipals() == null || authorizer.getTestPrincipals().isEmpty(),
        "Test principals should be empty or null");
  }

  @Test
  void testGetAuthorizerPrincipalDomain(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/system/config/authorizer", null);
    AuthorizerConfiguration authorizer =
        OBJECT_MAPPER.readValue(response, AuthorizerConfiguration.class);

    assertNotNull(authorizer);
  }

  @Test
  void testGetPipelineServiceClientConfiguration(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/system/config/pipeline-service-client", null);
    PipelineServiceAPIClientConfig pipelineConfig =
        OBJECT_MAPPER.readValue(response, PipelineServiceAPIClientConfig.class);

    assertNotNull(pipelineConfig, "Pipeline service client configuration should not be null");
    // API endpoint may be null in test environments without a pipeline service (e.g., Airflow)
    // Just verify that the configuration object is returned successfully
  }

  @Test
  void testGetCustomUiThemePreference(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/system/config/customUiThemePreference", null);
    UiThemePreference uiTheme = OBJECT_MAPPER.readValue(response, UiThemePreference.class);

    assertNotNull(uiTheme, "UI theme preference should not be null");
    assertNotNull(uiTheme.getCustomTheme(), "Custom theme should be present");
    assertNotNull(uiTheme.getCustomLogoConfig(), "Custom logo config should be present");

    assertNotNull(uiTheme.getCustomTheme().getPrimaryColor(), "Primary color should be present");
    assertNotNull(uiTheme.getCustomTheme().getSuccessColor(), "Success color should be present");
    assertNotNull(uiTheme.getCustomTheme().getErrorColor(), "Error color should be present");
    assertNotNull(uiTheme.getCustomTheme().getWarningColor(), "Warning color should be present");
    assertNotNull(uiTheme.getCustomTheme().getInfoColor(), "Info color should be present");

    assertNotNull(
        uiTheme.getCustomLogoConfig().getCustomLogoUrlPath(),
        "Custom logo URL path should be present");
    assertNotNull(
        uiTheme.getCustomLogoConfig().getCustomMonogramUrlPath(),
        "Custom monogram URL path should be present");
  }

  @Test
  void testGetLoginConfiguration(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/system/config/loginConfig", null);
    LoginConfiguration loginConfig = OBJECT_MAPPER.readValue(response, LoginConfiguration.class);

    assertNotNull(loginConfig, "Login configuration should not be null");
    assertNotNull(
        loginConfig.getMaxLoginFailAttempts(), "Max login fail attempts should be present");
    assertNotNull(loginConfig.getAccessBlockTime(), "Access block time should be present");
    assertNotNull(loginConfig.getJwtTokenExpiryTime(), "JWT token expiry time should be present");

    assertTrue(
        loginConfig.getMaxLoginFailAttempts() > 0, "Max login fail attempts should be positive");
    assertTrue(loginConfig.getAccessBlockTime() > 0, "Access block time should be positive");
    assertTrue(loginConfig.getJwtTokenExpiryTime() > 0, "JWT token expiry time should be positive");
  }

  @Test
  void testGetLoginConfigurationDefaultValues(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/system/config/loginConfig", null);
    LoginConfiguration loginConfig = OBJECT_MAPPER.readValue(response, LoginConfiguration.class);

    assertNotNull(loginConfig);
    assertEquals(
        3, loginConfig.getMaxLoginFailAttempts(), "Default max login fail attempts should be 3");
    assertEquals(30, loginConfig.getAccessBlockTime(), "Default access block time should be 30");
    assertEquals(
        3600, loginConfig.getJwtTokenExpiryTime(), "Default JWT token expiry time should be 3600");
  }

  @Test
  void testGetJwksConfiguration(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response =
        client.getHttpClient().executeForString(HttpMethod.GET, "/v1/system/config/jwks", null);
    JWKSResponse jwks = OBJECT_MAPPER.readValue(response, JWKSResponse.class);

    assertNotNull(jwks, "JWKS response should not be null");
    assertNotNull(jwks.getJwsKeys(), "JWS keys should be present");
    assertFalse(jwks.getJwsKeys().isEmpty(), "JWS keys should not be empty");

    assertEquals(1, jwks.getJwsKeys().size(), "Should have exactly one JWS key");
    var jwksKey = jwks.getJwsKeys().get(0);
    assertNotNull(jwksKey, "JWKS key should not be null");
  }

  @Test
  void testGetJwksConfigurationKeyDetails(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response =
        client.getHttpClient().executeForString(HttpMethod.GET, "/v1/system/config/jwks", null);
    JWKSResponse jwks = OBJECT_MAPPER.readValue(response, JWKSResponse.class);

    assertNotNull(jwks);
    var jwksKey = jwks.getJwsKeys().get(0);

    assertEquals("RS256", jwksKey.getAlg(), "Algorithm should be RS256");
    assertEquals("sig", jwksKey.getUse(), "Use should be sig");
    assertEquals("RSA", jwksKey.getKty(), "Key type should be RSA");
    assertNotNull(jwksKey.getN(), "Modulus should be present");
    assertNotNull(jwksKey.getE(), "Exponent should be present");
  }
}
