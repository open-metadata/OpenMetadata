package org.openmetadata.mcp;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.mcp.McpAppConstants;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

/**
 * Answers 404 on every /mcp route while MCP is off, so switching it off needs no restart
 * (ADR:2026-11-12-mcp-turns-off-at-request-time). {@link OAuthWellKnownFilter} applies the same
 * check to the discovery paths it serves.
 */
public class McpAvailabilityFilter implements Filter {

  @Override
  public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
      throws IOException, ServletException {
    if (isMcpAvailable()) {
      chain.doFilter(request, response);
    } else {
      refuse((HttpServletResponse) response);
    }
  }

  /** setStatus, not sendError: the server maps a 404 error to the UI page, which would answer. */
  static void refuse(HttpServletResponse response) {
    response.setStatus(HttpServletResponse.SC_NOT_FOUND);
  }

  static boolean isMcpAvailable() {
    return isEnabledInSettings() && isAppActive();
  }

  /**
   * In memory, reloaded when the setting is saved and on other servers by the settings watcher.
   * SettingsCache would run a query on every request on an install that never saved the setting,
   * because it does not cache a missing value. No setting means the schema default, enabled.
   */
  private static boolean isEnabledInSettings() {
    MCPConfiguration config = SecurityConfigurationManager.getCurrentMcpConfig();
    return config == null || Boolean.TRUE.equals(config.getEnabled());
  }

  /**
   * Through the entity cache. Disabling the app soft-deletes it; uninstalling removes it until a
   * restart re-seeds it.
   */
  private static boolean isAppActive() {
    App app =
        Entity.findEntityByNameOrNull(
            Entity.APPLICATION, McpAppConstants.MCP_APP_NAME, Include.ALL);
    return app != null && !Boolean.TRUE.equals(app.getDeleted());
  }
}
