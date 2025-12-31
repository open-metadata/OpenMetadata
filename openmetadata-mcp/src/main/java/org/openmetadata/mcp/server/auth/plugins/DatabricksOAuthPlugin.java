package org.openmetadata.mcp.server.auth.plugins;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.services.connections.common.OAuthCredentials;
import org.openmetadata.schema.services.connections.database.DatabricksConnection;

/**
 * OAuth plugin for Databricks connector.
 *
 * <p>Provides OAuth 2.0 / OIDC (OpenID Connect) support for Databricks workspace connections.
 * Databricks uses OIDC for authentication, which is an identity layer on top of OAuth 2.0.
 *
 * <p><b>Databricks OAuth Characteristics:</b>
 *
 * <ul>
 *   <li><b>Protocol:</b> OIDC (OpenID Connect) over OAuth 2.0
 *   <li><b>Token Endpoint Pattern:</b> {@code https://{workspace-url}/oidc/v1/token}
 *   <li><b>Default Scopes:</b> all-apis, offline_access
 *   <li><b>Grant Type:</b> client_credentials or refresh_token
 *   <li><b>Token Refresh:</b> Supported via refresh_token grant
 *   <li><b>Workspace URL:</b> Required in token endpoint (e.g.,
 *       "adb-1234567890123456.7.azuredatabricks.net")
 * </ul>
 *
 * <p><b>Configuration Requirements:</b>
 *
 * <ul>
 *   <li>Databricks workspace URL must be configured in hostPort field
 *   <li>OAuth credentials (client_id, client_secret) must be set in authType as OAuth 2.0
 *   <li>Token endpoint is auto-built from hostPort, or can be explicitly configured
 * </ul>
 *
 * <p><b>Example Usage:</b>
 *
 * <pre>{@code
 * // Create Databricks connection with OAuth
 * DatabricksConnection connection = new DatabricksConnection();
 * connection.setHostPort("adb-1234567890123456.7.azuredatabricks.net");
 *
 * OAuthCredentials oauth = new OAuthCredentials();
 * oauth.setClientId("DATABRICKS_CLIENT_ID");
 * oauth.setClientSecret("DATABRICKS_CLIENT_SECRET");
 * connection.setAuthType(oauth);  // authType is oneOf (BasicAuth, OAuth 2.0)
 *
 * // Plugin automatically extracts credentials and builds token endpoint
 * DatabricksOAuthPlugin plugin = new DatabricksOAuthPlugin();
 * String tokenEndpoint = plugin.buildTokenEndpoint(connection, oauth);
 * // Returns: "https://adb-1234567890123456.7.azuredatabricks.net/oidc/v1/token"
 * }</pre>
 *
 * <p><b>Databricks OAuth Documentation:</b>
 * https://docs.databricks.com/dev-tools/auth/oauth-m2m.html
 *
 * <p><b>Special Note on authType:</b> Databricks uses a polymorphic authType field that can be
 * either BasicAuth or OAuth 2.0. This plugin extracts OAuth credentials when authType is an
 * instance of OAuthCredentials.
 *
 * @see OAuthConnectorPlugin
 * @see OAuthConnectorPluginRegistry
 * @see DatabricksConnection
 * @since 1.12.0
 */
@Slf4j
public class DatabricksOAuthPlugin implements OAuthConnectorPlugin {

  private static final String CONNECTOR_TYPE = "Databricks";
  private static final String TOKEN_ENDPOINT_PATH = "/oidc/v1/token";

  /**
   * Default OAuth scopes for Databricks.
   *
   * <ul>
   *   <li><b>all-apis</b> - Access to all Databricks REST APIs
   *   <li><b>offline_access</b> - Enables refresh token for token renewal without re-authentication
   * </ul>
   */
  private static final List<String> DEFAULT_SCOPES = Arrays.asList("all-apis", "offline_access");

  @Override
  public String getConnectorType() {
    return CONNECTOR_TYPE;
  }

  @Override
  public OAuthCredentials extractCredentials(Object config) {
    if (!(config instanceof DatabricksConnection)) {
      throw new ClassCastException(
          String.format(
              "Expected DatabricksConnection but got %s",
              config != null ? config.getClass().getName() : "null"));
    }

    DatabricksConnection databricks = (DatabricksConnection) config;
    Object authType = databricks.getAuthType();

    // Databricks authType is polymorphic: can be BasicAuth or OAuthCredentials
    if (authType instanceof OAuthCredentials) {
      OAuthCredentials oauth = (OAuthCredentials) authType;
      LOG.debug(
          "Extracted OAuth credentials for Databricks workspace: {}",
          databricks.getHostPort() != null ? databricks.getHostPort() : "unknown");
      return oauth;
    } else {
      LOG.debug(
          "Databricks authType is not OAuth 2.0 (type: {}). OAuth is not configured for workspace: {}",
          authType != null ? authType.getClass().getSimpleName() : "null",
          databricks.getHostPort() != null ? databricks.getHostPort() : "unknown");
      return null;
    }
  }

  @Override
  public void setCredentials(Object config, OAuthCredentials oauth) {
    if (!(config instanceof DatabricksConnection)) {
      throw new ClassCastException(
          String.format(
              "Expected DatabricksConnection but got %s",
              config != null ? config.getClass().getName() : "null"));
    }

    DatabricksConnection databricks = (DatabricksConnection) config;
    databricks.setAuthType(oauth);

    LOG.debug(
        "Updated OAuth credentials for Databricks workspace: {}",
        databricks.getHostPort() != null ? databricks.getHostPort() : "unknown");
  }

  @Override
  public String buildTokenEndpoint(Object config, OAuthCredentials oauth) {
    if (!(config instanceof DatabricksConnection)) {
      throw new ClassCastException(
          String.format(
              "Expected DatabricksConnection but got %s",
              config != null ? config.getClass().getName() : "null"));
    }

    // Check if explicitly configured in OAuth credentials
    if (oauth != null && oauth.getTokenEndpoint() != null) {
      String explicitEndpoint = oauth.getTokenEndpoint().toString();
      LOG.debug("Using explicit Databricks token endpoint: {}", explicitEndpoint);
      return explicitEndpoint;
    }

    // Build from workspace URL (hostPort)
    DatabricksConnection databricks = (DatabricksConnection) config;
    String hostPort = databricks.getHostPort();

    if (hostPort == null || hostPort.trim().isEmpty()) {
      throw new IllegalArgumentException(
          "Databricks hostPort (workspace URL) is required to build token endpoint. "
              + "Please configure the 'hostPort' field in DatabricksConnection. "
              + "Example: 'adb-1234567890123456.7.azuredatabricks.net'");
    }

    // Clean up hostPort (remove protocol if present)
    String cleanHostPort = hostPort.trim();
    cleanHostPort = cleanHostPort.replaceFirst("^https?://", "");

    // Remove trailing slash if present
    cleanHostPort = cleanHostPort.replaceFirst("/$", "");

    // Databricks OIDC token endpoint format: https://{workspace-url}/oidc/v1/token
    String tokenEndpoint = "https://" + cleanHostPort + TOKEN_ENDPOINT_PATH;

    LOG.debug("Built Databricks OIDC token endpoint from workspace URL: {}", tokenEndpoint);
    return tokenEndpoint;
  }

  @Override
  public List<String> getDefaultScopes() {
    return DEFAULT_SCOPES;
  }

  @Override
  public boolean isOAuthConfigured(Object config) {
    if (!(config instanceof DatabricksConnection)) {
      return false;
    }

    DatabricksConnection databricks = (DatabricksConnection) config;
    Object authType = databricks.getAuthType();

    // OAuth is configured if authType is an instance of OAuthCredentials
    if (!(authType instanceof OAuthCredentials)) {
      LOG.debug(
          "Databricks authType is not OAuth 2.0 (type: {})",
          authType != null ? authType.getClass().getSimpleName() : "null");
      return false;
    }

    OAuthCredentials oauth = (OAuthCredentials) authType;
    boolean configured =
        oauth.getClientId() != null
            && !oauth.getClientId().isEmpty()
            && oauth.getClientSecret() != null
            && !oauth.getClientSecret().isEmpty();

    LOG.debug(
        "Databricks OAuth configured: {} for workspace: {}",
        configured,
        databricks.getHostPort() != null ? databricks.getHostPort() : "unknown");

    return configured;
  }

  @Override
  public Map<String, String> getAdditionalOAuthParameters() {
    // Databricks OIDC doesn't require additional parameters beyond standard OAuth 2.0
    return Map.of();
  }

  @Override
  public String getGrantType() {
    // Databricks supports both client_credentials (for service accounts) and refresh_token
    return "client_credentials"; // Default grant type for initial token acquisition
  }

  @Override
  public void validateOAuthConfiguration(Object config, OAuthCredentials oauth) {
    // Call default validation first
    OAuthConnectorPlugin.super.validateOAuthConfiguration(config, oauth);

    if (!(config instanceof DatabricksConnection)) {
      throw new IllegalArgumentException(
          "Configuration must be DatabricksConnection for Databricks OAuth");
    }

    DatabricksConnection databricks = (DatabricksConnection) config;

    // Validate workspace URL (hostPort) is present
    String hostPort = databricks.getHostPort();
    if (hostPort == null || hostPort.trim().isEmpty()) {
      throw new IllegalArgumentException(
          "Databricks hostPort (workspace URL) is required for OAuth. "
              + "Please configure the 'hostPort' field in DatabricksConnection. "
              + "Example: 'adb-1234567890123456.7.azuredatabricks.net'");
    }

    // Validate workspace URL format (basic check)
    // Databricks workspace URLs typically follow these patterns:
    // - Azure: adb-{workspace-id}.{region-id}.azuredatabricks.net
    // - AWS: dbc-{workspace-id}.cloud.databricks.com
    // - GCP: {workspace-id}.gcp.databricks.com
    String cleanHostPort = hostPort.trim().replaceFirst("^https?://", "");

    if (cleanHostPort.contains(" ")) {
      throw new IllegalArgumentException(
          "Invalid Databricks workspace URL format. "
              + "Workspace URL cannot contain spaces. "
              + "Provided: '"
              + hostPort
              + "'");
    }

    // Check if it looks like a valid Databricks URL
    boolean isValidFormat =
        cleanHostPort.contains("azuredatabricks.net")
            || cleanHostPort.contains("cloud.databricks.com")
            || cleanHostPort.contains("gcp.databricks.com");

    if (!isValidFormat) {
      LOG.warn(
          "Databricks workspace URL '{}' does not match known patterns. "
              + "Expected patterns: *.azuredatabricks.net, *.cloud.databricks.com, or *.gcp.databricks.com. "
              + "OAuth may fail if this is not a valid Databricks workspace URL.",
          cleanHostPort);
    }

    LOG.info("Databricks OAuth configuration validation passed for workspace: {}", cleanHostPort);
  }

  @Override
  public String toString() {
    return String.format(
        "DatabricksOAuthPlugin{connectorType='%s', defaultScopes=%s, protocol='OIDC'}",
        CONNECTOR_TYPE, DEFAULT_SCOPES);
  }
}
