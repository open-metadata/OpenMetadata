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

package org.openmetadata.service.security.credentials;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.service.security.credentials.OmCredential.NotStored;
import org.openmetadata.service.security.credentials.OmCredential.Stored;
import org.openmetadata.service.security.credentials.OmCredential.TokenTypeClaim;
import org.openmetadata.service.security.credentials.OmCredential.Unrecognized;

class OmCredentialTest {
  private static final OmCredential STORED = new Stored(CredentialSubject.of("ingestion-bot"));
  private static final OmCredential NOT_STORED = new NotStored();

  /** Columns: signed by the OpenMetadata key, isBot claim, raw tokenType claim, expected. */
  static Stream<Arguments> classificationRows() {
    return Stream.of(
        Arguments.of(false, true, null, Unrecognized.class),
        Arguments.of(false, true, "BOT", Unrecognized.class),
        Arguments.of(false, true, "OM_USER", Unrecognized.class),
        Arguments.of(false, true, "PERSONAL_ACCESS", Unrecognized.class),
        Arguments.of(false, true, "REFRESH", Unrecognized.class),
        Arguments.of(false, false, null, NOT_STORED),
        Arguments.of(false, false, "", NOT_STORED),
        Arguments.of(false, false, "BOT", NOT_STORED),
        Arguments.of(false, false, "OM_USER", NOT_STORED),
        Arguments.of(false, false, "PERSONAL_ACCESS", NOT_STORED),
        Arguments.of(false, false, "REFRESH", NOT_STORED),
        Arguments.of(true, true, null, STORED),
        Arguments.of(true, true, "", STORED),
        Arguments.of(true, true, "  ", STORED),
        Arguments.of(true, true, "BOT", STORED),
        Arguments.of(true, true, "OM_USER", Unrecognized.class),
        Arguments.of(true, true, "PERSONAL_ACCESS", Unrecognized.class),
        Arguments.of(true, true, "REFRESH", Unrecognized.class),
        Arguments.of(true, false, "PERSONAL_ACCESS", STORED),
        Arguments.of(true, false, null, NOT_STORED),
        Arguments.of(true, false, "", NOT_STORED),
        Arguments.of(true, false, "OM_USER", NOT_STORED),
        Arguments.of(true, false, "BOT", Unrecognized.class),
        Arguments.of(true, false, "REFRESH", Unrecognized.class),
        Arguments.of(true, false, "bot", Unrecognized.class));
  }

  @ParameterizedTest(name = "signedByOm={0} isBot={1} tokenType={2}")
  @MethodSource("classificationRows")
  void classifyFollowsTheDecisionTable(
      boolean signedByOm, boolean isBot, String tokenType, Object expected) {
    OmCredential credential =
        OmCredential.classify(signedByOm, isBot, tokenType, () -> "ingestion-bot");

    if (expected instanceof Class<?> unrecognized) {
      assertInstanceOf(unrecognized, credential);
    } else {
      assertEquals(expected, credential);
    }
  }

  @ParameterizedTest(name = "signedByOm={0} isBot={1} tokenType={2}")
  @MethodSource("classificationRows")
  void classifyAsksForThePrincipalOnlyForAStoredCredential(
      boolean signedByOm, boolean isBot, String tokenType, Object expected) {
    AtomicInteger principalReads = new AtomicInteger();

    OmCredential.classify(
        signedByOm,
        isBot,
        tokenType,
        () -> {
          principalReads.incrementAndGet();
          return "ingestion-bot";
        });

    assertEquals(STORED.equals(expected) ? 1 : 0, principalReads.get());
  }

  @Test
  void storedCredentialNamesTheCanonicalPrincipal() {
    OmCredential credential = OmCredential.classify(true, true, "BOT", () -> "Ingestion-Bot");

    assertEquals(new Stored(CredentialSubject.of("ingestion-bot")), credential);
  }

  @Test
  void unrecognizedReasonNamesTheThreeFacts() {
    Unrecognized credential =
        (Unrecognized) OmCredential.classify(true, false, "BOT", () -> "ingestion-bot");

    assertEquals("signedByOpenMetadata=true, isBot=false, tokenType=BOT", credential.reason());
    assertTrue(
        ((Unrecognized) OmCredential.classify(true, true, "SERVICE", () -> "x"))
            .reason()
            .endsWith("tokenType=UNKNOWN"));
  }

  @Test
  void tokenTypeClaimParsesEveryServiceTokenTypeAndNothingElse() {
    assertEquals(TokenTypeClaim.ABSENT, TokenTypeClaim.parse(null));
    assertEquals(TokenTypeClaim.ABSENT, TokenTypeClaim.parse(""));
    assertEquals(TokenTypeClaim.ABSENT, TokenTypeClaim.parse("   "));
    assertEquals(TokenTypeClaim.BOT, TokenTypeClaim.parse("BOT"));
    assertEquals(TokenTypeClaim.OM_USER, TokenTypeClaim.parse("OM_USER"));
    assertEquals(TokenTypeClaim.PERSONAL_ACCESS, TokenTypeClaim.parse("PERSONAL_ACCESS"));
    assertEquals(TokenTypeClaim.UNKNOWN, TokenTypeClaim.parse("REFRESH"));
    assertEquals(TokenTypeClaim.UNKNOWN, TokenTypeClaim.parse("personal_access"));
    assertEquals(TokenTypeClaim.UNKNOWN, TokenTypeClaim.parse(" BOT"));
  }
}
