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

import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Sets;
import java.lang.invoke.MethodHandles;
import java.lang.invoke.VarHandle;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * One cache entry: a {@link CredentialRecord} plus two moments on this server's monotonic clock.
 * {@code verifiedAtNanos} is the trust stamp, the instant at which the read that produced or last
 * re-confirmed the record was about to be issued. {@code fullReadAtNanos} is the instant the full
 * read that produced the record was about to be issued; a reconfirmation leaves it where it is.
 *
 * <p><b>Invariant:</b> a confirmed entry reflects every commit that completed before
 * {@code verifiedAtNanos}. It holds because the stamp is taken before the SQL is sent and each read
 * is a single autocommit statement, so its snapshot starts after the stamp. The hot path trusts an
 * entry only while it is confirmed and {@code now - verifiedAtNanos <= maxStaleness}; that is the
 * revocation bound.
 *
 * <p>A token the entry lacks may have been created on a peer after the full read, so the window in
 * which such a token is answered without a read is measured from {@code fullReadAtNanos}: a
 * reconfirmation proves the record current but reads nothing new. Inside that window the entry
 * rejects only a token it shows withdrawn: one that a read lacked although a check had presented
 * it before that read began, or one that a read held and a read begun after that one finished
 * lacked. A client is handed a token only after its commit, so in the first case the read began
 * after the commit too, and in the second the token went away between the reads. A record that
 * holds the token again outranks both. A stamp cannot order two reads, since it only bounds a
 * snapshot from below; a {@link ReadOrder} can.
 *
 * <p>The trust stamp moves forward in place, never backwards, so a reconfirmation is not a cache
 * write and leaves the cache's frequency, recency and idle expiry to requests alone. The stamps
 * travel with the value, so a slow load that finishes after a newer read cannot extend trust: it
 * carries its own older stamp and {@link #newer} keeps the later read.
 *
 * <p>An entry is unconfirmed once a deep read could not convert its subject. It keeps its record,
 * so the install that replaces it still reports the digests that went away, and its trust stamp is
 * the deep read's, which no reconfirmation moves. So {@link #newer} keeps it over a read stamped
 * before the deep read and gives it up to a read stamped after it.
 */
final class VerifiedCredentials {
  /**
   * Withdrawn digests one entry keeps, newest first. The oldest past the cap is forgotten, so
   * inside the window it answers "cannot confirm" instead of "not current" until a read shows it
   * withdrawn again.
   */
  static final int MAX_WITHDRAWN = 8;

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

  /** What an entry says about a token's digest. */
  enum Standing {
    HELD,
    WITHDRAWN,
    UNKNOWN
  }

  /**
   * Where a full read falls among this verifier's reads: a counter taken just before its statement
   * and again just after it returned. A read that started after another finished saw a later
   * snapshot.
   */
  record ReadOrder(long started, long finished) {
    boolean startedAfter(long counter) {
      return started > counter;
    }
  }

  /**
   * What one full read found, the stamp it was issued under, its place among the reads, and the
   * tokens a check presented before it began: the token of the check that started it, if one did.
   */
  record FullRead(
      CredentialRecord record,
      long stampNanos,
      ReadOrder order,
      Set<TokenDigest> presentedBefore) {}

  private final FullRead read;
  private final Set<TokenDigest> withdrawn;
  private final boolean confirmed;
  private volatile long verifiedAtNanos;

  /**
   * The entry a full read produces: both stamps are the read's own, and a token presented before
   * the read began that the read lacks is withdrawn.
   */
  VerifiedCredentials(FullRead read) {
    this(
        read,
        read.stampNanos(),
        ImmutableSet.copyOf(Sets.difference(read.presentedBefore(), read.record().digests())));
  }

  private VerifiedCredentials(FullRead read, long verifiedAtNanos, Set<TokenDigest> withdrawn) {
    this(read, verifiedAtNanos, withdrawn, true);
  }

  private VerifiedCredentials(
      FullRead read, long verifiedAtNanos, Set<TokenDigest> withdrawn, boolean confirmed) {
    this.read = read;
    this.verifiedAtNanos = verifiedAtNanos;
    this.withdrawn = withdrawn;
    this.confirmed = confirmed;
  }

  CredentialRecord record() {
    return read.record();
  }

  Standing standingOf(TokenDigest digest) {
    Standing standing;
    if (read.record().holds(digest)) {
      standing = Standing.HELD;
    } else {
      standing = withdrawn.contains(digest) ? Standing.WITHDRAWN : Standing.UNKNOWN;
    }
    return standing;
  }

  /** False for the entry a deep read leaves when it cannot convert the subject. */
  boolean isConfirmed() {
    return confirmed;
  }

  /**
   * This entry as a deep read stamped {@code stampNanos} leaves it when it cannot convert the
   * subject: the same record, full read and withdrawn digests, unconfirmed, with the read's stamp
   * as its trust stamp. An entry trusted from a later stamp is newer than that read and is returned
   * as is.
   */
  VerifiedCredentials unconfirmedAt(long stampNanos) {
    return isLater(verifiedAtNanos, stampNanos)
        ? this
        : new VerifiedCredentials(read, stampNanos, withdrawn, false);
  }

  long verifiedAtNanos() {
    return verifiedAtNanos;
  }

  long fullReadAtNanos() {
    return read.stampNanos();
  }

  long ageNanos(long nowNanos) {
    return nowNanos - verifiedAtNanos;
  }

  long fullReadAgeNanos(long nowNanos) {
    return nowNanos - read.stampNanos();
  }

  /**
   * The sweep found the stored inputs at a read stamped {@code stampNanos}. When they are this
   * record's own, the record reflects every commit before that later stamp and the trust stamp
   * moves to it, unless it is already later. Returns whether the fingerprint matched; a mismatch
   * means the record is out of date and the caller re-reads it. An unconfirmed entry keeps its
   * stamp: a match shows its inputs unchanged, not that they convert, and a later stamp would let it
   * outrank a converting read already in flight.
   */
  boolean confirm(SourceFingerprint fingerprint, long stampNanos) {
    boolean unchanged = fingerprint.equals(read.record().fingerprint());
    if (unchanged && confirmed) {
      advanceTrustTo(stampNanos);
    }
    return unchanged;
  }

  /**
   * Merge function for {@code asMap().merge/compute}: pure, no I/O. Keeps the read with the later
   * trust stamp. On a tie the candidate wins: a confirmation can move the existing entry's stamp to
   * the very instant of a full read, and the full read saw the rows. The kept entry also takes what
   * either entry shows withdrawn, and each token one read shows committed before the other began
   * that the other lacks, less every digest its own record holds. It is copied when that adds a
   * digest; a reconfirmation that lands on the copied entry meanwhile is lost, which leaves the
   * copy older than it could be, never newer.
   */
  static VerifiedCredentials newer(VerifiedCredentials existing, VerifiedCredentials candidate) {
    VerifiedCredentials kept =
        isLater(existing.verifiedAtNanos, candidate.verifiedAtNanos) ? existing : candidate;
    Set<TokenDigest> withdrawn = withdrawnAcross(existing, candidate, kept.record());
    return withdrawn.equals(kept.withdrawn)
        ? kept
        : new VerifiedCredentials(kept.read, kept.verifiedAtNanos, withdrawn, kept.confirmed);
  }

  /**
   * Newest knowledge first, so the cap forgets what was learned earliest: what the candidate's own
   * read shows withdrawn, which decides the check that installs it, then what the two reads show
   * together, then what the existing entry showed, in its own order.
   */
  private static Set<TokenDigest> withdrawnAcross(
      VerifiedCredentials existing, VerifiedCredentials candidate, CredentialRecord kept) {
    Set<TokenDigest> withdrawn = new LinkedHashSet<>(candidate.withdrawn);
    withdrawn.addAll(goneBy(existing, candidate));
    withdrawn.addAll(goneBy(candidate, existing));
    withdrawn.addAll(existing.withdrawn);
    withdrawn.removeAll(kept.digests());
    return withdrawn.stream().limit(MAX_WITHDRAWN).collect(ImmutableSet.toImmutableSet());
  }

  /**
   * The tokens {@code earlier} shows committed before {@code later} began, less those {@code
   * later} holds. A token presented before the earlier read began counts once the later began after
   * it; a token the earlier read held counts once the later began after it finished.
   */
  private static Set<TokenDigest> goneBy(VerifiedCredentials earlier, VerifiedCredentials later) {
    ReadOrder before = earlier.read.order();
    ReadOrder after = later.read.order();
    Set<TokenDigest> committed = Set.of();
    if (after.startedAfter(before.finished())) {
      committed = Sets.union(earlier.record().digests(), earlier.read.presentedBefore());
    } else if (after.startedAfter(before.started())) {
      committed = earlier.read.presentedBefore();
    }
    return Sets.difference(committed, later.record().digests());
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
