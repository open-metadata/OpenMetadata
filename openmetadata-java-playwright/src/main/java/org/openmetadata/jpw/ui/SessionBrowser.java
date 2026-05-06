package org.openmetadata.jpw.ui;

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
    final BrowserType.LaunchOptions options = new BrowserType.LaunchOptions().setHeadless(!isHeaded());
    if (isHeaded()) {
      options.setSlowMo(250);
    }
    browser = playwright.chromium().launch(options);
    Runtime.getRuntime().addShutdownHook(new Thread(SessionBrowser::tearDown, "SessionBrowser-cleanup"));
    LOG.info("SessionBrowser launched: chromium headed={}", isHeaded());
    return browser;
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
