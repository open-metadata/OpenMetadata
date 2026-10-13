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
package org.openmetadata.fuseki;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStreamReader;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.net.Socket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.zip.GZIPOutputStream;
import org.apache.jena.fuseki.main.FusekiServer;
import org.apache.jena.fuseki.main.sys.FusekiModules;
import org.apache.jena.fuseki.server.Operation;
import org.apache.jena.graph.Graph;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.graph.Triple;
import org.apache.jena.query.ARQ;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.query.ReadWrite;
import org.apache.jena.sparql.core.DatasetGraphWrapper;
import org.apache.jena.sparql.graph.GraphWrapper;
import org.apache.jena.tdb2.TDB2;
import org.apache.jena.tdb2.TDB2Factory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BoundedGraphStoreIT {
  private static final String TRIPLE = "<urn:test:s> <urn:test:p> <urn:test:o> .\n";
  private static final Node GRAPH = NodeFactory.createURI("urn:test:graph");
  @TempDir private Path directory;
  private Dataset dataset;
  private FusekiServer server;
  private HttpClient client;
  private URI endpoint;

  @BeforeEach
  void start() {
    dataset = TDB2Factory.connectDataset(directory.resolve("tdb").toString());
    dataset.getContext().set(TDB2.symUnionDefaultGraph, true);
    dataset.getContext().set(ARQ.queryTimeout, "500");
    dataset.getContext().set(ARQ.updateTimeout, "500");
    server =
        FusekiServer.create()
            .port(0)
            .fusekiModules(FusekiModules.empty())
            .registerOperation(Operation.GSP_RW, new BoundedGraphStore(5000, 1024))
            .add("/review", dataset)
            .build()
            .start();
    client = HttpClient.newHttpClient();
    endpoint =
        URI.create("http://localhost:" + server.getPort() + "/review/data?graph=urn:test:graph");
  }

  @AfterEach
  void stop() {
    client.close();
    server.stop();
    dataset.close();
  }

  @Test
  void deadlineExpiredDuringTdbMutationRollsBackTheWholeTransaction() throws Exception {
    server.stop();
    final AtomicLong now = new AtomicLong();
    final DatasetGraphWrapper delayed =
        new DatasetGraphWrapper(dataset.asDatasetGraph()) {
          @Override
          public Graph getGraph(final Node graph) {
            return new GraphWrapper(super.getGraph(graph)) {
              @Override
              public void add(final Triple triple) {
                super.add(triple);
                now.set(TimeUnit.SECONDS.toNanos(2));
              }
            };
          }
        };
    server =
        FusekiServer.create()
            .port(0)
            .fusekiModules(FusekiModules.empty())
            .registerOperation(Operation.GSP_RW, new BoundedGraphStore(1000, 1024, now::get))
            .add("/review", DatasetFactory.wrap(delayed))
            .build()
            .start();
    endpoint =
        URI.create("http://localhost:" + server.getPort() + "/review/data?graph=urn:test:graph");

    assertEquals(408, post(TRIPLE).statusCode());
    assertEquals(0, tripleCount());
  }

  @Test
  void timedOutUploadDoesNotCommitAndReleasesResources() throws Exception {
    try (Socket socket = new Socket("localhost", server.getPort())) {
      socket.setSoTimeout(3000);
      final String headers =
          "POST /review/data?graph=urn:test:graph HTTP/1.1\r\n"
              + "Host: localhost\r\nContent-Type: application/n-triples\r\nContent-Length: 900\r\n"
              + BoundedGraphStore.DEADLINE_HEADER
              + ": 500\r\n\r\n";
      socket.getOutputStream().write((headers + TRIPLE).getBytes(StandardCharsets.UTF_8));
      socket.getOutputStream().flush();
      final String status =
          new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8))
              .readLine();
      assertTrue(status.contains("408"), status);
      assertEquals(0, tripleCount());
    }
    assertTrue(post(TRIPLE).statusCode() / 100 == 2);
    assertEquals(1, tripleCount());
  }

  @Test
  void receivingAnUploadDoesNotHoldTheTdbWriter() throws Exception {
    try (PipedOutputStream producer = new PipedOutputStream();
        PipedInputStream body = new PipedInputStream(producer)) {
      final var uploading =
          client.sendAsync(
              request(HttpRequest.BodyPublishers.ofInputStream(() -> body)).build(),
              HttpResponse.BodyHandlers.ofString());
      producer.write(TRIPLE.getBytes(StandardCharsets.UTF_8));
      producer.flush();
      final var second =
          client.sendAsync(
              request(HttpRequest.BodyPublishers.ofString(TRIPLE)).build(),
              HttpResponse.BodyHandlers.ofString());
      assertTrue(second.get(2, TimeUnit.SECONDS).statusCode() / 100 == 2);
      assertEquals(1, tripleCount());
      producer.close();
      assertTrue(uploading.get(3, TimeUnit.SECONDS).statusCode() / 100 == 2);
    }
  }

  @Test
  void malformedUploadRollsBackEarlierTriples() throws Exception {
    final HttpResponse<String> response = post(TRIPLE + "this is not RDF");
    assertTrue(response.statusCode() >= 400);
    assertEquals(0, tripleCount());
    assertTrue(post(TRIPLE).statusCode() / 100 == 2);
  }

  @Test
  void stagedTurtleUsesTheRequestUriAsItsBase() throws Exception {
    final HttpResponse<String> response =
        client.send(
            HttpRequest.newBuilder(endpoint)
                .header("Content-Type", "text/turtle")
                .POST(HttpRequest.BodyPublishers.ofString("<subject> <predicate> <object> ."))
                .build(),
            HttpResponse.BodyHandlers.ofString());
    assertTrue(response.statusCode() / 100 == 2, response.body());
    dataset.begin(ReadWrite.READ);
    try {
      assertTrue(
          dataset
              .asDatasetGraph()
              .getGraph(GRAPH)
              .contains(
                  NodeFactory.createURI(endpoint.resolve("subject").toString()),
                  NodeFactory.createURI(endpoint.resolve("predicate").toString()),
                  NodeFactory.createURI(endpoint.resolve("object").toString())));
    } finally {
      dataset.end();
    }
  }

  @Test
  void oversizedGzipUploadIsRejectedBeforeItCanMutateTheDataset() throws Exception {
    final ByteArrayOutputStream compressed = new ByteArrayOutputStream();
    try (GZIPOutputStream gzip = new GZIPOutputStream(compressed)) {
      gzip.write(
          ("<urn:s> <urn:p> \"" + "x".repeat(2048) + "\" .").getBytes(StandardCharsets.UTF_8));
    }
    final HttpResponse<String> response =
        client.send(
            request(HttpRequest.BodyPublishers.ofByteArray(compressed.toByteArray()))
                .header("Content-Encoding", "gzip")
                .build(),
            HttpResponse.BodyHandlers.ofString());
    assertEquals(413, response.statusCode());
    assertEquals(0, tripleCount());
  }

  @Test
  void optionsDescribesTheActualDatasetConfiguration() throws Exception {
    final HttpResponse<String> response =
        client.send(
            HttpRequest.newBuilder(endpoint)
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
                .build(),
            HttpResponse.BodyHandlers.ofString());
    assertEquals(
        "5000", response.headers().firstValue(BoundedGraphStore.DEADLINE_HEADER).orElseThrow());
    assertEquals(
        "true", response.headers().firstValue(BoundedGraphStore.UNION_HEADER).orElseThrow());
    assertEquals(
        "500",
        response.headers().firstValue(BoundedGraphStore.UPDATE_TIMEOUT_HEADER).orElseThrow());
    assertEquals(
        "500", response.headers().firstValue(BoundedGraphStore.QUERY_TIMEOUT_HEADER).orElseThrow());
  }

  private HttpRequest.Builder request(final HttpRequest.BodyPublisher body) {
    return HttpRequest.newBuilder(endpoint)
        .timeout(Duration.ofSeconds(10))
        .header("Content-Type", "application/n-triples")
        .POST(body);
  }

  private HttpResponse<String> post(final String body) throws Exception {
    return client.send(
        request(HttpRequest.BodyPublishers.ofString(body)).build(),
        HttpResponse.BodyHandlers.ofString());
  }

  private long tripleCount() {
    dataset.begin(ReadWrite.READ);
    try {
      return dataset.asDatasetGraph().getGraph(GRAPH).size();
    } finally {
      dataset.end();
    }
  }
}
