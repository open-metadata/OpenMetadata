/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.service.csv;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class CsvExportPayloadTest {

  private static String read(String stored) throws IOException {
    try (InputStream in = CsvExportPayload.decompress(stored)) {
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }
  }

  @Test
  void compress_thenDecompress_roundTripsCsvContent() throws IOException {
    String csv = "name,displayName\nmetric_one,Metric One\n";

    String stored = CsvExportPayload.compress(csv);

    assertTrue(CsvExportPayload.isCompressed(stored));
    assertEquals(csv, read(stored));
  }

  @Test
  void compress_roundTripsUtf8BeyondAscii() throws IOException {
    String csv = "name,description\ntable_one,\"café — 数据 — Ω\"\n";

    assertEquals(csv, read(CsvExportPayload.compress(csv)));
  }

  @Test
  void compress_roundTripsMultiMegabytePayload() throws IOException {
    StringBuilder csv = new StringBuilder("id,name,description\n");
    for (int row = 0; row < 60_000; row++) {
      csv.append(row).append(",entity_").append(row).append(",a reasonably wordy description\n");
    }
    String original = csv.toString();

    String stored = CsvExportPayload.compress(original);

    assertTrue(
        stored.length() < original.length() / 2,
        "Compression must materially shrink the payload stored in the job row");
    assertEquals(original, read(stored));
  }

  @Test
  void compress_roundTripsEmptyCsv() throws IOException {
    assertEquals("", read(CsvExportPayload.compress("")));
  }

  @Test
  void isCompressed_rejectsLegacyEncodings() {
    // Both must stay distinguishable: the download endpoint still serves jobs that
    // completed before results moved into the job row.
    assertFalse(CsvExportPayload.isCompressed("{\"storage\":\"spool\",\"bytes\":12}"));
    assertFalse(CsvExportPayload.isCompressed("name,displayName\nmetric_one,Metric One\n"));
    assertFalse(CsvExportPayload.isCompressed(null));
  }

  @Test
  void buffer_streamsContentAndCompressesIt() throws IOException {
    String csv = "name\nstreamed_metric\n";

    final String stored;
    try (CsvExportPayload.Buffer buffer = new CsvExportPayload.Buffer()) {
      buffer.stream().write(csv.getBytes(StandardCharsets.UTF_8));
      stored = buffer.finish();
    }

    assertTrue(CsvExportPayload.isCompressed(stored));
    assertEquals(csv, read(stored));
  }

  @Test
  void buffer_writtenInManySmallChunks_roundTrips() throws IOException {
    StringBuilder expected = new StringBuilder("name\n");
    final String stored;
    try (CsvExportPayload.Buffer buffer = new CsvExportPayload.Buffer()) {
      OutputStream out = buffer.stream();
      out.write("name\n".getBytes(StandardCharsets.UTF_8));
      for (int row = 0; row < 2_000; row++) {
        String line = "row_" + row + "\n";
        expected.append(line);
        for (byte b : line.getBytes(StandardCharsets.UTF_8)) {
          out.write(b);
        }
      }
      stored = buffer.finish();
    }

    assertEquals(expected.toString(), read(stored));
  }

  /**
   * Fresh pseudo-random bytes per chunk. Reusing one chunk would let gzip back-reference it away, so
   * the guard would never see the size it is meant to catch.
   */
  private static byte[] incompressibleChunk(long seed) {
    byte[] chunk = new byte[1024 * 1024];
    long state = seed * 6364136223846793005L + 1442695040888963407L;
    for (int i = 0; i < chunk.length; i++) {
      state = state * 6364136223846793005L + 1442695040888963407L;
      chunk[i] = (byte) (state >>> 33);
    }
    return chunk;
  }

  @Test
  void buffer_abortsOnceCompressedPayloadExceedsTheCap() {
    assertThrows(
        CsvExportTooLargeException.class,
        () -> {
          try (CsvExportPayload.Buffer buffer = new CsvExportPayload.Buffer()) {
            OutputStream out = buffer.stream();
            // Well past MAX_COMPRESSED_BYTES if the guard never fires.
            for (int i = 0; i < 48; i++) {
              out.write(incompressibleChunk(i));
            }
          }
        });
  }

  @Test
  void buffer_finishIsIdempotent() throws IOException {
    try (CsvExportPayload.Buffer buffer = new CsvExportPayload.Buffer()) {
      buffer.stream().write("name\nvalue\n".getBytes(StandardCharsets.UTF_8));
      String first = buffer.finish();

      assertEquals(first, buffer.finish());
      assertDoesNotThrow(buffer::close);
    }
  }
}
