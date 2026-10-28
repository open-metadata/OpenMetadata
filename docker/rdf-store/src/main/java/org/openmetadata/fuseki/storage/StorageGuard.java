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
package org.openmetadata.fuseki.storage;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.apache.jena.fuseki.servlets.HttpAction;
import org.apache.jena.fuseki.servlets.ServletOps;
import org.apache.jena.web.HttpSC;

/**
 * Refuses writes while the data volume has less free space than a reserve.
 *
 * <p>TDB2 memory-maps its files. A write that needs a page on a full volume does not fail with an
 * I/O error the server can report: the JVM takes SIGBUS and dies, mid-transaction, and keeps dying
 * on every retry. Compaction is also the only way TDB2 gives space back, and it needs free space
 * about the size of the live data to copy it. So writes stop while there is still room to compact:
 * they get 507 Insufficient Storage, nothing is applied, and the client may retry once maintenance
 * has freed space. Reads and compaction are never refused. See
 * ADR:2026-10-28-the-fuseki-image-refuses-writes-below-a-free-space-reserve-and-reports-its-volume.
 */
public final class StorageGuard {
  static final String REFUSAL_MESSAGE =
      "The data volume is below its free-space reserve; writes resume once space is freed";

  public static final String MIN_FREE = "OPENMETADATA_STORAGE_MIN_FREE";
  static final String DEFAULT_MIN_FREE = "10%";
  private static final Pattern PERCENT = Pattern.compile("([1-9][0-9]?)%");
  private static final Pattern SIZE = Pattern.compile("([1-9][0-9]{0,12})([kKmMgGtT]?)");

  private final FileStore volume;
  private final long reserveBytes;

  StorageGuard(final FileStore volume, final long reserveBytes) {
    this.volume = volume;
    this.reserveBytes = reserveBytes;
  }

  /** The guard for the volume that holds {@code databases}, sized from the environment. */
  public static StorageGuard forVolume(
      final Path databases, final Map<String, String> environment) {
    final FileStore volume = fileStore(databases);
    return new StorageGuard(volume, reserve(volume, environment.get(MIN_FREE)));
  }

  static long reserve(final FileStore volume, final String configured) {
    final String value = configured == null || configured.isBlank() ? DEFAULT_MIN_FREE : configured;
    final var percent = PERCENT.matcher(value.trim());
    try {
      return percent.matches()
          ? volume.getTotalSpace() / 100 * Integer.parseInt(percent.group(1))
          : bytes(value.trim());
    } catch (IOException exception) {
      throw new UncheckedIOException(exception);
    }
  }

  /** A size in the JVM's notation, such as 512m or 2g. */
  static long bytes(final String value) {
    final var size = SIZE.matcher(value);
    if (!size.matches()) {
      throw new IllegalArgumentException(
          MIN_FREE
              + " must be a percentage such as 10% or a size such as 20g, got '"
              + value
              + "'");
    }
    final int shift =
        switch (size.group(2).toLowerCase(Locale.ROOT)) {
          case "k" -> 10;
          case "m" -> 20;
          case "g" -> 30;
          case "t" -> 40;
          default -> 0;
        };
    final long number = Long.parseLong(size.group(1));
    if (number > Long.MAX_VALUE >> shift) {
      throw new IllegalArgumentException(MIN_FREE + " is too large: '" + value + "'");
    }
    return number << shift;
  }

  private static FileStore fileStore(final Path path) {
    Path existing = path.toAbsolutePath();
    while (existing != null && !Files.exists(existing)) {
      existing = existing.getParent();
    }
    try {
      return Files.getFileStore(existing);
    } catch (IOException exception) {
      throw new UncheckedIOException(exception);
    }
  }

  /** Answers 507 instead of letting the write reach TDB2 when the volume is low. */
  public void requireWritable(final HttpAction action) {
    if (isLowOnSpace()) {
      ServletOps.error(HttpSC.INSUFFICIENT_STORAGE_507, REFUSAL_MESSAGE);
    }
  }

  public boolean isLowOnSpace() {
    return usableBytes() < reserveBytes;
  }

  public long reserveBytes() {
    return reserveBytes;
  }

  public long usableBytes() {
    try {
      return volume.getUsableSpace();
    } catch (IOException exception) {
      throw new UncheckedIOException(exception);
    }
  }

  public long totalBytes() {
    try {
      return volume.getTotalSpace();
    } catch (IOException exception) {
      throw new UncheckedIOException(exception);
    }
  }
}
