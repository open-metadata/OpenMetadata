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

package org.openmetadata.it.bench;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Map;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Writes benchmark output to {@code target/benchmark/}, the directory the nightly scale job uploads
 * as its {@code scale-metrics-*} artifact.
 *
 * <p>The raw {@link #write} form is the long-standing behaviour the reindex and ontology scale ITs
 * already rely on; {@link #publish} wraps a {@link BenchmarkReport} so runs from different releases
 * can be compared mechanically.
 */
public final class BenchmarkMetrics {

  private static final Logger LOG = LoggerFactory.getLogger(BenchmarkMetrics.class);

  /** Bump when a field in {@link BenchmarkReport} or {@link Latency} is renamed or removed. */
  public static final int SCHEMA_VERSION = 1;

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Path OUTPUT_DIR = Path.of("target", "benchmark");
  private static final String UNKNOWN = "unknown";
  private static final String GIT_SHA_PROPERTY = "jpw.bench.gitSha";
  private static final String GIT_SHA_ENV = "GITHUB_SHA";
  private static final String VERSION_PATH = "/v1/system/version";

  private BenchmarkMetrics() {}

  /** Writes {@code metrics} verbatim. Used by the reindex/ontology scale ITs. */
  public static void write(final Object metrics, final String filename) throws IOException {
    Files.createDirectories(OUTPUT_DIR);
    final Path target = OUTPUT_DIR.resolve(filename);
    MAPPER.writerWithDefaultPrettyPrinter().writeValue(target.toFile(), metrics);
    LOG.info("Benchmark metrics written to {}", target.toAbsolutePath());
  }

  public static void publish(final BenchmarkReport report, final String filename)
      throws IOException {
    write(report, filename);
  }

  public static BenchmarkReport report(
      final OpenMetadataClient client,
      final String benchmarkId,
      final Map<String, Object> params,
      final Map<String, Latency> latencies,
      final Map<String, Object> counters) {
    return new BenchmarkReport(
        SCHEMA_VERSION,
        benchmarkId,
        gitSha(),
        serverVersion(client),
        Instant.now().toString(),
        params,
        latencies,
        counters);
  }

  private static String gitSha() {
    final String fromProperty = System.getProperty(GIT_SHA_PROPERTY);
    if (fromProperty != null && !fromProperty.isBlank()) {
      return fromProperty;
    }
    final String fromEnv = System.getenv(GIT_SHA_ENV);
    return (fromEnv != null && !fromEnv.isBlank()) ? fromEnv : UNKNOWN;
  }

  /**
   * Best-effort — a benchmark must still publish its numbers when the version endpoint is
   * unreachable, but the run is then unattributable, so the failure is logged rather than swallowed
   * silently.
   */
  private static String serverVersion(final OpenMetadataClient client) {
    try {
      final String response =
          client.getHttpClient().executeForString(HttpMethod.GET, VERSION_PATH, null);
      final JsonNode version = MAPPER.readTree(response).path("version");
      return version.isMissingNode() ? UNKNOWN : version.asText(UNKNOWN);
    } catch (IOException | RuntimeException e) {
      LOG.warn(
          "Could not read server version from {}; report will be unattributable", VERSION_PATH, e);
      return UNKNOWN;
    }
  }
}
