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
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.security.credentials.VerifiedCredentials.FullRead;
import org.openmetadata.service.security.credentials.VerifiedCredentials.ReadOrder;
import org.openmetadata.service.security.credentials.VerifiedCredentials.Standing;

class VerifiedCredentialsTest {
  private static final SourceFingerprint FINGERPRINT = SourceFingerprint.of("a");
  private static final TokenDigest KEPT = TokenDigest.of("t");
  private static final TokenDigest SECOND = TokenDigest.of("second");
  private static final TokenDigest PRESENTED = TokenDigest.of("presented");
  private static final CredentialRecord RECORD =
      new CredentialRecord(FINGERPRINT, Set.of(KEPT), null, null);
  private static final CredentialRecord TWO_TOKENS =
      new CredentialRecord(SourceFingerprint.of("b"), Set.of(KEPT, SECOND), null, null);

  private static VerifiedCredentials entryAt(long stamp) {
    return read(RECORD, stamp, new ReadOrder(1, 2), Set.of());
  }

  private static VerifiedCredentials read(
      CredentialRecord record, long stamp, ReadOrder order, Set<TokenDigest> presentedBefore) {
    return new VerifiedCredentials(new FullRead(record, stamp, order, presentedBefore));
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
  void unconfirmedAtKeepsTheRecordAndTheFullReadStampUnderTheDeepReadStamp() {
    VerifiedCredentials entry = entryAt(100L);
    entry.confirm(FINGERPRINT, 200L);

    VerifiedCredentials unconfirmed = entry.unconfirmedAt(300L);

    assertFalse(unconfirmed.isConfirmed());
    assertTrue(entry.isConfirmed());
    assertSame(RECORD, unconfirmed.record());
    assertEquals(300L, unconfirmed.verifiedAtNanos());
    assertEquals(100L, unconfirmed.fullReadAtNanos());
  }

  @Test
  void aDeepReadAtTheInstantOfTheLastReconfirmationStillUnconfirms() {
    VerifiedCredentials entry = entryAt(100L);
    entry.confirm(FINGERPRINT, 300L);

    VerifiedCredentials unconfirmed = entry.unconfirmedAt(300L);

    assertFalse(unconfirmed.isConfirmed());
    assertEquals(300L, unconfirmed.verifiedAtNanos());
  }

  @Test
  void unconfirmedAtLeavesAnEntryALaterReadProduced() {
    VerifiedCredentials later = entryAt(400L);

    assertSame(later, later.unconfirmedAt(300L));
    assertTrue(later.isConfirmed());
  }

  @Test
  void anUnconfirmedEntryComparesItsFingerprintButNeverMovesItsStamp() {
    VerifiedCredentials unconfirmed = entryAt(100L).unconfirmedAt(300L);

    assertTrue(unconfirmed.confirm(FINGERPRINT, 500L));
    assertFalse(unconfirmed.confirm(SourceFingerprint.of("b"), 500L));
    assertEquals(300L, unconfirmed.verifiedAtNanos());
    assertFalse(unconfirmed.isConfirmed());
  }

  @Test
  void newerKeepsAnUnconfirmedEntryOverAnOlderReadAndYieldsToALaterOne() {
    VerifiedCredentials unconfirmed = entryAt(100L).unconfirmedAt(300L);
    VerifiedCredentials older = entryAt(200L);
    VerifiedCredentials later = entryAt(400L);

    assertSame(unconfirmed, VerifiedCredentials.newer(unconfirmed, older));
    assertSame(later, VerifiedCredentials.newer(unconfirmed, later));
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
  void aReadShowsWithdrawnTheTokenOfTheCheckThatStartedItWhenItLacksIt() {
    VerifiedCredentials lacking = read(RECORD, 100L, new ReadOrder(1, 2), Set.of(PRESENTED));
    VerifiedCredentials holding = read(RECORD, 100L, new ReadOrder(1, 2), Set.of(KEPT));

    assertEquals(Standing.WITHDRAWN, lacking.standingOf(PRESENTED));
    assertEquals(Standing.UNKNOWN, lacking.standingOf(SECOND));
    assertEquals(Standing.HELD, holding.standingOf(KEPT));
    assertEquals(Standing.UNKNOWN, entryAt(100L).standingOf(PRESENTED));
  }

  @Test
  void aReadBegunAfterAnotherFinishedShowsWithdrawnWhatTheEarlierHeldAndItLacks() {
    VerifiedCredentials earlier = read(TWO_TOKENS, 100L, new ReadOrder(1, 2), Set.of());
    VerifiedCredentials later = read(RECORD, 200L, new ReadOrder(3, 4), Set.of());

    for (VerifiedCredentials kept :
        List.of(
            VerifiedCredentials.newer(earlier, later), VerifiedCredentials.newer(later, earlier))) {
      assertSame(RECORD, kept.record());
      assertEquals(Standing.WITHDRAWN, kept.standingOf(SECOND));
      assertEquals(Standing.HELD, kept.standingOf(KEPT));
      assertEquals(200L, kept.verifiedAtNanos());
    }
  }

  /**
   * The earlier-stamped read ran longer and may have seen a commit the other did not, so a digest
   * only it holds proves nothing either way.
   */
  @Test
  void aReadThatOverlapsAnotherShowsNothingWithdrawnOfWhatTheOtherHeld() {
    VerifiedCredentials slow = read(TWO_TOKENS, 100L, new ReadOrder(1, 4), Set.of());
    VerifiedCredentials quick = read(RECORD, 200L, new ReadOrder(2, 3), Set.of());

    VerifiedCredentials kept = VerifiedCredentials.newer(slow, quick);

    assertSame(quick, kept);
    assertEquals(Standing.UNKNOWN, kept.standingOf(SECOND));
  }

  /**
   * The token was presented before the slow read began, so it had committed before the quick read
   * began too, however long the slow read ran.
   */
  @Test
  void aReadBegunAfterAnotherBeganShowsWithdrawnWhatWasPresentedBeforeTheOtherAndItLacks() {
    VerifiedCredentials slow = read(TWO_TOKENS, 100L, new ReadOrder(1, 4), Set.of(SECOND));
    VerifiedCredentials quick = read(RECORD, 200L, new ReadOrder(2, 3), Set.of());

    for (VerifiedCredentials kept :
        List.of(VerifiedCredentials.newer(slow, quick), VerifiedCredentials.newer(quick, slow))) {
      assertSame(RECORD, kept.record());
      assertEquals(Standing.WITHDRAWN, kept.standingOf(SECOND));
    }
  }

  /** The earlier read may have begun before the token committed, so lacking it proves nothing. */
  @Test
  void aTokenPresentedBeforeALaterReadShowsNothingWithdrawnInAnEarlierOne() {
    VerifiedCredentials early = read(RECORD, 200L, new ReadOrder(1, 4), Set.of());
    VerifiedCredentials presenting = read(TWO_TOKENS, 100L, new ReadOrder(2, 3), Set.of(SECOND));

    VerifiedCredentials kept = VerifiedCredentials.newer(presenting, early);

    assertSame(early, kept);
    assertEquals(Standing.UNKNOWN, kept.standingOf(SECOND));
  }

  @Test
  void theKeptEntryCarriesWhatTheOtherShowsWithdrawnLessWhatItsRecordHolds() {
    VerifiedCredentials earlier = read(RECORD, 100L, new ReadOrder(1, 4), Set.of(PRESENTED));
    VerifiedCredentials stillLacking = read(RECORD, 200L, new ReadOrder(2, 3), Set.of());
    CredentialRecord holdingItAgain =
        new CredentialRecord(SourceFingerprint.of("c"), Set.of(KEPT, PRESENTED), null, null);
    VerifiedCredentials holding = read(holdingItAgain, 200L, new ReadOrder(2, 3), Set.of());

    assertEquals(
        Standing.WITHDRAWN, VerifiedCredentials.newer(earlier, stillLacking).standingOf(PRESENTED));
    assertEquals(Standing.HELD, VerifiedCredentials.newer(earlier, holding).standingOf(PRESENTED));
  }

  @Test
  void aDigestTheKeptRecordHoldsIsNeverShownWithdrawn() {
    VerifiedCredentials reconfirmed = read(TWO_TOKENS, 100L, new ReadOrder(1, 2), Set.of());
    reconfirmed.confirm(TWO_TOKENS.fingerprint(), 300L);
    VerifiedCredentials later = read(RECORD, 200L, new ReadOrder(3, 4), Set.of());

    VerifiedCredentials kept = VerifiedCredentials.newer(reconfirmed, later);

    assertSame(reconfirmed, kept);
    assertEquals(Standing.HELD, kept.standingOf(SECOND));
  }

  @Test
  void anEntryKeepsAtMostTheCapOfWithdrawnDigests() {
    Set<TokenDigest> many =
        IntStream.range(0, 20)
            .mapToObj(i -> TokenDigest.of("pat-" + i))
            .collect(Collectors.toSet());
    CredentialRecord all = new CredentialRecord(SourceFingerprint.of("all"), many, null, null);
    VerifiedCredentials earlier = read(all, 100L, new ReadOrder(1, 2), Set.of());
    VerifiedCredentials emptied =
        read(CredentialRecord.ABSENT, 200L, new ReadOrder(3, 4), Set.of());

    VerifiedCredentials kept = VerifiedCredentials.newer(earlier, emptied);

    long withdrawn =
        many.stream().filter(digest -> kept.standingOf(digest) == Standing.WITHDRAWN).count();
    assertEquals(VerifiedCredentials.MAX_WITHDRAWN, withdrawn);
  }

  @Test
  void anUnconfirmedEntryKeepsItsWithdrawnDigests() {
    VerifiedCredentials entry = read(RECORD, 100L, new ReadOrder(1, 2), Set.of(PRESENTED));

    assertEquals(Standing.WITHDRAWN, entry.unconfirmedAt(300L).standingOf(PRESENTED));
  }

  @Test
  void recordHoldsOnlyItsDigestsAndAbsentHoldsNone() {
    assertEquals(true, RECORD.holds(TokenDigest.of("t")));
    assertEquals(false, RECORD.holds(TokenDigest.of("other")));
    assertEquals(false, CredentialRecord.ABSENT.holds(TokenDigest.of("t")));
  }
}
