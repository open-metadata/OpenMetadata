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

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.joining;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlStatements;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.security.credentials.CredentialRecord.MechanismVersion;
import org.openmetadata.service.security.credentials.CredentialSourceDAO.FingerprintInputs;
import org.openmetadata.service.security.credentials.CredentialSourceDAO.FullRow;

/**
 * {@link CredentialSource} over the live tables. Owns three pieces of knowledge: row to
 * fingerprint (one function for both reads), row to token digests, and when a decrypt can be
 * skipped. A statement failure propagates, because a failed read must never look like an absent
 * credential; a subject whose rows cannot be converted is left out of the result on its own.
 */
@Slf4j
final class JdbiCredentialSource implements CredentialSource {

  private final Jdbi jdbi;
  private final Supplier<SecretsManager> secretsManager;
  private final int timeoutSeconds;

  JdbiCredentialSource(
      Jdbi jdbi, Supplier<SecretsManager> secretsManager, CredentialVerificationConfig config) {
    this.jdbi = jdbi;
    this.secretsManager = secretsManager;
    this.timeoutSeconds =
        (int) Math.max(1, Math.ceilDiv(config.loadTimeoutNanos(), 1_000_000_000L));
  }

  @Override
  public Map<CredentialSubject, SourceFingerprint> fingerprints(
      Collection<CredentialSubject> subjects) {
    Map<CredentialSubject, SourceFingerprint> result = new HashMap<>();
    if (!subjects.isEmpty()) {
      Map<CredentialSubject, String> hashes = hashesOf(subjects);
      Map<String, List<CredentialSourceDAO.FingerprintRow>> rows =
          withFreshHandle(dao -> dao.fingerprintRows(distinct(hashes))).stream()
              .collect(groupingBy(CredentialSourceDAO.FingerprintRow::nameHash));
      hashes.forEach((s, hash) -> result.put(s, fingerprintOf(rows.getOrDefault(hash, List.of()))));
    }
    return result;
  }

  @Override
  public Map<CredentialSubject, CredentialRecord> read(
      Collection<CredentialSubject> subjects, Map<CredentialSubject, CredentialRecord> previous) {
    Map<CredentialSubject, CredentialRecord> result = new HashMap<>();
    if (!subjects.isEmpty()) {
      Map<CredentialSubject, String> hashes = hashesOf(subjects);
      Map<String, List<FullRow>> rows =
          withFreshHandle(dao -> dao.fullRows(distinct(hashes))).stream()
              .collect(groupingBy(FullRow::nameHash));
      BiFunction<String, AuthenticationMechanism, AuthenticationMechanism> decrypt =
          (name, mechanism) -> secretsManager.get().decryptAuthenticationMechanism(name, mechanism);
      result = convert(hashes, rows, previous, decrypt);
    }
    return result;
  }

  /**
   * Converts each subject on its own. A subject whose rows cannot be converted, because a decrypt
   * or a stored JSON value fails, is logged once with its principal and left out, so the other
   * subjects of the statement still confirm. The caller treats a missing subject as unconfirmed.
   */
  static Map<CredentialSubject, CredentialRecord> convert(
      Map<CredentialSubject, String> hashes,
      Map<String, List<FullRow>> rowsByHash,
      Map<CredentialSubject, CredentialRecord> previous,
      BiFunction<String, AuthenticationMechanism, AuthenticationMechanism> decrypt) {
    Map<CredentialSubject, CredentialRecord> result = new HashMap<>();
    hashes.forEach(
        (subject, hash) -> {
          try {
            List<FullRow> rows = rowsByHash.getOrDefault(hash, List.of());
            result.put(subject, toRecord(rows, previous.get(subject), decrypt));
          } catch (RuntimeException failure) {
            LOG.warn(
                "The stored credentials of {} could not be converted; its tokens stay unconfirmed"
                    + " until a later read succeeds",
                subject.principal(),
                failure);
          }
        });
    return result;
  }

  /**
   * Pure; the one fingerprint function for both reads, so the cheap and the full query cannot
   * disagree. No rows (no user) gives {@link SourceFingerprint#ABSENT}. Otherwise the input is
   * {@code "u|" + userId + "|" + deleted + "|" + updatedAt + "|" + mechanismMd5 + "|" +
   * sorted PAT row ids}, hashed so an entry does not grow with its PAT count.
   */
  static SourceFingerprint fingerprintOf(List<? extends FingerprintInputs> rowsOfOneUser) {
    SourceFingerprint fingerprint = SourceFingerprint.ABSENT;
    if (!rowsOfOneUser.isEmpty()) {
      FingerprintInputs user = rowsOfOneUser.get(0);
      String tokenIds =
          rowsOfOneUser.stream()
              .map(FingerprintInputs::tokenId)
              .filter(Objects::nonNull)
              .sorted()
              .collect(joining(","));
      fingerprint =
          SourceFingerprint.of(
              "u|%s|%s|%d|%s|%s"
                  .formatted(
                      user.userId(),
                      user.deleted(),
                      user.updatedAt(),
                      user.mechanismMd5(),
                      tokenIds));
    }
    return fingerprint;
  }

  /**
   * Pure given its inputs; the secrets manager is the {@code decrypt} boundary. A deleted user has
   * no digests, and a non-JWT mechanism (a Basic-auth password) never becomes one.
   */
  static CredentialRecord toRecord(
      List<FullRow> rowsOfOneUser,
      CredentialRecord previous,
      BiFunction<String, AuthenticationMechanism, AuthenticationMechanism> decrypt) {
    CredentialRecord record = CredentialRecord.ABSENT;
    if (!rowsOfOneUser.isEmpty()) {
      FullRow first = rowsOfOneUser.get(0);
      SourceFingerprint fingerprint = fingerprintOf(rowsOfOneUser);
      record =
          first.deleted()
              ? new CredentialRecord(fingerprint, Set.of(), null, null)
              : liveRecord(fingerprint, rowsOfOneUser, previous, decrypt);
    }
    return record;
  }

  private static CredentialRecord liveRecord(
      SourceFingerprint fingerprint,
      List<FullRow> rows,
      CredentialRecord previous,
      BiFunction<String, AuthenticationMechanism, AuthenticationMechanism> decrypt) {
    User user = JsonUtils.readValue(rows.get(0).userJson(), User.class);
    Set<TokenDigest> digests = patDigests(rows);
    FullRow first = rows.get(0);
    MechanismVersion version =
        isJwt(user.getAuthenticationMechanism())
            ? new MechanismVersion(first.mechanismMd5(), first.updatedAt())
            : null;
    TokenDigest digest = version == null ? null : mechanismDigest(user, version, previous, decrypt);
    if (digest != null) {
      digests.add(digest);
    }
    return new CredentialRecord(fingerprint, digests, version, digest);
  }

  private static TokenDigest mechanismDigest(
      User user,
      MechanismVersion version,
      CredentialRecord previous,
      BiFunction<String, AuthenticationMechanism, AuthenticationMechanism> decrypt) {
    boolean unchanged = previous != null && version.equals(previous.mechanismVersion());
    return unchanged ? previous.mechanismDigest() : decryptedDigest(user, decrypt);
  }

  private static boolean isJwt(AuthenticationMechanism mechanism) {
    return mechanism != null && mechanism.getAuthType() == AuthType.JWT;
  }

  private static TokenDigest decryptedDigest(
      User user, BiFunction<String, AuthenticationMechanism, AuthenticationMechanism> decrypt) {
    AuthenticationMechanism decrypted =
        decrypt.apply(user.getName(), user.getAuthenticationMechanism());
    JWTAuthMechanism jwt =
        decrypted == null
            ? null
            : JsonUtils.convertValue(decrypted.getConfig(), JWTAuthMechanism.class);
    return digestOf(jwt == null ? null : jwt.getJWTToken());
  }

  private static Set<TokenDigest> patDigests(List<FullRow> rows) {
    Set<TokenDigest> digests = new HashSet<>();
    for (FullRow row : rows) {
      if (row.tokenJson() != null) {
        TokenDigest digest =
            digestOf(JsonUtils.readValue(row.tokenJson(), PersonalAccessToken.class).getJwtToken());
        if (digest != null) {
          digests.add(digest);
        }
      }
    }
    return digests;
  }

  private static TokenDigest digestOf(String token) {
    return token == null || token.isEmpty() ? null : TokenDigest.of(token);
  }

  /** The name hash is the same value the user row was stored under, so dots and case resolve. */
  private static Map<CredentialSubject, String> hashesOf(Collection<CredentialSubject> subjects) {
    Map<CredentialSubject, String> hashes = new HashMap<>();
    subjects.forEach(s -> hashes.put(s, s.nameHash()));
    return hashes;
  }

  private static List<String> distinct(Map<CredentialSubject, String> hashes) {
    return hashes.values().stream().distinct().toList();
  }

  /**
   * Runs on a new handle and refuses to run inside an open transaction: a read that joined a
   * caller's transaction could see its uncommitted writes or an old REPEATABLE READ snapshot, which
   * would break the stamp invariant. {@code jdbi.open()} never reuses a thread-bound handle.
   */
  private <T> T withFreshHandle(Function<CredentialSourceDAO, T> query) {
    try (Handle handle = jdbi.open()) {
      if (handle.isInTransaction()) {
        throw new IllegalStateException("A credential read must not run inside a transaction");
      }
      handle.getConfig(SqlStatements.class).setQueryTimeout(timeoutSeconds);
      return query.apply(handle.attach(CredentialSourceDAO.class));
    }
  }
}
