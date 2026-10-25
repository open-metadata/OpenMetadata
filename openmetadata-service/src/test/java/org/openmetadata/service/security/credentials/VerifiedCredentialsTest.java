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
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import org.junit.jupiter.api.Test;

class VerifiedCredentialsTest {
  private static final SourceFingerprint FINGERPRINT = SourceFingerprint.of("a");
  private static final CredentialRecord RECORD =
      new CredentialRecord(FINGERPRINT, Set.of(TokenDigest.of("t")), null, null);

  private static VerifiedCredentials entryAt(long stamp) {
    return new VerifiedCredentials(RECORD, stamp);
  }

  @Test
  void ageIsMeasuredFromTheStamp() {
    assertEquals(250L, entryAt(1_000L).ageNanos(1_250L));
  }

  @Test
  void newerKeepsTheLaterStampInBothArgumentOrders() {
    VerifiedCredentials early = entryAt(100L);
    VerifiedCredentials late = entryAt(200L);

    assertSame(late, VerifiedCredentials.newer(early, late));
    assertSame(late, VerifiedCredentials.newer(late, early));
  }

  @Test
  void reconfirmMovesTheStampOnlyForAnEqualFingerprintAndALaterStamp() {
    VerifiedCredentials entry = entryAt(100L);

    assertEquals(200L, entry.reconfirmedAt(SourceFingerprint.of("a"), 200L).verifiedAtNanos());
    assertSame(entry, entry.reconfirmedAt(SourceFingerprint.of("b"), 200L));
    assertSame(entry, entry.reconfirmedAt(SourceFingerprint.ABSENT, 200L));
    assertSame(entry, entry.reconfirmedAt(FINGERPRINT, 100L));
    assertSame(entry, entry.reconfirmedAt(FINGERPRINT, 50L));
  }

  @Test
  void stampsThatCrossLongMaxValueStillOrderByElapsedTime() {
    long beforeWrap = Long.MAX_VALUE - 10;
    long afterWrap = beforeWrap + 20;
    assertTrue(afterWrap < beforeWrap, "the raw longs order the wrong way once the clock wraps");
    VerifiedCredentials early = entryAt(beforeWrap);
    VerifiedCredentials late = entryAt(afterWrap);

    assertSame(late, VerifiedCredentials.newer(early, late));
    assertSame(late, VerifiedCredentials.newer(late, early));
    assertEquals(afterWrap, early.reconfirmedAt(FINGERPRINT, afterWrap).verifiedAtNanos());
    assertSame(late, late.reconfirmedAt(FINGERPRINT, beforeWrap));
    assertEquals(20L, early.ageNanos(afterWrap));
  }

  @Test
  void reconfirmKeepsTheSameRecord() {
    assertSame(RECORD, entryAt(100L).reconfirmedAt(FINGERPRINT, 200L).record());
  }

  @Test
  void recordHoldsOnlyItsDigestsAndAbsentHoldsNone() {
    assertEquals(true, RECORD.holds(TokenDigest.of("t")));
    assertEquals(false, RECORD.holds(TokenDigest.of("other")));
    assertEquals(false, CredentialRecord.ABSENT.holds(TokenDigest.of("t")));
  }
}
