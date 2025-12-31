package org.openmetadata.mcp.server.auth.plugins;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.services.connections.common.OAuthCredentials;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;

/**
 * OAuth plugin for Snowflake connector.
 *
 * <p>Provides OAuth 2.0 support for Snowflake data warehouse connections. Snowflake uses a custom
 * OAuth implementation with account-specific token endpoints.
 *
 * <p><b>Snowflake OAuth Characteristics:</b>
 *
 * <ul>
 *   <li><b>Token Endpoint Pattern:</b> {@code
 *       https://{account}.snowflakecomputing.com/oauth/token-request}
 *   <li><b>Default Scopes:</b> session:role:any, refresh_token
 *   <li><b>Grant Type:</b> client_credentials or refresh_token
 *   <li><b>Token Refresh:</b> Supported via refresh_token grant
 *   <li><b>Account Identifier:</b> Required in token endpoint URL (e.g., "xy12345.us-east-1")
 * </ul>
 *
 * <p><b>Configuration Requirements:</b>
 *
 * <ul>
 *   <li>Snowflake account identifier must be configured in SnowflakeConnection
 *   <li>OAuth credentials (client_id, client_secret) must be set in connection.oauth
 *   <li>Token endpoint is auto-built from account identifier, or can be explicitly configured
 * </ul>
 *
 * <p><b>Example Usage:</b>
 *
 * <pre>{@code
 * // Create Snowflake connection with OAuth
 * SnowflakeConnection connection = new SnowflakeConnection();
 * connection.setAccount("xy12345.us-east-1");
 *
 * OAuthCredentials oauth = new OAuthCredentials();
 * oauth.setClientId("SNOWFLAKE_CLIENT_ID");
 * oauth.setClientSecret("SNOWFLAKE_CLIENT_SECRET");
 * connection.setOauth(oauth);
 *
 * // Plugin automatically extracts credentials and builds token endpoint
 * SnowflakeOAuthPlugin plugin = new SnowflakeOAuthPlugin();
 * String tokenEndpoint = plugin.buildTokenEndpoint(connection, oauth);
 * // Returns: "https://xy12345.us-east-1.snowflakecomputing.com/oauth/token-request"
 * }</pre>
 *
 * <p><b>Snowflake OAuth Documentation:</b>
 * https://docs.snowflake.com/en/user-guide/oauth-intro
 *
 * @see OAuthConnectorPlugin
 * @see OAuthConnectorPluginRegistry
 * @see SnowflakeConnection
 * @since 1.12.0
 */
@Slf4j
public class SnowflakeOAuthPlugin implements OAuthConnectorPlugin {

  private static final String CONNECTOR_TYPE = "Snowflake";
  private static final String TOKEN_ENDPOINT_SUFFIX = ".snowflakecomputing.com/oauth/token-request";

  /**
   * Default OAuth scopes for Snowflake.
   *
   * <ul>
   *   <li><b>session:role:any</b> - Allows assuming any role the user has access to
   *   <li><b>refresh_token</b> - Enables token refresh without re-authentication
   * </ul>
   */
  private static final List<String> DEFAULT_SCOPES =
      Arrays.asList("session:role:any", "refresh_token");

  @Override
  public String getConnectorType() {
    return CONNECTOR_TYPE;
  }

  @Override
  public OAuthCredentials extractCredentials(Object config) {
    if (!(config instanceof SnowflakeConnection)) {
      throw new ClassCastException(
          String.format(
              "Expected SnowflakeConnection but got %s",
              config != null ? config.getClass().getName() : "null"));
    }

    SnowflakeConnection snowflake = (SnowflakeConnection) config;
    OAuthCredentials oauth = snowflake.getOauth();

    if (oauth != null) {
      LOG.debug(
          "Extracted OAuth credentials for Snowflake account: {}",
          snowflake.getAccount() != null ? snowflake.getAccount() : "unknown");
    } else {
      LOG.debug(
          "No OAuth credentials configured for Snowflake account: {}",
          snowflake.getAccount() != null ? snowflake.getAccount() : "unknown");
    }

    return oauth;
  }

  @Override
  public void setCredentials(Object config, OAuthCredentials oauth) {
    if (!(config instanceof SnowflakeConnection)) {
      throw new ClassCastException(
          String.format(
              "Expected SnowflakeConnection but got %s",
              config != null ? config.getClass().getName() : "null"));
    }

    SnowflakeConnection snowflake = (SnowflakeConnection) config;
    snowflake.setOauth(oauth);

    LOG.debug(
        "Updated OAuth credentials for Snowflake account: {}",
        snowflake.getAccount() != null ? snowflake.getAccount() : "unknown");
  }

  @Override
  public String buildTokenEndpoint(Object config, OAuthCredentials oauth) {
    if (!(config instanceof SnowflakeConnection)) {
      throw new ClassCastException(
          String.format(
              "Expected SnowflakeConnection but got %s",
              config != null ? config.getClass().getName() : "null"));
    }

    // Check if explicitly configured in OAuth credentials
    if (oauth != null && oauth.getTokenEndpoint() != null) {
      String explicitEndpoint = oauth.getTokenEndpoint().toString();
      LOG.debug("Using explicit Snowflake token endpoint: {}", explicitEndpoint);
      return explicitEndpoint;
    }

    // Build from account identifier
    SnowflakeConnection snowflake = (SnowflakeConnection) config;
    String account = snowflake.getAccount();

    if (account == null || account.trim().isEmpty()) {
      throw new IllegalArgumentException(
          "Snowflake account identifier is required to build token endpoint. "
              + "Please configure the 'account' field in SnowflakeConnection.");
    }

    // Remove any leading/trailing whitespace
    account = account.trim();

    // Snowflake token endpoint format: https://{account}.snowflakecomputing.com/oauth/token-request
    String tokenEndpoint = "https://" + account + TOKEN_ENDPOINT_SUFFIX;

    LOG.debug("Built Snowflake token endpoint from account identifier: {}", tokenEndpoint);
    return tokenEndpoint;
  }

  @Override
  public List<String> getDefaultScopes() {
    return DEFAULT_SCOPES;
  }

  @Override
  public boolean isOAuthConfigured(Object config) {
    if (!(config instanceof SnowflakeConnection)) {
      return false;
    }

    SnowflakeConnection snowflake = (SnowflakeConnection) config;
    OAuthCredentials oauth = snowflake.getOauth();

    boolean configured =
        oauth != null
            && oauth.getClientId() != null
            && !oauth.getClientId().isEmpty()
            && oauth.getClientSecret() != null
            && !oauth.getClientSecret().isEmpty();

    LOG.debug(
        "Snowflake OAuth configured: {} for account: {}",
        configured,
        snowflake.getAccount() != null ? snowflake.getAccount() : "unknown");

    return configured;
  }

  @Override
  public Map<String, String> getAdditionalOAuthParameters() {
    // Snowflake-specific OAuth parameters
    return Map.of(
        "resource", "snowflake" // Snowflake requires this parameter in token requests
        );
  }

  @Override
  public String getGrantType() {
    // Snowflake supports both client_credentials and refresh_token
    return "client_credentials"; // Default grant type for initial token acquisition
  }

  @Override
  public void validateOAuthConfiguration(Object config, OAuthCredentials oauth) {
    // Call default validation first
    OAuthConnectorPlugin.super.validateOAuthConfiguration(config, oauth);

    if (!(config instanceof SnowflakeConnection)) {
      throw new IllegalArgumentException(
          "Configuration must be SnowflakeConnection for Snowflake OAuth");
    }

    SnowflakeConnection snowflake = (SnowflakeConnection) config;

    // Validate account identifier is present
    String account = snowflake.getAccount();
    if (account == null || account.trim().isEmpty()) {
      throw new IllegalArgumentException(
          "Snowflake account identifier is required for OAuth. "
              + "Please configure the 'account' field in SnowflakeConnection. "
              + "Example: 'xy12345.us-east-1' or 'myorg-myaccount'");
    }

    // Validate account identifier format (basic check)
    // Snowflake accounts can be:
    // - Legacy format: xy12345.us-east-1
    // - New format: myorg-myaccount
    // - With region: myorg-myaccount.us-east-1
    if (account.contains(" ")) {
      throw new IllegalArgumentException(
          "Invalid Snowflake account identifier format. "
              + "Account identifier cannot contain spaces. "
              + "Provided: '"
              + account
              + "'");
    }

    LOG.info("Snowflake OAuth configuration validation passed for account: {}", account);
  }

  @Override
  public String toString() {
    return String.format(
        "SnowflakeOAuthPlugin{connectorType='%s', defaultScopes=%s}",
        CONNECTOR_TYPE, DEFAULT_SCOPES);
  }
}
