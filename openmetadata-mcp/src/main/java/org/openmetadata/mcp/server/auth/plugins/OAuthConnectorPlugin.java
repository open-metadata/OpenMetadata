package org.openmetadata.mcp.server.auth.plugins;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.services.connections.common.OAuthCredentials;

/**
 * Plugin interface for OAuth 2.0 connector support.
 *
 * <p>This interface enables extensible OAuth support for 100+ OpenMetadata connectors without
 * hardcoding connector-specific logic. Each connector type implements this interface to provide
 * OAuth credential extraction, token endpoint building, and scope management.
 *
 * <p><b>Design Goals:</b>
 *
 * <ul>
 *   <li>Universal OAuth support for all OpenMetadata connectors
 *   <li>Eliminate hardcoded if/else statements for each connector
 *   <li>Enable community contributions for new connector OAuth support
 *   <li>Consistent OAuth behavior across all connectors
 * </ul>
 *
 * <p><b>Implementation Pattern:</b>
 *
 * <pre>{@code
 * public class SnowflakeOAuthPlugin implements OAuthConnectorPlugin {
 *     @Override
 *     public String getConnectorType() {
 *         return "Snowflake";
 *     }
 *
 *     @Override
 *     public OAuthCredentials extractCredentials(Object config) {
 *         SnowflakeConnection snowflake = (SnowflakeConnection) config;
 *         return snowflake.getOauth();
 *     }
 *
 *     @Override
 *     public String buildTokenEndpoint(Object config, OAuthCredentials oauth) {
 *         SnowflakeConnection snowflake = (SnowflakeConnection) config;
 *         String account = snowflake.getAccount();
 *         return String.format("https://%s.snowflakecomputing.com/oauth/token-request", account);
 *     }
 * }
 * }</pre>
 *
 * <p><b>Plugin Registration:</b>
 *
 * <pre>{@code
 * OAuthConnectorPluginRegistry.registerPlugin(new SnowflakeOAuthPlugin());
 * OAuthConnectorPluginRegistry.registerPlugin(new DatabricksOAuthPlugin());
 * OAuthConnectorPluginRegistry.registerPlugin(new BigQueryOAuthPlugin());
 * }</pre>
 *
 * @see OAuthConnectorPluginRegistry
 * @see org.openmetadata.mcp.server.auth.provider.ConnectorOAuthProvider
 * @since 1.12.0
 */
public interface OAuthConnectorPlugin {

  /**
   * Returns the connector type identifier.
   *
   * <p>This must match the connector type in OpenMetadata's service definitions. Examples:
   * "Snowflake", "Databricks", "BigQuery", "Redshift", "AzureSynapse"
   *
   * @return connector type name (case-sensitive)
   */
  String getConnectorType();

  /**
   * Extracts OAuth credentials from the connector configuration.
   *
   * <p>Each connector stores OAuth credentials differently in its configuration schema. This method
   * knows how to find and extract the {@link OAuthCredentials} object from the connector-specific
   * configuration.
   *
   * <p><b>Examples:</b>
   *
   * <ul>
   *   <li>Snowflake: {@code ((SnowflakeConnection) config).getOauth()}
   *   <li>Databricks: {@code ((DatabricksConnection) config).getAuthType()} (if instanceof
   *       OAuthCredentials)
   *   <li>BigQuery: {@code ((BigQueryConnection) config).getCredentials().getGcpConfig()} (custom
   *       OAuth)
   * </ul>
   *
   * @param config connector-specific configuration object (e.g., SnowflakeConnection,
   *     DatabricksConnection)
   * @return OAuth credentials if configured, null if OAuth is not configured
   * @throws ClassCastException if config is not the expected connector type
   */
  OAuthCredentials extractCredentials(Object config);

  /**
   * Sets OAuth credentials in the connector configuration.
   *
   * <p>Updates the connector configuration with OAuth credentials. Used when storing refreshed
   * tokens back to the configuration.
   *
   * @param config connector-specific configuration object
   * @param oauth OAuth credentials to set
   * @throws ClassCastException if config is not the expected connector type
   */
  void setCredentials(Object config, OAuthCredentials oauth);

  /**
   * Builds the OAuth token endpoint URL for this connector.
   *
   * <p>Different connectors have different patterns for token endpoints:
   *
   * <ul>
   *   <li><b>Account-based:</b> Snowflake uses account identifier in URL
   *   <li><b>Host-based:</b> Databricks uses workspace URL
   *   <li><b>Static:</b> Some cloud services have fixed token endpoints
   *   <li><b>Custom:</b> Some connectors allow custom token endpoint configuration
   * </ul>
   *
   * <p><b>Examples:</b>
   *
   * <pre>
   * Snowflake: https://{account}.snowflakecomputing.com/oauth/token-request
   * Databricks: https://{workspace}.cloud.databricks.com/oidc/v1/token
   * BigQuery: https://oauth2.googleapis.com/token (static)
   * Redshift: Custom endpoint via AWS IAM
   * </pre>
   *
   * @param config connector-specific configuration object
   * @param oauth OAuth credentials (may contain custom tokenEndpoint)
   * @return fully-qualified token endpoint URL
   * @throws IllegalArgumentException if required configuration is missing
   */
  String buildTokenEndpoint(Object config, OAuthCredentials oauth);

  /**
   * Returns default OAuth scopes for this connector.
   *
   * <p>Different connectors require different scopes for data access. This method provides sensible
   * defaults that can be overridden by user configuration.
   *
   * <p><b>Examples:</b>
   *
   * <pre>
   * Snowflake: ["session:role:any", "refresh_token"]
   * Databricks: ["all-apis", "offline_access"]
   * BigQuery: ["https://www.googleapis.com/auth/bigquery.readonly"]
   * Redshift: ["redshift:GetClusterCredentials"]
   * </pre>
   *
   * @return list of default OAuth scope strings
   */
  List<String> getDefaultScopes();

  /**
   * Checks if OAuth is configured for this connector.
   *
   * <p>Validates that the configuration contains valid OAuth credentials with required fields
   * (client_id, client_secret, etc.).
   *
   * @param config connector-specific configuration object
   * @return true if OAuth is properly configured, false otherwise
   */
  boolean isOAuthConfigured(Object config);

  /**
   * Returns additional OAuth parameters specific to this connector.
   *
   * <p>Some connectors require extra parameters in token requests or authorization URLs. This method
   * provides connector-specific customization.
   *
   * <p><b>Examples:</b>
   *
   * <ul>
   *   <li>Snowflake: {"resource": "snowflake", "grant_type": "refresh_token"}
   *   <li>Azure: {"resource": "https://database.windows.net/"}
   *   <li>Google: {"access_type": "offline"}
   * </ul>
   *
   * @return map of additional OAuth parameters (empty by default)
   */
  default Map<String, String> getAdditionalOAuthParameters() {
    return Map.of();
  }

  /**
   * Returns the OAuth grant type used by this connector.
   *
   * <p>Most connectors use "client_credentials" for server-to-server OAuth. Some may use
   * "authorization_code" with PKCE or "refresh_token" for token renewal.
   *
   * @return OAuth 2.0 grant type (default: "client_credentials")
   */
  default String getGrantType() {
    return "client_credentials";
  }

  /**
   * Validates connector-specific OAuth configuration.
   *
   * <p>Performs connector-specific validation beyond basic OAuth credential checks. For example:
   *
   * <ul>
   *   <li>Snowflake: Validate account identifier format
   *   <li>Databricks: Validate workspace URL format
   *   <li>BigQuery: Validate project ID is present
   * </ul>
   *
   * @param config connector-specific configuration object
   * @param oauth OAuth credentials to validate
   * @throws IllegalArgumentException if validation fails with detailed error message
   */
  default void validateOAuthConfiguration(Object config, OAuthCredentials oauth) {
    // Default implementation: no additional validation
    if (oauth == null) {
      throw new IllegalArgumentException("OAuth credentials cannot be null");
    }
    if (oauth.getClientId() == null || oauth.getClientId().isEmpty()) {
      throw new IllegalArgumentException("OAuth client_id is required");
    }
    if (oauth.getClientSecret() == null || oauth.getClientSecret().isEmpty()) {
      throw new IllegalArgumentException("OAuth client_secret is required");
    }
  }
}
