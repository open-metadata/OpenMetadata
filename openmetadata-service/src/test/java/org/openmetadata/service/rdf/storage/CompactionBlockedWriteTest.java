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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;

/**
 * Fuseki blocks every writer while it compacts. A write that times out then was held up by
 * maintenance, whoever started it, so it is retried later instead of counting as a failed write.
 */
class CompactionBlockedWriteTest {
  private static final String RUNNING_COMPACTION =
      "[{\"task\":\"Compact\",\"taskId\":\"1\",\"started\":\"2026-10-28T10:00:00Z\"}]";
  private static final String UPDATE = "INSERT DATA { <urn:s> <urn:p> \"o\" }";

  private final CountDownLatch writerReleased = new CountDownLatch(1);
  private final ExecutorService handlers = Executors.newCachedThreadPool();
  private HttpServer server;
  private volatile boolean compacting;

  @BeforeEach
  void startStub() throws IOException {
    server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
    server.createContext("/", this::handle);
    server.setExecutor(handlers);
    server.start();
  }

  @AfterEach
  void stopStub() {
    writerReleased.countDown();
    server.stop(0);
    handlers.shutdownNow();
  }

  @Test
  void aWriteHeldUpByACompactionIsRetriedLaterNotFailed() {
    compacting = true;

    final RuntimeException failure =
        assertThrows(RuntimeException.class, () -> storage().executeSparqlUpdate(UPDATE));

    assertTrue(RdfStorageMaintenanceException.find(failure).isPresent(), failure::toString);
  }

  @Test
  void aTimeoutWithoutACompactionIsStillAnUncertainWrite() {
    final RuntimeException failure =
        assertThrows(RuntimeException.class, () -> storage().executeSparqlUpdate(UPDATE));

    assertFalse(RdfStorageMaintenanceException.find(failure).isPresent(), failure::toString);
    assertTrue(RdfWriteOutcomeUnknownException.isPresent(failure), failure::toString);
  }

  private JenaFusekiStorage storage() {
    return new JenaFusekiStorage(
        new RdfConfiguration()
            .withEnabled(true)
            .withBaseUri(URI.create("https://open-metadata.org/"))
            .withRemoteEndpoint(
                URI.create("http://localhost:" + server.getAddress().getPort() + "/openmetadata"))
            .withRequestTimeoutMs(300)
            .withWriteMaxRetries(0),
        delayMs -> {});
  }

  /** Updates wait like Fuseki's blocked writer; the task list says whether a compaction runs. */
  private void handle(final HttpExchange exchange) throws IOException {
    final String contentType = exchange.getRequestHeaders().getFirst("Content-Type");
    final boolean update = contentType != null && contentType.contains("sparql-update");
    if (update) {
      awaitQuietly(writerReleased);
    }
    final byte[] body =
        exchange.getRequestURI().getPath().equals("/$/tasks")
            ? (compacting ? RUNNING_COMPACTION : "[]").getBytes(StandardCharsets.UTF_8)
            : new byte[0];
    exchange.sendResponseHeaders(200, body.length == 0 ? -1 : body.length);
    if (body.length > 0) {
      exchange.getResponseBody().write(body);
    }
    exchange.close();
  }

  private static void awaitQuietly(final CountDownLatch latch) {
    try {
      latch.await(10, TimeUnit.SECONDS);
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
    }
  }
}
