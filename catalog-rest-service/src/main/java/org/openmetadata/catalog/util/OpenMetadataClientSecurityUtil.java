package org.openmetadata.catalog.util;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

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
  public static final String CLIENT_ID = "clientId";
  public static final String AUDIENCE = "audience";
  public static final String DOMAIN = "domain";
  public static final String EMAIL = "email";
  public static final String SCOPES = "scopes";
  public static final String AUTHORITY = "authority";
  public static final String CLIENT_SECRET = "clientSecret";
  public static final String SECRET_KEY = "secretKey";

  private OpenMetadataClientSecurityUtil() {
    /* Utility class with private constructor */
  }

  public static OpenMetadataServerConnection buildOpenMetadataServerConfig(AirflowConfiguration airflowConfiguration) {
    AuthProvider authProvider = AuthProvider.fromValue(airflowConfiguration.getAuthProvider());
    String openMetadataURL = airflowConfiguration.getMetadataApiEndpoint();
    AuthConfiguration authConfig = airflowConfiguration.getAuthConfig();
    OpenMetadataServerConnection openMetadataServerConnection = new OpenMetadataServerConnection();
    openMetadataServerConnection.setAuthProvider(authProvider);
    if (authProvider != AuthProvider.NO_AUTH && authConfig == null) {
      throw new OpenMetadataClientSecurityConfigException(
          String.format("%s SSO client config requires authConfig section", authProvider));
    }
    switch (authProvider) {
      case GOOGLE:
        GoogleSSOClientConfig googleSSOClientConfig = authConfig.getGoogle();
        checkAuthConfig(googleSSOClientConfig, authProvider);
        checkRequiredField(SECRET_KEY, googleSSOClientConfig.getSecretKey(), authProvider);
        openMetadataServerConnection.setSecurityConfig(googleSSOClientConfig);
        break;
      case AUTH_0:
        Auth0SSOClientConfig auth0SSOClientConfig = authConfig.getAuth0();
        checkAuthConfig(auth0SSOClientConfig, authProvider);
        checkRequiredField(CLIENT_ID, auth0SSOClientConfig.getClientId(), authProvider);
        checkRequiredField(SECRET_KEY, auth0SSOClientConfig.getSecretKey(), authProvider);
        checkRequiredField(DOMAIN, auth0SSOClientConfig.getDomain(), authProvider);
        openMetadataServerConnection.setSecurityConfig(auth0SSOClientConfig);
        break;
      case OKTA:
        OktaSSOClientConfig oktaSSOClientConfig = authConfig.getOkta();
        checkAuthConfig(oktaSSOClientConfig, authProvider);
        checkRequiredField(CLIENT_ID, oktaSSOClientConfig.getClientId(), authProvider);
        checkRequiredField("privateKey", oktaSSOClientConfig.getPrivateKey(), authProvider);
        checkRequiredField(EMAIL, oktaSSOClientConfig.getEmail(), authProvider);
        checkRequiredField("orgUrl", oktaSSOClientConfig.getOrgURL(), authProvider);
        openMetadataServerConnection.setSecurityConfig(oktaSSOClientConfig);
        break;
      case AZURE:
        AzureSSOClientConfig azureSSOClientConfig = authConfig.getAzure();
        checkAuthConfig(azureSSOClientConfig, authProvider);
        checkRequiredField(CLIENT_ID, azureSSOClientConfig.getClientId(), authProvider);
        checkRequiredField(CLIENT_SECRET, azureSSOClientConfig.getClientSecret(), authProvider);
        checkRequiredField(AUTHORITY, azureSSOClientConfig.getAuthority(), authProvider);
        checkRequiredField(SCOPES, azureSSOClientConfig.getScopes(), authProvider);
        openMetadataServerConnection.setSecurityConfig(azureSSOClientConfig);
        break;
      case CUSTOM_OIDC:
        CustomOIDCSSOClientConfig customOIDCSSOClientConfig = authConfig.getCustomOidc();
        checkAuthConfig(customOIDCSSOClientConfig, authProvider);
        checkRequiredField(CLIENT_ID, customOIDCSSOClientConfig.getClientId(), authProvider);
        checkRequiredField(SECRET_KEY, customOIDCSSOClientConfig.getSecretKey(), authProvider);
        checkRequiredField("tokenEndpoint", customOIDCSSOClientConfig.getTokenEndpoint(), authProvider);
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

  public static void checkAuthConfig(Object authConfig, AuthProvider authProvider) {
    if (authConfig == null) {
      throw new OpenMetadataClientSecurityConfigException(
          String.format("%s SSO client config requires authConfig.%s section", authProvider, authProvider));
    }
  }

  public static void checkRequiredField(String fieldName, String fieldValue, AuthProvider authProvider) {
    if (nullOrEmpty(fieldValue)) {
      throw new OpenMetadataClientSecurityConfigException(
          String.format("%s SSO client config requires %s", authProvider, fieldName));
    }
  }

  public static void checkRequiredField(String fieldName, List<?> fieldValue, AuthProvider authProvider) {
    if (nullOrEmpty(fieldValue)) {
      throw new OpenMetadataClientSecurityConfigException(
          String.format("%s SSO client config requires %s", authProvider, fieldName));
    }
  }

  public static List<String> getSecurityScopes(String scopes) {
    return nullOrEmpty(scopes) ? Arrays.asList(scopes.split("\\s*,\\s*")) : Collections.emptyList();
  }
}
