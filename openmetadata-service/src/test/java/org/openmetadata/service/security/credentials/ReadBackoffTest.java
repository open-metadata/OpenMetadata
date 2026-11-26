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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/** Reads that finish out of order, which the verifier tests cannot stage deterministically. */
class ReadBackoffTest {
  private static final long WINDOW = 500;
  private static final long WARNING_INTERVAL = 60_000;
  private static final CredentialSubject ALICE = CredentialSubject.of("alice");

  private final ReadBackoff backoff =
      new ReadBackoff(new FakeTicker(), WINDOW, WARNING_INTERVAL, 10);

  @Test
  void aFailureBacksItsSubjectOffForOneWindowFromItsStamp() {
    backoff.recordCheckFailure(ALICE, 100);

    assertTrue(backoff.isBackingOff(ALICE, 599));
    assertFalse(backoff.isBackingOff(ALICE, 600));
    assertFalse(backoff.isBackingOff(CredentialSubject.of("bob"), 100));
  }

  @Test
  void aFailureFinishingAfterANewerOneKeepsTheNewerWindow() {
    backoff.recordCheckFailure(ALICE, 300);

    backoff.recordCheckFailure(ALICE, 100);
    assertTrue(backoff.isBackingOff(ALICE, 799));
  }

  @Test
  void aCheckFailureBacksOffFromTheLatestFailure() {
    backoff.recordLeftOut(ALICE, 0, true);
    backoff.recordLeftOut(ALICE, 400, true);

    assertTrue(backoff.isBackingOff(ALICE, 899));
    assertFalse(backoff.isBackingOff(ALICE, 900));
  }

  @Test
  void aSubjectLeftOutAtEveryBackoffWindowIsWarnedAboutOncePerWarningInterval() {
    assertTrue(backoff.recordLeftOut(ALICE, 0, true));
    for (long stamp = WINDOW; stamp < WARNING_INTERVAL; stamp += WINDOW) {
      assertFalse(backoff.recordLeftOut(ALICE, stamp, true), "left out again at " + stamp);
    }
    assertTrue(backoff.recordLeftOut(ALICE, WARNING_INTERVAL, true));
    assertFalse(backoff.recordLeftOut(ALICE, WARNING_INTERVAL + WINDOW, true));
  }

  @Test
  void aSubjectLeftOutByAReadNoCheckStartedPacesWarningsButNeverBacksChecksOff() {
    assertTrue(backoff.recordLeftOut(ALICE, 100, false));
    assertFalse(backoff.recordLeftOut(ALICE, 200, false));

    assertFalse(backoff.isBackingOff(ALICE, 300));
    assertTrue(backoff.recordLeftOut(ALICE, WARNING_INTERVAL + 100, false));
  }

  @Test
  void aWarningStampedBeforeTheOpenWindowFinishingLaterDoesNotMoveItsStart() {
    assertTrue(backoff.recordLeftOut(ALICE, 1_000, false));
    assertFalse(backoff.recordLeftOut(ALICE, 0, false));
    assertFalse(backoff.recordLeftOut(ALICE, WARNING_INTERVAL + 999, false));
    assertTrue(backoff.recordLeftOut(ALICE, WARNING_INTERVAL + 1_000, false));
  }

  @Test
  void aWarningWindowOpenedJustBeforeTheWrapLastsTheWholeInterval() {
    long nearWrap = Long.MAX_VALUE - 100;
    assertTrue(backoff.recordLeftOut(ALICE, nearWrap, false));
    assertFalse(backoff.recordLeftOut(ALICE, nearWrap + 1, false));
    assertFalse(backoff.recordLeftOut(ALICE, nearWrap + WARNING_INTERVAL - 1, false));
    assertTrue(backoff.recordLeftOut(ALICE, nearWrap + WARNING_INTERVAL, false));
  }

  @Test
  void aSuccessEndsTheWarningWindowSoTheNextFailureIsReported() {
    assertTrue(backoff.recordLeftOut(ALICE, 100, false));

    backoff.recordSuccess(ALICE, 200);

    assertTrue(backoff.recordLeftOut(ALICE, 300, false));
  }

  @Test
  void aSuccessEndsOnlyAWindowThatStartedNoLaterThanItsStamp() {
    backoff.recordCheckFailure(ALICE, 300);

    backoff.recordSuccess(ALICE, 299);
    assertTrue(backoff.isBackingOff(ALICE, 400));
    backoff.recordSuccess(ALICE, 300);
    assertFalse(backoff.isBackingOff(ALICE, 400));
  }

  @Test
  void stampsCompareByDifferenceAcrossTheTickerWrap() {
    long nearWrap = Long.MAX_VALUE - 100;
    backoff.recordCheckFailure(ALICE, nearWrap);

    assertTrue(backoff.isBackingOff(ALICE, nearWrap + WINDOW - 1));
    assertFalse(backoff.isBackingOff(ALICE, nearWrap + WINDOW));
  }

  @Test
  void aWindowOpenedJustBeforeTheWrapStillHoldsAtTheFirstStampAfterIt() {
    long nearWrap = Long.MAX_VALUE - 100;
    backoff.recordCheckFailure(ALICE, nearWrap);

    assertTrue(backoff.isBackingOff(ALICE, nearWrap + 1));
  }

  @Test
  void ofTwoFailuresAcrossTheWrapTheLaterStampWins() {
    long nearWrap = Long.MAX_VALUE - 100;
    backoff.recordCheckFailure(ALICE, nearWrap);

    backoff.recordCheckFailure(ALICE, nearWrap + 300);

    assertTrue(backoff.isBackingOff(ALICE, nearWrap + 799));
    assertFalse(backoff.isBackingOff(ALICE, nearWrap + 800));
  }
}
