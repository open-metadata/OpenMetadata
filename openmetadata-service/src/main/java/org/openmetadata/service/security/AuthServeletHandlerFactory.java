package org.openmetadata.service.security;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.security.auth.BasicAuthServletHandler;
import org.openmetadata.service.security.auth.LdapAuthServletHandler;
import org.openmetadata.service.security.auth.SamlAuthServletHandler;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

@Slf4j
public class AuthServeletHandlerFactory {
  public static AuthServeletHandler getHandler(OpenMetadataApplicationConfig config) {
    AuthenticationConfiguration authConfig = SecurityConfigurationManager.getCurrentAuthConfig();
    AuthorizerConfiguration authzConfig = SecurityConfigurationManager.getCurrentAuthzConfig();

    if (authConfig == null) {
      LOG.warn("No authentication configuration found, using NoopAuthServeletHandler");
      return NoopAuthServeletHandler.getInstance();
    }

    AuthProvider provider = authConfig.getProvider();
    LOG.info("Creating AuthServeletHandler for provider: {}", provider);

    // Route based on provider type
    switch (provider) {
      case BASIC:
        return BasicAuthServletHandler.getInstance(authConfig, authzConfig);

      case LDAP:
        return LdapAuthServletHandler.getInstance(authConfig, authzConfig);

      case GOOGLE:
      case OKTA:
      case AUTH_0:
      case AZURE:
      case CUSTOM_OIDC:
      case AWS_COGNITO:
        // OIDC providers use AuthenticationCodeFlowHandler
        LOG.info("OIDC provider {} detected, clientType: {}", provider, authConfig.getClientType());
        if (ClientType.CONFIDENTIAL.equals(authConfig.getClientType())) {
          try {
            AuthenticationCodeFlowHandler handler =
                AuthenticationCodeFlowHandler.getInstance(authConfig, authzConfig);
            LOG.info(
                "Successfully initialized AuthenticationCodeFlowHandler for provider: {}",
                provider);
            return handler;
          } catch (Exception e) {
            LOG.error(
                "Failed to initialize AuthenticationCodeFlowHandler for provider: {}. "
                    + "SSO will not be available. Error: {}",
                provider,
                e.getMessage(),
                e);
            return NoopAuthServeletHandler.getInstance();
          }
        }
        LOG.warn(
            "OIDC provider {} requires CONFIDENTIAL client type, but got: {}. "
                + "Set AUTHENTICATION_CLIENT_TYPE=confidential to enable SSO.",
            provider,
            authConfig.getClientType());
        return NoopAuthServeletHandler.getInstance();

      case SAML:
        return SamlAuthServletHandler.getInstance(authConfig, authzConfig);

      case OPENMETADATA:
        // OpenMetadata provider uses Basic auth internally
        return BasicAuthServletHandler.getInstance(authConfig, authzConfig);

      default:
        LOG.warn("Unknown authentication provider: {}", provider);
        return NoopAuthServeletHandler.getInstance();
    }
  }
}
