package org.openmetadata.mcp;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
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

  private static final long APP_STATE_REFRESH_SECONDS = 2;
  private static final ScheduledExecutorService APP_STATE_REFRESHER =
      Executors.newSingleThreadScheduledExecutor(
          Thread.ofPlatform().daemon().name("mcp-availability").factory());

  /**
   * The app's state is served from memory and re-read in the background, so a request never waits
   * on the database: during an outage MCP keeps the last state it read, and its auth answers 503
   * instead of the request hanging on this read. A failed re-read keeps the previous state.
   */
  private static final LoadingCache<String, Boolean> APP_ACTIVE =
      CacheBuilder.newBuilder()
          .maximumSize(1)
          .build(
              CacheLoader.asyncReloading(
                  CacheLoader.from(McpAvailabilityFilter::readAppActive), APP_STATE_REFRESHER));

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
  public static void refuse(HttpServletResponse response) {
    response.setStatus(HttpServletResponse.SC_NOT_FOUND);
  }

  public static boolean isMcpAvailable() {
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

  /** Starts re-reading the app's state in the background, beginning while the database is up. */
  public static void startAppStateRefresh() {
    APP_STATE_REFRESHER.scheduleWithFixedDelay(
        () -> APP_ACTIVE.refresh(McpAppConstants.MCP_APP_NAME),
        0,
        APP_STATE_REFRESH_SECONDS,
        TimeUnit.SECONDS);
  }

  private static boolean isAppActive() {
    return APP_ACTIVE.getUnchecked(McpAppConstants.MCP_APP_NAME);
  }

  /**
   * Through the entity cache. Disabling the app soft-deletes it; uninstalling removes it until a
   * restart re-seeds it.
   */
  private static boolean readAppActive(String appName) {
    App app = Entity.findEntityByNameOrNull(Entity.APPLICATION, appName, Include.ALL);
    return app != null && !Boolean.TRUE.equals(app.getDeleted());
  }
}
