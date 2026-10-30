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

import com.google.common.io.BaseEncoding;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.UUID;

/**
 * Renders owner ids and field paths as key segments every provider accepts as they are: lowercase
 * base32 holds only {@code [a-z2-7]}, which no provider separator or character replacement touches.
 */
final class SecretKeyEncoding {
  /** 64 bits: a field key only has to be unique among the few credential fields of one owner. */
  static final int FIELD_KEY_BYTES = 8;

  private static final BaseEncoding BASE32 = BaseEncoding.base32().lowerCase().omitPadding();
  private static final String HASH_ALGORITHM = "SHA-256";

  private SecretKeyEncoding() {}

  static String encodeId(UUID id) {
    ByteBuffer bytes = ByteBuffer.allocate(Long.BYTES * 2);
    bytes.putLong(id.getMostSignificantBits()).putLong(id.getLeastSignificantBits());
    return BASE32.encode(bytes.array());
  }

  /** Fixed-length key for a field, so nested paths and user-named array elements cannot collide. */
  static String fieldKey(List<String> fieldPath) {
    byte[] digest = sha256(pointer(fieldPath));
    return BASE32.encode(digest, 0, FIELD_KEY_BYTES);
  }

  /** The field path as an RFC 6901 JSON pointer, which is unambiguous whatever the segments hold. */
  static String pointer(List<String> fieldPath) {
    StringBuilder pointer = new StringBuilder();
    fieldPath.forEach(
        segment -> pointer.append('/').append(segment.replace("~", "~0").replace("/", "~1")));
    return pointer.toString();
  }

  private static byte[] sha256(String text) {
    try {
      return MessageDigest.getInstance(HASH_ALGORITHM)
          .digest(text.getBytes(StandardCharsets.UTF_8));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(HASH_ALGORITHM + " is required of every Java runtime", e);
    }
  }
}
