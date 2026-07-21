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

package org.openmetadata.service.security.jwt;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.security.jwt.InternalActionTokenSigner.Claims;

class InternalActionTokenSignerTest {
  private static final Instant NOW = Instant.parse("2026-07-18T20:00:00Z");
  private static final Algorithm ALGORITHM = Algorithm.HMAC256("internal-action-test-secret");

  @Test
  void roundTripsTypedClaimsAndEnforcesPurpose() {
    final InternalActionTokenSigner signer = signer(NOW);
    final Claims expected =
        new Claims("ontology-delete", "term-id", "alice", "1.2", "digest", NOW.plusSeconds(60));

    final String token = signer.sign(expected);

    assertEquals(expected, signer.verify(token, "ontology-delete"));
    assertThrows(JWTVerificationException.class, () -> signer.verify(token, "another-action"));
  }

  @Test
  void rejectsExpiredTokensUsingTheInjectedClock() {
    final Claims claims =
        new Claims("ontology-delete", "term-id", "alice", "1.2", "digest", NOW.plusSeconds(30));
    final String token = signer(NOW).sign(claims);

    assertThrows(
        JWTVerificationException.class,
        () -> signer(NOW.plusSeconds(31)).verify(token, "ontology-delete"));
  }

  private static InternalActionTokenSigner signer(final Instant instant) {
    final Clock clock = Clock.fixed(instant, ZoneOffset.UTC);
    return new InternalActionTokenSigner(ALGORITHM, ALGORITHM, "openmetadata-test", clock);
  }
}
