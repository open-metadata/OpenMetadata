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

/**
 * One cache entry: a {@link CredentialRecord} plus the moment, on this server's monotonic clock,
 * at which the read that produced (or re-confirmed) it was about to be issued.
 *
 * <p><b>Invariant:</b> an entry reflects every commit that completed before
 * {@code verifiedAtNanos}. It holds because the stamp is taken before the SQL is sent and each read
 * is a single autocommit statement, so its snapshot starts after the stamp. The hot path trusts an
 * entry only while {@code now - verifiedAtNanos <= maxStaleness}; that is the revocation bound.
 *
 * <p>The stamp travels with the value, so a slow load that finishes after a newer read cannot
 * extend trust: it carries its own older stamp and {@link #newer} keeps the later read.
 */
record VerifiedCredentials(CredentialRecord record, long verifiedAtNanos) {

  long ageNanos(long nowNanos) {
    return nowNanos - verifiedAtNanos;
  }

  /**
   * The sweep found the stored inputs unchanged at a read stamped {@code stampNanos}: the same
   * record now reflects every commit before that later stamp. Any other fingerprint or an older
   * stamp leaves the entry as it is.
   */
  VerifiedCredentials reconfirmedAt(SourceFingerprint fingerprint, long stampNanos) {
    boolean unchanged = fingerprint.equals(record.fingerprint());
    return unchanged && isLater(stampNanos, verifiedAtNanos)
        ? new VerifiedCredentials(record, stampNanos)
        : this;
  }

  /**
   * Merge function for {@code asMap().merge/compute}: pure, no I/O. Keeps the read with the later
   * stamp; on a tie the existing entry stays.
   */
  static VerifiedCredentials newer(VerifiedCredentials existing, VerifiedCredentials candidate) {
    return isLater(candidate.verifiedAtNanos, existing.verifiedAtNanos) ? candidate : existing;
  }

  /**
   * Stamps follow the {@link System#nanoTime} contract: only differences are meaningful, so a
   * reading that wrapped past {@code Long.MAX_VALUE} is still later than one taken just before.
   */
  private static boolean isLater(long stampNanos, long thanNanos) {
    return stampNanos - thanNanos > 0;
  }
}
