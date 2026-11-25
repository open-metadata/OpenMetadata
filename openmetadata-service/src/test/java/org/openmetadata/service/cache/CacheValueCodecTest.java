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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class CacheValueCodecTest {

  @Test
  void compressesLargeRepetitiveJsonAndRoundTrips() {
    final StringBuilder wideTable = new StringBuilder("{\"columns\":[");
    for (int i = 0; i < 150; i++) {
      if (i > 0) {
        wideTable.append(',');
      }
      wideTable
          .append("{\"name\":\"column_")
          .append(i)
          .append("\",\"dataType\":\"VARCHAR\",\"description\":\"Customer attribute column\"}");
    }
    wideTable.append("]}");
    final String raw = wideTable.toString();

    final String encoded = CacheValueCodec.encode(raw, 2048);

    assertTrue(CacheValueCodec.isCompressed(encoded));
    assertTrue(
        encoded.length() < raw.length() / 4,
        "wide table JSON should compress by >4x, got " + encoded.length() + " vs " + raw.length());
    assertEquals(raw, CacheValueCodec.decode(encoded));
  }

  @Test
  void leavesSmallOrDisabledValuesUncompressed() {
    final String small = "{\"id\":\"123\",\"name\":\"orders\"}";

    assertEquals(small, CacheValueCodec.encode(small, 2048));
    assertFalse(CacheValueCodec.isCompressed(CacheValueCodec.encode(small, 2048)));
    assertEquals(small, CacheValueCodec.encode(small, 0));
    assertEquals(small, CacheValueCodec.encode(small, -1));
    assertNull(CacheValueCodec.encode(null, 2048));
  }

  @Test
  void skipsCompressionWhenEncodedPayloadIsNotSmaller() {
    final String shortIncompressible = "a1b2c3d4e5f6g7h8i9j0";

    final String encoded = CacheValueCodec.encode(shortIncompressible, 1);

    assertEquals(shortIncompressible, encoded);
    assertFalse(CacheValueCodec.isCompressed(encoded));
  }

  @Test
  void decodePassesThroughPlainJsonAndRejectsCorruptedCompressedPayload() {
    final String plain = "{\"id\":\"123\"}";
    assertEquals(plain, CacheValueCodec.decode(plain));
    assertNull(CacheValueCodec.decode(null));

    assertThrows(
        IllegalArgumentException.class,
        () -> CacheValueCodec.decode(CacheValueCodec.GZIP_PREFIX + "not-valid-base64!!!"));
    assertThrows(
        IllegalArgumentException.class,
        () -> CacheValueCodec.decode(CacheValueCodec.GZIP_PREFIX + "YWJjZGVm"));
  }

  @Test
  void exceedsMaxEntrySizeMeasuresUtf8BytesForUncompressedNonAsciiValues() {
    // 10 CJK characters = 10 UTF-16 chars, but 30 UTF-8 bytes.
    final String cjk = "数据目录资产元数据表";
    assertEquals(10, cjk.length());
    assertEquals(30, CacheValueCodec.encodedByteSize(cjk));

    assertTrue(CacheValueCodec.exceedsMaxEntrySize(cjk, 20));
    assertFalse(CacheValueCodec.exceedsMaxEntrySize(cjk, 30));
    assertFalse(CacheValueCodec.exceedsMaxEntrySize(cjk, 0));
    assertFalse(CacheValueCodec.exceedsMaxEntrySize(null, 10));
  }

  @Test
  void encodeCompressesNonAsciiValuesUsingUtf8ByteLengthForThresholdAndSavings() {
    // Build a CJK string whose UTF-16 char count is below the 2048-byte threshold, while its
    // UTF-8 byte length exceeds 2048 bytes and shrinks meaningfully under GZIP+Base64.
    final StringBuilder cjkPayload = new StringBuilder();
    for (int i = 0; i < 80; i++) {
      cjkPayload.append("数据目录资产元数据表").append(i).append(',');
    }
    final String raw = cjkPayload.toString();
    final int rawUtf8Bytes = CacheValueCodec.encodedByteSize(raw);
    assertTrue(raw.length() < 2048, "UTF-16 char count should be below byte threshold");
    assertTrue(rawUtf8Bytes >= 2048, "UTF-8 byte length should meet byte threshold");

    final String encoded = CacheValueCodec.encode(raw, 2048);

    assertTrue(CacheValueCodec.isCompressed(encoded));
    assertTrue(encoded.length() < rawUtf8Bytes);
    assertEquals(raw, CacheValueCodec.decode(encoded));
  }
}
