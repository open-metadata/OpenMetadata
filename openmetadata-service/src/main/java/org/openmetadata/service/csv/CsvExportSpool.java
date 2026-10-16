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

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.time.Instant;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;

/**
 * Local spool for completed CSV export payloads. Storing the CSV as a file
 * keeps the background_jobs row small and lets the result endpoint stream the
 * download instead of materializing it through JSON.
 *
 * <p>The directory defaults to the JVM temp dir and can be pointed at a shared
 * mount via the {@code CSV_EXPORT_SPOOL_DIR} environment variable — required in
 * multi-server deployments, where the server answering the download request may
 * not be the one that ran the job. Files are swept after {@link #RETENTION} on
 * startup; a missing file surfaces to the client as "result no longer
 * available".
 */
@Slf4j
public final class CsvExportSpool {
  public static final String SPOOL_DIR_ENV = "CSV_EXPORT_SPOOL_DIR";
  public static final Duration RETENTION = Duration.ofDays(7);
  private static final String FILE_PREFIX = "csv-export-";
  private static final String FILE_SUFFIX = ".csv";

  private CsvExportSpool() {}

  public static Path fileForJob(String jobId) {
    return spoolDir().resolve(FILE_PREFIX + jobId + FILE_SUFFIX);
  }

  public static long write(String jobId, String csvData) {
    Path file = fileForJob(jobId);
    try {
      Files.writeString(file, csvData, StandardCharsets.UTF_8);
      return Files.size(file);
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to spool CSV export for job " + jobId, e);
    }
  }

  public static OutputStream openForWrite(String jobId) {
    try {
      return Files.newOutputStream(fileForJob(jobId));
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to open CSV export spool for job " + jobId, e);
    }
  }

  public static boolean exists(String jobId) {
    return Files.isRegularFile(fileForJob(jobId));
  }

  public static long size(String jobId) {
    try {
      return Files.size(fileForJob(jobId));
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to stat CSV export spool for job " + jobId, e);
    }
  }

  public static InputStream openForRead(String jobId) {
    try {
      return Files.newInputStream(fileForJob(jobId));
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to read CSV export spool for job " + jobId, e);
    }
  }

  public static void sweepExpired() {
    Path dir = spoolDir();
    Instant cutoff = Instant.now().minus(RETENTION);
    try (Stream<Path> files = Files.list(dir)) {
      files
          .filter(file -> file.getFileName().toString().startsWith(FILE_PREFIX))
          .filter(file -> isOlderThan(file, cutoff))
          .forEach(CsvExportSpool::deleteQuietly);
    } catch (IOException e) {
      LOG.warn("Failed to sweep CSV export spool directory {}", dir, e);
    }
  }

  private static boolean isOlderThan(Path file, Instant cutoff) {
    try {
      return Files.getLastModifiedTime(file).toInstant().isBefore(cutoff);
    } catch (IOException e) {
      LOG.warn("Failed to read modification time for spooled export {}", file, e);
      return false;
    }
  }

  private static void deleteQuietly(Path file) {
    try {
      Files.deleteIfExists(file);
      LOG.info("Deleted expired CSV export spool file {}", file);
    } catch (IOException e) {
      LOG.warn("Failed to delete expired CSV export spool file {}", file, e);
    }
  }

  private static Path spoolDir() {
    String configured = System.getenv(SPOOL_DIR_ENV);
    Path dir =
        CommonUtil.nullOrEmpty(configured)
            ? Paths.get(System.getProperty("java.io.tmpdir"), "openmetadata-csv-exports")
            : Paths.get(configured);
    try {
      Files.createDirectories(dir);
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to create CSV export spool directory " + dir, e);
    }
    return dir;
  }
}
