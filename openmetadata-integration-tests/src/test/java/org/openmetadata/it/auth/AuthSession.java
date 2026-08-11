package org.openmetadata.it.auth;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

/**
 * JVM-wide holder for the suite's active {@link AuthBackend} and current {@link TokenSet}.
 *
 * <p>Tests never construct one — {@code UiTestServer} initializes the singleton once, and
 * test extensions read {@link #current()} per test to pick up post-refresh tokens.
 */
public final class AuthSession {

  private static final AtomicReference<AuthBackend> BACKEND = new AtomicReference<>();
  private static final AtomicReference<TokenSet> CURRENT = new AtomicReference<>();

  private AuthSession() {}

  public static synchronized void initialize(final AuthBackend backend, final TokenSet initial) {
    BACKEND.set(backend);
    CURRENT.set(initial);
  }

  public static AuthBackend backend() {
    final AuthBackend backend = BACKEND.get();
    if (backend == null) {
      throw new IllegalStateException(
          "AuthSession not initialized — UiTestServer.get() must run first");
    }
    return backend;
  }

  public static TokenSet current() {
    final TokenSet tokens = CURRENT.get();
    if (tokens == null) {
      throw new IllegalStateException(
          "AuthSession has no token — UiTestServer.get() must run first");
    }
    return tokens;
  }

  public static Optional<TokenSet> currentOptional() {
    return Optional.ofNullable(CURRENT.get());
  }

  /** Replace the current token set after a refresh. */
  public static void update(final TokenSet refreshed) {
    CURRENT.set(refreshed);
  }
}
