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
  private static final CredentialSubject ALICE = CredentialSubject.of("alice");

  private final ReadBackoff backoff = new ReadBackoff(new FakeTicker(), WINDOW, 10);

  @Test
  void aFailureBacksItsSubjectOffForOneWindowFromItsStamp() {
    assertTrue(backoff.recordFailure(ALICE, 100));

    assertTrue(backoff.isBackingOff(ALICE, 599));
    assertFalse(backoff.isBackingOff(ALICE, 600));
    assertFalse(backoff.isBackingOff(CredentialSubject.of("bob"), 100));
  }

  @Test
  void aFailureFinishingAfterANewerOneKeepsTheNewerWindow() {
    backoff.recordFailure(ALICE, 300);

    assertFalse(backoff.recordFailure(ALICE, 100));
    assertTrue(backoff.isBackingOff(ALICE, 799));
  }

  @Test
  void aFailureOpensAWindowOnlyOnceTheLatestOneHasPassed() {
    assertTrue(backoff.recordFailure(ALICE, 0));
    assertFalse(backoff.recordFailure(ALICE, 499));
    assertFalse(backoff.recordFailure(ALICE, 998));
    assertTrue(backoff.recordFailure(ALICE, 1498));
  }

  @Test
  void aSuccessEndsOnlyAWindowThatStartedNoLaterThanItsStamp() {
    backoff.recordFailure(ALICE, 300);

    backoff.recordSuccess(ALICE, 299);
    assertTrue(backoff.isBackingOff(ALICE, 400));
    backoff.recordSuccess(ALICE, 300);
    assertFalse(backoff.isBackingOff(ALICE, 400));
  }

  @Test
  void stampsCompareByDifferenceAcrossTheTickerWrap() {
    long nearWrap = Long.MAX_VALUE - 100;
    backoff.recordFailure(ALICE, nearWrap);

    assertTrue(backoff.isBackingOff(ALICE, nearWrap + WINDOW - 1));
    assertFalse(backoff.isBackingOff(ALICE, nearWrap + WINDOW));
  }
}
