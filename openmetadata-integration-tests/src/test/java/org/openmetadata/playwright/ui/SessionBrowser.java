package org.openmetadata.playwright.ui;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Playwright;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * One Chromium per JVM, lazily launched on first use, torn down via shutdown hook.
 *
 * <p>Tests get isolation through {@link UiSession} (one fresh {@code BrowserContext} per
 * {@code @Test}); they never close the {@link Browser} themselves. This shaves ~2s of
 * startup off every test and keeps Playwright happy under failsafe forks.
 *
 * <p>Headed mode honors {@code PW_HEADED=true} (env or system property) and adds a 250ms
 * {@code slowMo} for debugging.
 */
public final class SessionBrowser {

  private static final Logger LOG = LoggerFactory.getLogger(SessionBrowser.class);

  private static volatile Playwright playwright;
  private static volatile Browser browser;

  private SessionBrowser() {}

  public static synchronized Browser get() {
    if (browser != null) {
      return browser;
    }
    playwright = Playwright.create();
    final BrowserType.LaunchOptions options =
        new BrowserType.LaunchOptions().setHeadless(!isHeaded());
    final int slowMoMs = resolveSlowMo();
    if (slowMoMs > 0) {
      options.setSlowMo(slowMoMs);
    }
    browser = playwright.chromium().launch(options);
    Runtime.getRuntime()
        .addShutdownHook(new Thread(SessionBrowser::tearDown, "SessionBrowser-cleanup"));
    LOG.info("SessionBrowser launched: chromium headed={} slowMo={}ms", isHeaded(), slowMoMs);
    return browser;
  }

  /**
   * Resolves the inter-action delay applied to every Playwright operation. {@code PW_SLOWMO}
   * (env or system property) wins; otherwise headed mode defaults to 250ms and headless to 0.
   */
  private static int resolveSlowMo() {
    final String raw = lookup("PW_SLOWMO");
    if (raw != null) {
      try {
        return Math.max(0, Integer.parseInt(raw.trim()));
      } catch (NumberFormatException e) {
        LOG.warn("Ignoring non-numeric PW_SLOWMO={}", raw);
      }
    }
    return isHeaded() ? 250 : 0;
  }

  private static String lookup(final String name) {
    final String prop = System.getProperty(name);
    if (prop != null && !prop.isBlank()) {
      return prop;
    }
    final String env = System.getenv(name);
    return (env != null && !env.isBlank()) ? env : null;
  }

  private static synchronized void tearDown() {
    if (browser != null) {
      try {
        browser.close();
      } catch (RuntimeException e) {
        LOG.warn("SessionBrowser browser close failed: {}", e.getMessage());
      }
      browser = null;
    }
    if (playwright != null) {
      try {
        playwright.close();
      } catch (RuntimeException e) {
        LOG.warn("SessionBrowser playwright close failed: {}", e.getMessage());
      }
      playwright = null;
    }
  }

  private static boolean isHeaded() {
    final String prop = System.getProperty("PW_HEADED");
    if (prop != null && !prop.isBlank()) {
      return Boolean.parseBoolean(prop);
    }
    final String env = System.getenv("PW_HEADED");
    return Boolean.parseBoolean(env);
  }
}
