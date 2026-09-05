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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpServer;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.GZIPInputStream;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFParser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.rdf.RdfWriteMode;

/**
 * Byte-level round-trip for the streamed GSP append: everything the storage layer streams into
 * the request body must parse back (RDF Thrift, optionally gzipped) to exactly the triples of the
 * submitted models — including blank nodes, whose label scoping is the reason the body is one
 * continuous stream rather than concatenated fragments.
 */
@DisplayName("JenaFusekiStorage streaming append round-trip")
class JenaFusekiStreamingAppendTest {

  private static final String DATASET_PATH = "/openmetadata";

  private HttpServer server;
  private ExecutorService serverExecutor;
  private final Map<String, byte[]> capturedBodies = new ConcurrentHashMap<>();
  private final Map<String, String> capturedHeaders = new ConcurrentHashMap<>();
  private final AtomicInteger appendRequests = new AtomicInteger();
  private final AtomicInteger mutationRequests = new AtomicInteger();
  private final AtomicInteger activeMutations = new AtomicInteger();
  private final AtomicInteger maxActiveMutations = new AtomicInteger();
  private final CountDownLatch firstMutationStarted = new CountDownLatch(1);
  private final CountDownLatch releaseFirstMutation = new CountDownLatch(1);
  private volatile boolean blockFirstMutation;

  @BeforeEach
  void startStubServer() throws Exception {
    server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
    serverExecutor = Executors.newFixedThreadPool(4);
    server.setExecutor(serverExecutor);
    // Permissive stub: constructor-time admin checks and ontology loads succeed
    // silently; the GSP data endpoint records what the streaming path sent.
    server.createContext(
        "/",
        exchange -> {
          String query = exchange.getRequestURI().getQuery();
          boolean knowledgeGraphAppend =
              exchange.getRequestURI().getPath().equals(DATASET_PATH + "/data")
                  && query != null
                  && query.contains("graph/knowledge");
          String contentType = exchange.getRequestHeaders().getFirst("Content-Type");
          boolean sparqlUpdate =
              contentType != null && contentType.contains("application/sparql-update");
          boolean mutation =
              knowledgeGraphAppend
                  || sparqlUpdate
                  || exchange.getRequestURI().getPath().equals(DATASET_PATH + "/update");
          String accept = exchange.getRequestHeaders().getFirst("Accept");
          boolean sparqlQuery =
              !mutation
                  && exchange.getRequestURI().getPath().startsWith(DATASET_PATH)
                  && accept != null
                  && accept.contains("sparql-results");
          int requestNumber = 0;
          if (mutation) {
            requestNumber = mutationRequests.incrementAndGet();
            int active = activeMutations.incrementAndGet();
            maxActiveMutations.accumulateAndGet(active, Math::max);
            firstMutationStarted.countDown();
          }
          if (knowledgeGraphAppend) {
            appendRequests.incrementAndGet();
          }
          try {
            if (blockFirstMutation && requestNumber == 1) {
              releaseFirstMutation.await(5, TimeUnit.SECONDS);
            }
            byte[] body = exchange.getRequestBody().readAllBytes();
            // Constructor-time ontology bootstrap also posts RDF; only requests targeting
            // the knowledge graph belong to the streaming append under test.
            if (knowledgeGraphAppend) {
              capturedBodies.put(exchange.getRequestURI().toString(), body);
              String encoding = exchange.getRequestHeaders().getFirst("Content-Encoding");
              if (encoding != null) {
                capturedHeaders.put("Content-Encoding", encoding);
              }
              capturedHeaders.put(
                  "Content-Type", exchange.getRequestHeaders().getFirst("Content-Type"));
            }
            byte[] responseBody = new byte[0];
            if (sparqlQuery) {
              responseBody = "{\"head\":{},\"boolean\":false}".getBytes(StandardCharsets.UTF_8);
              exchange.getResponseHeaders().set("Content-Type", "application/sparql-results+json");
            }
            exchange.sendResponseHeaders(200, responseBody.length);
            exchange.getResponseBody().write(responseBody);
            exchange.getResponseBody().close();
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            exchange.sendResponseHeaders(503, -1);
          } finally {
            if (mutation) {
              activeMutations.decrementAndGet();
            }
          }
        });
    server.start();
  }

  @AfterEach
  void stopStubServer() {
    releaseFirstMutation.countDown();
    server.stop(0);
    serverExecutor.shutdownNow();
    capturedBodies.clear();
    capturedHeaders.clear();
  }

  private JenaFusekiStorage storageWith(boolean gzip) {
    return storageWith(gzip, 60_000);
  }

  private JenaFusekiStorage storageWith(boolean gzip, int requestTimeoutMs) {
    RdfConfiguration config =
        new RdfConfiguration()
            .withEnabled(true)
            .withBaseUri(URI.create("https://open-metadata.org/"))
            .withRemoteEndpoint(
                URI.create("http://localhost:" + server.getAddress().getPort() + DATASET_PATH))
            .withStreamingAppendEnabled(true)
            .withGzipRequests(gzip)
            .withRequestTimeoutMs(requestTimeoutMs)
            .withWriteMaxRetries(0);
    return new JenaFusekiStorage(config, delayMs -> {});
  }

  private static RdfStorageInterface.EntityWriteRequest entityWithBlankNode(String name) {
    UUID id = UUID.randomUUID();
    Model model = ModelFactory.createDefaultModel();
    Resource entity = model.createResource("https://open-metadata.org/entity/table/" + id);
    entity.addProperty(model.createProperty("https://open-metadata.org/ontology/name"), name);
    Resource lifeCycle = model.createResource();
    lifeCycle.addProperty(
        model.createProperty("https://open-metadata.org/ontology/stage"), "Active");
    entity.addProperty(
        model.createProperty("https://open-metadata.org/ontology/hasLifeCycle"), lifeCycle);
    return new RdfStorageInterface.EntityWriteRequest("table", id, model);
  }

  private Model parseCapturedBody(boolean gzipped) throws Exception {
    byte[] body = capturedBodies.values().iterator().next();
    InputStream in = new ByteArrayInputStream(body);
    if (gzipped) {
      in = new GZIPInputStream(in);
    }
    Model parsed = ModelFactory.createDefaultModel();
    RDFParser.source(in).lang(Lang.RDFTHRIFT).parse(parsed);
    return parsed;
  }

  @Test
  @DisplayName("streamed body parses back to exactly the submitted triples (blank nodes intact)")
  void streamedBodyRoundTrips() throws Exception {
    JenaFusekiStorage storage = storageWith(false);
    List<RdfStorageInterface.EntityWriteRequest> requests =
        List.of(entityWithBlankNode("orders"), entityWithBlankNode("customers"));
    Model expected = ModelFactory.createDefaultModel();
    requests.forEach(request -> expected.add(request.model()));

    storage.bulkStoreEntities(requests, RdfWriteMode.INSERT_ONLY);

    assertEquals(1, capturedBodies.size(), "one streamed request per chunk");
    assertEquals("application/rdf+thrift", capturedHeaders.get("Content-Type"));
    assertNull(capturedHeaders.get("Content-Encoding"), "no encoding header without gzip");
    Model parsed = parseCapturedBody(false);
    assertTrue(
        expected.isIsomorphicWith(parsed),
        "streamed triples must be isomorphic with the submitted models");
  }

  @Test
  @DisplayName("gzip mode compresses the body and never sends deflate")
  void gzipModeCompressesBody() throws Exception {
    JenaFusekiStorage storage = storageWith(true);
    List<RdfStorageInterface.EntityWriteRequest> requests = List.of(entityWithBlankNode("orders"));
    Model expected = ModelFactory.createDefaultModel();
    requests.forEach(request -> expected.add(request.model()));

    storage.bulkStoreEntities(requests, RdfWriteMode.INSERT_ONLY);

    assertEquals("gzip", capturedHeaders.get("Content-Encoding"));
    Model parsed = parseCapturedBody(true);
    assertTrue(expected.isIsomorphicWith(parsed));
  }

  @Test
  @DisplayName("reads stay concurrent while scheduled and live writes share one writer")
  void liveAndScheduledWritesAreSerializedAtTheStorageBoundary() throws Exception {
    JenaFusekiStorage storage = storageWith(false);
    blockFirstMutation = true;
    ExecutorService callers = Executors.newFixedThreadPool(3);
    try {
      Future<?> first =
          callers.submit(
              () ->
                  storage.bulkStoreEntities(
                      List.of(entityWithBlankNode("orders")), RdfWriteMode.INSERT_ONLY));
      assertTrue(firstMutationStarted.await(5, TimeUnit.SECONDS));
      Future<String> read =
          callers.submit(() -> storage.executeSparqlQuery("ASK { ?s ?p ?o }", "json"));
      assertTrue(read.get(2, TimeUnit.SECONDS).contains("false"));
      assertFalse(first.isDone(), "the read must not wait for the active writer");
      RdfStorageInterface.EntityWriteRequest liveEntity = entityWithBlankNode("customers");
      Future<?> second =
          callers.submit(
              () ->
                  storage.storeEntity(
                      liveEntity.entityType(), liveEntity.entityId(), liveEntity.model()));

      assertFalse(
          waitForMutationCount(2, 250),
          "a live write reached Fuseki while a rebuild write was active");
      releaseFirstMutation.countDown();
      first.get(5, TimeUnit.SECONDS);
      second.get(5, TimeUnit.SECONDS);

      assertEquals(2, mutationRequests.get());
      assertEquals(1, appendRequests.get());
      assertEquals(1, maxActiveMutations.get());
    } finally {
      releaseFirstMutation.countDown();
      callers.shutdownNow();
    }
  }

  @Test
  @DisplayName("a write that times out in the writer queue cannot execute later")
  void timedOutQueuedWriteIsCancelled() throws Exception {
    JenaFusekiStorage storage = storageWith(false, 500);
    CountDownLatch releaseActiveWrite = new CountDownLatch(1);
    CountDownLatch activeWriteFinished = new CountDownLatch(1);
    CountDownLatch queuedWriteExecuted = new CountDownLatch(1);
    AtomicBoolean activeWriteStarted = new AtomicBoolean();

    try {
      assertThrows(
          RuntimeException.class,
          () ->
              storage.runWriteWithTimeout(
                  () -> {
                    activeWriteStarted.set(true);
                    try {
                      awaitIgnoringInterrupt(releaseActiveWrite);
                    } finally {
                      activeWriteFinished.countDown();
                    }
                  },
                  "activeWrite"));
      assertTrue(activeWriteStarted.get());

      assertThrows(
          RuntimeException.class,
          () -> storage.runWriteWithTimeout(queuedWriteExecuted::countDown, "queuedWrite"));
    } finally {
      releaseActiveWrite.countDown();
    }

    assertTrue(activeWriteFinished.await(2, TimeUnit.SECONDS));
    assertFalse(
        queuedWriteExecuted.await(250, TimeUnit.MILLISECONDS),
        "a timed-out queued write executed after the active writer released its permit");
  }

  private static void awaitIgnoringInterrupt(CountDownLatch release) {
    boolean released = false;
    while (!released) {
      try {
        released = release.await(2, TimeUnit.SECONDS);
      } catch (InterruptedException ignored) {
        // A server call may ignore cancellation; the writer permit must remain held until it exits.
      }
    }
  }

  private boolean waitForMutationCount(int expected, long timeoutMs) throws InterruptedException {
    long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs);
    while (mutationRequests.get() < expected && System.nanoTime() < deadline) {
      TimeUnit.MILLISECONDS.sleep(10);
    }
    return mutationRequests.get() >= expected;
  }
}
