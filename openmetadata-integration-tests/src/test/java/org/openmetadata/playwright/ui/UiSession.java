package org.openmetadata.playwright.ui;

import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import org.openmetadata.it.server.ServerHandle;

/**
 * Per-test handle around a fresh {@link BrowserContext} pre-authenticated for the OM UI.
 *
 * <p>Created and closed by {@link UiSessionExtension}; tests receive one as a {@code @Test}
 * parameter and use it to open pages without any UI login flow:
 *
 * <pre>{@code
 *   @Test
 *   void scenario(UiSession ui, TestNamespace ns) {
 *     Page page = ui.newPage();
 *     page.navigate(ui.uiUrl("/explore/tables"));
 *     ...
 *   }
 * }</pre>
 */
public final class UiSession {

  // Playwright's stock default is 30s. Against a shared/external cluster, search-backed renders
  // (assignee popovers, page-size menus, filtered lists) can lag behind that under contention,
  // surfacing as spurious 30s locator timeouts. Give every auto-wait more headroom; web-first
  // assertions still return the instant the element is ready, so this only raises the ceiling.
  private static final double DEFAULT_TIMEOUT_MS = 60_000;

  private final BrowserContext context;
  private final ServerHandle server;

  UiSession(final BrowserContext context, final ServerHandle server) {
    this.context = context;
    this.server = server;
    context.setDefaultTimeout(DEFAULT_TIMEOUT_MS);
  }

  public Page newPage() {
    return context.newPage();
  }

  public BrowserContext context() {
    return context;
  }

  public ServerHandle server() {
    return server;
  }

  /**
   * Resolves a UI path against the server's UI root. {@link ServerHandle#baseUrl()} ends in
   * {@code /api} (the REST base), so we strip that to land on the UI root before appending
   * the path — relying on {@link java.net.URI#resolve} here is fragile (a relative path or a
   * trailing-slash base would resolve under {@code /api/...} and 404).
   */
  public String uiUrl(final String path) {
    String base = server.baseUrl().toString();
    if (base.endsWith("/")) {
      base = base.substring(0, base.length() - 1);
    }
    if (base.endsWith("/api")) {
      base = base.substring(0, base.length() - "/api".length());
    }
    return base + (path.startsWith("/") ? path : "/" + path);
  }
}
