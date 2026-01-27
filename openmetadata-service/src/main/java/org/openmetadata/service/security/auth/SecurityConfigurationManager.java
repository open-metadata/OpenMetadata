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
  private MCPConfiguration previousMcpConfig;
  private OpenMetadataApplication application;
  private Environment environment;
  private OpenMetadataApplicationConfig config;
  @Getter private AuthenticatorHandler authenticatorHandler;
  private java.util.concurrent.ScheduledExecutorService configPollingExecutor;

  private SecurityConfigurationManager() {
    // Private constructor
  }

  public static SecurityConfigurationManager getInstance() {
    return Holder.INSTANCE;
  }

  public static synchronized AuthenticationConfiguration getCurrentAuthConfig() {
    return getInstance().currentAuthConfig;
  }

  public static synchronized AuthorizerConfiguration getCurrentAuthzConfig() {
    return getInstance().currentAuthzConfig;
  }

  public static synchronized MCPConfiguration getCurrentMcpConfig() {
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

    // Try loading from database first (Pure DB-driven)
    try {
      currentAuthConfig =
          SettingsCache.getSetting(AUTHENTICATION_CONFIGURATION, AuthenticationConfiguration.class);
      currentAuthzConfig =
          SettingsCache.getSetting(AUTHORIZER_CONFIGURATION, AuthorizerConfiguration.class);
      currentMcpConfig = SettingsCache.getSetting(MCP_CONFIGURATION, MCPConfiguration.class);
      LOG.info(
          "Loaded security configuration from DATABASE - provider: {}, clientType: {}",
          currentAuthConfig != null ? currentAuthConfig.getProvider() : "null",
          currentAuthConfig != null ? currentAuthConfig.getClientType() : "null");
      LOG.info(
          "Loaded MCP configuration from DATABASE - enabled: {}, baseUrl: {}",
          currentMcpConfig != null ? currentMcpConfig.getEnabled() : "null",
          currentMcpConfig != null ? currentMcpConfig.getBaseUrl() : "null");
    } catch (Exception e) {
      // Fall back to YAML if database is empty or not yet initialized
      LOG.warn(
          "Failed to load configuration from database, falling back to YAML: {}", e.getMessage());
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

    // Start database polling for cluster cache invalidation (Issue #12)
    startConfigurationPolling();
  }

  /**
   * Start periodic polling of database to detect configuration changes in cluster deployments.
   * This ensures all instances reload configuration within 10 seconds of changes.
   */
  private void startConfigurationPolling() {
    if (configPollingExecutor == null) {
      configPollingExecutor =
          java.util.concurrent.Executors.newSingleThreadScheduledExecutor(
              r -> {
                Thread t = new Thread(r, "config-polling-thread");
                t.setDaemon(true);
                return t;
              });

      configPollingExecutor.scheduleWithFixedDelay(
          () -> {
            try {
              checkForConfigurationChanges();
            } catch (Exception e) {
              LOG.error("Error checking for configuration changes", e);
            }
          },
          10,
          10,
          java.util.concurrent.TimeUnit.SECONDS);

      LOG.info("Started configuration polling for cluster cache invalidation (10-second interval)");
    }
  }

  /**
   * Check if configuration has changed in database and reload if necessary.
   * This method polls the database to detect changes made by other instances.
   * Uses hash comparison to detect actual configuration changes efficiently.
   */
  private void checkForConfigurationChanges() {
    try {
      // Invalidate cache to force fresh read from database
      // This ensures we detect changes made by other instances
      SettingsCache.invalidateSettings(AUTHENTICATION_CONFIGURATION.toString());
      SettingsCache.invalidateSettings(AUTHORIZER_CONFIGURATION.toString());
      SettingsCache.invalidateSettings(MCP_CONFIGURATION.toString());

      // Reload from database (cache now fresh)
      AuthenticationConfiguration newAuthConfig =
          SettingsCache.getSetting(AUTHENTICATION_CONFIGURATION, AuthenticationConfiguration.class);
      AuthorizerConfiguration newAuthzConfig =
          SettingsCache.getSetting(AUTHORIZER_CONFIGURATION, AuthorizerConfiguration.class);
      MCPConfiguration newMcpConfig =
          SettingsCache.getSetting(MCP_CONFIGURATION, MCPConfiguration.class);

      // Check if configs actually changed by comparing hash codes
      boolean configChanged = false;
      if ((currentAuthConfig == null && newAuthConfig != null)
          || (currentAuthConfig != null && !currentAuthConfig.equals(newAuthConfig))) {
        configChanged = true;
      }
      if ((currentAuthzConfig == null && newAuthzConfig != null)
          || (currentAuthzConfig != null && !currentAuthzConfig.equals(newAuthzConfig))) {
        configChanged = true;
      }
      if ((currentMcpConfig == null && newMcpConfig != null)
          || (currentMcpConfig != null && !currentMcpConfig.equals(newMcpConfig))) {
        configChanged = true;
      }

      if (configChanged) {
        LOG.info("Configuration change detected in database, reloading security system");
        reloadSecuritySystem();
      }
    } catch (Exception e) {
      LOG.warn("Error checking for configuration changes: {}", e.getMessage());
    }
  }

  /**
   * Shutdown the configuration polling executor.
   */
  public void shutdown() {
    if (configPollingExecutor != null) {
      configPollingExecutor.shutdownNow();
      LOG.info("Stopped configuration polling executor");
    }
  }

  public SecurityConfiguration getCurrentSecurityConfig() {
    return new SecurityConfiguration()
        .withAuthenticationConfiguration(currentAuthConfig)
        .withAuthorizerConfiguration(currentAuthzConfig);
  }

  public void reloadSecuritySystem() {
    try {
      previousSecurityConfig = getCurrentSecurityConfig();
      previousMcpConfig = currentMcpConfig;
      currentAuthConfig =
          SettingsCache.getSetting(AUTHENTICATION_CONFIGURATION, AuthenticationConfiguration.class);
      currentAuthzConfig =
          SettingsCache.getSetting(AUTHORIZER_CONFIGURATION, AuthorizerConfiguration.class);
      currentMcpConfig = SettingsCache.getSetting(MCP_CONFIGURATION, MCPConfiguration.class);

      LOG.info("Reloaded MCP configuration from database");

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
  public void addConfigurationChangeListener(ConfigurationChangeListener listener) {
    if (listener != null && !listeners.contains(listener)) {
      listeners.add(listener);
      LOG.info("Registered configuration change listener: {}", listener.getClass().getSimpleName());
    }
  }

  /**
   * Remove a previously registered listener.
   * @param listener The listener to remove
   */
  public void removeConfigurationChangeListener(ConfigurationChangeListener listener) {
    if (listeners.remove(listener)) {
      LOG.info("Removed configuration change listener: {}", listener.getClass().getSimpleName());
    }
  }

  /**
   * Notify all registered listeners of configuration changes.
   */
  private void notifyListeners() {
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
      currentMcpConfig = previousMcpConfig;
      LOG.info("Rolled back to previous security configuration (including MCP)");
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
