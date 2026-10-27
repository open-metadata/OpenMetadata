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

import java.util.Set;
import org.openmetadata.service.security.credentials.CredentialMetrics.DecryptOutcome;

/**
 * What the database said about one principal at one read: the OpenMetadata-signed tokens currently
 * valid for it and a fingerprint of every stored input those tokens are derived from. Produced only
 * by {@link CredentialSource}. Carries no time: the verifier, not the source, stamps reads (see
 * {@link VerifiedCredentials}).
 *
 * <p>{@code digests} is the union of the principal's stored tokens: the JWT inside
 * {@code authenticationMechanism} when that mechanism is a JWT plus every personal access token
 * row. Empty for an absent or deleted user.
 *
 * <p>{@code mechanismVersion} and {@code mechanismDigest} remember which stored mechanism the
 * digest was decrypted from, so a later sweep or nudge read of an unchanged mechanism skips the
 * secrets-manager call. Both are null when the mechanism is not a JWT (or the user is absent).
 *
 * <p>{@code mechanismDigestOrigin} says how this read obtained {@code mechanismDigest}: decrypted,
 * or reused from the previous record. The verifier counts it for every record a read returns,
 * whether or not the read installs it. Null when the mechanism is not a JWT, the user is absent or
 * the user is deleted.
 *
 * <p>Invariant the source must keep: equal fingerprints imply equal digest sets, except for edits
 * the fingerprint cannot see (a secret edited inside an external secrets manager, a PAT row's
 * JSON edited in place by direct SQL). The deep verify exists for exactly those.
 */
record CredentialRecord(
    SourceFingerprint fingerprint,
    Set<TokenDigest> digests,
    MechanismVersion mechanismVersion,
    TokenDigest mechanismDigest,
    DecryptOutcome mechanismDigestOrigin) {
  static final CredentialRecord ABSENT =
      new CredentialRecord(SourceFingerprint.ABSENT, Set.of(), null, null);

  CredentialRecord {
    digests = Set.copyOf(digests);
  }

  CredentialRecord(
      SourceFingerprint fingerprint,
      Set<TokenDigest> digests,
      MechanismVersion mechanismVersion,
      TokenDigest mechanismDigest) {
    this(fingerprint, digests, mechanismVersion, mechanismDigest, null);
  }

  boolean holds(TokenDigest digest) {
    return digests.contains(digest);
  }

  /**
   * The md5 of the stored {@code authenticationMechanism} and the user row's {@code updatedAt}. A
   * cached decrypt is reused only when both match. The md5 alone is not enough: with an external
   * secrets manager the stored value is a reference built from the bot name
   * ({@code SecretsManager.buildSecretId(true, "bot", name)}), so an API rotation or revoke
   * rewrites the secret behind an unchanged md5. That write moves {@code updatedAt}.
   */
  record MechanismVersion(String md5, long updatedAt) {}
}
