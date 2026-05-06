package org.openmetadata.jpw.ui.auth;

import com.microsoft.playwright.BrowserContext;

/**
 * Strategy for authenticating a Playwright {@link BrowserContext} before the test runs.
 *
 * <p>An implementation seeds whatever browser-side state the OM UI reads on first paint —
 * typically a JWT in {@code localStorage.app_state} — so the page renders directly into the
 * authenticated app instead of the login screen.
 *
 * <p>Implementations are stateless and thread-safe; one instance can authenticate many
 * contexts.
 */
public interface AuthStrategy {

  void inject(BrowserContext context);
}
