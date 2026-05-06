package org.openmetadata.jpw.ui.auth;

import com.microsoft.playwright.BrowserContext;
import java.util.Locale;
import org.openmetadata.it.auth.JwtAuthProvider;

/**
 * Authenticates a {@link BrowserContext} as the built-in {@code admin} user.
 *
 * <p>Mints a fresh admin JWT via {@link JwtAuthProvider} and seeds it into both
 * {@code localStorage.app_state} and the {@code AppDataStore} IndexedDB so the OM UI's
 * service-worker token storage finds it on first read.
 */
public final class AdminJwtAuth implements AuthStrategy {

  private static final String ADMIN_PRINCIPAL = "admin@open-metadata.org";
  private static final String[] ADMIN_ROLES = {"admin"};
  private static final long TOKEN_TTL_SECONDS = 24L * 60 * 60;
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

  @Override
  public void inject(final BrowserContext context) {
    final String jwt = mintAdminToken();
    context.addInitScript(buildInitScript(jwt));
  }

  private static String mintAdminToken() {
    return JwtAuthProvider.tokenFor(ADMIN_PRINCIPAL, ADMIN_PRINCIPAL, ADMIN_ROLES, TOKEN_TTL_SECONDS);
  }

  private static String buildInitScript(final String jwt) {
    final String escaped = jwt.replace("\\", "\\\\").replace("\"", "\\\"");
    return String.format(Locale.ROOT, INIT_SCRIPT_TEMPLATE, escaped);
  }
}
