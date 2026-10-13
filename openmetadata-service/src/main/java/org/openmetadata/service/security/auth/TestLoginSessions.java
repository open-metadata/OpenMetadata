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

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.Optional;

/**
 * The identity and lifetime of a Test Login. The session id is unguessable, and it travels through
 * the identity provider inside the OIDC {@code state} / SAML {@code RelayState}, prefixed with
 * {@link #MARKER_PREFIX} so the shared callback servlets can recognise a test callback before they
 * dispatch to the live login handler.
 */
public final class TestLoginSessions {
  /** How long a test, and then its result, stays readable after it was last written. */
  static final Duration SESSION_TTL = Duration.ofMinutes(5);

  /** The window over which credential tests are counted against the per-admin limit. */
  static final Duration CREDENTIAL_TEST_WINDOW = Duration.ofMinutes(10);

  static final String MARKER_PREFIX = "omtest:";
  private static final int SESSION_ID_BYTES = 32;
  private static final SecureRandom SECURE_RANDOM = new SecureRandom();

  private TestLoginSessions() {}

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
}
