package org.openmetadata.service.security;

import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

public class AuthServeletHandlerFactory {
  public static AuthServeletHandler getHandler() {
    AuthenticationConfiguration authConfig =
        SecurityConfigurationManager.getInstance().getCurrentAuthConfig();
    if (authConfig == null) {
      return NoopAuthServeletHandler.getInstance();
    }
    AuthProvider provider = authConfig.getProvider();
    if (provider == null) {
      if (authConfig.getClientType() != null
          && authConfig.getClientType().equals(ClientType.CONFIDENTIAL)) {
        return AuthenticationCodeFlowHandler.getInstance(
            authConfig, SecurityConfigurationManager.getInstance().getCurrentAuthzConfig());
      }
      return NoopAuthServeletHandler.getInstance();
    }

    switch (provider) {
      case BASIC:
      case LDAP:
        return new BasicAuthHandler();

      case SAML:
        return new SamlAuthHandler();

      case AZURE:
      case GOOGLE:
      case OKTA:
      case AUTH_0:
      case AWS_COGNITO:
      case CUSTOM_OIDC:
        if (authConfig.getClientType() != null
            && authConfig.getClientType().equals(ClientType.CONFIDENTIAL)) {

          return AuthenticationCodeFlowHandler.getInstance(
              authConfig, SecurityConfigurationManager.getInstance().getCurrentAuthzConfig());
        }
        return NoopAuthServeletHandler.getInstance();
      case OPENMETADATA:
      default:
        return NoopAuthServeletHandler.getInstance();
    }
  }
}
