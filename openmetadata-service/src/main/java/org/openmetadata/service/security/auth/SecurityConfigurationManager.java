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
import java.util.concurrent.CopyOnWriteArrayList;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheInvalidationPubSub;
import org.openmetadata.service.exception.AuthenticationException;
import org.openmetadata.service.resources.settings.SettingsCache;

@Slf4j
public class SecurityConfigurationManager {
  public static final String SECURITY_CONFIG_INVALIDATION_TYPE = "securityConfig";
  public static final String SECURITY_CONFIG_RELOAD_OP = "reload";

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
   * Reloads this pod's security system from the database and tells every peer pod to do the same.
   * Without the broadcast an admin changing SSO through the UI leaves the other pods serving their
   * old in-memory security config indefinitely: behind a non-sticky load balancer, logins then
   * succeed or fail depending on which pod answers — at the worst possible moment, the cutover.
   */
  public void reloadSecuritySystem() {
    reloadLocally();
    broadcastReload();
  }

  /**
   * Applies a security-config change made on another pod. Drops the cached settings first — the
   * reload reads through {@link SettingsCache}, so a stale entry here would reload the old config and
   * silently keep the pod out of sync.
   */
  public void applyRemoteSecurityConfigChange() {
    SettingsCache.invalidateSettings(AUTHENTICATION_CONFIGURATION.toString());
    SettingsCache.invalidateSettings(AUTHORIZER_CONFIGURATION.toString());
    SettingsCache.invalidateSettings(MCP_CONFIGURATION.toString());
    LOG.info("Applying security configuration change published by a peer node");
    reloadLocally();
  }

  private void broadcastReload() {
    CacheInvalidationPubSub pubSub = CacheBundle.getCacheInvalidationPubSub();
    if (pubSub == null) {
      LOG.warn(
          "Security configuration reloaded on this node only: no cross-node invalidation bus is "
              + "configured (cache.provider is not redis). In a multi-node deployment every other "
              + "node keeps serving the previous security configuration until it is restarted.");
      return;
    }
    pubSub.publish(SECURITY_CONFIG_INVALIDATION_TYPE, null, null, SECURITY_CONFIG_RELOAD_OP);
    LOG.info("Published security configuration reload to peer nodes");
  }

  private void reloadLocally() {
    try {
      previousSecurityConfig = getCurrentSecurityConfig();
      previousMcpConfig = currentMcpConfig;
      currentState =
          new SecurityState(
              SettingsCache.getSetting(
                  AUTHENTICATION_CONFIGURATION, AuthenticationConfiguration.class),
              SettingsCache.getSetting(AUTHORIZER_CONFIGURATION, AuthorizerConfiguration.class));
      currentMcpConfig =
          SettingsCache.getSettingOrDefault(MCP_CONFIGURATION, null, MCPConfiguration.class);

      OpenMetadataApplicationConfig appConfig = this.config;
      SecurityState state = currentState;
      appConfig.setAuthenticationConfiguration(state.authenticationConfiguration());
      appConfig.setAuthorizerConfiguration(state.authorizerConfiguration());
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

  private void rollbackConfiguration() {
    if (previousSecurityConfig != null) {
      currentState =
          new SecurityState(
              previousSecurityConfig.getAuthenticationConfiguration(),
              previousSecurityConfig.getAuthorizerConfiguration());
      currentMcpConfig = previousMcpConfig;
      LOG.info("Rolled back to previous security configuration");
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

  /**
   * True when logins on this deployment go through the server and therefore mint a server-side
   * {@code UserSession} (basic, LDAP, SAML, and confidential-client OIDC). Public-client OIDC has the
   * SPA talk to the IdP directly, so there is no session to validate against and callers must not
   * require one.
   */
  public static boolean createsServerSideSessions() {
    return isBasicAuth() || isLdap() || isSaml() || isConfidentialClient();
  }

  public static boolean isNativePasswordProvider(AuthProvider provider) {
    return AuthProvider.BASIC.equals(provider) || AuthProvider.OPENMETADATA.equals(provider);
  }
}
