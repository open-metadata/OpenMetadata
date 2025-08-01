package org.openmetadata.service.security;

import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

public class AuthServeletHandlerFactory {
  public static AuthServeletHandler getHandler(OpenMetadataApplicationConfig config) {
    if (SecurityConfigurationManager.getInstance().getCurrentAuthConfig() != null
        && SecurityConfigurationManager.getInstance()
            .getCurrentAuthConfig()
            .getClientType()
            .equals(ClientType.CONFIDENTIAL)) {
      return AuthenticationCodeFlowHandler.getInstance(
          SecurityConfigurationManager.getInstance().getCurrentAuthConfig(),
          SecurityConfigurationManager.getInstance().getCurrentAuthzConfig());
    }
    return NoopAuthServeletHandler.getInstance();
  }
}
