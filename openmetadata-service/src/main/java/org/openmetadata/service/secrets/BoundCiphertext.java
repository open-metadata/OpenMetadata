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

package org.openmetadata.service.secrets;

import com.macasaet.fernet.Key;
import com.macasaet.fernet.StringValidator;
import com.macasaet.fernet.Token;
import com.macasaet.fernet.TokenValidationException;
import com.macasaet.fernet.Validator;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.TemporalAmount;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.crypto.digests.SHA256Digest;
import org.bouncycastle.crypto.generators.HKDFBytesGenerator;
import org.bouncycastle.crypto.params.HKDFParameters;
import org.openmetadata.service.fernet.Fernet;

/**
 * Ciphertext that opens only for the owner and the field it was written for. Each owner and field
 * has its own key, derived from every configured Fernet key (HKDF-SHA256, RFC 5869), so a value
 * encrypted anywhere else, for another owner, for another field or by {@link Fernet#encrypt} does
 * not open here, and this ciphertext opens nowhere else. Rotating the Fernet keys rotates every
 * derived key with them. ADR:2026-11-03-a-webhook-secret-opens-only-where-it-was-written
 */
@Slf4j
public final class BoundCiphertext {
  public static final String PREFIX = Fernet.FERNET_PREFIX + "bound:";

  private static final byte[] SALT =
      "openmetadata/bound-ciphertext/v1".getBytes(StandardCharsets.UTF_8);
  // A Fernet key is a 16-byte signing key followed by a 16-byte encryption key.
  private static final int FERNET_KEY_LENGTH = 32;
  private static final char SEPARATOR = '\u0000';
  private static final SecureRandom RANDOM = new SecureRandom();
  private static final Validator<String> NEVER_EXPIRES =
      new StringValidator() {
        @Override
        public TemporalAmount getTimeToLive() {
          return Duration.ofSeconds(Instant.MAX.getEpochSecond());
        }
      };

  private BoundCiphertext() {}

  public static boolean isBound(String value) {
    return value != null && value.startsWith(PREFIX);
  }

  /** Encrypts {@code secret} for {@code owner} at {@code field}, with the primary Fernet key. */
  public static String encrypt(SecretOwner owner, String field, String secret) {
    Key key = derive(keys().getFirst(), owner, field);
    return PREFIX + Token.generate(RANDOM, key, secret).serialise();
  }

  /** The secret {@code value} holds, when it was written for {@code owner} at {@code field}. */
  public static Optional<String> decrypt(SecretOwner owner, String field, String value) {
    return open(value, keys().stream().map(key -> derive(key, owner, field)).toList());
  }

  /** As {@link #decrypt}, with the primary key only, the one {@link #encrypt} uses. */
  public static Optional<String> decryptWithPrimaryKey(
      SecretOwner owner, String field, String value) {
    return open(value, List.of(derive(keys().getFirst(), owner, field)));
  }

  private static Optional<String> open(String value, List<Key> keys) {
    Optional<String> secret = Optional.empty();
    if (isBound(value)) {
      try {
        Token token = Token.fromString(value.substring(PREFIX.length()));
        secret = Optional.of(token.validateAndDecrypt(keys, NEVER_EXPIRES));
      } catch (TokenValidationException | IllegalArgumentException e) {
        LOG.debug("A stored secret does not open for this owner and field", e);
      }
    }
    return secret;
  }

  private static List<Key> keys() {
    List<Key> keys = Fernet.getInstance().getCachedKeys();
    if (keys == null || keys.isEmpty()) {
      throw new IllegalStateException("No Fernet key is configured");
    }
    return keys;
  }

  private static Key derive(Key key, SecretOwner owner, String field) {
    return new Key(hkdfSha256(material(key), SALT, context(owner, field), FERNET_KEY_LENGTH));
  }

  /** HKDF-SHA256 (RFC 5869): {@code length} bytes derived from {@code inputKey}. */
  static byte[] hkdfSha256(byte[] inputKey, byte[] salt, byte[] info, int length) {
    HKDFBytesGenerator hkdf = new HKDFBytesGenerator(SHA256Digest.newInstance());
    hkdf.init(new HKDFParameters(inputKey, salt, info));
    byte[] derived = new byte[length];
    hkdf.generateBytes(derived, 0, length);
    return derived;
  }

  private static byte[] material(Key key) {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    try {
      key.writeTo(bytes);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
    return bytes.toByteArray();
  }

  // Owner segments hold only [a-z0-9], so the separators below cannot appear inside one.
  private static byte[] context(SecretOwner owner, String field) {
    String context = String.join("/", owner.segments()) + SEPARATOR + field;
    return context.getBytes(StandardCharsets.UTF_8);
  }
}
