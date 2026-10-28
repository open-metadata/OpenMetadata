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
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.apache.jena.atlas.json.JsonArray;
import org.apache.jena.atlas.json.JsonObject;

/**
 * How the TDB2 datasets use the data volume, for the client that decides when to compact.
 *
 * <p>A TDB2 dataset directory holds one generation per compaction, {@code Data-0001},
 * {@code Data-0002}, and so on; the highest is the one in service. A lower one is left behind only
 * when the server stopped between switching to a compacted copy and deleting the old one, and is
 * reported as orphaned. Sizes are the files' lengths: TDB2 grows its files in chunks, so a freshly
 * compacted dataset reports more than its data, which is why the client compares a dataset with
 * its own size after the last compaction rather than with a fixed number.
 */
public record StorageReport(
    long totalBytes,
    long usableBytes,
    long reserveBytes,
    boolean lowOnSpace,
    List<DatasetStorage> datasets) {
  private static final Pattern GENERATION = Pattern.compile("Data-[0-9]{4}");

  public record DatasetStorage(
      String name, String generation, long generationBytes, List<String> orphanedGenerations) {
    JsonObject toJson() {
      final JsonObject json = new JsonObject();
      json.put("name", name);
      json.put("generation", generation);
      json.put("generationBytes", generationBytes);
      final JsonArray orphaned = new JsonArray();
      orphanedGenerations.forEach(orphaned::add);
      json.put("orphanedGenerations", orphaned);
      return json;
    }
  }

  public static StorageReport of(final Path databases, final StorageGuard guard) {
    return new StorageReport(
        guard.totalBytes(),
        guard.usableBytes(),
        guard.reserveBytes(),
        guard.isLowOnSpace(),
        datasets(databases));
  }

  static List<DatasetStorage> datasets(final Path databases) {
    if (!Files.isDirectory(databases)) {
      return List.of();
    }
    try (Stream<Path> children = Files.list(databases)) {
      return children
          .filter(Files::isDirectory)
          .sorted()
          .map(StorageReport::dataset)
          .flatMap(Stream::ofNullable)
          .toList();
    } catch (IOException exception) {
      throw new UncheckedIOException(exception);
    }
  }

  private static DatasetStorage dataset(final Path directory) {
    final List<Path> generations = generations(directory);
    if (generations.isEmpty()) {
      return null;
    }
    final Path serving = generations.getLast();
    return new DatasetStorage(
        directory.getFileName().toString(),
        serving.getFileName().toString(),
        bytes(serving),
        generations.subList(0, generations.size() - 1).stream()
            .map(path -> path.getFileName().toString())
            .toList());
  }

  static List<Path> generations(final Path directory) {
    try (Stream<Path> children = Files.list(directory)) {
      return children
          .filter(Files::isDirectory)
          .filter(path -> GENERATION.matcher(path.getFileName().toString()).matches())
          .sorted(Comparator.comparing(path -> path.getFileName().toString()))
          .toList();
    } catch (IOException exception) {
      throw new UncheckedIOException(exception);
    }
  }

  private static long bytes(final Path directory) {
    try (Stream<Path> files = Files.walk(directory)) {
      return files.filter(Files::isRegularFile).mapToLong(StorageReport::size).sum();
    } catch (IOException exception) {
      throw new UncheckedIOException(exception);
    }
  }

  private static long size(final Path file) {
    try {
      return Files.size(file);
    } catch (IOException exception) {
      // A file removed by a finishing compaction while the report walks the tree.
      return 0;
    }
  }

  public JsonObject toJson() {
    final JsonObject json = new JsonObject();
    json.put("totalBytes", totalBytes);
    json.put("usableBytes", usableBytes);
    json.put("reserveBytes", reserveBytes);
    json.put("lowOnSpace", lowOnSpace);
    final JsonArray array = new JsonArray();
    datasets.forEach(dataset -> array.add(dataset.toJson()));
    json.put("datasets", array);
    return json;
  }
}
