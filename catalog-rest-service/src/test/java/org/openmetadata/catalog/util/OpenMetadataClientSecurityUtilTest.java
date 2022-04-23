package org.openmetadata.catalog.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.airflow.AuthConfiguration;
import org.openmetadata.catalog.exception.OpenMetadataClientSecurityConfigException;
import org.openmetadata.catalog.security.client.Auth0SSOClientConfig;
import org.openmetadata.catalog.security.client.AzureSSOClientConfig;
import org.openmetadata.catalog.security.client.CustomOIDCSSOClientConfig;
import org.openmetadata.catalog.security.client.GoogleSSOClientConfig;
import org.openmetadata.catalog.security.client.OktaSSOClientConfig;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;

@Slf4j
class OpenMetadataClientSecurityUtilTest {

  @Test
  void testOpenMetadataGoogleClientConfigs() {
    AirflowConfiguration airflowConfiguration = buildGoogleAuthConfig();
    OpenMetadataServerConnection serverConnection =
        OpenMetadataClientSecurityUtil.buildOpenMetadataServerConfig(airflowConfiguration);
    assertEquals(serverConnection.getHostPort(), airflowConfiguration.getMetadataApiEndpoint());
    assertEquals(serverConnection.getAuthProvider().value(), airflowConfiguration.getAuthProvider());
    GoogleSSOClientConfig googleSSOClientConfig =
        JsonUtils.convertValue(serverConnection.getSecurityConfig(), GoogleSSOClientConfig.class);
    assertEquals(googleSSOClientConfig.getSecretKey(), airflowConfiguration.getAuthConfig().getGoogle().getSecretKey());
    assertEquals(googleSSOClientConfig.getAudience(), airflowConfiguration.getAuthConfig().getGoogle().getAudience());
    AuthConfiguration authConfigs = airflowConfiguration.getAuthConfig();
    authConfigs.getGoogle().setSecretKey(null);
    airflowConfiguration.setAuthConfig(authConfigs);
    OpenMetadataClientSecurityConfigException exception =
        assertThrows(
            OpenMetadataClientSecurityConfigException.class,
            () -> {
              OpenMetadataClientSecurityUtil.buildOpenMetadataServerConfig(airflowConfiguration);
            });
    assertEquals("google SSO client config requires secretKey", exception.getMessage());
  }

  @Test
  void testOpenMetadataOktaClientConfigs() {
    AirflowConfiguration airflowConfiguration = buildOktaAuthConfig();
    OpenMetadataServerConnection serverConnection =
        OpenMetadataClientSecurityUtil.buildOpenMetadataServerConfig(airflowConfiguration);
    assertEquals(serverConnection.getHostPort(), airflowConfiguration.getMetadataApiEndpoint());
    assertEquals(serverConnection.getAuthProvider().value(), airflowConfiguration.getAuthProvider());
    OktaSSOClientConfig oktaSSOClientConfig =
        JsonUtils.convertValue(serverConnection.getSecurityConfig(), OktaSSOClientConfig.class);
    OktaSSOClientConfig oktaSSOClientConfig1 = airflowConfiguration.getAuthConfig().getOkta();
    assertEquals(oktaSSOClientConfig.getClientId(), oktaSSOClientConfig1.getClientId());
    assertEquals(oktaSSOClientConfig.getEmail(), oktaSSOClientConfig1.getEmail());
    assertEquals(oktaSSOClientConfig.getOrgURL(), oktaSSOClientConfig1.getOrgURL());
    assertEquals(oktaSSOClientConfig.getPrivateKey(), oktaSSOClientConfig1.getPrivateKey());
    assertEquals(oktaSSOClientConfig.getScopes(), oktaSSOClientConfig1.getScopes());
    AuthConfiguration authConfigs = airflowConfiguration.getAuthConfig();
    authConfigs.getOkta().setPrivateKey(null);
    airflowConfiguration.setAuthConfig(authConfigs);
    OpenMetadataClientSecurityConfigException exception =
        assertThrows(
            OpenMetadataClientSecurityConfigException.class,
            () -> {
              OpenMetadataClientSecurityUtil.buildOpenMetadataServerConfig(airflowConfiguration);
            });
    assertEquals("okta SSO client config requires privateKey", exception.getMessage());
  }

  @Test
  void testOpenMetadataAuth0ClientConfigs() {
    AirflowConfiguration airflowConfiguration = buildAuth0Config();
    OpenMetadataServerConnection serverConnection =
        OpenMetadataClientSecurityUtil.buildOpenMetadataServerConfig(airflowConfiguration);
    assertEquals(serverConnection.getHostPort(), airflowConfiguration.getMetadataApiEndpoint());
    assertEquals(serverConnection.getAuthProvider().value(), airflowConfiguration.getAuthProvider());
    Auth0SSOClientConfig auth0SSOClientConfig =
        JsonUtils.convertValue(serverConnection.getSecurityConfig(), Auth0SSOClientConfig.class);
    Auth0SSOClientConfig auth0SSOClientConfig1 = airflowConfiguration.getAuthConfig().getAuth0();
    assertEquals(auth0SSOClientConfig.getClientId(), auth0SSOClientConfig1.getClientId());
    assertEquals(auth0SSOClientConfig.getSecretKey(), auth0SSOClientConfig1.getSecretKey());
    assertEquals(auth0SSOClientConfig.getDomain(), auth0SSOClientConfig1.getDomain());
  }

  @Test
  void testOpenMetadataAzureAuthClientConfigs() {
    AirflowConfiguration airflowConfiguration = buildAzureAuthConfig();
    OpenMetadataServerConnection serverConnection =
        OpenMetadataClientSecurityUtil.buildOpenMetadataServerConfig(airflowConfiguration);
    assertEquals(serverConnection.getHostPort(), airflowConfiguration.getMetadataApiEndpoint());
    assertEquals(serverConnection.getAuthProvider().value(), airflowConfiguration.getAuthProvider());
    AzureSSOClientConfig azureSSOClientConfig =
        JsonUtils.convertValue(serverConnection.getSecurityConfig(), AzureSSOClientConfig.class);
    AzureSSOClientConfig azureSSOClientConfig1 = airflowConfiguration.getAuthConfig().getAzure();
    assertEquals(azureSSOClientConfig.getClientId(), azureSSOClientConfig1.getClientId());
    assertEquals(azureSSOClientConfig.getClientSecret(), azureSSOClientConfig1.getClientSecret());
    assertEquals(azureSSOClientConfig.getAuthority(), azureSSOClientConfig1.getAuthority());
    assertEquals(azureSSOClientConfig.getScopes(), azureSSOClientConfig1.getScopes());
  }

  @Test
  void testOpenMetadataCustomOIDCAuthClientConfigs() {
    AirflowConfiguration airflowConfiguration = buildCustomOIDCConfig();
    OpenMetadataServerConnection serverConnection =
        OpenMetadataClientSecurityUtil.buildOpenMetadataServerConfig(airflowConfiguration);
    assertEquals(serverConnection.getHostPort(), airflowConfiguration.getMetadataApiEndpoint());
    assertEquals(serverConnection.getAuthProvider().value(), airflowConfiguration.getAuthProvider());
    CustomOIDCSSOClientConfig customOIDCSSOClientConfig =
        JsonUtils.convertValue(serverConnection.getSecurityConfig(), CustomOIDCSSOClientConfig.class);
    CustomOIDCSSOClientConfig customOIDCSSOClientConfig1 = airflowConfiguration.getAuthConfig().getCustomOidc();
    assertEquals(customOIDCSSOClientConfig.getClientId(), customOIDCSSOClientConfig1.getClientId());
    assertEquals(customOIDCSSOClientConfig.getSecretKey(), customOIDCSSOClientConfig1.getSecretKey());
    assertEquals(customOIDCSSOClientConfig.getTokenEndpoint(), customOIDCSSOClientConfig1.getTokenEndpoint());
  }

  @Test
  void testOpenMetadataNoAuthClientConfigs() {
    AirflowConfiguration airflowConfiguration = buildNoAuthConfig();
    OpenMetadataServerConnection serverConnection =
        OpenMetadataClientSecurityUtil.buildOpenMetadataServerConfig(airflowConfiguration);
    assertEquals(serverConnection.getHostPort(), airflowConfiguration.getMetadataApiEndpoint());
    assertEquals(serverConnection.getAuthProvider().value(), airflowConfiguration.getAuthProvider());
    assertNull(serverConnection.getSecurityConfig());
  }

  private AirflowConfiguration buildNoAuthConfig() {
    AirflowConfiguration airflowConfiguration = new AirflowConfiguration();
    airflowConfiguration.setUsername("admin");
    airflowConfiguration.setPassword("admin");
    airflowConfiguration.setApiEndpoint("http://localhost:8080/api");
    airflowConfiguration.setMetadataApiEndpoint("http://localhost:8585/api");
    airflowConfiguration.setAuthProvider("no-auth");
    return airflowConfiguration;
  }

  private AirflowConfiguration buildGoogleAuthConfig() {
    AuthConfiguration authConfig = new AuthConfiguration();
    GoogleSSOClientConfig googleSSOClientConfig =
        new GoogleSSOClientConfig().withSecretKey("1234").withAudience("test");
    authConfig.setGoogle(googleSSOClientConfig);
    AirflowConfiguration airflowConfiguration = new AirflowConfiguration();
    airflowConfiguration.setAuthConfig(authConfig);
    airflowConfiguration.setUsername("admin");
    airflowConfiguration.setPassword("admin");
    airflowConfiguration.setApiEndpoint("http://localhost:8080/api");
    airflowConfiguration.setMetadataApiEndpoint("http://localhost:8585/api");
    airflowConfiguration.setAuthProvider("google");
    return airflowConfiguration;
  }

  private AirflowConfiguration buildOktaAuthConfig() {
    AuthConfiguration authConfig = new AuthConfiguration();
    List<String> scopes = List.of("local", "prod", "test");
    OktaSSOClientConfig oktaSSOClientConfig =
        new OktaSSOClientConfig()
            .withClientId("1234")
            .withEmail("test@test.com")
            .withOrgURL("https://okta.domain.com")
            .withPrivateKey("34123")
            .withScopes(scopes);
    authConfig.setOkta(oktaSSOClientConfig);
    AirflowConfiguration airflowConfiguration = new AirflowConfiguration();
    airflowConfiguration.setAuthConfig(authConfig);
    airflowConfiguration.setUsername("admin");
    airflowConfiguration.setPassword("admin");
    airflowConfiguration.setApiEndpoint("http://localhost:8080/api");
    airflowConfiguration.setMetadataApiEndpoint("http://localhost:8585/api");
    airflowConfiguration.setAuthProvider("okta");
    return airflowConfiguration;
  }

  private AirflowConfiguration buildAuth0Config() {
    AuthConfiguration authConfig = new AuthConfiguration();
    Auth0SSOClientConfig auth0SSOClientConfig =
        new Auth0SSOClientConfig().withClientId("1234").withDomain("local").withSecretKey("34123");
    authConfig.setAuth0(auth0SSOClientConfig);
    AirflowConfiguration airflowConfiguration = new AirflowConfiguration();
    airflowConfiguration.setAuthConfig(authConfig);
    airflowConfiguration.setUsername("admin");
    airflowConfiguration.setPassword("admin");
    airflowConfiguration.setApiEndpoint("http://localhost:8080/api");
    airflowConfiguration.setMetadataApiEndpoint("http://localhost:8585/api");
    airflowConfiguration.setAuthProvider("auth0");
    return airflowConfiguration;
  }

  private AirflowConfiguration buildAzureAuthConfig() {
    AuthConfiguration authConfig = new AuthConfiguration();
    List<String> scopes = List.of("local", "prod", "test");
    AzureSSOClientConfig azureSSOClientConfig =
        new AzureSSOClientConfig()
            .withClientId("1234")
            .withClientSecret("34123")
            .withAuthority("local")
            .withScopes(scopes);
    authConfig.setAzure(azureSSOClientConfig);
    AirflowConfiguration airflowConfiguration = new AirflowConfiguration();
    airflowConfiguration.setAuthConfig(authConfig);
    airflowConfiguration.setUsername("admin");
    airflowConfiguration.setPassword("admin");
    airflowConfiguration.setApiEndpoint("http://localhost:8080/api");
    airflowConfiguration.setMetadataApiEndpoint("http://localhost:8585/api");
    airflowConfiguration.setAuthProvider("azure");
    return airflowConfiguration;
  }

  private AirflowConfiguration buildCustomOIDCConfig() {
    AuthConfiguration authConfig = new AuthConfiguration();
    CustomOIDCSSOClientConfig customOIDCSSOClientConfig =
        new CustomOIDCSSOClientConfig()
            .withClientId("1234")
            .withSecretKey("34123")
            .withTokenEndpoint("https://localhost/");
    authConfig.setCustomOidc(customOIDCSSOClientConfig);
    AirflowConfiguration airflowConfiguration = new AirflowConfiguration();
    airflowConfiguration.setAuthConfig(authConfig);
    airflowConfiguration.setUsername("admin");
    airflowConfiguration.setPassword("admin");
    airflowConfiguration.setApiEndpoint("http://localhost:8080/api");
    airflowConfiguration.setMetadataApiEndpoint("http://localhost:8585/api");
    airflowConfiguration.setAuthProvider("custom-oidc");
    return airflowConfiguration;
  }
}
