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

import org.openmetadata.service.security.credentials.VerifiedCredentials.Standing;

/**
 * The hot-path policy as a pure function of (entry, now, digest, policy): no clock, no I/O, no
 * cache access. {@link CredentialVerifier} gathers the inputs and acts on the answer. Staleness is
 * the age of the trust stamp, which reconfirmations move; the unknown-token window is the age of
 * the last full read, which only a full read moves.
 *
 * <pre>
 * entry == null                     -> LOAD_MISSING
 * unconfirmed                       -> LOAD_STALE
 * age > maxStaleness                -> LOAD_STALE
 * entry holds digest                -> ACCEPT
 * fullReadAge >= missRefreshMinAge  -> LOAD_UNKNOWN_TOKEN
 * entry shows digest withdrawn      -> REJECT
 * otherwise                         -> DEFER
 * </pre>
 */
enum CheckDecision {
  ACCEPT,
  REJECT,
  /**
   * A fresh entry lacks the digest without showing it withdrawn, and its last full read is younger
   * than missRefreshMinAge: the token may have been created after that read began, and reading
   * again this soon would let retries become database load. The verifier answers "cannot confirm"
   * without a read, and a retry after the window reads.
   */
  DEFER,
  /** No entry for the subject: first use on this server, evicted, or idle-expired. */
  LOAD_MISSING,
  /**
   * The entry is older than maxStaleness, so trusting it would break the bound, or a deep read
   * could not convert its subject, so nothing confirms it.
   */
  LOAD_STALE,
  /**
   * A fresh entry lacks the digest and its last full read is at least missRefreshMinAge old: the
   * token may have been created on a peer after this server last read the subject. These reloads
   * come at most about once per missRefreshMinAge per subject, so retries of a revoked token
   * cannot become database load: a reload that produces a record moves the last full read, and
   * one that produces none, because the read failed or left the subject out, starts a backoff of
   * the same length in the verifier.
   */
  LOAD_UNKNOWN_TOKEN;

  record Policy(long maxStalenessNanos, long missRefreshMinAgeNanos) {
    Policy {
      if (missRefreshMinAgeNanos <= 0 || maxStalenessNanos <= missRefreshMinAgeNanos) {
        throw new IllegalArgumentException("need 0 < missRefreshMinAge < maxStaleness");
      }
    }
  }

  boolean needsLoad() {
    return switch (this) {
      case LOAD_MISSING, LOAD_STALE, LOAD_UNKNOWN_TOKEN -> true;
      case ACCEPT, REJECT, DEFER -> false;
    };
  }

  static CheckDecision decide(
      VerifiedCredentials entry, long nowNanos, TokenDigest digest, Policy policy) {
    CheckDecision decision;
    if (entry == null) {
      decision = LOAD_MISSING;
    } else if (!entry.isConfirmed()) {
      decision = LOAD_STALE;
    } else {
      decision =
          decideOn(
              entry.ageNanos(nowNanos),
              entry.fullReadAgeNanos(nowNanos),
              entry.standingOf(digest),
              policy);
    }
    return decision;
  }

  /**
   * After one load: ACCEPT, REJECT or DEFER when the loaded entry is within maxStaleness, so one
   * request does at most one read. A load that completes outside the bound confirms nothing and
   * answers LOAD_STALE, which the verifier reports as "cannot confirm", never as "revoked". A load
   * that lacks the digest rejects it only when the entry shows it withdrawn, which a check's own
   * read does for the token the check presented; a check that joined another's read may hold a
   * token newer than that read, and defers. {@code loaded} is confirmed: when the entry after the
   * read is one that a newer deep read left unconfirmed, the verifier answers "cannot confirm"
   * before this.
   */
  static CheckDecision decideAfterLoad(
      VerifiedCredentials loaded, long nowNanos, TokenDigest digest, Policy policy) {
    return loaded.ageNanos(nowNanos) > policy.maxStalenessNanos()
        ? LOAD_STALE
        : answerFor(loaded.standingOf(digest));
  }

  private static CheckDecision decideOn(
      long ageNanos, long fullReadAgeNanos, Standing standing, Policy policy) {
    CheckDecision decision;
    if (ageNanos > policy.maxStalenessNanos()) {
      decision = LOAD_STALE;
    } else if (standing != Standing.HELD && fullReadAgeNanos >= policy.missRefreshMinAgeNanos()) {
      decision = LOAD_UNKNOWN_TOKEN;
    } else {
      decision = answerFor(standing);
    }
    return decision;
  }

  private static CheckDecision answerFor(Standing standing) {
    return switch (standing) {
      case HELD -> ACCEPT;
      case WITHDRAWN -> REJECT;
      case UNKNOWN -> DEFER;
    };
  }
}
