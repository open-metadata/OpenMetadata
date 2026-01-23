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
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.AuthenticationException;
import org.openmetadata.service.resources.settings.SettingsCache;

@Slf4j
public class SecurityConfigurationManager {

  /**
   * Listener interface for configuration change notifications.
   * Implementations can be registered to receive callbacks when configuration is reloaded.
   */
  @FunctionalInterface
  public interface ConfigurationChangeListener {
    /**
     * Called when configuration has been reloaded.
     * @param authConfig The new authentication configuration
     * @param authzConfig The new authorizer configuration
     * @param mcpConfig The new MCP configuration
     */
    void onConfigurationChanged(
        AuthenticationConfiguration authConfig,
        AuthorizerConfiguration authzConfig,
        MCPConfiguration mcpConfig);
  }

  private static class Holder {
    private static final SecurityConfigurationManager INSTANCE = new SecurityConfigurationManager();
  }

  private volatile AuthenticationConfiguration currentAuthConfig;
  private volatile AuthorizerConfiguration currentAuthzConfig;
  private volatile MCPConfiguration currentMcpConfig;
  private final List<ConfigurationChangeListener> listeners =
      new java.util.concurrent.CopyOnWriteArrayList<>();

  public void setCurrentAuthConfig(AuthenticationConfiguration authConfig) {
    this.currentAuthConfig = authConfig;
  }

  public void setCurrentAuthzConfig(AuthorizerConfiguration authzConfig) {
    this.currentAuthzConfig = authzConfig;
  }

  public void setCurrentMcpConfig(MCPConfiguration mcpConfig) {
    this.currentMcpConfig = mcpConfig;
  }

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

  public static AuthenticationConfiguration getCurrentAuthConfig() {
    return getInstance().currentAuthConfig;
  }

  public static AuthorizerConfiguration getCurrentAuthzConfig() {
    return getInstance().currentAuthzConfig;
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

    // Always use YAML configuration for auth during startup
    // This ensures environment variables and YAML defaults take precedence
    // Database settings can override this later via the Settings API
    currentAuthConfig = config.getAuthenticationConfiguration();
    currentAuthzConfig = config.getAuthorizerConfiguration();
    currentMcpConfig = config.getMcpConfiguration();
    LOG.info(
        "Using security configuration from YAML - provider: {}, clientType: {}",
        currentAuthConfig != null ? currentAuthConfig.getProvider() : "null",
        currentAuthConfig != null ? currentAuthConfig.getClientType() : "null");
    LOG.info(
        "Using MCP configuration from YAML - enabled: {}, baseUrl: {}",
        currentMcpConfig != null ? currentMcpConfig.getEnabled() : "null",
        currentMcpConfig != null ? currentMcpConfig.getBaseUrl() : "null");
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

      // Reload MCP configuration from database
      try {
        currentMcpConfig = SettingsCache.getSetting(MCP_CONFIGURATION, MCPConfiguration.class);
        LOG.info("Reloaded MCP configuration from database");
      } catch (Exception e) {
        LOG.warn("Failed to reload MCP configuration, keeping current config: {}", e.getMessage());
      }

      OpenMetadataApplicationConfig appConfig = this.config;
      appConfig.setAuthenticationConfiguration(currentAuthConfig);
      appConfig.setAuthorizerConfiguration(currentAuthzConfig);
      if (currentMcpConfig != null) {
        appConfig.setMcpConfiguration(currentMcpConfig);
      }

      application.reinitializeAuthSystem(appConfig, environment);

      notifyListeners();

      LOG.info("Successfully reloaded security system with new configuration");
    } catch (Exception e) {
      LOG.error("Failed to reload security system", e);
      rollbackConfiguration();
      throw new AuthenticationException("Failed to reload security system", e);
    }
  }

  /**
   * Register a listener to be notified of configuration changes.
   * @param listener The listener to register
   */
  public synchronized void addConfigurationChangeListener(ConfigurationChangeListener listener) {
    if (listener != null && !listeners.contains(listener)) {
      listeners.add(listener);
      LOG.info("Registered configuration change listener: {}", listener.getClass().getSimpleName());
    }
  }

  /**
   * Remove a previously registered listener.
   * @param listener The listener to remove
   */
  public synchronized void removeConfigurationChangeListener(ConfigurationChangeListener listener) {
    if (listeners.remove(listener)) {
      LOG.info("Removed configuration change listener: {}", listener.getClass().getSimpleName());
    }
  }

  /**
   * Notify all registered listeners of configuration changes.
   */
  private synchronized void notifyListeners() {
    for (ConfigurationChangeListener listener : listeners) {
      try {
        listener.onConfigurationChanged(currentAuthConfig, currentAuthzConfig, currentMcpConfig);
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

  private void rollbackConfiguration() {
    if (previousSecurityConfig != null) {
      currentAuthConfig = previousSecurityConfig.getAuthenticationConfiguration();
      currentAuthzConfig = previousSecurityConfig.getAuthorizerConfiguration();
      LOG.info("Rolled back to previous security configuration");
    }
  }

  // Helper methods for checking authentication provider types
  public static boolean isSaml() {
    AuthenticationConfiguration authConfig = getCurrentAuthConfig();
    return authConfig != null && AuthProvider.SAML.equals(authConfig.getProvider());
  }

  public static boolean isBasicAuth() {
    AuthenticationConfiguration authConfig = getCurrentAuthConfig();
    return authConfig != null && AuthProvider.BASIC.equals(authConfig.getProvider());
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
}
