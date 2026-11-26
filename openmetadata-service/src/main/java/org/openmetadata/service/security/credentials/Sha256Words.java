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

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * The package's single SHA-256 implementation, packed big-endian into four longs so equality and
 * hashing never allocate. {@link TokenDigest} and {@link SourceFingerprint} both build on it.
 */
final class Sha256Words {
  private static final MessageDigest PROTOTYPE = prototype();

  final long w0;
  final long w1;
  final long w2;
  final long w3;

  private Sha256Words(long w0, long w1, long w2, long w3) {
    this.w0 = w0;
    this.w1 = w1;
    this.w2 = w2;
    this.w3 = w3;
  }

  /** Clones a prototype digest per call; a ThreadLocal would pin state to virtual threads. */
  static Sha256Words of(String text) {
    byte[] hash = newDigest().digest(text.getBytes(StandardCharsets.UTF_8));
    return new Sha256Words(word(hash, 0), word(hash, 8), word(hash, 16), word(hash, 24));
  }

  boolean sameWords(Sha256Words other) {
    return w0 == other.w0 && w1 == other.w1 && w2 == other.w2 && w3 == other.w3;
  }

  private static long word(byte[] hash, int offset) {
    long word = 0;
    for (int i = 0; i < Long.BYTES; i++) {
      word = (word << Byte.SIZE) | (hash[offset + i] & 0xFFL);
    }
    return word;
  }

  private static MessageDigest newDigest() {
    try {
      return (MessageDigest) PROTOTYPE.clone();
    } catch (CloneNotSupportedException e) {
      throw new IllegalStateException("SHA-256 digest is not cloneable", e);
    }
  }

  private static MessageDigest prototype() {
    try {
      return MessageDigest.getInstance("SHA-256");
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 is required by every Java platform", e);
    }
  }
}
