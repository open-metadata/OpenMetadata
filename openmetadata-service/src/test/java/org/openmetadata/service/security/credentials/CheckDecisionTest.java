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
import static org.openmetadata.service.security.credentials.CheckDecision.DEFER;
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
import org.openmetadata.service.security.credentials.VerifiedCredentials.FullRead;
import org.openmetadata.service.security.credentials.VerifiedCredentials.ReadOrder;

class CheckDecisionTest {
  private static final long MAX_STALENESS = 5_000_000_000L;
  private static final long MISS_REFRESH_MIN_AGE = 500_000_000L;
  private static final CheckDecision.Policy POLICY =
      new CheckDecision.Policy(MAX_STALENESS, MISS_REFRESH_MIN_AGE);
  private static final long STAMP = 1_000_000_000_000L;
  private static final TokenDigest HELD = TokenDigest.of("held-token");
  private static final TokenDigest UNKNOWN = TokenDigest.of("unknown-token");
  private static final TokenDigest WITHDRAWN = TokenDigest.of("withdrawn-token");
  private static final CredentialRecord RECORD =
      new CredentialRecord(SourceFingerprint.of("fp"), Set.of(HELD), null, null);
  private static final VerifiedCredentials ENTRY = entry(STAMP, STAMP);

  /**
   * An entry read at {@code fullReadAt} on behalf of a check that presented {@link #WITHDRAWN},
   * which the read lacks, and reconfirmed by a sweep at {@code verifiedAt}.
   */
  private static VerifiedCredentials entry(long verifiedAt, long fullReadAt) {
    VerifiedCredentials entry =
        new VerifiedCredentials(
            new FullRead(RECORD, fullReadAt, new ReadOrder(1, 2), Set.of(WITHDRAWN)));
    entry.confirm(RECORD.fingerprint(), verifiedAt);
    return entry;
  }

  /**
   * Columns: entry present, age of the trust stamp in ns, age of the last full read in ns, the
   * digest checked, expected decision. The two ages are equal right after a full read; a sweep
   * reconfirmation moves only the trust stamp, so the full read is then the older of the two.
   */
  static Stream<Arguments> decideRows() {
    return Stream.of(
        Arguments.of("no entry, held", false, 0L, 0L, HELD, LOAD_MISSING),
        Arguments.of("no entry, unknown", false, 0L, 0L, UNKNOWN, LOAD_MISSING),
        Arguments.of("fresh, held", true, 0L, 0L, HELD, ACCEPT),
        Arguments.of("fresh, unknown, age below min", true, 0L, 0L, UNKNOWN, DEFER),
        Arguments.of("fresh, withdrawn, age below min", true, 0L, 0L, WITHDRAWN, REJECT),
        Arguments.of("negative age, held", true, -1L, -1L, HELD, ACCEPT),
        Arguments.of("negative age, unknown", true, -1L, -1L, UNKNOWN, DEFER),
        Arguments.of("negative age, withdrawn", true, -1L, -1L, WITHDRAWN, REJECT),
        Arguments.of(
            "age = minAge - 1, unknown",
            true,
            MISS_REFRESH_MIN_AGE - 1,
            MISS_REFRESH_MIN_AGE - 1,
            UNKNOWN,
            DEFER),
        Arguments.of(
            "age = minAge - 1, withdrawn",
            true,
            MISS_REFRESH_MIN_AGE - 1,
            MISS_REFRESH_MIN_AGE - 1,
            WITHDRAWN,
            REJECT),
        Arguments.of(
            "age = minAge, unknown",
            true,
            MISS_REFRESH_MIN_AGE,
            MISS_REFRESH_MIN_AGE,
            UNKNOWN,
            LOAD_UNKNOWN_TOKEN),
        Arguments.of(
            "age = minAge, withdrawn reads again",
            true,
            MISS_REFRESH_MIN_AGE,
            MISS_REFRESH_MIN_AGE,
            WITHDRAWN,
            LOAD_UNKNOWN_TOKEN),
        Arguments.of(
            "age = minAge + 1, unknown",
            true,
            MISS_REFRESH_MIN_AGE + 1,
            MISS_REFRESH_MIN_AGE + 1,
            UNKNOWN,
            LOAD_UNKNOWN_TOKEN),
        Arguments.of(
            "age = minAge, held", true, MISS_REFRESH_MIN_AGE, MISS_REFRESH_MIN_AGE, HELD, ACCEPT),
        Arguments.of(
            "age = maxStaleness - 1, held",
            true,
            MAX_STALENESS - 1,
            MAX_STALENESS - 1,
            HELD,
            ACCEPT),
        Arguments.of("age = maxStaleness, held", true, MAX_STALENESS, MAX_STALENESS, HELD, ACCEPT),
        Arguments.of(
            "age = maxStaleness + 1, held",
            true,
            MAX_STALENESS + 1,
            MAX_STALENESS + 1,
            HELD,
            LOAD_STALE),
        Arguments.of(
            "age = maxStaleness, unknown",
            true,
            MAX_STALENESS,
            MAX_STALENESS,
            UNKNOWN,
            LOAD_UNKNOWN_TOKEN),
        Arguments.of(
            "age = maxStaleness + 1, unknown",
            true,
            MAX_STALENESS + 1,
            MAX_STALENESS + 1,
            UNKNOWN,
            LOAD_STALE),
        Arguments.of(
            "age = maxStaleness + 1, withdrawn",
            true,
            MAX_STALENESS + 1,
            MAX_STALENESS + 1,
            WITHDRAWN,
            LOAD_STALE),
        Arguments.of(
            "far past the bound, held",
            true,
            60L * MAX_STALENESS,
            60L * MAX_STALENESS,
            HELD,
            LOAD_STALE),
        Arguments.of(
            "reconfirmed now, full read at minAge - 1, unknown",
            true,
            0L,
            MISS_REFRESH_MIN_AGE - 1,
            UNKNOWN,
            DEFER),
        Arguments.of(
            "reconfirmed now, full read at minAge - 1, withdrawn",
            true,
            0L,
            MISS_REFRESH_MIN_AGE - 1,
            WITHDRAWN,
            REJECT),
        Arguments.of(
            "reconfirmed now, full read at minAge, unknown",
            true,
            0L,
            MISS_REFRESH_MIN_AGE,
            UNKNOWN,
            LOAD_UNKNOWN_TOKEN),
        Arguments.of(
            "reconfirmed now, full read at minAge + 1, unknown",
            true,
            0L,
            MISS_REFRESH_MIN_AGE + 1,
            UNKNOWN,
            LOAD_UNKNOWN_TOKEN),
        Arguments.of(
            "reconfirmed now, full read long ago, held",
            true,
            0L,
            60L * MAX_STALENESS,
            HELD,
            ACCEPT),
        Arguments.of(
            "reconfirmed at maxStaleness, full read long ago, held",
            true,
            MAX_STALENESS,
            60L * MAX_STALENESS,
            HELD,
            ACCEPT),
        Arguments.of(
            "reconfirmed past maxStaleness, full read long ago, unknown",
            true,
            MAX_STALENESS + 1,
            60L * MAX_STALENESS,
            UNKNOWN,
            LOAD_STALE));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("decideRows")
  void decideFollowsTheTable(
      String name,
      boolean present,
      long ageNanos,
      long fullReadAgeNanos,
      TokenDigest digest,
      CheckDecision expected) {
    long now = STAMP + ageNanos;
    VerifiedCredentials entry = present ? entry(STAMP, now - fullReadAgeNanos) : null;

    assertEquals(expected, CheckDecision.decide(entry, now, digest, POLICY));
  }

  /** Columns: age in ns, the digest checked, expected decision. */
  static Stream<Arguments> decideAfterLoadRows() {
    return Stream.of(
        Arguments.of("fresh, held", 0L, HELD, ACCEPT),
        Arguments.of("fresh, unknown", 0L, UNKNOWN, DEFER),
        Arguments.of("fresh, withdrawn", 0L, WITHDRAWN, REJECT),
        Arguments.of("age = minAge, unknown stays deferred", MISS_REFRESH_MIN_AGE, UNKNOWN, DEFER),
        Arguments.of(
            "age = minAge, withdrawn stays rejected", MISS_REFRESH_MIN_AGE, WITHDRAWN, REJECT),
        Arguments.of("age = maxStaleness, held", MAX_STALENESS, HELD, ACCEPT),
        Arguments.of("age = maxStaleness, unknown", MAX_STALENESS, UNKNOWN, DEFER),
        Arguments.of("age = maxStaleness, withdrawn", MAX_STALENESS, WITHDRAWN, REJECT),
        Arguments.of("age = maxStaleness + 1, held", MAX_STALENESS + 1, HELD, LOAD_STALE),
        Arguments.of("age = maxStaleness + 1, unknown", MAX_STALENESS + 1, UNKNOWN, LOAD_STALE));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("decideAfterLoadRows")
  void decideAfterLoadNeverAsksForASecondLoadWithinTheBound(
      String name, long ageNanos, TokenDigest digest, CheckDecision expected) {
    assertEquals(expected, CheckDecision.decideAfterLoad(ENTRY, STAMP + ageNanos, digest, POLICY));
  }

  @Test
  void anUnconfirmedEntryNeedsALoadHoweverFreshItsStampIs() {
    VerifiedCredentials unconfirmed = ENTRY.unconfirmedAt(STAMP);

    assertEquals(LOAD_STALE, CheckDecision.decide(unconfirmed, STAMP, HELD, POLICY));
    assertEquals(LOAD_STALE, CheckDecision.decide(unconfirmed, STAMP, UNKNOWN, POLICY));
  }

  @Test
  void onlyTheLoadDecisionsNeedALoad() {
    assertFalse(ACCEPT.needsLoad());
    assertFalse(REJECT.needsLoad());
    assertFalse(DEFER.needsLoad());
    assertTrue(LOAD_MISSING.needsLoad());
    assertTrue(LOAD_STALE.needsLoad());
    assertTrue(LOAD_UNKNOWN_TOKEN.needsLoad());
  }

  @Test
  void stampsThatCrossLongMaxValueKeepTheirAge() {
    VerifiedCredentials nearWrap =
        entry(Long.MAX_VALUE - MISS_REFRESH_MIN_AGE, Long.MAX_VALUE - MISS_REFRESH_MIN_AGE);
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
