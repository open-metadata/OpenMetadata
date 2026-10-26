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

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Ticker;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * The subjects whose latest read produced no record, each with the stamp of that read. Until a
 * window after the stamp has passed, a check that needs a read of the subject answers "cannot
 * confirm" without one, so a subject that keeps failing costs about one read per window however
 * often it is checked. The stamp is taken before the read's statement, so with missRefreshMinAge
 * as the window, a write at T that makes the subject readable is read by the first check at or
 * after T + missRefreshMinAge. A read that produces a record ends the window. Stamps are compared
 * by difference.
 */
final class ReadBackoff {
  private final Cache<CredentialSubject, Long> failedReadStamps;
  private final long windowNanos;

  ReadBackoff(Ticker ticker, long windowNanos, int maxSubjects) {
    this.windowNanos = windowNanos;
    this.failedReadStamps =
        Caffeine.newBuilder()
            .ticker(ticker)
            .maximumSize(maxSubjects)
            .expireAfterWrite(Duration.ofNanos(windowNanos))
            .build();
  }

  boolean isBackingOff(CredentialSubject subject, long nowNanos) {
    Long failedAtNanos = failedReadStamps.getIfPresent(subject);
    return failedAtNanos != null && nowNanos - failedAtNanos < windowNanos;
  }

  /**
   * Keeps the later of the two stamps. Returns true when no window was open at {@code stampNanos},
   * so the caller can report a failing subject once per window rather than once per read.
   */
  boolean recordFailure(CredentialSubject subject, long stampNanos) {
    AtomicBoolean opensWindow = new AtomicBoolean();
    failedReadStamps
        .asMap()
        .compute(
            subject,
            (key, failedAtNanos) -> {
              opensWindow.set(failedAtNanos == null || stampNanos - failedAtNanos >= windowNanos);
              return failedAtNanos == null || stampNanos - failedAtNanos > 0
                  ? stampNanos
                  : failedAtNanos;
            });
    return opensWindow.get();
  }

  /** Ends the window of a failure stamped no later than this read, which produced a record. */
  void recordSuccess(CredentialSubject subject, long stampNanos) {
    failedReadStamps
        .asMap()
        .computeIfPresent(
            subject, (key, failedAtNanos) -> failedAtNanos - stampNanos > 0 ? failedAtNanos : null);
  }
}
