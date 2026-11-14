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
import org.openmetadata.service.fernet.KeyRing;
import org.openmetadata.service.fernet.Opening;

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
  private static final String NO_KEY = "No Fernet key is configured";
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
    return seal(requireKeys(), owner, field, secret);
  }

  /** The secret {@code value} holds, when it was written for {@code owner} at {@code field}. */
  public static Optional<String> decrypt(SecretOwner owner, String field, String value) {
    return plaintext(open(requireKeys(), owner, field, value), false);
  }

  /** As {@link #decrypt}, with the primary key only, the one {@link #encrypt} uses. */
  public static Optional<String> decryptWithPrimaryKey(
      SecretOwner owner, String field, String value) {
    return plaintext(open(requireKeys(), owner, field, value), true);
  }

  /** Encrypts {@code secret} for {@code owner} at {@code field} with the primary key of {@code keys}. */
  public static String seal(KeyRing keys, SecretOwner owner, String field, String secret) {
    if (keys.size() == 0) {
      throw new IllegalStateException(NO_KEY);
    }
    return PREFIX
        + Token.generate(RANDOM, derive(keys.keys().getFirst(), owner, field), secret).serialise();
  }

  /**
   * Opens {@code token} with each derived key on its own, so the result says which key opened it.
   * Anything that is not bound text for this owner and field gives {@link Opening.NoKey}.
   */
  public static Opening open(KeyRing keys, SecretOwner owner, String field, String token) {
    if (!isBound(token) || keys.size() == 0) {
      return new Opening.NoKey();
    }
    Token parsed;
    try {
      parsed = Token.fromString(token.substring(PREFIX.length()));
    } catch (IllegalArgumentException e) {
      LOG.debug("A stored secret is not a well-formed token", e);
      return new Opening.NoKey();
    }
    return openWithEach(keys.keys(), parsed, owner, field);
  }

  private static Opening openWithEach(
      List<Key> keys, Token token, SecretOwner owner, String field) {
    for (int i = 0; i < keys.size(); i++) {
      try {
        String secret = token.validateAndDecrypt(derive(keys.get(i), owner, field), NEVER_EXPIRES);
        return i == 0 ? new Opening.Primary(secret) : new Opening.Older(i, secret);
      } catch (TokenValidationException e) {
        LOG.debug("A stored secret does not open for this owner and field with key {}", i, e);
      }
    }
    return new Opening.NoKey();
  }

  private static Optional<String> plaintext(Opening opening, boolean primaryOnly) {
    return switch (opening) {
      case Opening.Primary primary -> Optional.of(primary.plaintext());
      case Opening.Older older -> primaryOnly ? Optional.empty() : Optional.of(older.plaintext());
      case Opening.NoKey ignored -> Optional.empty();
    };
  }

  private static KeyRing requireKeys() {
    KeyRing keys = KeyRing.current();
    if (keys.size() == 0) {
      throw new IllegalStateException(NO_KEY);
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
