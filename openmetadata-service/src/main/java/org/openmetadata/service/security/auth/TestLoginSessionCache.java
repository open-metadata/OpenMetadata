/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.security.auth;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Ticker;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.Optional;
import org.openmetadata.schema.system.TestLoginResult;
import org.openmetadata.service.exception.EntityNotFoundException;

/**
 * In-flight Test Login round-trips, keyed by an unguessable session id.
 *
 * <p>Bounded and short-lived by design: an entry exists only between an admin starting a test and
 * the identity provider's callback completing it, and it holds a candidate configuration with live
 * secrets, so it must never outlive the test. Nothing is persisted — a restart simply abandons any
 * test in flight, which the admin can re-run.
 *
 * <p>The session id travels through the identity provider inside the OIDC {@code state} / SAML
 * {@code RelayState}, prefixed with {@link #MARKER_PREFIX} so the shared callback servlets can
 * recognise a test callback before dispatching to the live login handler.
 */
public final class TestLoginSessionCache {
  static final int MAX_IN_FLIGHT_TESTS = 50;
  static final Duration SESSION_TTL = Duration.ofMinutes(5);
  static final String MARKER_PREFIX = "omtest:";
  private static final int SESSION_ID_BYTES = 32;
  private static final SecureRandom SECURE_RANDOM = new SecureRandom();

  private final Cache<String, TestLoginSessionEntry> sessions;

  public TestLoginSessionCache() {
    this(boundedCache(Ticker.systemTicker()));
  }

  TestLoginSessionCache(Cache<String, TestLoginSessionEntry> sessions) {
    this.sessions = sessions;
  }

  static Cache<String, TestLoginSessionEntry> boundedCache(Ticker ticker) {
    return Caffeine.newBuilder()
        .maximumSize(MAX_IN_FLIGHT_TESTS)
        .expireAfterWrite(SESSION_TTL)
        .ticker(ticker)
        .build();
  }

  public static String newSessionId() {
    byte[] bytes = new byte[SESSION_ID_BYTES];
    SECURE_RANDOM.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  /** The value to put in the OIDC {@code state} or SAML {@code RelayState} for this test. */
  public static String markerFor(String testSessionId) {
    return MARKER_PREFIX + testSessionId;
  }

  /** The session id carried by a Test Login marker, or empty for any other state/RelayState. */
  public static Optional<String> sessionIdFromMarker(String stateOrRelayState) {
    return Optional.ofNullable(stateOrRelayState)
        .filter(value -> value.startsWith(MARKER_PREFIX))
        .map(value -> value.substring(MARKER_PREFIX.length()))
        .filter(sessionId -> !sessionId.isEmpty());
  }

  public static boolean isTestLoginMarker(String stateOrRelayState) {
    return sessionIdFromMarker(stateOrRelayState).isPresent();
  }

  public void put(TestLoginSessionEntry entry) {
    sessions.put(entry.testSessionId(), entry);
  }

  /** The test a callback may complete: one that exists and has not completed yet. */
  public Optional<TestLoginSessionEntry> findPending(String testSessionId) {
    return Optional.ofNullable(sessions.getIfPresent(testSessionId))
        .filter(entry -> !entry.isCompleted());
  }

  /**
   * Records the outcome of a round-trip. The first completion wins: a replayed or forged callback
   * for an already-completed test cannot overwrite the result the admin is about to be shown.
   *
   * @return whether this call completed the test
   */
  public boolean complete(String testSessionId, TestLoginResult result) {
    return findPending(testSessionId)
        .map(
            pending -> sessions.asMap().replace(testSessionId, pending, pending.withResult(result)))
        .orElse(false);
  }

  /**
   * The test the given admin started. Another admin's test answers exactly like an unknown id, so a
   * session id's existence cannot be probed.
   */
  public TestLoginSessionEntry requireOwnedBy(String testSessionId, String adminPrincipal) {
    return Optional.ofNullable(sessions.getIfPresent(testSessionId))
        .filter(entry -> entry.isOwnedBy(adminPrincipal))
        .orElseThrow(
            () ->
                new EntityNotFoundException(
                    "Test login session not found or expired. Start a new test login."));
  }
}
