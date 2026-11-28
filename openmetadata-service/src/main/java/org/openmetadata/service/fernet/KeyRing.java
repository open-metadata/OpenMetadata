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

package org.openmetadata.service.fernet;

import com.macasaet.fernet.Key;
import com.macasaet.fernet.StringValidator;
import com.macasaet.fernet.Token;
import com.macasaet.fernet.TokenValidationException;
import com.macasaet.fernet.Validator;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.TemporalAmount;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.apache.commons.codec.digest.DigestUtils;

/**
 * The configured Fernet keys, primary first, as an immutable value. It never reads or changes the
 * {@link Fernet} singleton, except {@link #current()}, so a caller can hold any key list.
 */
public final class KeyRing {
  public static final KeyRing NONE = new KeyRing(List.of());
  public static final String SHIPPED_DEFAULT_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";
  public static final Validator<String> NEVER_EXPIRES =
      new StringValidator() {
        @Override
        public TemporalAmount getTimeToLive() {
          return Duration.ofSeconds(Instant.MAX.getEpochSecond());
        }
      };

  private static final String KEY_SEPARATOR = ",";
  private static final int FINGERPRINT_LENGTH = 12;
  private static final SecureRandom RANDOM = new SecureRandom();
  private static final String SHIPPED_DEFAULT_FINGERPRINT =
      fingerprint(parse(SHIPPED_DEFAULT_KEY).keys.getFirst());

  private final List<Key> keys;

  private KeyRing(List<Key> keys) {
    this.keys = List.copyOf(keys);
  }

  /**
   * Parses a comma-separated key list, normalizing base64 to base64url as {@link
   * Fernet#setFernetKey(String)} always has.
   *
   * @throws IllegalArgumentException when the text is null, blank, the no-encryption marker or has
   *     an invalid key. The message never holds key material.
   */
  public static KeyRing parse(String configured) {
    if (configured == null
        || configured.isBlank()
        || Fernet.FERNET_NO_ENCRYPTION.equals(configured)) {
      throw new IllegalArgumentException("No Fernet key is configured");
    }
    String normalized = configured.replace("/", "_").replace("+", "-").replace("=", "");
    String[] parts = normalized.split(KEY_SEPARATOR);
    if (parts.length == 0) {
      throw new IllegalArgumentException("A configured Fernet key is not valid");
    }
    try {
      return new KeyRing(Arrays.stream(parts).map(Key::new).toList());
    } catch (RuntimeException e) {
      throw new IllegalArgumentException("A configured Fernet key is not valid");
    }
  }

  /** The ring {@link Fernet} holds, {@link #NONE} when no key is set. */
  public static KeyRing current() {
    return Fernet.getInstance().keyRing();
  }

  public int size() {
    return keys.size();
  }

  /** The keys, primary first. */
  public List<Key> keys() {
    return keys;
  }

  /** The first 12 hex digits of SHA-256 over each key's bytes, primary first. Safe to log. */
  public List<String> fingerprints() {
    return keys.stream().map(KeyRing::fingerprint).toList();
  }

  /** For example {@code 9f3a1c2e7b40 (primary), 51d0e8aa02c7}. */
  public String describe() {
    return describe(fingerprints());
  }

  /** Formats key fingerprints with the first labeled {@code (primary)}. */
  public static String describe(List<String> fingerprints) {
    return IntStream.range(0, fingerprints.size())
        .mapToObj(i -> i == 0 ? fingerprints.get(i) + " (primary)" : fingerprints.get(i))
        .collect(Collectors.joining(", "));
  }

  public boolean isPrimaryTheShippedDefault() {
    return !keys.isEmpty() && fingerprint(keys.getFirst()).equals(SHIPPED_DEFAULT_FINGERPRINT);
  }

  /** Opens {@code plainToken} with each key on its own. Never throws. */
  public Opening open(String plainToken) {
    if (plainToken == null
        || !plainToken.startsWith(Fernet.FERNET_PREFIX)
        || plainToken.startsWith(Fernet.FERNET_PREFIX + "bound:")) {
      return new Opening.NoKey();
    }
    Token token;
    try {
      token = Token.fromString(plainToken.substring(Fernet.FERNET_PREFIX.length()));
    } catch (RuntimeException e) {
      return new Opening.NoKey();
    }
    return openWithEach(token);
  }

  private Opening openWithEach(Token token) {
    for (int i = 0; i < keys.size(); i++) {
      try {
        String plaintext = token.validateAndDecrypt(keys.get(i), NEVER_EXPIRES);
        return i == 0 ? new Opening.Primary(plaintext) : new Opening.Older(i, plaintext);
      } catch (TokenValidationException e) {
        // this key does not open it; try the next one
      }
    }
    return new Opening.NoKey();
  }

  /**
   * @throws IllegalStateException when no key is configured
   */
  public String seal(String plaintext) {
    if (keys.isEmpty()) {
      throw new IllegalStateException("No Fernet key is configured");
    }
    return Fernet.FERNET_PREFIX + generateToken(keys.getFirst(), plaintext).serialise();
  }

  /** Generates a Fernet token for {@code plaintext} using the shared CSPRNG. */
  public static Token generateToken(Key key, String plaintext) {
    return Token.generate(RANDOM, key, plaintext);
  }

  /** Returns the raw 32-byte key material (signing key followed by encryption key). */
  public static byte[] keyBytes(Key key) {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    try {
      key.writeTo(bytes);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
    return bytes.toByteArray();
  }

  /** The token sealed again under the primary key when an older key opens it, else the argument. */
  public String rekeyIfOlder(String plainToken) {
    return open(plainToken) instanceof Opening.Older older ? seal(older.plaintext()) : plainToken;
  }

  private static String fingerprint(Key key) {
    return DigestUtils.sha256Hex(keyBytes(key)).substring(0, FINGERPRINT_LENGTH);
  }
}
