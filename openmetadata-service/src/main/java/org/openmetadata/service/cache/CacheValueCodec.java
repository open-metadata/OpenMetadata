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
package org.openmetadata.service.cache;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/**
 * Transparent GZIP + Base64 codec for large Redis cache values stored over the UTF-8 string
 * connection. Values below {@code thresholdBytes} or that do not shrink under compression are kept
 * as plain text; {@link #decode(String)} accepts both plain and compressed entries.
 */
public final class CacheValueCodec {
  static final String GZIP_PREFIX = "om:gz1:";

  private CacheValueCodec() {}

  public static String encode(final String raw, final int thresholdBytes) {
    if (raw == null || thresholdBytes <= 0 || raw.length() * 3L < thresholdBytes) {
      return raw;
    }
    final byte[] rawBytes = raw.getBytes(StandardCharsets.UTF_8);
    if (rawBytes.length < thresholdBytes) {
      return raw;
    }
    final String encoded = GZIP_PREFIX + Base64.getEncoder().encodeToString(gzip(rawBytes));
    return encoded.length() < rawBytes.length ? encoded : raw;
  }

  public static String decode(final String stored) {
    if (!isCompressed(stored)) {
      return stored;
    }
    try {
      final byte[] compressed = Base64.getDecoder().decode(stored.substring(GZIP_PREFIX.length()));
      return new String(gunzip(compressed), StandardCharsets.UTF_8);
    } catch (IOException | IllegalArgumentException e) {
      throw new IllegalArgumentException("Corrupted compressed cache value", e);
    }
  }

  public static boolean isCompressed(final String stored) {
    return stored != null && stored.startsWith(GZIP_PREFIX);
  }

  public static boolean exceedsMaxEntrySize(final String encoded, final int maxEntrySizeBytes) {
    if (encoded == null || maxEntrySizeBytes <= 0) {
      return false;
    }
    return encodedByteSize(encoded) > maxEntrySizeBytes;
  }

  public static int encodedByteSize(final String encoded) {
    if (encoded == null) {
      return 0;
    }
    return isCompressed(encoded)
        ? encoded.length()
        : encoded.getBytes(StandardCharsets.UTF_8).length;
  }

  private static byte[] gzip(final byte[] input) {
    final ByteArrayOutputStream out = new ByteArrayOutputStream(Math.max(64, input.length / 4));
    try (GZIPOutputStream gzipOut = new GZIPOutputStream(out)) {
      gzipOut.write(input);
    } catch (IOException e) {
      throw new IllegalStateException("Failed to compress cache value", e);
    }
    return out.toByteArray();
  }

  private static byte[] gunzip(final byte[] compressed) throws IOException {
    try (GZIPInputStream gzipIn = new GZIPInputStream(new ByteArrayInputStream(compressed))) {
      return gzipIn.readAllBytes();
    }
  }
}
