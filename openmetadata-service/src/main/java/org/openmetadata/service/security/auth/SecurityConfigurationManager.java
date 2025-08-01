/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.security.auth;

import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHORIZER_CONFIGURATION;

import io.dropwizard.core.setup.Environment;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.AuthenticationException;
import org.openmetadata.service.resources.settings.SettingsCache;

@Slf4j
public class SecurityConfigurationManager {
  private static class Holder {
    private static final SecurityConfigurationManager INSTANCE = new SecurityConfigurationManager();
  }

  @Getter private AuthenticationConfiguration currentAuthConfig;
  @Getter private AuthorizerConfiguration currentAuthzConfig;
  private SecurityConfiguration previousSecurityConfig;
  private OpenMetadataApplication application;
  private Environment environment;
  private OpenMetadataApplicationConfig config;
  @Getter private AuthenticatorHandler authenticatorHandler;

  private SecurityConfigurationManager() {
    // Private constructor
  }

  public static SecurityConfigurationManager getInstance() {
    return Holder.INSTANCE;
  }

  public void setAuthenticatorHandler(AuthenticatorHandler handler) {
    this.authenticatorHandler = handler;
  }

  public void initialize(
      OpenMetadataApplication app, OpenMetadataApplicationConfig config, Environment env) {
    application = app;
    environment = env;
    this.config = config;

    // Try to load from database first
    try {
      currentAuthConfig =
          SettingsCache.getSetting(AUTHENTICATION_CONFIGURATION, AuthenticationConfiguration.class);
      currentAuthzConfig =
          SettingsCache.getSetting(AUTHORIZER_CONFIGURATION, AuthorizerConfiguration.class);
      LOG.info("Loaded security configuration from database");
    } catch (Exception e) {
      // If not in database, use the one from YAML
      currentAuthConfig = config.getAuthenticationConfiguration();
      currentAuthzConfig = config.getAuthorizerConfiguration();
      LOG.info("Using security configuration from YAML");
    }
  }

  public AuthenticationConfiguration getCurrentAuthConfig() {
    return currentAuthConfig;
  }

  public AuthorizerConfiguration getCurrentAuthzConfig() {
    return currentAuthzConfig;
  }

  public SecurityConfiguration getCurrentSecurityConfig() {
    return new SecurityConfiguration()
        .withAuthenticationConfiguration(currentAuthConfig)
        .withAuthorizerConfiguration(currentAuthzConfig);
  }

  public void reloadSecuritySystem() {
    try {
      previousSecurityConfig = getCurrentSecurityConfig();
      currentAuthConfig =
          SettingsCache.getSetting(AUTHENTICATION_CONFIGURATION, AuthenticationConfiguration.class);
      currentAuthzConfig =
          SettingsCache.getSetting(AUTHORIZER_CONFIGURATION, AuthorizerConfiguration.class);

      OpenMetadataApplicationConfig appConfig = this.config;
      appConfig.setAuthenticationConfiguration(currentAuthConfig);
      appConfig.setAuthorizerConfiguration(currentAuthzConfig);

      application.reinitializeAuthSystem(appConfig, environment);

      LOG.info("Successfully reloaded security system with new configuration");
    } catch (Exception e) {
      LOG.error("Failed to reload security system", e);
      rollbackConfiguration();
      throw new AuthenticationException("Failed to reload security system", e);
    }
  }

  private void rollbackConfiguration() {
    if (previousSecurityConfig != null) {
      currentAuthConfig = previousSecurityConfig.getAuthenticationConfiguration();
      currentAuthzConfig = previousSecurityConfig.getAuthorizerConfiguration();
      LOG.info("Rolled back to previous security configuration");
    }
  }
}
