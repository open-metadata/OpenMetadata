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
 * SHA-256 of a whole bearer token, held as four longs so equality and hashing are allocation-free
 * and no raw token ever sits in the verifier's heap.
 *
 * <p>Public but opaque: outside code can make one from a token it holds (a WebSocket session
 * remembering which credential opened it) and compare, but cannot read or forge the words.
 */
public final class TokenDigest {
  private final Sha256Words words;

  private TokenDigest(Sha256Words words) {
    this.words = words;
  }

  public static TokenDigest of(String token) {
    return new TokenDigest(Sha256Words.of(Objects.requireNonNull(token, "token")));
  }

  @Override
  public boolean equals(Object other) {
    return this == other || (other instanceof TokenDigest digest && words.sameWords(digest.words));
  }

  @Override
  public int hashCode() {
    return Long.hashCode(words.w0);
  }

  @Override
  public String toString() {
    return "TokenDigest";
  }
}
