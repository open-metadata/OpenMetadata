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
package org.openmetadata.service.rdf.storage;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.OptionalLong;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.BiFunction;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.rdf.inference.InferenceDirtyMarker;

/**
 * Exercises the Fuseki admin surface blue/green rebuilds depend on — dataset existence, readiness,
 * deletion and the Prometheus scrape — against a stub server, so the request shapes and the
 * status-code handling are pinned without a container.
 */
@DisplayName("JenaFusekiStorage dataset administration")
class JenaFusekiDatasetAdminTest {

  private static final String DATASET_PATH = "/openmetadata";
  private static final Pattern PROBE_SUBJECT = Pattern.compile("<urn:uuid:[^>]+>");
  private static final Map<String, String> EXTENSION_HEADERS =
      Map.of(
          FusekiWriteCapabilities.DEADLINE, "50000",
          FusekiWriteCapabilities.LIMIT, "67108864",
          FusekiWriteCapabilities.UNION, "true",
          FusekiWriteCapabilities.QUERY, "50000",
          FusekiWriteCapabilities.UPDATE, "50000");

  private HttpServer server;
  private final List<String> requests = new CopyOnWriteArrayList<>();
  private final List<String> updates = new CopyOnWriteArrayList<>();
  private final Map<String, Integer> statusByPath = new ConcurrentHashMap<>();
  private volatile BiFunction<String, String, String> bodyForPath = (method, path) -> "";
  private volatile Map<String, String> optionsHeaders = EXTENSION_HEADERS;
  private volatile boolean askAnswer = true;

  @BeforeEach
  void startStub() throws Exception {
    server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
    server.createContext("/", this::handle);
    server.start();
  }

  private void handle(HttpExchange exchange) throws java.io.IOException {
    String request = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    String method = exchange.getRequestMethod();
    String path = exchange.getRequestURI().getPath();
    requests.add(method + " " + path);
    if (hasHeader(exchange, "Content-Type", "application/sparql-update")) {
      updates.add(request);
    }
    int status =
        statusByPath.getOrDefault(method + " " + path, statusByPath.getOrDefault(path, 200));
    byte[] body = bodyForPath.apply(method, path).getBytes(StandardCharsets.UTF_8);
    if (hasHeader(exchange, "Accept", "sparql-results")) {
      body = ("{\"head\":{},\"boolean\":" + askAnswer + "}").getBytes(StandardCharsets.UTF_8);
      exchange.getResponseHeaders().set("Content-Type", "application/sparql-results+json");
    }
    if (method.equals("OPTIONS")) {
      optionsHeaders.forEach(exchange.getResponseHeaders()::set);
    }
    exchange.sendResponseHeaders(status, body.length == 0 ? -1 : body.length);
    if (body.length > 0) {
      exchange.getResponseBody().write(body);
    }
    exchange.close();
  }

  private static boolean hasHeader(HttpExchange exchange, String name, String fragment) {
    String value = exchange.getRequestHeaders().getFirst(name);
    return value != null && value.contains(fragment);
  }

  @AfterEach
  void stopStub() {
    server.stop(0);
  }

  private JenaFusekiStorage storage() {
    RdfConfiguration config =
        new RdfConfiguration()
            .withEnabled(true)
            .withBaseUri(URI.create("https://open-metadata.org/"))
            .withRemoteEndpoint(
                URI.create("http://localhost:" + server.getAddress().getPort() + DATASET_PATH))
            .withWriteMaxRetries(0);
    return new JenaFusekiStorage(config, delayMs -> {});
  }

  @Test
  void productionDecoratorPreservesDatasetCapabilities() {
    JenaFusekiStorage storage = storage();
    try {
      RdfStorageInterface wrapped =
          new InferenceInvalidatingRdfStorage(storage, InferenceDirtyMarker.NO_OP);

      assertTrue(wrapped.supportsDatasetManagement());
      assertEquals("openmetadata", wrapped.currentDatasetName());
      wrapped.repointToDataset("openmetadata_a");
      assertEquals("openmetadata_a", wrapped.currentDatasetName());
      assertTrue(wrapped.datasetExists("openmetadata_a"));
      wrapped.createDatasetIfMissing("openmetadata_a");
      wrapped.deleteDataset("openmetadata_b");
      assertTrue(requests.contains("DELETE /$/datasets/openmetadata_b"));
    } finally {
      storage.close();
    }
  }

  @Test
  void productionDecoratorExposesServerHeap() {
    bodyForPath =
        (method, path) ->
            path.equals("/$/metrics")
                ? "jvm_memory_max_bytes{area=\"heap\",id=\"G1 Old Gen\",} 4.294967296E9\n"
                : "";
    JenaFusekiStorage storage = storage();
    try {
      RdfStorageInterface wrapped =
          new InferenceInvalidatingRdfStorage(storage, InferenceDirtyMarker.NO_OP);

      assertEquals(OptionalLong.of(4L << 30), wrapped.fetchServerMaxHeapBytes());
    } finally {
      storage.close();
    }
  }

  @Test
  @DisplayName("dataset existence maps 200 to present and 404 to absent")
  void datasetExistenceFollowsStatusCode() {
    JenaFusekiStorage storage = storage();

    statusByPath.put("/$/datasets/build_a", 200);
    assertTrue(storage.datasetExists("build_a"));

    statusByPath.put("/$/datasets/build_a", 404);
    assertFalse(storage.datasetExists("build_a"));
  }

  @Test
  void missingDatasetRequiresEquivalentAssemblerConfiguration() {
    try (JenaFusekiStorage storage = storage()) {
      statusByPath.put("OPTIONS /build_b/data", 404);
      requests.clear();
      assertThrows(IllegalStateException.class, () -> storage.createDatasetIfMissing("build_b"));
      assertFalse(requests.contains("POST /$/datasets"));
    }
  }

  @Test
  @DisplayName("a dataset on Fuseki without the OpenMetadata extension is usable")
  void datasetWithoutTheExtensionIsUsable() {
    optionsHeaders = Map.of(FusekiWriteCapabilities.REQUEST_ID, "1");
    try (JenaFusekiStorage storage = storage()) {
      assertDoesNotThrow(() -> storage.createDatasetIfMissing("build_a"));
    }
  }

  @Test
  @DisplayName("a path answered without a Fuseki request id names the dataset that was probed")
  void pathWithoutADatasetIsReportedAsMissing() {
    optionsHeaders = Map.of();
    try (JenaFusekiStorage storage = storage()) {
      IllegalStateException failure =
          assertThrows(
              IllegalStateException.class, () -> storage.createDatasetIfMissing("build_a"));
      assertTrue(failure.getMessage().contains("'build_a' does not exist"), failure.getMessage());
    }
  }

  @Test
  @DisplayName(
      "readiness writes a probe into a named graph, sees it without GRAPH, then removes it")
  void readinessProbesTheUnionDefaultGraphAndRemovesTheProbe() {
    try (JenaFusekiStorage storage = storage()) {
      assertDoesNotThrow(storage::ensureStorageReady);

      assertProbeWrittenThenRemoved();
    }
  }

  @Test
  @DisplayName("a build dataset whose default graph hides named graphs fails and is left clean")
  void buildDatasetWithoutUnionDefaultGraphFailsAndIsLeftClean() {
    try (JenaFusekiStorage storage = storage()) {
      askAnswer = false;
      requests.clear();

      IllegalStateException failure =
          assertThrows(
              IllegalStateException.class, () -> storage.createDatasetIfMissing("build_a"));

      assertTrue(failure.getMessage().contains("tdb2:unionDefaultGraph"), failure.getMessage());
      assertTrue(failure.getMessage().contains("'build_a'"), failure.getMessage());
      assertTrue(requests.contains("POST /build_a"), requests.toString());
      assertProbeWrittenThenRemoved();
    }
  }

  @Test
  @DisplayName("a dataset that rejects SPARQL updates fails readiness naming the status")
  void datasetRejectingUpdatesFailsNamingTheStatus() {
    try (JenaFusekiStorage storage = storage()) {
      statusByPath.put("POST /build_a", 400);

      IllegalStateException failure =
          assertThrows(
              IllegalStateException.class, () -> storage.createDatasetIfMissing("build_a"));

      assertTrue(
          failure.getMessage().contains("did not accept a SPARQL update (HTTP 400)"),
          failure.getMessage());
      assertTrue(failure.getMessage().contains("'build_a'"), failure.getMessage());
    }
  }

  @Test
  @DisplayName("a probe write with an unknown outcome is still removed, since it may land later")
  void probeWriteWithAnUnknownOutcomeIsStillRemoved() {
    try (JenaFusekiStorage storage = storage()) {
      statusByPath.put("POST /build_a", 503);

      IllegalStateException failure =
          assertThrows(
              IllegalStateException.class, () -> storage.createDatasetIfMissing("build_a"));

      assertTrue(
          failure.getMessage().contains("did not accept a SPARQL update (HTTP 503)"),
          failure.getMessage());
      assertProbeWrittenThenRemoved();
    }
  }

  private void assertProbeWrittenThenRemoved() {
    assertEquals(2, updates.size(), updates.toString());
    assertTrue(updates.getFirst().contains("INSERT DATA"), updates.getFirst());
    assertTrue(updates.getLast().contains("DELETE DATA"), updates.getLast());
    assertEquals(probeSubject(updates.getFirst()), probeSubject(updates.getLast()));
  }

  private static String probeSubject(String update) {
    Matcher subject = PROBE_SUBJECT.matcher(update);
    assertTrue(subject.find(), update);
    return subject.group();
  }

  @Test
  @DisplayName("an existing dataset is not re-created")
  void createDatasetIfMissingSkipsWhenPresent() {
    JenaFusekiStorage storage = storage();
    statusByPath.put("/$/datasets/build_a", 200);
    requests.clear();

    storage.createDatasetIfMissing("build_a");

    assertFalse(requests.contains("POST /$/datasets"), "an existing dataset must not be recreated");
  }

  @Test
  @DisplayName("deleting tolerates 404 but surfaces other failures")
  void deleteDatasetTreatsMissingAsDone() {
    JenaFusekiStorage storage = storage();

    statusByPath.put("DELETE /$/datasets/build_a", 404);
    storage.deleteDataset("build_a");

    statusByPath.put("DELETE /$/datasets/build_a", 500);
    IllegalStateException failure =
        assertThrows(IllegalStateException.class, () -> storage.deleteDataset("build_a"));
    assertTrue(failure.getMessage().contains("build_a"));
  }

  @Test
  @DisplayName("server heap is read from the Prometheus endpoint, and absent metrics are empty")
  void serverHeapComesFromMetricsEndpoint() {
    JenaFusekiStorage storage = storage();
    bodyForPath =
        (method, path) ->
            path.equals("/$/metrics")
                ? "jvm_memory_max_bytes{area=\"heap\",id=\"G1 Old Gen\",} 4.294967296E9\n"
                : "";

    OptionalLong heap = storage.fetchServerMaxHeapBytes();
    assertTrue(heap.isPresent());
    assertEquals(4L << 30, heap.getAsLong());

    statusByPath.put("/$/metrics", 401);
    assertTrue(
        storage.fetchServerMaxHeapBytes().isEmpty(),
        "an unauthorized scrape must fall back to defaults rather than fail the run");
  }
}
