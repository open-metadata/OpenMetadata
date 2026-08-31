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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpServer;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
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
  private final Map<String, byte[]> capturedBodies = new ConcurrentHashMap<>();
  private final Map<String, String> capturedHeaders = new ConcurrentHashMap<>();

  @BeforeEach
  void startStubServer() throws Exception {
    server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
    // Permissive stub: constructor-time admin checks and ontology loads succeed
    // silently; the GSP data endpoint records what the streaming path sent.
    server.createContext(
        "/",
        exchange -> {
          byte[] body = exchange.getRequestBody().readAllBytes();
          // Constructor-time ontology bootstrap also posts RDF; only requests targeting
          // the knowledge graph belong to the streaming append under test.
          String query = exchange.getRequestURI().getQuery();
          if (exchange.getRequestURI().getPath().equals(DATASET_PATH + "/data")
              && query != null
              && query.contains("graph/knowledge")) {
            capturedBodies.put(exchange.getRequestURI().toString(), body);
            String encoding = exchange.getRequestHeaders().getFirst("Content-Encoding");
            if (encoding != null) {
              capturedHeaders.put("Content-Encoding", encoding);
            }
            capturedHeaders.put(
                "Content-Type", exchange.getRequestHeaders().getFirst("Content-Type"));
          }
          exchange.sendResponseHeaders(200, 0);
          exchange.getResponseBody().close();
        });
    server.start();
  }

  @AfterEach
  void stopStubServer() {
    server.stop(0);
    capturedBodies.clear();
    capturedHeaders.clear();
  }

  private JenaFusekiStorage storageWith(boolean gzip) {
    RdfConfiguration config =
        new RdfConfiguration()
            .withEnabled(true)
            .withBaseUri(URI.create("https://open-metadata.org/"))
            .withRemoteEndpoint(
                URI.create("http://localhost:" + server.getAddress().getPort() + DATASET_PATH))
            .withStreamingAppendEnabled(true)
            .withGzipRequests(gzip)
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
}
