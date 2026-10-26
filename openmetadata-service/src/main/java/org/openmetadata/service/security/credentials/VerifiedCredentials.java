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

import java.lang.invoke.MethodHandles;
import java.lang.invoke.VarHandle;

/**
 * One cache entry: a {@link CredentialRecord} plus two moments on this server's monotonic clock.
 * {@code verifiedAtNanos} is the trust stamp, the instant at which the read that produced or last
 * re-confirmed the record was about to be issued. {@code fullReadAtNanos} is the instant the full
 * read that produced the record was about to be issued; a reconfirmation leaves it where it is.
 *
 * <p><b>Invariant:</b> an entry reflects every commit that completed before
 * {@code verifiedAtNanos}. It holds because the stamp is taken before the SQL is sent and each read
 * is a single autocommit statement, so its snapshot starts after the stamp. The hot path trusts an
 * entry only while {@code now - verifiedAtNanos <= maxStaleness}; that is the revocation bound.
 *
 * <p>A token the entry lacks may have been created on a peer after the full read, so the window in
 * which such a token is answered without a read is measured from {@code fullReadAtNanos}: a
 * reconfirmation proves the record current but reads nothing new.
 *
 * <p>The trust stamp moves forward in place, never backwards, so a reconfirmation is not a cache
 * write and leaves the cache's frequency, recency and idle expiry to requests alone. The stamps
 * travel with the value, so a slow load that finishes after a newer read cannot extend trust: it
 * carries its own older stamp and {@link #newer} keeps the later read.
 */
final class VerifiedCredentials {
  private static final VarHandle VERIFIED_AT;

  static {
    try {
      VERIFIED_AT =
          MethodHandles.lookup()
              .findVarHandle(VerifiedCredentials.class, "verifiedAtNanos", long.class);
    } catch (ReflectiveOperationException impossible) {
      throw new ExceptionInInitializerError(impossible);
    }
  }

  private final CredentialRecord record;
  private final long fullReadAtNanos;
  private volatile long verifiedAtNanos;

  /** The entry a full read produces: both stamps are the read's own. */
  VerifiedCredentials(CredentialRecord record, long readStampNanos) {
    this(record, readStampNanos, readStampNanos);
  }

  VerifiedCredentials(CredentialRecord record, long verifiedAtNanos, long fullReadAtNanos) {
    this.record = record;
    this.verifiedAtNanos = verifiedAtNanos;
    this.fullReadAtNanos = fullReadAtNanos;
  }

  CredentialRecord record() {
    return record;
  }

  long verifiedAtNanos() {
    return verifiedAtNanos;
  }

  long fullReadAtNanos() {
    return fullReadAtNanos;
  }

  long ageNanos(long nowNanos) {
    return nowNanos - verifiedAtNanos;
  }

  long fullReadAgeNanos(long nowNanos) {
    return nowNanos - fullReadAtNanos;
  }

  /**
   * The sweep found the stored inputs at a read stamped {@code stampNanos}. When they are this
   * record's own, the record reflects every commit before that later stamp and the trust stamp
   * moves to it, unless it is already later. Returns whether the fingerprint matched; a mismatch
   * means the record is out of date and the caller re-reads it.
   */
  boolean confirm(SourceFingerprint fingerprint, long stampNanos) {
    boolean unchanged = fingerprint.equals(record.fingerprint());
    if (unchanged) {
      advanceTrustTo(stampNanos);
    }
    return unchanged;
  }

  /**
   * Merge function for {@code asMap().merge/compute}: pure, no I/O. Keeps the read with the later
   * trust stamp; on a tie the existing entry stays.
   */
  static VerifiedCredentials newer(VerifiedCredentials existing, VerifiedCredentials candidate) {
    return isLater(candidate.verifiedAtNanos, existing.verifiedAtNanos) ? candidate : existing;
  }

  private void advanceTrustTo(long stampNanos) {
    long current = verifiedAtNanos;
    while (isLater(stampNanos, current) && !VERIFIED_AT.compareAndSet(this, current, stampNanos)) {
      current = verifiedAtNanos;
    }
  }

  /**
   * Stamps follow the {@link System#nanoTime} contract: only differences are meaningful, so a
   * reading that wrapped past {@code Long.MAX_VALUE} is still later than one taken just before.
   */
  private static boolean isLater(long stampNanos, long thanNanos) {
    return stampNanos - thanNanos > 0;
  }
}
