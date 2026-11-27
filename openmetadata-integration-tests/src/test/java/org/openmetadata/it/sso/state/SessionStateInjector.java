package org.openmetadata.it.sso.state;

import java.util.function.UnaryOperator;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.TokenDAO;
import org.openmetadata.service.security.AuthServeletHandlerRegistry;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.SessionStore;
import org.openmetadata.service.security.session.UserSession;

/**
 * Moves stored login state into the past instead of waiting for it: session lifetimes have a floor
 * of an hour and refresh tokens last for days. Edits go through the same store (database or Redis)
 * and optimistic version the server uses, and the server's session cache is refreshed so it sees
 * them at once.
 */
public final class SessionStateInjector {
  private static final long ONE_MINUTE_MILLIS = 60_000L;

  private SessionStateInjector() {}

  public static void expireAbsolutely(String sessionId) {
    update(sessionId, session -> session.expiresAt(oneMinuteAgo()));
  }

  public static void expireIdle(String sessionId) {
    update(sessionId, session -> session.idleExpiresAt(oneMinuteAgo()));
  }

  /** Leaves the session mid-refresh with a lease that ran out, as a crashed refresh would. */
  public static void leaveStaleRefreshLease(String sessionId) {
    update(
        sessionId,
        session -> session.status(SessionStatus.REFRESHING).refreshLeaseUntil(oneMinuteAgo()));
  }

  /** Expires the OpenMetadata refresh token the session holds. */
  public static void expireOmRefreshToken(String sessionId) {
    UserSession session = StoredSessions.require(sessionId);
    String token = sessionService().decryptOmRefreshToken(session);
    TokenDAO tokens = Entity.getCollectionDAO().getTokenDAO();
    TokenInterface stored = tokens.findByToken(token);
    stored.setExpiryDate(oneMinuteAgo());
    tokens.update(token, JsonUtils.pojoToJson(stored));
  }

  private static void update(
      String sessionId, UnaryOperator<UserSession.UserSessionBuilder> change) {
    SessionStore store = StoredSessions.store();
    UserSession current =
        store
            .findById(sessionId)
            .orElseThrow(() -> new AssertionError("No stored session with id " + sessionId));
    long version = current.getVersion() == null ? 0L : current.getVersion();
    UserSession updated =
        change
            .apply(current.toBuilder())
            .version(version + 1)
            .updatedAt(System.currentTimeMillis())
            .build();
    if (!store.updateIfVersion(updated, version)) {
      throw new IllegalStateException("Session " + sessionId + " changed while being edited");
    }
    sessionService().getFreshSessionById(sessionId);
  }

  private static SessionService sessionService() {
    return AuthServeletHandlerRegistry.getSessionService();
  }

  private static long oneMinuteAgo() {
    return System.currentTimeMillis() - ONE_MINUTE_MILLIS;
  }
}
