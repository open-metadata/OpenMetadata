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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.rdf.inference.InferenceDirtyMarker;

/**
 * Exercises the Fuseki admin surface blue/green rebuilds depend on — dataset existence, creation,
 * deletion and the Prometheus scrape — against a stub server, so the request shapes and the
 * status-code handling are pinned without a container.
 */
@DisplayName("JenaFusekiStorage dataset administration")
class JenaFusekiDatasetAdminTest {

  private static final String DATASET_PATH = "/openmetadata";

  private HttpServer server;
  private final List<String> requests = new CopyOnWriteArrayList<>();
  private final Map<String, Integer> statusByPath = new ConcurrentHashMap<>();
  private volatile BiFunction<String, String, String> bodyForPath = (method, path) -> "";

  @BeforeEach
  void startStub() throws Exception {
    server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
    server.createContext("/", this::handle);
    server.start();
  }

  private void handle(HttpExchange exchange) throws java.io.IOException {
    exchange.getRequestBody().readAllBytes();
    String method = exchange.getRequestMethod();
    String path = exchange.getRequestURI().getPath();
    requests.add(method + " " + path);
    int status =
        statusByPath.getOrDefault(method + " " + path, statusByPath.getOrDefault(path, 200));
    byte[] body = bodyForPath.apply(method, path).getBytes(StandardCharsets.UTF_8);
    if (method.equals("OPTIONS")) {
      exchange.getResponseHeaders().set(FusekiWriteCapabilities.DEADLINE, "50000");
      exchange.getResponseHeaders().set(FusekiWriteCapabilities.LIMIT, "67108864");
      exchange.getResponseHeaders().set(FusekiWriteCapabilities.UNION, "true");
      exchange.getResponseHeaders().set(FusekiWriteCapabilities.QUERY, "50000");
      exchange.getResponseHeaders().set(FusekiWriteCapabilities.UPDATE, "50000");
    }
    exchange.sendResponseHeaders(status, body.length == 0 ? -1 : body.length);
    if (body.length > 0) {
      exchange.getResponseBody().write(body);
    }
    exchange.close();
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
