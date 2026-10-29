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

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.auth.LogoutRequest;

class JwtTokenCacheManagerTest {
  private static final String BASE64URL_ALPHABET =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  @Test
  void logoutEntryMatchesEveryEncodingOfTheSameToken() {
    String token =
        JWT.create()
            .withSubject("logged-out-" + UUID.randomUUID())
            .withExpiresAt(Date.from(Instant.now().plusSeconds(600)))
            .sign(Algorithm.HMAC256("test-key"));
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
}
