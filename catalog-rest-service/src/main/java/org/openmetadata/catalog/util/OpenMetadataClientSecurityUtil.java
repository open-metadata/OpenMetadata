package org.openmetadata.catalog.util;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.airflow.AuthConfiguration;
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
  public static final String AUDIENCE = "audience";
  public static final String DOMAIN = "domain";
  public static final String EMAIL = "email";
  public static final String SCOPES = "scopes";
  public static final String AUTHORITY = "authority";
  public static final String CLIENT_SECRET = "clientSecret";

  private OpenMetadataClientSecurityUtil() {
    /* Utility class with private constructor */
  }

  public static OpenMetadataServerConnection buildOpenMetadataServerConfig(AirflowConfiguration airflowConfiguration) {
    AuthProvider authProvider = AuthProvider.fromValue(airflowConfiguration.getAuthProvider());
    String openMetadataURL = airflowConfiguration.getMetadataApiEndpoint();
    AuthConfiguration authConfig = airflowConfiguration.getAuthConfig();
    OpenMetadataServerConnection openMetadataServerConnection = new OpenMetadataServerConnection();
    openMetadataServerConnection.setAuthProvider(authProvider);
    switch (authProvider) {
      case GOOGLE:
        validateAuthConfigs(authConfig, authProvider);
        GoogleSSOClientConfig googleSSOClientConfig =
            new GoogleSSOClientConfig()
                .withSecretKey(authConfig.getGoogle().getSecretKey())
                .withAudience(authConfig.getGoogle().getAudience());
        openMetadataServerConnection.setSecurityConfig(googleSSOClientConfig);
        break;
      case AUTH_0:
        validateAuthConfigs(authConfig, authProvider);
        Auth0SSOClientConfig auth0SSOClientConfig =
            new Auth0SSOClientConfig()
                .withClientId(authConfig.getAuth0().getClientId())
                .withSecretKey(authConfig.getAuth0().getSecretKey())
                .withDomain(authConfig.getAuth0().getDomain());
        openMetadataServerConnection.setSecurityConfig(auth0SSOClientConfig);
        break;
      case OKTA:
        validateAuthConfigs(authConfig, authProvider);
        OktaSSOClientConfig oktaSSOClientConfig =
            new OktaSSOClientConfig()
                .withClientId(authConfig.getOkta().getClientId())
                .withEmail(authConfig.getOkta().getEmail())
                .withOrgURL(authConfig.getOkta().getOrgURL())
                .withPrivateKey(authConfig.getOkta().getPrivateKey());

        List<String> oktaScopesList = authConfig.getOkta().getScopes();
        if (!oktaScopesList.isEmpty()) {
          oktaSSOClientConfig.setScopes(oktaScopesList);
        }

        openMetadataServerConnection.setSecurityConfig(oktaSSOClientConfig);
        break;
      case AZURE:
        validateAuthConfigs(authConfig, authProvider);
        AzureSSOClientConfig azureSSOClientConfig =
            new AzureSSOClientConfig()
                .withClientId(authConfig.getAzure().getClientId())
                .withClientSecret(authConfig.getAzure().getClientSecret())
                .withAuthority(authConfig.getAzure().getAuthority());
        List<String> scopesList = authConfig.getAzure().getScopes();
        if (!scopesList.isEmpty()) {
          azureSSOClientConfig.setScopes(scopesList);
        }

        openMetadataServerConnection.setSecurityConfig(azureSSOClientConfig);
        break;
      case CUSTOM_OIDC:
        validateAuthConfigs(authConfig, authProvider);
        CustomOIDCSSOClientConfig customOIDCSSOClientConfig =
            new CustomOIDCSSOClientConfig()
                .withClientId(authConfig.getCustomOidc().getClientId())
                .withSecretKey(authConfig.getCustomOidc().getSecretKey())
                .withTokenEndpoint(authConfig.getCustomOidc().getTokenEndpoint());
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

  public static void validateAuthConfigs(AuthConfiguration authConfig, AuthProvider authProvider)
      throws OpenMetadataClientSecurityConfigException {
    if (authConfig == null) {
      throw new OpenMetadataClientSecurityConfigException(
          String.format("%s SSO client config requires authConfig section", authProvider));
    }
    switch (authProvider) {
      case NO_AUTH:
        // No auth doesn't require auth configs
        break;
      case AZURE:
        if (authConfig.getAzure() == null) {
          throw new OpenMetadataClientSecurityConfigException(
              String.format("%s SSO client config requires authConfig.%s section", authProvider, authProvider));
        } else {
          AzureSSOClientConfig azureSSOClientConfig = authConfig.getAzure();
          if (azureSSOClientConfig.getClientId() == null || azureSSOClientConfig.getClientId().isEmpty()) {
            throw new OpenMetadataClientSecurityConfigException(
                String.format("%s SSO client config requires clientId", authProvider));
          }
          if (azureSSOClientConfig.getClientSecret() == null || azureSSOClientConfig.getClientSecret().isEmpty()) {
            throw new OpenMetadataClientSecurityConfigException(
                String.format("%s SSO client config requires clientSecret", authProvider));
          }
          if (azureSSOClientConfig.getAuthority() == null || azureSSOClientConfig.getAuthority().isEmpty()) {
            throw new OpenMetadataClientSecurityConfigException(
                String.format("%s SSO client config requires authority", authProvider));
          }
          if (azureSSOClientConfig.getScopes() == null || azureSSOClientConfig.getScopes().isEmpty()) {
            throw new OpenMetadataClientSecurityConfigException(
                String.format("%s SSO client config requires scopes", authProvider));
          }
        }
        break;
      case GOOGLE:
        if (authConfig.getGoogle() == null) {
          throw new OpenMetadataClientSecurityConfigException(
              String.format("%s SSO client config requires authConfig.%s section", authProvider, authProvider));
        } else {
          GoogleSSOClientConfig googleSSOClientConfig = authConfig.getGoogle();
          if (googleSSOClientConfig.getSecretKey() == null || googleSSOClientConfig.getSecretKey().isEmpty()) {
            throw new OpenMetadataClientSecurityConfigException(
                String.format("%s SSO client config requires secretKey", authProvider));
          }
        }
        break;
      case OKTA:
        if (authConfig.getOkta() == null) {
          throw new OpenMetadataClientSecurityConfigException(
              String.format("%s SSO client config requires authConfig.%s section", authProvider, authProvider));
        } else {
          OktaSSOClientConfig oktaSSOClientConfig = authConfig.getOkta();
          if (oktaSSOClientConfig.getClientId() == null || oktaSSOClientConfig.getClientId().isEmpty()) {
            throw new OpenMetadataClientSecurityConfigException(
                String.format("%s SSO client config requires clientId", authProvider));
          }
          if (oktaSSOClientConfig.getPrivateKey() == null || oktaSSOClientConfig.getPrivateKey().isEmpty()) {
            throw new OpenMetadataClientSecurityConfigException(
                String.format("%s SSO client config requires privateKey", authProvider));
          }
          if (oktaSSOClientConfig.getEmail() == null || oktaSSOClientConfig.getEmail().isEmpty()) {
            throw new OpenMetadataClientSecurityConfigException(
                String.format("%s SSO client config requires email", authProvider));
          }
          if (oktaSSOClientConfig.getOrgURL() == null || oktaSSOClientConfig.getOrgURL().isEmpty()) {
            throw new OpenMetadataClientSecurityConfigException(
                String.format("%s SSO client config requires orgUrl", authProvider));
          }
        }
        break;
      case AUTH_0:
        if (authConfig.getAuth0() == null) {
          throw new OpenMetadataClientSecurityConfigException(
              String.format("%s SSO client config requires authConfig.%s section", authProvider, authProvider));
        } else {
          Auth0SSOClientConfig auth0SSOClientConfig = authConfig.getAuth0();
          if (auth0SSOClientConfig.getClientId() == null || auth0SSOClientConfig.getClientId().isEmpty()) {
            throw new OpenMetadataClientSecurityConfigException(
                String.format("%s SSO client config requires clientId", authProvider));
          }
          if (auth0SSOClientConfig.getSecretKey() == null || auth0SSOClientConfig.getSecretKey().isEmpty()) {
            throw new OpenMetadataClientSecurityConfigException(
                String.format("%s SSO client config requires secretKey", authProvider));
          }
          if (auth0SSOClientConfig.getDomain() == null || auth0SSOClientConfig.getDomain().isEmpty()) {
            throw new OpenMetadataClientSecurityConfigException(
                String.format("%s SSO client config requires domain", authProvider));
          }
        }
        break;
      case CUSTOM_OIDC:
        if (authConfig.getCustomOidc() == null) {
          throw new OpenMetadataClientSecurityConfigException(
              String.format("%s SSO client config requires authConfig.%s section", authProvider, authProvider));
        } else {
          CustomOIDCSSOClientConfig customOIDCSSOClientConfig = authConfig.getCustomOidc();
          if (customOIDCSSOClientConfig.getClientId() == null || customOIDCSSOClientConfig.getClientId().isEmpty()) {
            throw new OpenMetadataClientSecurityConfigException(
                String.format("%s SSO client config requires clientId", authProvider));
          }
          if (customOIDCSSOClientConfig.getSecretKey() == null || customOIDCSSOClientConfig.getSecretKey().isEmpty()) {
            throw new OpenMetadataClientSecurityConfigException(
                String.format("%s SSO client config requires secretKey", authProvider));
          }
          if (customOIDCSSOClientConfig.getTokenEndpoint() == null
              || customOIDCSSOClientConfig.getTokenEndpoint().isEmpty()) {
            throw new OpenMetadataClientSecurityConfigException(
                String.format("%s SSO client config requires tokenEndpoint", authProvider));
          }
        }
        break;

      default:
        throw new IllegalStateException("Unexpected value: " + authProvider);
    }
  }

  public static List<String> getSecurityScopes(String scopes) {
    if (scopes != null && !scopes.isEmpty()) {
      return Arrays.asList(scopes.split("\\s*,\\s*"));
    }
    return Collections.emptyList();
  }
}
