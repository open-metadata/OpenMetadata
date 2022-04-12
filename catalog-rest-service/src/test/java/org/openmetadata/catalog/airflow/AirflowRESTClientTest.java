package org.openmetadata.catalog.airflow;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.security.client.Auth0SSOClientConfig;
import org.openmetadata.catalog.security.client.AzureSSOClientConfig;
import org.openmetadata.catalog.security.client.CustomOIDCSSOClientConfig;
import org.openmetadata.catalog.security.client.GoogleSSOClientConfig;
import org.openmetadata.catalog.security.client.OKtaSSOClientConfig;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.catalog.util.JsonUtils;

@Slf4j
public class AirflowRESTClientTest {

  @Test
  void testOpenMetadataGoogleClientConfigs() {
    AirflowConfiguration airflowConfiguration = buildGoogleAuthConfig();
    AirflowRESTClient airflowRESTClient = new AirflowRESTClient(airflowConfiguration);
    OpenMetadataServerConnection serverConnection = airflowRESTClient.buildOpenMetadataServerConfig();
    assertEquals(serverConnection.getHostPort(), airflowConfiguration.getMetadataApiEndpoint());
    assertEquals(serverConnection.getAuthProvider().value(), airflowConfiguration.getAuthProvider());
    GoogleSSOClientConfig googleSSOClientConfig =
        JsonUtils.convertValue(serverConnection.getSecurityConfig(), GoogleSSOClientConfig.class);
    assertEquals(googleSSOClientConfig.getSecretKey(), airflowConfiguration.getAuthConfig().get("secretKey"));
    assertEquals(googleSSOClientConfig.getAudience(), airflowConfiguration.getAuthConfig().get("audience"));
  }

  @Test
  void testOpenMetadataOktaClientConfigs() {
    AirflowConfiguration airflowConfiguration = buildOktaAuthConfig();
    AirflowRESTClient airflowRESTClient = new AirflowRESTClient(airflowConfiguration);
    OpenMetadataServerConnection serverConnection = airflowRESTClient.buildOpenMetadataServerConfig();
    assertEquals(serverConnection.getHostPort(), airflowConfiguration.getMetadataApiEndpoint());
    assertEquals(serverConnection.getAuthProvider().value(), airflowConfiguration.getAuthProvider());
    OKtaSSOClientConfig oktaSSOClientConfig =
        JsonUtils.convertValue(serverConnection.getSecurityConfig(), OKtaSSOClientConfig.class);
    assertEquals(oktaSSOClientConfig.getClientId(), airflowConfiguration.getAuthConfig().get("clientId"));
    assertEquals(oktaSSOClientConfig.getEmail(), airflowConfiguration.getAuthConfig().get("email"));
    assertEquals(oktaSSOClientConfig.getOrgURL(), airflowConfiguration.getAuthConfig().get("orgURL"));
    assertEquals(oktaSSOClientConfig.getPrivateKey(), airflowConfiguration.getAuthConfig().get("privateKey"));
    assertEquals(
        oktaSSOClientConfig.getScopes(),
        airflowRESTClient.getSecurityScopes(airflowConfiguration.getAuthConfig().get("scopes")));
  }

  @Test
  void testOpenMetadataAuth0ClientConfigs() {
    AirflowConfiguration airflowConfiguration = buildAuth0Config();
    AirflowRESTClient airflowRESTClient = new AirflowRESTClient(airflowConfiguration);
    OpenMetadataServerConnection serverConnection = airflowRESTClient.buildOpenMetadataServerConfig();
    assertEquals(serverConnection.getHostPort(), airflowConfiguration.getMetadataApiEndpoint());
    assertEquals(serverConnection.getAuthProvider().value(), airflowConfiguration.getAuthProvider());
    Auth0SSOClientConfig auth0SSOClientConfig =
        JsonUtils.convertValue(serverConnection.getSecurityConfig(), Auth0SSOClientConfig.class);
    assertEquals(auth0SSOClientConfig.getClientId(), airflowConfiguration.getAuthConfig().get("clientId"));
    assertEquals(auth0SSOClientConfig.getSecretKey(), airflowConfiguration.getAuthConfig().get("secretKey"));
    assertEquals(auth0SSOClientConfig.getDomain(), airflowConfiguration.getAuthConfig().get("domain"));
  }

  @Test
  void testOpenMetadataAzureAuthClientConfigs() {
    AirflowConfiguration airflowConfiguration = buildAzureAuthConfig();
    AirflowRESTClient airflowRESTClient = new AirflowRESTClient(airflowConfiguration);
    OpenMetadataServerConnection serverConnection = airflowRESTClient.buildOpenMetadataServerConfig();
    assertEquals(serverConnection.getHostPort(), airflowConfiguration.getMetadataApiEndpoint());
    assertEquals(serverConnection.getAuthProvider().value(), airflowConfiguration.getAuthProvider());
    AzureSSOClientConfig azureSSOClientConfig =
        JsonUtils.convertValue(serverConnection.getSecurityConfig(), AzureSSOClientConfig.class);
    assertEquals(azureSSOClientConfig.getClientId(), airflowConfiguration.getAuthConfig().get("clientId"));
    assertEquals(azureSSOClientConfig.getClientSecret(), airflowConfiguration.getAuthConfig().get("clientSecret"));
    assertEquals(azureSSOClientConfig.getAuthority(), airflowConfiguration.getAuthConfig().get("authority"));
    assertEquals(
        azureSSOClientConfig.getScopes(),
        airflowRESTClient.getSecurityScopes(airflowConfiguration.getAuthConfig().get("scopes")));
  }

  @Test
  void testOpenMetadataCustomOIDCAuthClientConfigs() {
    AirflowConfiguration airflowConfiguration = buildCustomOIDCConfig();
    AirflowRESTClient airflowRESTClient = new AirflowRESTClient(airflowConfiguration);
    OpenMetadataServerConnection serverConnection = airflowRESTClient.buildOpenMetadataServerConfig();
    assertEquals(serverConnection.getHostPort(), airflowConfiguration.getMetadataApiEndpoint());
    assertEquals(serverConnection.getAuthProvider().value(), airflowConfiguration.getAuthProvider());
    CustomOIDCSSOClientConfig customOIDCSSOClientConfig =
        JsonUtils.convertValue(serverConnection.getSecurityConfig(), CustomOIDCSSOClientConfig.class);
    assertEquals(customOIDCSSOClientConfig.getClientId(), airflowConfiguration.getAuthConfig().get("clientId"));
    assertEquals(customOIDCSSOClientConfig.getSecretKey(), airflowConfiguration.getAuthConfig().get("secretKey"));
    assertEquals(
        customOIDCSSOClientConfig.getTokenEndpoint(), airflowConfiguration.getAuthConfig().get("tokenEndpoint"));
  }

  @Test
  void testOpenMetadataNoAuthClientConfigs() {
    AirflowConfiguration airflowConfiguration = buildNoAuthConfig();
    AirflowRESTClient airflowRESTClient = new AirflowRESTClient(airflowConfiguration);
    OpenMetadataServerConnection serverConnection = airflowRESTClient.buildOpenMetadataServerConfig();
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
    Map<String, String> authConfig = new HashMap<>();
    authConfig.put("secretKey", "1234");
    authConfig.put("audience", "test");
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
    Map<String, String> authConfig = new HashMap<>();
    authConfig.put("clientId", "1234");
    authConfig.put("email", "test@test.com");
    authConfig.put("orgURL", "https://okta.domain.com");
    authConfig.put("privateKey", "34123");
    authConfig.put("scopes", "local,prod,test");
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
    Map<String, String> authConfig = new HashMap<>();
    authConfig.put("clientId", "1234");
    authConfig.put("secretKey", "34123");
    authConfig.put("audience", "local");
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
    Map<String, String> authConfig = new HashMap<>();
    authConfig.put("clientId", "1234");
    authConfig.put("clientSecret", "34123");
    authConfig.put("authority", "local");
    authConfig.put("scopes", "local,prod,test");
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
    Map<String, String> authConfig = new HashMap<>();
    authConfig.put("clientId", "1234");
    authConfig.put("secretKey", "34123");
    authConfig.put("tokenEndpoint", "https://localhost/");
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
