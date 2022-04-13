package org.openmetadata.catalog.util;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.exception.OpenMetadataClientSecurityConfigException;
import org.openmetadata.catalog.security.client.Auth0SSOClientConfig;
import org.openmetadata.catalog.security.client.AzureSSOClientConfig;
import org.openmetadata.catalog.security.client.CustomOIDCSSOClientConfig;
import org.openmetadata.catalog.security.client.GoogleSSOClientConfig;
import org.openmetadata.catalog.security.client.OktaSSOClientConfig;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection.AuthProvider;

@Slf4j
public final class OpenMetadataClientSecurityUtil {
  public static final String SECRET_KEY = "secretKey";
  public static final String AUDIENCE = "audience";
  public static final String CLIENT_ID = "clientId";
  public static final String DOMAIN = "domain";
  public static final String EMAIL = "email";
  public static final String ORG_URL = "orgURL";
  public static final String PRIVATE_KEY = "privateKey";
  public static final String SCOPES = "scopes";
  public static final String AUTHORITY = "authority";
  public static final String CLIENT_SECRET = "clientSecret";
  public static final String TOKEN_ENDPOINT = "tokenEndpoint";
  public static final List<String> GOOGLE_SSO_CONFIGS = List.of(SECRET_KEY);
  public static final List<String> AUTH0_SSO_CONFIGS = List.of(CLIENT_ID, SECRET_KEY, DOMAIN);
  public static final List<String> OKTA_SSO_CONFIGS = List.of(CLIENT_ID, EMAIL, ORG_URL, PRIVATE_KEY);
  public static final List<String> AZURE_SSO_CONFIGS = List.of(CLIENT_SECRET, CLIENT_ID, AUTHORITY, SCOPES);
  public static final List<String> CUSTOM_OIDC_SSO_CONFIGS = List.of(CLIENT_ID, SECRET_KEY, TOKEN_ENDPOINT);

  public static OpenMetadataServerConnection buildOpenMetadataServerConfig(AirflowConfiguration airflowConfiguration) {
    AuthProvider authProvider = AuthProvider.fromValue(airflowConfiguration.getAuthProvider());
    String openMetadataURL = airflowConfiguration.getMetadataApiEndpoint();
    Map<String, String> authConfig = airflowConfiguration.getAuthConfig();
    OpenMetadataServerConnection openMetadataServerConnection = new OpenMetadataServerConnection();
    openMetadataServerConnection.setAuthProvider(authProvider);
    switch (authProvider) {
      case GOOGLE:
        validateAuthConfigs(authConfig, authProvider, GOOGLE_SSO_CONFIGS);
        GoogleSSOClientConfig googleSSOClientConfig =
            new GoogleSSOClientConfig()
                .withSecretKey(authConfig.get(SECRET_KEY))
                .withAudience(authConfig.get(AUDIENCE));
        openMetadataServerConnection.setSecurityConfig(googleSSOClientConfig);
        break;
      case AUTH_0:
        validateAuthConfigs(authConfig, authProvider, AUTH0_SSO_CONFIGS);
        Auth0SSOClientConfig auth0SSOClientConfig =
            new Auth0SSOClientConfig()
                .withClientId(authConfig.get(CLIENT_ID))
                .withSecretKey(authConfig.get(SECRET_KEY))
                .withDomain(authConfig.get(DOMAIN));
        openMetadataServerConnection.setSecurityConfig(auth0SSOClientConfig);
        break;
      case OKTA:
        validateAuthConfigs(authConfig, authProvider, OKTA_SSO_CONFIGS);
        OktaSSOClientConfig oktaSSOClientConfig =
            new OktaSSOClientConfig()
                .withClientId(authConfig.get(CLIENT_ID))
                .withEmail(authConfig.get(EMAIL))
                .withOrgURL(authConfig.get(ORG_URL))
                .withPrivateKey(authConfig.get(PRIVATE_KEY));
        if (authConfig.containsKey(SCOPES)) {
          List<String> oktaScopesList = getSecurityScopes(authConfig.get(SCOPES));
          if (!oktaScopesList.isEmpty()) {
            oktaSSOClientConfig.setScopes(oktaScopesList);
          }
        }
        openMetadataServerConnection.setSecurityConfig(oktaSSOClientConfig);
        break;
      case AZURE:
        validateAuthConfigs(authConfig, authProvider, AZURE_SSO_CONFIGS);
        AzureSSOClientConfig azureSSOClientConfig =
            new AzureSSOClientConfig()
                .withClientId(authConfig.get(CLIENT_ID))
                .withClientSecret(authConfig.get(CLIENT_SECRET))
                .withAuthority(authConfig.get(AUTHORITY));
        if (authConfig.containsKey(SCOPES)) {
          List<String> scopesList = getSecurityScopes(authConfig.get(SCOPES));
          if (!scopesList.isEmpty()) {
            azureSSOClientConfig.setScopes(scopesList);
          }
        }
        openMetadataServerConnection.setSecurityConfig(azureSSOClientConfig);
        break;
      case CUSTOM_OIDC:
        validateAuthConfigs(authConfig, authProvider, CUSTOM_OIDC_SSO_CONFIGS);
        CustomOIDCSSOClientConfig customOIDCSSOClientConfig =
            new CustomOIDCSSOClientConfig()
                .withClientId(authConfig.get(CLIENT_ID))
                .withSecretKey(authConfig.get(SECRET_KEY))
                .withTokenEndpoint(authConfig.get(TOKEN_ENDPOINT));
        openMetadataServerConnection.setSecurityConfig(customOIDCSSOClientConfig);
        break;
      case NO_AUTH:
        break;
      default:
        throw new IllegalArgumentException("OpenMetadata doesn't support auth provider type " + authProvider.value());
    }
    openMetadataServerConnection.setHostPort(openMetadataURL);
    return openMetadataServerConnection;
  }

  public static void validateAuthConfigs(
      Map<String, String> authConfig, AuthProvider authProvider, List<String> configKeys)
      throws OpenMetadataClientSecurityConfigException {
    if (authConfig == null || authConfig.isEmpty()) {
      throw new OpenMetadataClientSecurityConfigException(
          String.format("%s SSO client config requires authConfig section", authProvider));
    }
    for (String key : configKeys) {
      if (!authConfig.containsKey(key) || authConfig.get(key) == null || authConfig.get(key).isEmpty()) {
        throw new OpenMetadataClientSecurityConfigException(
            String.format("%s SSO client config requires %s", authProvider, key));
      }
    }
  }

  public static List<String> getSecurityScopes(String scopes) {
    if (scopes != null && !scopes.isEmpty()) {
      return Arrays.asList(scopes.split("\\s*,\\s*"));
    }
    return Collections.emptyList();
  }
}
