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

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.openmetadata.service.security.credentials.CredentialRecord.MechanismVersion;

/**
 * An in-memory {@link CredentialSource}: one row per principal with the same inputs the real
 * source fingerprints (id, deleted, updatedAt, the stored mechanism, the PAT row ids), an
 * "external secrets manager" behind {@code secret:} references, and the decrypt-reuse rule of the
 * contract. A read snapshots the rows when the statement starts, then blocks if asked, so a test can
 * stage a read that began before a revocation. Counts statements and decrypts.
 */
final class FakeCredentialSource implements CredentialSource {
  private static final String ENCRYPTED = "enc:";
  private static final String SECRET_REFERENCE = "secret:";
  private static final String BASIC = "basic";

  private record Pat(String rowId, String token) {}

  private record Row(
      String id, boolean deleted, long updatedAt, String storedMechanism, List<Pat> pats) {
    boolean hasJwtMechanism() {
      return storedMechanism != null && !BASIC.equals(storedMechanism);
    }

    Row touched(String mechanism) {
      return new Row(id, deleted, updatedAt + 1, mechanism, pats);
    }

    Row withPats(List<Pat> newPats) {
      return new Row(id, deleted, updatedAt, storedMechanism, List.copyOf(newPats));
    }
  }

  private final ConcurrentMap<String, Row> rows = new ConcurrentHashMap<>();
  private final ConcurrentMap<String, String> secrets = new ConcurrentHashMap<>();
  private final ConcurrentMap<String, AtomicInteger> fullReadsBySubject = new ConcurrentHashMap<>();
  private final AtomicInteger fingerprintReads = new AtomicInteger();
  private final AtomicInteger fullReads = new AtomicInteger();
  private final AtomicInteger decrypts = new AtomicInteger();
  private final AtomicInteger patRows = new AtomicInteger();
  private final AtomicBoolean failing = new AtomicBoolean();
  private final AtomicBoolean failNextFingerprints = new AtomicBoolean();
  private final AtomicBoolean blockNext = new AtomicBoolean();
  private final AtomicBoolean errorOnRead = new AtomicBoolean();
  private final Set<String> unconvertible = ConcurrentHashMap.newKeySet();
  private final Set<String> poison = ConcurrentHashMap.newKeySet();
  private volatile CountDownLatch readStarted = new CountDownLatch(1);
  private volatile CountDownLatch release = new CountDownLatch(1);

  FakeCredentialSource withPats(String principal, String... tokens) {
    for (String token : tokens) {
      addPat(principal, token);
    }
    return this;
  }

  FakeCredentialSource withJwtMechanism(String principal, String token) {
    rows.compute(key(principal), (key, row) -> rowOrNew(row).touched(ENCRYPTED + token));
    return this;
  }

  /** The stored value is a reference that never changes; the secret behind it can. */
  FakeCredentialSource withSecretReferenceMechanism(String principal, String token) {
    secrets.put(key(principal), token);
    rows.compute(
        key(principal), (key, row) -> rowOrNew(row).touched(SECRET_REFERENCE + key(principal)));
    return this;
  }

  FakeCredentialSource withBasicMechanism(String principal) {
    rows.compute(key(principal), (key, row) -> rowOrNew(row).touched(BASIC));
    return this;
  }

  void addPat(String principal, String token) {
    String rowId = "pat-" + patRows.incrementAndGet();
    rows.compute(
        key(principal),
        (key, row) -> {
          Row current = rowOrNew(row);
          List<Pat> pats = new ArrayList<>(current.pats());
          pats.add(new Pat(rowId, token));
          return current.withPats(pats);
        });
  }

  void revokePat(String principal, String token) {
    rows.computeIfPresent(
        key(principal),
        (key, row) ->
            row.withPats(row.pats().stream().filter(p -> !p.token().equals(token)).toList()));
  }

  /** Removes every token of the principal: the mechanism and all PAT rows. */
  void revokeAll(String principal) {
    rows.computeIfPresent(key(principal), (key, row) -> row.touched(null).withPats(List.of()));
  }

  /** An API rotation through an external secrets manager: same stored value, new secret, updatedAt moved. */
  void rotateSecretBehindReference(String principal, String newToken) {
    secrets.put(key(principal), newToken);
    rows.computeIfPresent(key(principal), (key, row) -> row.touched(row.storedMechanism()));
  }

  /** Direct SQL on a PAT row: the id stays, so the fingerprint cannot see the edit. */
  void replacePatInPlace(String principal, String oldToken, String newToken) {
    rows.computeIfPresent(
        key(principal),
        (key, row) ->
            row.withPats(
                row.pats().stream()
                    .map(p -> p.token().equals(oldToken) ? new Pat(p.rowId(), newToken) : p)
                    .toList()));
  }

  void softDelete(String principal) {
    rows.computeIfPresent(
        key(principal),
        (key, row) ->
            new Row(row.id(), true, row.updatedAt() + 1, row.storedMechanism(), row.pats()));
  }

  void hardDelete(String principal) {
    rows.remove(key(principal));
  }

  void failReads() {
    failing.set(true);
  }

  void heal() {
    failing.set(false);
  }

  void failNextFingerprintRead() {
    failNextFingerprints.set(true);
  }

  /**
   * Full reads leave {@code principal} out of their result, as the database source does for a
   * subject whose rows it cannot convert (a decrypt or a stored JSON value that fails).
   */
  void failConversionOf(String principal) {
    unconvertible.add(key(principal));
  }

  /** Every full read whose subjects include {@code principal} throws, as a statement failure does. */
  void poisonReadsOf(String principal) {
    poison.add(key(principal));
  }

  /**
   * Every full read ends by throwing an {@link Error}, after any requested block: the shape of a
   * failure that is not an exception, such as a stack overflow inside a decrypt.
   */
  void failReadsWithError() {
    errorOnRead.set(true);
  }

  /** The next full read computes its result, then parks until {@link #releaseReads()}. */
  void blockNextRead() {
    readStarted = new CountDownLatch(1);
    release = new CountDownLatch(1);
    blockNext.set(true);
  }

  void awaitReadStarted() throws InterruptedException {
    assertTrue(readStarted.await(10, TimeUnit.SECONDS), "a read should have started");
  }

  void releaseReads() {
    release.countDown();
  }

  int fingerprintReads() {
    return fingerprintReads.get();
  }

  int fullReads() {
    return fullReads.get();
  }

  int fullReadsOf(String principal) {
    AtomicInteger count = fullReadsBySubject.get(key(principal));
    return count == null ? 0 : count.get();
  }

  int decrypts() {
    return decrypts.get();
  }

  @Override
  public Map<CredentialSubject, SourceFingerprint> fingerprints(
      Collection<CredentialSubject> subjects) {
    fingerprintReads.incrementAndGet();
    failIfDown();
    if (failNextFingerprints.compareAndSet(true, false)) {
      throw new IllegalStateException("injected fingerprint statement failure");
    }
    Map<CredentialSubject, SourceFingerprint> fingerprints = new HashMap<>();
    for (CredentialSubject subject : subjects) {
      fingerprints.put(subject, fingerprintOf(rows.get(subject.principal())));
    }
    return fingerprints;
  }

  @Override
  public Map<CredentialSubject, CredentialRecord> read(
      Collection<CredentialSubject> subjects, Map<CredentialSubject, CredentialRecord> previous) {
    fullReads.incrementAndGet();
    for (CredentialSubject subject : subjects) {
      fullReadsBySubject
          .computeIfAbsent(subject.principal(), k -> new AtomicInteger())
          .incrementAndGet();
    }
    failIfDown();
    failIfPoisoned(subjects);
    Map<CredentialSubject, CredentialRecord> records = new HashMap<>();
    for (CredentialSubject subject : subjects) {
      if (!unconvertible.contains(subject.principal())) {
        records.put(subject, recordOf(rows.get(subject.principal()), previous.get(subject)));
      }
    }
    blockIfRequested();
    if (errorOnRead.get()) {
      throw new AssertionError("injected error inside the read");
    }
    return records;
  }

  private void failIfPoisoned(Collection<CredentialSubject> subjects) {
    for (CredentialSubject subject : subjects) {
      if (poison.contains(subject.principal())) {
        throw new IllegalStateException(
            "injected statement failure for a batch holding " + subject.principal());
      }
    }
  }

  private void failIfDown() {
    if (failing.get()) {
      throw new IllegalStateException("database unreachable");
    }
  }

  private void blockIfRequested() {
    if (blockNext.compareAndSet(true, false)) {
      readStarted.countDown();
      try {
        if (!release.await(10, TimeUnit.SECONDS)) {
          throw new IllegalStateException("the blocked read was never released");
        }
      } catch (InterruptedException interrupted) {
        Thread.currentThread().interrupt();
        throw new IllegalStateException("interrupted while blocked", interrupted);
      }
    }
  }

  private CredentialRecord recordOf(Row row, CredentialRecord previous) {
    CredentialRecord record;
    if (row == null) {
      record = CredentialRecord.ABSENT;
    } else if (row.deleted()) {
      record = new CredentialRecord(fingerprintOf(row), Set.of(), null, null);
    } else {
      record = liveRecordOf(row, previous);
    }
    return record;
  }

  private CredentialRecord liveRecordOf(Row row, CredentialRecord previous) {
    Set<TokenDigest> digests = new HashSet<>();
    row.pats().forEach(pat -> digests.add(TokenDigest.of(pat.token())));
    MechanismVersion version =
        row.hasJwtMechanism() ? new MechanismVersion(row.storedMechanism(), row.updatedAt()) : null;
    TokenDigest mechanismDigest = version == null ? null : mechanismDigest(row, version, previous);
    if (mechanismDigest != null) {
      digests.add(mechanismDigest);
    }
    return new CredentialRecord(fingerprintOf(row), digests, version, mechanismDigest);
  }

  /** The contract's reuse rule: the cached digest only when md5 and updatedAt both match. */
  private TokenDigest mechanismDigest(
      Row row, MechanismVersion version, CredentialRecord previous) {
    boolean reusable =
        previous != null
            && version.equals(previous.mechanismVersion())
            && previous.mechanismDigest() != null;
    if (reusable) {
      return previous.mechanismDigest();
    }
    decrypts.incrementAndGet();
    return TokenDigest.of(decrypt(row.storedMechanism()));
  }

  private String decrypt(String storedMechanism) {
    return storedMechanism.startsWith(SECRET_REFERENCE)
        ? secrets.get(storedMechanism.substring(SECRET_REFERENCE.length()))
        : storedMechanism.substring(ENCRYPTED.length());
  }

  private static SourceFingerprint fingerprintOf(Row row) {
    if (row == null) {
      return SourceFingerprint.ABSENT;
    }
    String patRowIds =
        row.pats().stream().map(Pat::rowId).sorted().reduce("", (a, b) -> a + "," + b);
    return SourceFingerprint.of(
        String.join(
            "|",
            row.id(),
            String.valueOf(row.deleted()),
            String.valueOf(row.updatedAt()),
            String.valueOf(row.storedMechanism()),
            patRowIds));
  }

  private static Row rowOrNew(Row row) {
    return row == null ? new Row(UUID.randomUUID().toString(), false, 1L, null, List.of()) : row;
  }

  private static String key(String principal) {
    return CredentialSubject.of(principal).principal();
  }
}
