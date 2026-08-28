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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class CsvExportSpoolTest {
  private final String jobId = "test-" + UUID.randomUUID();

  @AfterEach
  void cleanup() throws IOException {
    Files.deleteIfExists(CsvExportSpool.fileForJob(jobId));
  }

  @Test
  void write_thenRead_roundTripsCsvContent() throws IOException {
    String csv = "name,displayName\nmetric_one,Metric One\n";

    long bytes = CsvExportSpool.write(jobId, csv);

    assertEquals(csv.getBytes(StandardCharsets.UTF_8).length, bytes);
    assertTrue(CsvExportSpool.exists(jobId));
    assertEquals(bytes, CsvExportSpool.size(jobId));
    try (InputStream in = CsvExportSpool.openForRead(jobId)) {
      assertEquals(csv, new String(in.readAllBytes(), StandardCharsets.UTF_8));
    }
  }

  @Test
  void openForWrite_streamsContentToTheSpoolFile() throws IOException {
    String csv = "name\nstreamed_metric\n";

    try (OutputStream out = CsvExportSpool.openForWrite(jobId)) {
      out.write(csv.getBytes(StandardCharsets.UTF_8));
    }

    try (InputStream in = CsvExportSpool.openForRead(jobId)) {
      assertEquals(csv, new String(in.readAllBytes(), StandardCharsets.UTF_8));
    }
  }

  @Test
  void sweepExpired_deletesOnlyFilesOlderThanRetention() throws IOException {
    String freshJobId = "fresh-" + UUID.randomUUID();
    String expiredJobId = "expired-" + UUID.randomUUID();
    try {
      CsvExportSpool.write(freshJobId, "name\nfresh\n");
      CsvExportSpool.write(expiredJobId, "name\nexpired\n");

      Path expiredFile = CsvExportSpool.fileForJob(expiredJobId);
      Instant beyondRetention = Instant.now().minus(CsvExportSpool.RETENTION).minusSeconds(60 * 60);
      Files.setLastModifiedTime(expiredFile, FileTime.from(beyondRetention));

      CsvExportSpool.sweepExpired();

      assertTrue(CsvExportSpool.exists(freshJobId), "Fresh export must survive the sweep");
      assertFalse(CsvExportSpool.exists(expiredJobId), "Expired export must be deleted");
    } finally {
      Files.deleteIfExists(CsvExportSpool.fileForJob(freshJobId));
      Files.deleteIfExists(CsvExportSpool.fileForJob(expiredJobId));
    }
  }
}
