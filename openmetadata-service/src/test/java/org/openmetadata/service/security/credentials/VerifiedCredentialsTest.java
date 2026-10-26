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
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;
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
  void aFullReadStampsBothMoments() {
    VerifiedCredentials entry = entryAt(1_000L);

    assertEquals(1_000L, entry.verifiedAtNanos());
    assertEquals(1_000L, entry.fullReadAtNanos());
    assertEquals(250L, entry.fullReadAgeNanos(1_250L));
  }

  @Test
  void newerKeepsTheLaterStampInBothArgumentOrders() {
    VerifiedCredentials early = entryAt(100L);
    VerifiedCredentials late = entryAt(200L);

    assertSame(late, VerifiedCredentials.newer(early, late));
    assertSame(late, VerifiedCredentials.newer(late, early));
  }

  @Test
  void confirmMovesTheStampOnlyForAnEqualFingerprintAndALaterStamp() {
    VerifiedCredentials entry = entryAt(100L);

    assertTrue(entry.confirm(SourceFingerprint.of("a"), 200L));
    assertEquals(200L, entry.verifiedAtNanos());
    assertFalse(entry.confirm(SourceFingerprint.of("b"), 300L));
    assertFalse(entry.confirm(SourceFingerprint.ABSENT, 300L));
    assertEquals(200L, entry.verifiedAtNanos());
    assertTrue(entry.confirm(FINGERPRINT, 200L));
    assertTrue(entry.confirm(FINGERPRINT, 50L));
    assertEquals(200L, entry.verifiedAtNanos());
  }

  @Test
  void confirmKeepsTheFullReadStampAndTheRecord() {
    VerifiedCredentials entry = entryAt(100L);
    entry.confirm(FINGERPRINT, 200L);

    assertEquals(100L, entry.fullReadAtNanos());
    assertEquals(200L, entry.verifiedAtNanos());
    assertEquals(150L, entry.fullReadAgeNanos(250L));
    assertEquals(50L, entry.ageNanos(250L));
    assertSame(RECORD, entry.record());
  }

  @Test
  void aFullReadWinsATieAgainstAConfirmationAtTheSameInstant() {
    VerifiedCredentials confirmed = entryAt(100L);
    confirmed.confirm(FINGERPRINT, 200L);
    VerifiedCredentials fullRead = entryAt(200L);

    assertSame(fullRead, VerifiedCredentials.newer(confirmed, fullRead));
  }

  @Test
  void newerComparesTheTrustStampNotTheFullReadStamp() {
    VerifiedCredentials reconfirmed = entryAt(100L);
    reconfirmed.confirm(FINGERPRINT, 300L);
    VerifiedCredentials fullRead = entryAt(200L);

    assertSame(reconfirmed, VerifiedCredentials.newer(reconfirmed, fullRead));
    assertSame(reconfirmed, VerifiedCredentials.newer(fullRead, reconfirmed));
  }

  @Test
  void concurrentConfirmationsLeaveTheLatestStamp() throws Exception {
    VerifiedCredentials entry = entryAt(0L);
    List<Callable<Boolean>> confirmations =
        IntStream.rangeClosed(1, 2_000)
            .mapToObj(stamp -> (Callable<Boolean>) () -> entry.confirm(FINGERPRINT, stamp))
            .toList();
    ExecutorService threads = Executors.newFixedThreadPool(8);
    try {
      for (Future<Boolean> confirmed : threads.invokeAll(confirmations)) {
        assertTrue(confirmed.get());
      }
    } finally {
      threads.shutdownNow();
      assertTrue(threads.awaitTermination(10, TimeUnit.SECONDS));
    }

    assertEquals(2_000L, entry.verifiedAtNanos());
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
    assertEquals(20L, early.ageNanos(afterWrap));
    assertTrue(late.confirm(FINGERPRINT, beforeWrap));
    assertEquals(afterWrap, late.verifiedAtNanos());
    assertTrue(early.confirm(FINGERPRINT, afterWrap));
    assertEquals(afterWrap, early.verifiedAtNanos());
    assertEquals(20L, early.fullReadAgeNanos(afterWrap));
  }

  @Test
  void recordHoldsOnlyItsDigestsAndAbsentHoldsNone() {
    assertEquals(true, RECORD.holds(TokenDigest.of("t")));
    assertEquals(false, RECORD.holds(TokenDigest.of("other")));
    assertEquals(false, CredentialRecord.ABSENT.holds(TokenDigest.of("t")));
  }
}
