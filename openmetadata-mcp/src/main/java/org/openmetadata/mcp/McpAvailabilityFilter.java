package org.openmetadata.mcp;

import static org.openmetadata.schema.settings.SettingsType.MCP_CONFIGURATION;

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
import org.openmetadata.service.resources.settings.SettingsCache;

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

  /** Both reads are cached, so a change reaches other pods once their cache entry expires. */
  static boolean isMcpAvailable() {
    return isEnabledInSettings() && isAppActive();
  }

  private static boolean isEnabledInSettings() {
    MCPConfiguration config =
        SettingsCache.getSettingOrDefault(
            MCP_CONFIGURATION, new MCPConfiguration(), MCPConfiguration.class);
    return config != null && Boolean.TRUE.equals(config.getEnabled());
  }

  /** Disabling the app soft-deletes it; uninstalling removes it until a restart re-seeds it. */
  private static boolean isAppActive() {
    App app =
        Entity.findEntityByNameOrNull(
            Entity.APPLICATION, McpAppConstants.MCP_APP_NAME, Include.ALL);
    return app != null && !Boolean.TRUE.equals(app.getDeleted());
  }
}
