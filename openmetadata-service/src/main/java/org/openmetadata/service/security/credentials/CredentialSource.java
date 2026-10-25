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

import java.util.Collection;
import java.util.Map;

/**
 * The authoritative store, seen as two batched questions, both by principal only. Implementations
 * do I/O and nothing else: no clocks, no caching, no swallowing. A failure throws; it is never
 * reported as "absent". A principal with no row maps to {@link CredentialRecord#ABSENT} /
 * {@link SourceFingerprint#ABSENT}.
 */
interface CredentialSource {

  /** Cheap: no token material, no decryption. One statement per call. */
  Map<CredentialSubject, SourceFingerprint> fingerprints(Collection<CredentialSubject> subjects);

  /**
   * Full: the current token digests and the fingerprint, from one statement. A JWT-type
   * {@code authenticationMechanism} is decrypted through the secrets manager, unless
   * {@code previous} holds a record for the subject whose {@code mechanismVersion} (md5 and
   * {@code updatedAt}) equals the row's: then {@code previous.mechanismDigest()} is reused. Pass an
   * empty map to force every decrypt, as the deep verify does so a secret edited inside the
   * secrets manager is seen.
   *
   * @param previous the cached records for these subjects, possibly missing some or empty
   */
  Map<CredentialSubject, CredentialRecord> read(
      Collection<CredentialSubject> subjects, Map<CredentialSubject, CredentialRecord> previous);
}
