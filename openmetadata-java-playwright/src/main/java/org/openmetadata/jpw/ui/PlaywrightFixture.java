package org.openmetadata.jpw.ui;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.Tracing;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.openmetadata.jpw.server.ServerHandle;

/**
 * Lifecycle wrapper around a Playwright browser session for UI scenarios.
 *
 * <p>UI scenarios are gated on external mode (the embedded test stack does not serve the
 * UI bundle). Set {@code JPW_MODE=external} and ensure {@code playwright install chromium}
 * has been run before invoking.
 *
 * <p>Typical usage:
 * <pre>{@code
 *   try (PlaywrightFixture pw = PlaywrightFixture.launch(server)) {
 *     final Page page = pw.newPage();
 *     page.navigate(server.baseUrl().toString());
 *     // ... assertions ...
 *   }
 * }</pre>
 */
public final class PlaywrightFixture implements AutoCloseable {

  private static final Path TRACE_DIR = Paths.get("target", "playwright-traces");

  private final Playwright playwright;
  private final Browser browser;
  private final BrowserContext context;
  private final ServerHandle server;

  private PlaywrightFixture(
      final Playwright playwright,
      final Browser browser,
      final BrowserContext context,
      final ServerHandle server) {
    this.playwright = playwright;
    this.browser = browser;
    this.context = context;
    this.server = server;
  }

  public static PlaywrightFixture launch(final ServerHandle server) {
    final Playwright pw = Playwright.create();
    final BrowserType.LaunchOptions options = new BrowserType.LaunchOptions().setHeadless(!isHeaded());
    if (isHeaded()) {
      options.setSlowMo(250);
    }
    final Browser browser = pw.chromium().launch(options);
    final BrowserContext context = browser.newContext();
    context
        .tracing()
        .start(new Tracing.StartOptions().setScreenshots(true).setSnapshots(true).setSources(true));
    return new PlaywrightFixture(pw, browser, context, server);
  }

  public Page newPage() {
    return context.newPage();
  }

  public ServerHandle server() {
    return server;
  }

  private static boolean isHeaded() {
    final String prop = System.getProperty("PW_HEADED");
    if (prop != null && !prop.isBlank()) {
      return Boolean.parseBoolean(prop);
    }
    final String env = System.getenv("PW_HEADED");
    return env != null && Boolean.parseBoolean(env);
  }

  @Override
  public void close() {
    final Path tracePath = TRACE_DIR.resolve("trace-" + System.currentTimeMillis() + ".zip");
    tracePath.getParent().toFile().mkdirs();
    context.tracing().stop(new Tracing.StopOptions().setPath(tracePath));
    context.close();
    browser.close();
    playwright.close();
  }
}
