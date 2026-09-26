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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Ticker;
import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.TestLoginProtocol;
import org.openmetadata.schema.system.TestLoginResult;
import org.openmetadata.service.exception.EntityNotFoundException;

class TestLoginSessionCacheTest {
  private static final String ADMIN = "admin";
  private static final String CLIENT_SECRET = "s3cr3t-client-secret";
  private static final String CODE_VERIFIER = "pkce-verifier-value";

  private final AtomicLong nanos = new AtomicLong();
  private final Ticker fakeTicker = nanos::get;
  private final TestLoginSessionCache cache =
      new TestLoginSessionCache(TestLoginSessionCache.boundedCache(fakeTicker));

  @Test
  void sessionIdsAreUrlSafeAndUnique() {
    String first = TestLoginSessionCache.newSessionId();
    String second = TestLoginSessionCache.newSessionId();

    // 32 random bytes, base64url without padding.
    assertEquals(43, first.length());
    assertTrue(first.matches("[A-Za-z0-9_-]+"));
    assertNotEquals(first, second);
  }

  @Test
  void markerRoundTripsAndRejectsEverythingElse() {
    String marker = TestLoginSessionCache.markerFor("abc123");

    assertEquals(Optional.of("abc123"), TestLoginSessionCache.sessionIdFromMarker(marker));
    assertTrue(TestLoginSessionCache.isTestLoginMarker(marker));
    assertFalse(TestLoginSessionCache.isTestLoginMarker("omtest:"));
    assertFalse(TestLoginSessionCache.isTestLoginMarker("mcp:abc123"));
    assertFalse(TestLoginSessionCache.isTestLoginMarker("a-live-login-state"));
    assertFalse(TestLoginSessionCache.isTestLoginMarker(null));
  }

  @Test
  void theFirstCompletionWinsSoAReplayedCallbackCannotOverwriteIt() {
    cache.put(pendingEntry("session-1"));
    TestLoginResult genuine = new TestLoginResult().withStatus(TestLoginResult.Status.SUCCESS);
    TestLoginResult replayed = new TestLoginResult().withStatus(TestLoginResult.Status.FAILED);

    assertTrue(cache.complete("session-1", genuine));
    assertFalse(cache.complete("session-1", replayed));

    assertEquals(genuine, cache.requireOwnedBy("session-1", ADMIN).result());
    assertTrue(cache.findPending("session-1").isEmpty());
  }

  @Test
  void completingAnUnknownSessionDoesNothing() {
    assertFalse(
        cache.complete(
            "no-such-session", new TestLoginResult().withStatus(TestLoginResult.Status.SUCCESS)));
  }

  @Test
  void anotherAdminsTestLooksExactlyLikeAnUnknownOne() {
    cache.put(pendingEntry("session-1"));

    EntityNotFoundException otherAdmin =
        assertThrows(
            EntityNotFoundException.class, () -> cache.requireOwnedBy("session-1", "other-admin"));
    EntityNotFoundException unknown =
        assertThrows(
            EntityNotFoundException.class, () -> cache.requireOwnedBy("no-such-session", ADMIN));

    assertEquals(unknown.getMessage(), otherAdmin.getMessage());
  }

  @Test
  void aTestExpiresAfterTheSessionTtl() {
    cache.put(pendingEntry("session-1"));
    assertTrue(cache.findPending("session-1").isPresent());

    nanos.addAndGet(TestLoginSessionCache.SESSION_TTL.plusSeconds(1).toNanos());

    assertTrue(cache.findPending("session-1").isEmpty());
    assertFalse(
        cache.complete(
            "session-1", new TestLoginResult().withStatus(TestLoginResult.Status.SUCCESS)));
  }

  @Test
  void theProductionCacheIsBoundedAndShortLived() {
    Cache<String, TestLoginSessionEntry> production =
        TestLoginSessionCache.boundedCache(Ticker.systemTicker());

    assertEquals(
        TestLoginSessionCache.MAX_IN_FLIGHT_TESTS,
        production.policy().eviction().orElseThrow().getMaximum());
    assertEquals(
        Duration.ofMinutes(5),
        production.policy().expireAfterWrite().orElseThrow().getExpiresAfter());
  }

  @Test
  void toStringNeverRevealsTheCandidateSecretsOrTheHandshake() {
    String rendered = pendingEntry("session-1").toString();

    assertFalse(rendered.contains(CLIENT_SECRET));
    assertFalse(rendered.contains(CODE_VERIFIER));
    assertFalse(
        new TestLoginHandshake.Oidc("nonce-value", CODE_VERIFIER, "https://om/callback")
            .toString()
            .contains(CODE_VERIFIER));
  }

  private static TestLoginSessionEntry pendingEntry(String testSessionId) {
    SecurityConfiguration candidate =
        new SecurityConfiguration()
            .withAuthenticationConfiguration(
                new AuthenticationConfiguration()
                    .withOidcConfiguration(new OidcClientConfig().withSecret(CLIENT_SECRET)));
    return TestLoginSessionEntry.pending(
        testSessionId,
        ADMIN,
        candidate,
        TestLoginProtocol.OIDC,
        new TestLoginHandshake.Oidc("nonce-value", CODE_VERIFIER, "https://om/callback"));
  }
}
