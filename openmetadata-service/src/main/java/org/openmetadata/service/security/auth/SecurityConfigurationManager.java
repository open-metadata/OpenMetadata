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
import static org.openmetadata.schema.settings.SettingsType.MCP_CONFIGURATION;

import io.dropwizard.core.setup.Environment;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.config.source.ConfigSources;
import org.openmetadata.service.exception.AuthenticationException;
import org.openmetadata.service.resources.settings.SettingsCache;

@Slf4j
public class SecurityConfigurationManager {

  @FunctionalInterface
  public interface ConfigurationChangeListener {
    void onConfigurationChanged(
        AuthenticationConfiguration authConfig,
        AuthorizerConfiguration authzConfig,
        MCPConfiguration mcpConfig);
  }

  private static class Holder {
    private static final SecurityConfigurationManager INSTANCE = new SecurityConfigurationManager();
  }

  private record SecurityState(
      AuthenticationConfiguration authenticationConfiguration,
      AuthorizerConfiguration authorizerConfiguration) {}

  private volatile MCPConfiguration currentMcpConfig;
  private final List<ConfigurationChangeListener> listeners = new CopyOnWriteArrayList<>();

  private volatile SecurityState currentState = new SecurityState(null, null);

  public synchronized void setCurrentAuthConfig(AuthenticationConfiguration authConfig) {
    SecurityState state = currentState;
    currentState = new SecurityState(authConfig, state.authorizerConfiguration());
  }

  public synchronized void setCurrentAuthzConfig(AuthorizerConfiguration authzConfig) {
    SecurityState state = currentState;
    currentState = new SecurityState(state.authenticationConfiguration(), authzConfig);
  }

  public void setCurrentMcpConfig(MCPConfiguration mcpConfig) {
    this.currentMcpConfig = mcpConfig;
  }

  private SecurityConfiguration previousSecurityConfig;
  private MCPConfiguration previousMcpConfig;
  private OpenMetadataApplication application;
  private Environment environment;
  private OpenMetadataApplicationConfig config;
  @Getter private AuthenticatorHandler authenticatorHandler;

  private SecurityConfigurationManager() {}

  public static SecurityConfigurationManager getInstance() {
    return Holder.INSTANCE;
  }

  public static AuthenticationConfiguration getCurrentAuthConfig() {
    return getInstance().currentState.authenticationConfiguration();
  }

  public static AuthorizerConfiguration getCurrentAuthzConfig() {
    return getInstance().currentState.authorizerConfiguration();
  }

  public static MCPConfiguration getCurrentMcpConfig() {
    return getInstance().currentMcpConfig;
  }

  public void setAuthenticatorHandler(AuthenticatorHandler handler) {
    this.authenticatorHandler = handler;
  }

  public void initialize(
      OpenMetadataApplication app, OpenMetadataApplicationConfig config, Environment env) {
    application = app;
    environment = env;
    this.config = config;

    try {
      currentState =
          new SecurityState(
              SettingsCache.getSetting(
                  AUTHENTICATION_CONFIGURATION, AuthenticationConfiguration.class),
              SettingsCache.getSetting(AUTHORIZER_CONFIGURATION, AuthorizerConfiguration.class));
      LOG.info(
          "Loaded security configuration from database - provider: {}",
          currentState.authenticationConfiguration() != null
              ? currentState.authenticationConfiguration().getProvider()
              : "null");
    } catch (Exception e) {
      LOG.warn(
          "Failed to load configuration from database, falling back to YAML: {}", e.getMessage());
      currentState =
          new SecurityState(
              config.getAuthenticationConfiguration(), config.getAuthorizerConfiguration());
      LOG.info(
          "Using security configuration from YAML - provider: {}",
          currentState.authenticationConfiguration() != null
              ? currentState.authenticationConfiguration().getProvider()
              : "null");
    }

    // MCP config is optional — load separately so its absence doesn't affect auth config
    currentMcpConfig =
        SettingsCache.getSettingOrDefault(
            MCP_CONFIGURATION, config.getMcpConfiguration(), MCPConfiguration.class);
  }

  public SecurityConfiguration getCurrentSecurityConfig() {
    SecurityState state = currentState;
    AuthenticationConfiguration currentAuthConfig = state.authenticationConfiguration();
    // Apply LDAP default values before returning to prevent JSON PATCH errors
    // when updating fields that were previously null in the database
    if (currentAuthConfig != null && currentAuthConfig.getLdapConfiguration() != null) {
      Entity.getSystemRepository()
          .ensureLdapConfigDefaultValues(currentAuthConfig.getLdapConfiguration());
    }

    return new SecurityConfiguration()
        .withAuthenticationConfiguration(currentAuthConfig)
        .withAuthorizerConfiguration(state.authorizerConfiguration());
  }

  /**
   * Reloads only when the stored configuration differs from the one this server runs. Used when
   * another server, the CLI or an administration job changed the stored configuration.
   */
  public synchronized boolean reloadIfStoredChanged() {
    SecurityState stored =
        new SecurityState(
            SettingsCache.getSetting(
                AUTHENTICATION_CONFIGURATION, AuthenticationConfiguration.class),
            SettingsCache.getSetting(AUTHORIZER_CONFIGURATION, AuthorizerConfiguration.class));
    MCPConfiguration storedMcp =
        SettingsCache.getSettingOrDefault(
            MCP_CONFIGURATION, deploymentMcpConfiguration(), MCPConfiguration.class);
    boolean changed = !sameJson(stored, currentState) || !sameJson(storedMcp, currentMcpConfig);
    if (changed) {
      reloadSecuritySystem();
    }
    return changed;
  }

  private static boolean sameJson(Object left, Object right) {
    return Objects.equals(JsonUtils.pojoToJson(left), JsonUtils.pojoToJson(right));
  }

  /** The MCP configuration of the configuration file; reloads must not lose it when none is stored. */
  private MCPConfiguration deploymentMcpConfiguration() {
    return ConfigSources.deployment()
        .flatMap(deployment -> deployment.setting(MCP_CONFIGURATION))
        .map(setting -> JsonUtils.convertValue(setting.value(), MCPConfiguration.class))
        .orElse(null);
  }

  /** Synchronized: a reload requested by the API and one noticed by the watcher must not overlap. */
  public synchronized void reloadSecuritySystem() {
    try {
      previousSecurityConfig = getCurrentSecurityConfig();
      previousMcpConfig = currentMcpConfig;
      currentState =
          new SecurityState(
              SettingsCache.getSetting(
                  AUTHENTICATION_CONFIGURATION, AuthenticationConfiguration.class),
              SettingsCache.getSetting(AUTHORIZER_CONFIGURATION, AuthorizerConfiguration.class));
      currentMcpConfig =
          SettingsCache.getSettingOrDefault(
              MCP_CONFIGURATION, deploymentMcpConfiguration(), MCPConfiguration.class);
      applyToApplication();
      notifyListeners();

      LOG.info("Successfully reloaded security system with new configuration");
    } catch (Exception e) {
      LOG.error("Failed to reload security system", e);
      rollbackConfiguration();
      throw new AuthenticationException("Failed to reload security system", e);
    }
  }

  public void addConfigurationChangeListener(ConfigurationChangeListener listener) {
    if (listener != null && !listeners.contains(listener)) {
      listeners.add(listener);
      LOG.debug(
          "Registered configuration change listener: {}", listener.getClass().getSimpleName());
    }
  }

  public void removeConfigurationChangeListener(ConfigurationChangeListener listener) {
    if (listeners.remove(listener)) {
      LOG.debug("Removed configuration change listener: {}", listener.getClass().getSimpleName());
    }
  }

  private void notifyListeners() {
    SecurityState state = currentState;
    for (ConfigurationChangeListener listener : listeners) {
      try {
        listener.onConfigurationChanged(
            state.authenticationConfiguration(), state.authorizerConfiguration(), currentMcpConfig);
        LOG.debug(
            "Notified configuration change listener: {}", listener.getClass().getSimpleName());
      } catch (Exception e) {
        LOG.error(
            "Error notifying configuration change listener: {}",
            listener.getClass().getSimpleName(),
            e);
      }
    }
  }

  /** Copies the current state into the application configuration and rebuilds authentication. */
  private void applyToApplication() {
    OpenMetadataApplicationConfig appConfig = this.config;
    SecurityState state = currentState;
    appConfig.setAuthenticationConfiguration(state.authenticationConfiguration());
    appConfig.setAuthorizerConfiguration(state.authorizerConfiguration());
    if (currentMcpConfig != null) {
      appConfig.setMcpConfiguration(currentMcpConfig);
    }
    application.reinitializeAuthSystem(appConfig, environment);
  }

  /**
   * Restores the previous configuration everywhere the failed reload reached, including the
   * application configuration and the authenticators it may already have replaced, so this server
   * is never left half switched.
   */
  private void rollbackConfiguration() {
    if (previousSecurityConfig != null) {
      currentState =
          new SecurityState(
              previousSecurityConfig.getAuthenticationConfiguration(),
              previousSecurityConfig.getAuthorizerConfiguration());
      currentMcpConfig = previousMcpConfig;
      restoreApplication();
      LOG.info("Rolled back to previous security configuration");
    }
  }

  private void restoreApplication() {
    try {
      applyToApplication();
    } catch (RuntimeException failure) {
      LOG.error("Could not rebuild authentication for the previous configuration", failure);
    }
  }

  public static boolean isSaml() {
    AuthenticationConfiguration authConfig = getCurrentAuthConfig();
    return authConfig != null && AuthProvider.SAML.equals(authConfig.getProvider());
  }

  public static boolean isBasicAuth() {
    AuthenticationConfiguration authConfig = getCurrentAuthConfig();
    return authConfig != null && isNativePasswordProvider(authConfig.getProvider());
  }

  public static boolean isLdap() {
    AuthenticationConfiguration authConfig = getCurrentAuthConfig();
    return authConfig != null && AuthProvider.LDAP.equals(authConfig.getProvider());
  }

  public static boolean isOidc() {
    AuthenticationConfiguration authConfig = getCurrentAuthConfig();
    if (authConfig == null) {
      return false;
    }
    AuthProvider provider = authConfig.getProvider();
    return provider == AuthProvider.GOOGLE
        || provider == AuthProvider.OKTA
        || provider == AuthProvider.AUTH_0
        || provider == AuthProvider.AZURE
        || provider == AuthProvider.CUSTOM_OIDC
        || provider == AuthProvider.AWS_COGNITO;
  }

  public static boolean isConfidentialClient() {
    AuthenticationConfiguration authConfig = getCurrentAuthConfig();
    return authConfig != null && ClientType.CONFIDENTIAL.equals(authConfig.getClientType());
  }

  public static boolean isNativePasswordProvider(AuthProvider provider) {
    return AuthProvider.BASIC.equals(provider) || AuthProvider.OPENMETADATA.equals(provider);
  }
}
