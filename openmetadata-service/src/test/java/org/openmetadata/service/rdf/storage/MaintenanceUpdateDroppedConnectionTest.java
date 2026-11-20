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
import java.io.EOFException;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.SocketException;
import java.net.URI;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;

/** Fuseki closing the connection before it answers a CLEAR, as an idle pooled connection does. */
class MaintenanceUpdateDroppedConnectionTest {
  private static final Duration BUDGET = Duration.ofSeconds(5);

  private final AtomicInteger updates = new AtomicInteger();
  private HttpServer server;
  private volatile int dropsLeft;

  @BeforeEach
  void startStub() throws IOException {
    server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
    server.createContext("/", this::handle);
    server.start();
  }

  @AfterEach
  void stopStub() {
    server.stop(0);
  }

  @Test
  void aClearDroppedBeforeItsAnswerIsSentOnceMore() {
    dropsLeft = 1;

    storage().executeMaintenanceUpdate("CLEAR ALL", BUDGET);

    assertEquals(2, updates.get());
  }

  @Test
  void aClearDroppedTwiceFailsAfterOneResend() {
    dropsLeft = 2;

    assertThrows(
        RuntimeException.class, () -> storage().executeMaintenanceUpdate("CLEAR ALL", BUDGET));

    assertEquals(2, updates.get());
  }

  @Test
  void aDroppedConnectionReadsAsEofOrAReset() {
    assertTrue(
        JenaFusekiStorage.isDroppedConnection(
            new RuntimeException(new IOException("no bytes", new EOFException("EOF")))));
    assertTrue(
        JenaFusekiStorage.isDroppedConnection(
            new RuntimeException(new SocketException("Connection reset"))));
    assertFalse(
        JenaFusekiStorage.isDroppedConnection(
            new RuntimeException(new HttpTimeoutException("request timed out"))));
  }

  private JenaFusekiStorage storage() {
    return new JenaFusekiStorage(
        new RdfConfiguration()
            .withEnabled(true)
            .withBaseUri(URI.create("https://open-metadata.org/"))
            .withRemoteEndpoint(
                URI.create("http://localhost:" + server.getAddress().getPort() + "/openmetadata"))
            .withWriteMaxRetries(0),
        delayMs -> {});
  }

  /** Closing an exchange without a response closes the connection the client sent it on. */
  private void handle(final HttpExchange exchange) throws IOException {
    if (isUpdate(exchange) && updates.incrementAndGet() > 0 && dropsLeft > 0) {
      dropsLeft--;
    } else {
      exchange.sendResponseHeaders(200, -1);
    }
    exchange.close();
  }

  private static boolean isUpdate(final HttpExchange exchange) {
    final String contentType = exchange.getRequestHeaders().getFirst("Content-Type");
    return contentType != null && contentType.contains("sparql-update");
  }
}
