package org.openmetadata.it.auth;

import com.microsoft.playwright.BrowserContext;
import java.util.Locale;

/**
 * Builds and applies the JS init-script that seeds the OM UI's
 * {@code localStorage.app_state} (and the equivalent IndexedDB store) with a token
 * before any application code runs. This skips the UI login flow regardless of which
 * {@link AuthBackend} produced the token — Playwright runs this script at every page
 * navigation, so each request goes straight into the authenticated app.
 */
final class AppStateInjection {

  private static final String INIT_SCRIPT_TEMPLATE =
      """
      (function() {
        const APP_STATE_KEY = 'app_state';
        const stateJson = JSON.stringify({ primary: "%s" });
        try { localStorage.setItem(APP_STATE_KEY, stateJson); } catch (e) {}
        try {
          const open = indexedDB.open('AppDataStore', 1);
          open.onupgradeneeded = () => {
            const db = open.result;
            if (!db.objectStoreNames.contains('keyValueStore')) {
              db.createObjectStore('keyValueStore');
            }
          };
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction(['keyValueStore'], 'readwrite');
            tx.objectStore('keyValueStore').put(stateJson, APP_STATE_KEY);
          };
        } catch (e) {}
      })();
      """;

  private AppStateInjection() {}

  static void seed(final BrowserContext context, final String tokenForLocalStorage) {
    final String escaped = tokenForLocalStorage.replace("\\", "\\\\").replace("\"", "\\\"");
    context.addInitScript(String.format(Locale.ROOT, INIT_SCRIPT_TEMPLATE, escaped));
  }
}
