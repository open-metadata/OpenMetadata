package org.openmetadata.it.sso.state;

import com.google.common.base.Supplier;
import com.google.common.base.Suppliers;
import java.util.Optional;
import org.openmetadata.service.security.session.SessionStore;
import org.openmetadata.service.security.session.SessionStoreFactory;
import org.openmetadata.service.security.session.UserSession;

/**
 * Reads login sessions from the store the server itself uses: the {@code user_session} table, or
 * Redis on the cache-backed profiles.
 */
public final class StoredSessions {
  private static final Supplier<SessionStore> STORE =
      Suppliers.memoize(SessionStoreFactory::create);

  private StoredSessions() {}

  public static Optional<UserSession> find(String sessionId) {
    return store().findById(sessionId);
  }

  public static UserSession require(String sessionId) {
    return find(sessionId)
        .orElseThrow(() -> new AssertionError("No stored session with id " + sessionId));
  }

  static SessionStore store() {
    return STORE.get();
  }
}
