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

package org.openmetadata.it.factories;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Optional;

/**
 * A lineage graph that {@code scripts/lineage_seed/seed_lineage_graph.py} already created, read
 * from the manifest it writes.
 *
 * <p>Seeding 2M assets through {@link LineageGraphLoader} takes hours of REST calls inside the test
 * JVM, every run. Seeding once with the script and pointing the benchmark at the result with
 * {@code -Djpw.lineage.seedManifest=<manifest.json>} measures the same scenarios against the same
 * graph as often as needed. The graph is never cleaned up in this mode: the benchmark did not
 * create it.
 */
public final class SeededLineageGraph {

  public static final String MANIFEST_PROPERTY = "jpw.lineage.seedManifest";

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String BENCHMARK_SECTION = "benchmark";
  private static final String FOCUS_SECTION = "focus";

  private SeededLineageGraph() {}

  public static Optional<Path> manifest() {
    final String location = System.getProperty(MANIFEST_PROPERTY);
    return (location == null || location.isBlank())
        ? Optional.empty()
        : Optional.of(Path.of(location.trim()));
  }

  public static LineageGraphSummary read(final Path manifest) {
    final JsonNode benchmark = readTree(manifest).path(BENCHMARK_SECTION);
    if (benchmark.isMissingNode()) {
      throw new IllegalArgumentException(
          manifest + " has no '" + BENCHMARK_SECTION + "' section; re-run the seed script");
    }
    final JsonNode focus = benchmark.path(FOCUS_SECTION);
    return new LineageGraphSummary(
        required(benchmark, "cohortFqnPrefix").asText(),
        required(benchmark, "services").asInt(),
        required(benchmark, "databases").asInt(),
        required(benchmark, "schemas").asInt(),
        required(benchmark, "tables").asInt(),
        required(benchmark, "edges").asInt(),
        required(benchmark, "columnEdges").asInt(),
        Duration.ZERO,
        Duration.ZERO,
        Duration.ZERO,
        new LineageFocusPoints(
            required(focus, "serviceFqn").asText(),
            required(focus, "databaseFqn").asText(),
            required(focus, "schemaFqn").asText(),
            required(focus, "hubTableFqn").asText(),
            required(focus, "leafTableFqn").asText(),
            required(focus, "hubColumnFqn").asText()));
  }

  private static JsonNode readTree(final Path manifest) {
    try {
      return MAPPER.readTree(Files.readString(manifest));
    } catch (IOException e) {
      throw new IllegalArgumentException("Cannot read seed manifest " + manifest, e);
    }
  }

  private static JsonNode required(final JsonNode node, final String field) {
    final JsonNode value = node.path(field);
    if (value.isMissingNode() || value.isNull()) {
      throw new IllegalArgumentException("Seed manifest is missing '" + field + "'");
    }
    return value;
  }
}
