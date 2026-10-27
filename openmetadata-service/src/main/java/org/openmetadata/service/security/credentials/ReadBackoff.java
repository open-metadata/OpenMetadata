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
 * The subjects whose latest check read produced no record, each with the stamp of that read. Until
 * a window after the stamp has passed, a check that needs a read of the subject answers "cannot
 * confirm" without one, so a subject that keeps failing costs about one read per window however
 * often it is checked. Only reads a check started open a window: a sweep, deep, refresh or nudge
 * read covers a batch or runs for a writer, so its failure says nothing about a check's own read of
 * one subject. The stamp is taken before the read's statement, so with missRefreshMinAge as the
 * window, a write at T that makes the subject readable is read by the first check at or after T +
 * missRefreshMinAge. A read that produces a record ends the window. Stamps are compared by
 * difference.
 *
 * <p>A second, independent window per subject paces the warning about a subject the source left
 * out, whichever read found it. That window runs from the warning that started it, so a subject
 * that keeps failing is reported once per warning interval, however often it is read.
 */
final class ReadBackoff {
  private final Windows blocking;
  private final Windows warnings;

  ReadBackoff(Ticker ticker, long windowNanos, long warningIntervalNanos, int maxSubjects) {
    this.blocking = new Windows(ticker, windowNanos, maxSubjects);
    this.warnings = new Windows(ticker, warningIntervalNanos, maxSubjects);
  }

  boolean isBackingOff(CredentialSubject subject, long nowNanos) {
    return blocking.isOpen(subject, nowNanos);
  }

  /** A check's read of {@code subject} threw or got no slot. */
  void recordCheckFailure(CredentialSubject subject, long stampNanos) {
    blocking.record(subject, stampNanos);
  }

  /**
   * The source left {@code subject} out of a read. Returns true when no warning window was open at
   * {@code stampNanos}, and starts one, so the caller reports a failing subject once per warning
   * interval rather than once per read.
   */
  boolean recordLeftOut(CredentialSubject subject, long stampNanos, boolean fromCheck) {
    if (fromCheck) {
      blocking.record(subject, stampNanos);
    }
    return warnings.startUnlessOpen(subject, stampNanos);
  }

  /** Ends the windows of a failure stamped no later than this read, which produced a record. */
  void recordSuccess(CredentialSubject subject, long stampNanos) {
    blocking.endIfNotNewer(subject, stampNanos);
    warnings.endIfNotNewer(subject, stampNanos);
  }

  /** Per subject, the stamp a window runs from, kept for at most one window. */
  private static final class Windows {
    private final Cache<CredentialSubject, Long> stamps;
    private final long windowNanos;

    private Windows(Ticker ticker, long windowNanos, int maxSubjects) {
      this.windowNanos = windowNanos;
      this.stamps =
          Caffeine.newBuilder()
              .ticker(ticker)
              .maximumSize(maxSubjects)
              .expireAfterWrite(Duration.ofNanos(windowNanos))
              .build();
    }

    private boolean isOpen(CredentialSubject subject, long nowNanos) {
      Long failedAtNanos = stamps.getIfPresent(subject);
      return failedAtNanos != null && nowNanos - failedAtNanos < windowNanos;
    }

    /** Keeps the later of the two stamps; true when no window was open at {@code stampNanos}. */
    private boolean record(CredentialSubject subject, long stampNanos) {
      AtomicBoolean opensWindow = new AtomicBoolean();
      stamps
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

    /** Starts a window at {@code stampNanos} unless one is open there; true when it starts one. */
    private boolean startUnlessOpen(CredentialSubject subject, long stampNanos) {
      AtomicBoolean startsWindow = new AtomicBoolean();
      stamps
          .asMap()
          .compute(
              subject,
              (key, startedAtNanos) -> {
                startsWindow.set(
                    startedAtNanos == null || stampNanos - startedAtNanos >= windowNanos);
                return startsWindow.get() ? stampNanos : startedAtNanos;
              });
      return startsWindow.get();
    }

    private void endIfNotNewer(CredentialSubject subject, long stampNanos) {
      stamps
          .asMap()
          .computeIfPresent(
              subject,
              (key, failedAtNanos) -> failedAtNanos - stampNanos > 0 ? failedAtNanos : null);
    }
  }
}
