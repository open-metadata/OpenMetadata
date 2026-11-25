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

import java.util.Objects;

/**
 * Opaque summary of a principal's stored credential inputs, computed in Java from the rows of one
 * SELECT by {@code JdbiCredentialSource.fingerprintOf}: user row present, user {@code id} (a
 * recreated name is a new user), {@code deleted}, {@code updatedAt}, {@code md5} of
 * {@code json -> authenticationMechanism}, and the sorted PAT row ids.
 *
 * <p>{@code updatedAt} is included because with an external secrets manager the stored value is a
 * reference that stays the same while the secret behind it rotates through the API. PAT rows are
 * only ever inserted or deleted, so their ids suffice. Compared by content only.
 */
final class SourceFingerprint {
  /** Never equals a real fingerprint, not even that of the empty string. */
  static final SourceFingerprint ABSENT = new SourceFingerprint(null);

  private final Sha256Words words;

  private SourceFingerprint(Sha256Words words) {
    this.words = words;
  }

  static SourceFingerprint of(String canonicalInput) {
    return new SourceFingerprint(Sha256Words.of(Objects.requireNonNull(canonicalInput, "input")));
  }

  @Override
  public boolean equals(Object other) {
    return this == other
        || (other instanceof SourceFingerprint fingerprint && sameContent(fingerprint));
  }

  private boolean sameContent(SourceFingerprint other) {
    return words != null && other.words != null && words.sameWords(other.words);
  }

  @Override
  public int hashCode() {
    return words == null ? 0 : Long.hashCode(words.w0);
  }
}
