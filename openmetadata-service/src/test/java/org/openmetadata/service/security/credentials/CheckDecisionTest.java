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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.security.credentials.CheckDecision.ACCEPT;
import static org.openmetadata.service.security.credentials.CheckDecision.LOAD_MISSING;
import static org.openmetadata.service.security.credentials.CheckDecision.LOAD_STALE;
import static org.openmetadata.service.security.credentials.CheckDecision.LOAD_UNKNOWN_TOKEN;
import static org.openmetadata.service.security.credentials.CheckDecision.REJECT;

import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class CheckDecisionTest {
  private static final long MAX_STALENESS = 5_000_000_000L;
  private static final long MISS_REFRESH_MIN_AGE = 500_000_000L;
  private static final CheckDecision.Policy POLICY =
      new CheckDecision.Policy(MAX_STALENESS, MISS_REFRESH_MIN_AGE);
  private static final long STAMP = 1_000_000_000_000L;
  private static final TokenDigest HELD = TokenDigest.of("held-token");
  private static final TokenDigest UNKNOWN = TokenDigest.of("unknown-token");
  private static final VerifiedCredentials ENTRY =
      new VerifiedCredentials(
          new CredentialRecord(SourceFingerprint.of("fp"), Set.of(HELD), null, null), STAMP);

  /** Columns: entry present, age in ns, digest held, expected decision. */
  static Stream<Arguments> decideRows() {
    return Stream.of(
        Arguments.of("no entry, held", false, 0L, true, LOAD_MISSING),
        Arguments.of("no entry, unknown", false, 0L, false, LOAD_MISSING),
        Arguments.of("fresh, held", true, 0L, true, ACCEPT),
        Arguments.of("fresh, unknown, age below min", true, 0L, false, REJECT),
        Arguments.of("negative age, held", true, -1L, true, ACCEPT),
        Arguments.of("negative age, unknown", true, -1L, false, REJECT),
        Arguments.of("age = minAge - 1, unknown", true, MISS_REFRESH_MIN_AGE - 1, false, REJECT),
        Arguments.of(
            "age = minAge, unknown", true, MISS_REFRESH_MIN_AGE, false, LOAD_UNKNOWN_TOKEN),
        Arguments.of(
            "age = minAge + 1, unknown", true, MISS_REFRESH_MIN_AGE + 1, false, LOAD_UNKNOWN_TOKEN),
        Arguments.of("age = minAge, held", true, MISS_REFRESH_MIN_AGE, true, ACCEPT),
        Arguments.of("age = maxStaleness - 1, held", true, MAX_STALENESS - 1, true, ACCEPT),
        Arguments.of("age = maxStaleness, held", true, MAX_STALENESS, true, ACCEPT),
        Arguments.of("age = maxStaleness + 1, held", true, MAX_STALENESS + 1, true, LOAD_STALE),
        Arguments.of("age = maxStaleness, unknown", true, MAX_STALENESS, false, LOAD_UNKNOWN_TOKEN),
        Arguments.of("age = maxStaleness + 1, unknown", true, MAX_STALENESS + 1, false, LOAD_STALE),
        Arguments.of("far past the bound, held", true, 60L * MAX_STALENESS, true, LOAD_STALE));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("decideRows")
  void decideFollowsTheTable(
      String name, boolean present, long ageNanos, boolean held, CheckDecision expected) {
    VerifiedCredentials entry = present ? ENTRY : null;

    assertEquals(
        expected, CheckDecision.decide(entry, STAMP + ageNanos, held ? HELD : UNKNOWN, POLICY));
  }

  /** Columns: age in ns, digest held, expected decision. */
  static Stream<Arguments> decideAfterLoadRows() {
    return Stream.of(
        Arguments.of("fresh, held", 0L, true, ACCEPT),
        Arguments.of("fresh, unknown", 0L, false, REJECT),
        Arguments.of("age = minAge, unknown stays rejected", MISS_REFRESH_MIN_AGE, false, REJECT),
        Arguments.of("age = maxStaleness, held", MAX_STALENESS, true, ACCEPT),
        Arguments.of("age = maxStaleness, unknown", MAX_STALENESS, false, REJECT),
        Arguments.of("age = maxStaleness + 1, held", MAX_STALENESS + 1, true, LOAD_STALE),
        Arguments.of("age = maxStaleness + 1, unknown", MAX_STALENESS + 1, false, LOAD_STALE));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("decideAfterLoadRows")
  void decideAfterLoadNeverAsksForASecondLoadWithinTheBound(
      String name, long ageNanos, boolean held, CheckDecision expected) {
    assertEquals(
        expected,
        CheckDecision.decideAfterLoad(ENTRY, STAMP + ageNanos, held ? HELD : UNKNOWN, POLICY));
  }

  @Test
  void onlyTheLoadDecisionsNeedALoad() {
    assertFalse(ACCEPT.needsLoad());
    assertFalse(REJECT.needsLoad());
    assertTrue(LOAD_MISSING.needsLoad());
    assertTrue(LOAD_STALE.needsLoad());
    assertTrue(LOAD_UNKNOWN_TOKEN.needsLoad());
  }

  @Test
  void stampsThatCrossLongMaxValueKeepTheirAge() {
    VerifiedCredentials nearWrap =
        new VerifiedCredentials(ENTRY.record(), Long.MAX_VALUE - MISS_REFRESH_MIN_AGE);
    long afterWrap = Long.MAX_VALUE - MISS_REFRESH_MIN_AGE + MAX_STALENESS;

    assertEquals(ACCEPT, CheckDecision.decide(nearWrap, afterWrap, HELD, POLICY));
    assertEquals(LOAD_STALE, CheckDecision.decide(nearWrap, afterWrap + 1, HELD, POLICY));
    assertEquals(LOAD_UNKNOWN_TOKEN, CheckDecision.decide(nearWrap, afterWrap, UNKNOWN, POLICY));
  }

  @Test
  void policyRequiresAPositiveMinAgeBelowMaxStaleness() {
    assertThrows(IllegalArgumentException.class, () -> new CheckDecision.Policy(5, 0));
    assertThrows(IllegalArgumentException.class, () -> new CheckDecision.Policy(5, 5));
    assertThrows(IllegalArgumentException.class, () -> new CheckDecision.Policy(4, 5));
    assertEquals(4L, new CheckDecision.Policy(5, 4).missRefreshMinAgeNanos());
  }

  @Test
  void configDefaultsGiveTheDocumentedPolicy() {
    assertEquals(
        new CheckDecision.Policy(5_000_000_000L, 500_000_000L),
        CredentialVerificationConfig.defaults().policy());
  }
}
