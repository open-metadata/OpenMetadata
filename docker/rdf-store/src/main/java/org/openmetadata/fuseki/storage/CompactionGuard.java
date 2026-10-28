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

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.apache.jena.web.HttpSC;

/**
 * Refuses a compaction the data volume has no room for. TDB2 compacts by copying the live data into
 * a new generation, and a volume that fills during the copy crashes the JVM with SIGBUS. The copy
 * holds only live data, so it is never larger than the generation in service: a compaction starts
 * only when the volume has at least that much free. Reads and writes are not affected. See
 * ADR:2026-10-28-the-fuseki-image-refuses-writes-below-a-free-space-reserve-and-reports-its-volume.
 */
public final class CompactionGuard implements Filter {
  public static final String PATH_SPEC = "/$/compact/*";
  private static final String COMPACT_PATH = "/$/compact/";
  private static final Pattern GENERATION = Pattern.compile("Data-[0-9]{4}");
  private static final Pattern DATASET_NAME = Pattern.compile("[A-Za-z0-9_.-]+");

  private final Path databases;
  private final StorageGuard guard;

  public CompactionGuard(final Path databases, final StorageGuard guard) {
    this.databases = databases;
    this.guard = guard;
  }

  @Override
  public void doFilter(
      final ServletRequest request, final ServletResponse response, final FilterChain chain)
      throws IOException, ServletException {
    final long needed = copyBytes((HttpServletRequest) request);
    final long usable = guard.usableBytes();
    if (usable < needed) {
      ((HttpServletResponse) response)
          .sendError(
              HttpSC.INSUFFICIENT_STORAGE_507,
              "Not enough free space to compact: the copy needs up to "
                  + needed
                  + " bytes and the volume has "
                  + usable
                  + " free. Expand the volume first.");
    } else {
      chain.doFilter(request, response);
    }
  }

  /** The most a compaction of the requested dataset can write; 0 when there is nothing to copy. */
  long copyBytes(final HttpServletRequest request) {
    final String uri = request.getRequestURI();
    final int start = uri.indexOf(COMPACT_PATH);
    final String name = start < 0 ? "" : uri.substring(start + COMPACT_PATH.length());
    final boolean compaction =
        "POST".equalsIgnoreCase(request.getMethod()) && DATASET_NAME.matcher(name).matches();
    return compaction ? servingGenerationBytes(databases.resolve(name)) : 0;
  }

  static long servingGenerationBytes(final Path dataset) {
    return servingGeneration(dataset).map(CompactionGuard::bytes).orElse(0L);
  }

  private static Optional<Path> servingGeneration(final Path dataset) {
    if (!Files.isDirectory(dataset)) {
      return Optional.empty();
    }
    try (Stream<Path> children = Files.list(dataset)) {
      return children
          .filter(Files::isDirectory)
          .filter(path -> GENERATION.matcher(path.getFileName().toString()).matches())
          .max(Comparator.comparing(path -> path.getFileName().toString()));
    } catch (IOException exception) {
      throw new UncheckedIOException(exception);
    }
  }

  private static long bytes(final Path directory) {
    try (Stream<Path> files = Files.walk(directory)) {
      return files.filter(Files::isRegularFile).mapToLong(CompactionGuard::size).sum();
    } catch (IOException exception) {
      throw new UncheckedIOException(exception);
    }
  }

  private static long size(final Path file) {
    try {
      return Files.size(file);
    } catch (IOException exception) {
      // A file removed by a finishing compaction while the walk runs.
      return 0;
    }
  }
}
