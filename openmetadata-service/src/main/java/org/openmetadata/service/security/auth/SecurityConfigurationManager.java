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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHORIZER_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.MCP_CONFIGURATION;

import com.google.common.annotations.VisibleForTesting;
import io.dropwizard.core.setup.Environment;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.AuthenticationException;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.auth.validator.OidcDiscoveryValidator;

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

  private static final long OIDC_ISSUER_RESOLVE_THROTTLE_MS = 60_000L;

  private volatile AuthenticationConfiguration currentAuthConfig;
  private volatile AuthorizerConfiguration currentAuthzConfig;
  private volatile MCPConfiguration currentMcpConfig;
  private volatile String resolvedOidcIssuer;
  private volatile boolean oidcIssuerFromDiscovery;
  private final AtomicLong lastOidcIssuerResolveAttemptMillis = new AtomicLong(0L);
  private final List<ConfigurationChangeListener> listeners = new CopyOnWriteArrayList<>();

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

  private SecurityConfigurationManager() {}

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

    try {
      currentAuthConfig =
          SettingsCache.getSetting(AUTHENTICATION_CONFIGURATION, AuthenticationConfiguration.class);
      currentAuthzConfig =
          SettingsCache.getSetting(AUTHORIZER_CONFIGURATION, AuthorizerConfiguration.class);
      LOG.info(
          "Loaded security configuration from database - provider: {}",
          currentAuthConfig != null ? currentAuthConfig.getProvider() : "null");
    } catch (Exception e) {
      LOG.warn(
          "Failed to load configuration from database, falling back to YAML: {}", e.getMessage());
      currentAuthConfig = config.getAuthenticationConfiguration();
      currentAuthzConfig = config.getAuthorizerConfiguration();
      LOG.info(
          "Using security configuration from YAML - provider: {}",
          currentAuthConfig != null ? currentAuthConfig.getProvider() : "null");
    }

    // MCP config is optional — load separately so its absence doesn't affect auth config
    currentMcpConfig =
        SettingsCache.getSettingOrDefault(
            MCP_CONFIGURATION, config.getMcpConfiguration(), MCPConfiguration.class);

    resolveOidcIssuerForCurrentConfig();
  }

  public SecurityConfiguration getCurrentSecurityConfig() {
    // Apply LDAP default values before returning to prevent JSON PATCH errors
    // when updating fields that were previously null in the database
    if (currentAuthConfig != null && currentAuthConfig.getLdapConfiguration() != null) {
      Entity.getSystemRepository()
          .ensureLdapConfigDefaultValues(currentAuthConfig.getLdapConfiguration());
    }

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
      currentMcpConfig =
          SettingsCache.getSettingOrDefault(MCP_CONFIGURATION, null, MCPConfiguration.class);

      OpenMetadataApplicationConfig appConfig = this.config;
      appConfig.setAuthenticationConfiguration(currentAuthConfig);
      appConfig.setAuthorizerConfiguration(currentAuthzConfig);
      if (currentMcpConfig != null) {
        appConfig.setMcpConfiguration(currentMcpConfig);
      }

      application.reinitializeAuthSystem(appConfig, environment);

      resolveOidcIssuerForCurrentConfig();

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
      LOG.info("Rolled back to previous security configuration");
    }
  }

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

  public String getResolvedOidcIssuer() {
    return resolvedOidcIssuer;
  }

  public boolean isOidcIssuerFromDiscovery() {
    return oidcIssuerFromDiscovery;
  }

  /**
   * Re-attempts OIDC issuer resolution from the discovery document when the cached value is a
   * fallback (not from discovery) and the retry throttle has expired. Returns true if a fresh
   * attempt was made, false if the call was a no-op (already resolved from discovery, not
   * configured for OIDC, or throttled).
   */
  public boolean refreshResolvedOidcIssuerIfStale() {
    if (oidcIssuerFromDiscovery || !isOidc()) {
      return false;
    }
    long now = System.currentTimeMillis();
    long lastAttempt = lastOidcIssuerResolveAttemptMillis.get();
    if (now - lastAttempt < OIDC_ISSUER_RESOLVE_THROTTLE_MS) {
      return false;
    }
    if (!lastOidcIssuerResolveAttemptMillis.compareAndSet(lastAttempt, now)) {
      return false;
    }
    resolveOidcIssuerInternal();
    return true;
  }

  private void resolveOidcIssuerForCurrentConfig() {
    if (isOidc()) {
      resolveOidcIssuerInternal();
    } else {
      resolvedOidcIssuer = null;
      oidcIssuerFromDiscovery = false;
      lastOidcIssuerResolveAttemptMillis.set(0L);
    }
  }

  private void resolveOidcIssuerInternal() {
    AuthenticationConfiguration authConfig = currentAuthConfig;
    if (authConfig == null) {
      return;
    }
    OidcClientConfig oidcConfig = authConfig.getOidcConfiguration();
    String fromDiscovery = OidcDiscoveryValidator.resolveIssuer(authConfig, oidcConfig);
    if (fromDiscovery != null) {
      resolvedOidcIssuer = fromDiscovery;
      oidcIssuerFromDiscovery = true;
      LOG.info("Resolved OIDC issuer from discovery: {}", fromDiscovery);
      return;
    }
    String authority = authConfig.getAuthority();
    if (!nullOrEmpty(authority)) {
      resolvedOidcIssuer = authority;
      oidcIssuerFromDiscovery = false;
      LOG.warn(
          "OIDC issuer fallback to authority URL '{}': discovery unreachable or malformed",
          authority);
    } else {
      resolvedOidcIssuer = null;
      oidcIssuerFromDiscovery = false;
    }
  }

  @VisibleForTesting
  void resetOidcIssuerResolutionState() {
    resolvedOidcIssuer = null;
    oidcIssuerFromDiscovery = false;
    lastOidcIssuerResolveAttemptMillis.set(0L);
  }
}
