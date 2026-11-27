/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.security.saml;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.auth.LogoutRequest;

class JwtTokenCacheManagerTest {
  private static final String BASE64URL_ALPHABET =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  @Test
  void logoutEntryMatchesEveryEncodingOfTheSameToken() {
    String token = tokenExpiringIn(600);
    JwtTokenCacheManager.getInstance()
        .markLogoutEventForToken(new LogoutRequest().withUsername("user").withToken(token));

    // The last base64url character of a 32-byte signature carries two unused bits, so this is a
    // second encoding of the same signature.
    char last = token.charAt(token.length() - 1);
    String reencoded =
        token.substring(0, token.length() - 1)
            + BASE64URL_ALPHABET.charAt(BASE64URL_ALPHABET.indexOf(last) ^ 1);

    assertNotEquals(token, reencoded);
    assertNotNull(JwtTokenCacheManager.getInstance().getLogoutEventForToken(reencoded));
  }

  @Test
  void aLogoutEntryKeepsTheUserAndTimeButNotTheToken() {
    String token = tokenExpiringIn(600);
    Date loggedOutAt = new Date();
    JwtTokenCacheManager.getInstance()
        .markLogoutEventForToken(
            new LogoutRequest().withUsername("user").withToken(token).withLogoutTime(loggedOutAt));

    LogoutRequest entry = JwtTokenCacheManager.getInstance().getLogoutEventForToken(token);

    assertEquals("user", entry.getUsername());
    assertEquals(loggedOutAt, entry.getLogoutTime());
    assertNull(entry.getToken());
  }

  @Test
  void aTokenThatNeverExpiresIsNotCached() {
    String token =
        JWT.create().withSubject("bot-" + UUID.randomUUID()).sign(Algorithm.HMAC256("test-key"));

    assertDoesNotThrow(
        () ->
            JwtTokenCacheManager.getInstance()
                .markLogoutEventForToken(new LogoutRequest().withUsername("bot").withToken(token)));
    assertNull(JwtTokenCacheManager.getInstance().getLogoutEventForToken(token));
  }

  @Test
  void aFullCacheDropsTheEntryThatExpiresFirst() {
    JwtTokenCacheManager cache = new JwtTokenCacheManager(2);
    String soonest = tokenExpiringIn(60);
    String later = tokenExpiringIn(600);
    String latest = tokenExpiringIn(6000);
    for (String token : List.of(later, soonest, latest)) {
      cache.markLogoutEventForToken(new LogoutRequest().withUsername("user").withToken(token));
    }

    assertNull(cache.getLogoutEventForToken(soonest));
    assertNotNull(cache.getLogoutEventForToken(later));
    assertNotNull(cache.getLogoutEventForToken(latest));
  }

  private static String tokenExpiringIn(long seconds) {
    return JWT.create()
        .withSubject("logged-out-" + UUID.randomUUID())
        .withExpiresAt(Date.from(Instant.now().plusSeconds(seconds)))
        .sign(Algorithm.HMAC256("test-key"));
  }
}
