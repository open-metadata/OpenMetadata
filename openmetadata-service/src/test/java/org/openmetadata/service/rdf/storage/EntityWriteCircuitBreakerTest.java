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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.apache.jena.rdf.model.ModelFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;

/**
 * An unchanged entity write only reads, so its successful read is the only call that tells the
 * circuit breaker Fuseki answers; otherwise occasional read timeouts add up across a night of
 * unchanged writes until the breaker stops all RDF traffic.
 */
class EntityWriteCircuitBreakerTest {
  private static final byte[] EMPTY_GRAPH = "# empty\n".getBytes(StandardCharsets.UTF_8);
  private static final UUID ENTITY = UUID.randomUUID();

  private final CountDownLatch released = new CountDownLatch(1);
  private final ExecutorService handlers = Executors.newCachedThreadPool();
  private HttpServer server;
  private volatile boolean unresponsive;

  @BeforeEach
  void startStub() throws IOException {
    server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
    server.createContext("/", this::handle);
    server.setExecutor(handlers);
    server.start();
  }

  @AfterEach
  void stopStub() {
    released.countDown();
    server.stop(0);
    handlers.shutdownNow();
  }

  @Test
  void anUnchangedWriteAfterTimedOutReadsClosesTheBreakerAgain() {
    final JenaFusekiStorage storage = storage();
    assertEquals(RdfEntityWriteResult.UNCHANGED, writeEmptyProjection(storage));
    timeOutWrites(storage, 4);
    assertEquals(RdfEntityWriteResult.UNCHANGED, writeEmptyProjection(storage));

    timeOutWrites(storage, 1);

    assertEquals(RdfEntityWriteResult.UNCHANGED, writeEmptyProjection(storage));
  }

  private void timeOutWrites(final JenaFusekiStorage storage, final int count) {
    unresponsive = true;
    for (int attempt = 0; attempt < count; attempt++) {
      final RuntimeException failure =
          assertThrows(RuntimeException.class, () -> writeEmptyProjection(storage));
      assertTrue(JenaFusekiStorage.isTimeoutError(failure), failure::toString);
    }
    unresponsive = false;
  }

  private static RdfEntityWriteResult writeEmptyProjection(final JenaFusekiStorage storage) {
    return storage.storeEntity(
        "table", ENTITY, ModelFactory.createDefaultModel(), RdfEntityWriteStrategy.DIFFERENCE);
  }

  private JenaFusekiStorage storage() {
    return new JenaFusekiStorage(
        new RdfConfiguration()
            .withEnabled(true)
            .withBaseUri(URI.create("https://open-metadata.org/"))
            .withRemoteEndpoint(
                URI.create("http://localhost:" + server.getAddress().getPort() + "/openmetadata"))
            .withRequestTimeoutMs(1000)
            .withWriteMaxRetries(0),
        delayMs -> {});
  }

  /** Answers every read with an empty graph, or holds it past the client deadline. */
  private void handle(final HttpExchange exchange) throws IOException {
    exchange.getRequestBody().readAllBytes();
    if (unresponsive) {
      awaitRelease();
    }
    exchange.getResponseHeaders().add("Content-Type", "application/n-triples");
    exchange.sendResponseHeaders(200, EMPTY_GRAPH.length);
    exchange.getResponseBody().write(EMPTY_GRAPH);
    exchange.close();
  }

  private void awaitRelease() {
    try {
      released.await(10, TimeUnit.SECONDS);
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
    }
  }
}
