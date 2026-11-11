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

package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.graph.Triple;
import org.apache.jena.query.QueryDeniedException;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFParser;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.configuration.rdf.SparqlFederationConfig;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;

class OntologySparqlQueryServiceTest {
  private static final UUID GLOSSARY_ID = UUID.randomUUID();

  @Test
  void rejectsSingleValueGrowthWithoutExhaustingTheServerHeap() {
    final StringBuilder query = new StringBuilder("SELECT ?s27 WHERE { BIND(\"12345678\" AS ?s0) ");
    for (int index = 1; index <= 27; index++) {
      query.append("BIND(CONCAT(?s%d, ?s%d) AS ?s%d) ".formatted(index - 1, index - 1, index));
    }
    query.append('}');
    final Model model = ModelFactory.createDefaultModel();

    final var failure =
        assertThrows(
            SparqlQueryLimits.QueryLimitExceededException.class,
            () -> service(model).query(GLOSSARY_ID, request(query.toString())));

    assertTrue(failure.getMessage().contains("query or inference"), failure.getMessage());
    assertTrue(model.isClosed());
    assertTrue(
        service(modelWithStatement())
            .query(GLOSSARY_ID, request("ASK { ?s ?p ?o }"))
            .body()
            .contains("true"));
  }

  @ParameterizedTest
  @MethodSource("memoryIntensiveQueries")
  void containsIntermediateAndOptimizerAllocations(final String query) {
    final Model model = ModelFactory.createDefaultModel();
    for (int index = 0; index < 706; index++) {
      model.add(
          model.createResource("urn:subject:" + index),
          model.createProperty("urn:predicate"),
          model.createLiteral("value:" + index));
    }

    final RuntimeException failure =
        assertThrows(
            RuntimeException.class,
            () -> service(model).query(GLOSSARY_ID, request(query).withTimeout(10_000)));
    assertTrue(
        failure instanceof SparqlQueryLimits.QueryLimitExceededException
            || failure instanceof SparqlQueryExecutionGuard.QueryTimeoutException,
        failure.toString());
    assertTrue(model.isClosed());
  }

  private static Stream<String> memoryIntensiveQueries() {
    final String product = "{ ?a ?b ?c . ?d ?e ?f . ?g ?h ?i }";
    final String values =
        IntStream.range(0, 600).mapToObj(Integer::toString).collect(Collectors.joining(" "));
    final String valueProduct =
        "{ VALUES ?a { %s } VALUES ?b { %s } VALUES ?c { %s } }".formatted(values, values, values);
    String expression = "\"abcdefgh\"";
    for (int index = 0; index < 27; index++) {
      expression = "REPLACE(" + expression + ", \"(.)\", \"$1$1\")";
    }
    return Stream.of(
        "SELECT * WHERE " + product + " ORDER BY ?c",
        "SELECT * WHERE " + product + " ORDER BY ?c LIMIT 10000",
        "SELECT ?a ?b ?c ?d ?e ?f WHERE " + product + " GROUP BY ?a ?b ?c ?d ?e ?f",
        "SELECT * WHERE " + valueProduct + " ORDER BY ?c",
        "SELECT * WHERE { { SELECT * WHERE " + product + " ORDER BY ?c } }",
        "SELECT (" + expression + " AS ?value) WHERE {}",
        "SELECT (GROUP_CONCAT(?c) AS ?value) WHERE " + product,
        "SELECT ?wide WHERE { VALUES ?a { %s } VALUES ?b { %s } BIND(CONCAT(\"%s\", STR(?a), STR(?b)) AS ?wide) } ORDER BY ?wide"
            .formatted(values, values, "x".repeat(4_096)));
  }

  @Test
  void rejectsOversizedOutputBeforeReturningAPartialResult() {
    final Model model = ModelFactory.createDefaultModel();
    model.add(
        model.createResource("urn:subject"),
        model.createProperty("urn:predicate"),
        model.createLiteral("\u754c".repeat(4_000)));
    final String values =
        IntStream.range(0, 1_000).mapToObj(Integer::toString).collect(Collectors.joining(" "));

    final var failure =
        assertThrows(
            SparqlQueryLimits.QueryLimitExceededException.class,
            () ->
                service(model)
                    .query(
                        GLOSSARY_ID,
                        request(
                            "SELECT ?value WHERE { ?s ?p ?value . VALUES ?n { "
                                + values
                                + " } }")));

    assertTrue(failure.getMessage().contains("response"), failure.getMessage());
    assertTrue(model.isClosed());
  }

  @ParameterizedTest
  @EnumSource(
      value = SparqlQuery.Format.class,
      names = {"JSON", "XML", "CSV", "TSV"})
  void preservesTupleFormats(final SparqlQuery.Format format) {
    final var result =
        service(modelWithStatement())
            .query(GLOSSARY_ID, request("SELECT ?s WHERE { ?s ?p ?o }").withFormat(format));

    assertTrue(result.body().contains("urn:subject"), result.body());
    assertEquals(format.value(), result.format());
  }

  @ParameterizedTest
  @EnumSource(
      value = SparqlQuery.Format.class,
      names = {"TURTLE", "RDFXML", "NTRIPLES", "JSONLD"})
  void preservesDescribeFormats(final SparqlQuery.Format format) {
    final Model model = ModelFactory.createDefaultModel();
    model.add(
        model.createResource("https://example.com/subject"),
        model.createProperty("https://example.com/predicate"),
        model.createResource("https://example.com/object"));
    final var result =
        service(model)
            .query(
                GLOSSARY_ID, request("DESCRIBE <https://example.com/subject>").withFormat(format));

    assertTrue(result.body().contains("https://example.com/subject"), result.body());
    assertEquals(format.value(), result.format());
  }

  @ParameterizedTest
  @ValueSource(strings = {"DESCRIBE <https://example.com/subject>", "CONSTRUCT WHERE { ?s ?p ?o }"})
  void preservesCustomPrefixesInGraphResults(final String query) {
    final Model model = ModelFactory.createDefaultModel();
    model.setNsPrefix("custom", "https://example.com/");
    model.setNsPrefix("", "https://example.com/default/");
    final String longNamespace = "https://example.com/" + "x".repeat(65_536) + "/";
    model.setNsPrefix("long", longNamespace);
    model.add(
        model.createResource("https://example.com/subject"),
        model.createProperty("https://example.com/predicate"),
        model.createResource("https://example.com/object"));

    final var result =
        service(model).query(GLOSSARY_ID, request(query).withFormat(SparqlQuery.Format.TURTLE));
    final Model parsed = RDFParser.fromString(result.body(), Lang.TURTLE).toModel();
    try {
      assertEquals("https://example.com/", parsed.getNsPrefixURI("custom"), result.body());
      assertEquals("https://example.com/default/", parsed.getNsPrefixURI(""));
      assertEquals(longNamespace, parsed.getNsPrefixURI("long"));
      assertEquals(1, parsed.size());
    } finally {
      parsed.close();
    }
  }

  @Test
  void rejectsInvalidQueryWhileWorkerIsBusy() {
    try (final var worker = OntologySparqlWorker.acquire(SparqlQueryLimits.TIMEOUT_MILLIS)) {
      final var service =
          new OntologySparqlQueryService(
              (id, includeRelations) -> {
                throw new AssertionError("Invalid requests must not materialize a model");
              },
              new SparqlFederationGuard(null));
      assertThrows(
          IllegalArgumentException.class, () -> service.query(GLOSSARY_ID, request("invalid")));
    }
  }

  @Test
  void refusesOversizedNamespaceBeforeStartingTheWorker() {
    final Model model = modelWithStatement();
    model.setNsPrefix("large", "https://example.com/" + "x".repeat(32 * 1024 * 1024));

    final var failure =
        assertThrows(
            SparqlQueryLimits.QueryLimitExceededException.class,
            () -> service(model).query(GLOSSARY_ID, request("ASK {}")));

    assertTrue(failure.getMessage().contains("input"), failure.getMessage());
    assertTrue(model.isClosed());
  }

  @Test
  void retainsTheRequestedFormatAndReasonForUnrepresentableRdfXml() {
    final Model model = ModelFactory.createDefaultModel();
    model.add(
        model.createResource("urn:table:orders"),
        model.createProperty("https://example.com/p/"),
        "plain");
    final var expected =
        assertThrows(
            UnsupportedRdfSerializationException.class,
            () -> RdfGraphSerializer.asString(model, RdfSerializationFormat.RDF_XML));
    final var failure =
        assertThrows(
            UnsupportedRdfSerializationException.class,
            () ->
                service(model)
                    .query(
                        GLOSSARY_ID,
                        request("CONSTRUCT WHERE { ?s ?p ?o }")
                            .withFormat(SparqlQuery.Format.RDFXML)));

    assertEquals(expected.getMessage(), failure.getMessage());
    assertTrue(model.isClosed());
  }

  @Test
  void releasesWorkerCapacityAfterTimeout() {
    assertThrows(
        SparqlQueryExecutionGuard.QueryTimeoutException.class,
        () ->
            service(modelWithStatement())
                .query(GLOSSARY_ID, request("ASK { ?s ?p ?o }").withTimeout(1)));

    assertTrue(
        service(modelWithStatement())
            .query(GLOSSARY_ID, request("ASK { ?s ?p ?o }"))
            .body()
            .contains("true"));
  }

  @Test
  void boundsAdmissionBeforeMaterializingAnotherModel() throws Exception {
    final CountDownLatch materializing = new CountDownLatch(1);
    final CountDownLatch release = new CountDownLatch(1);
    final var blockingService =
        new OntologySparqlQueryService(
            (id, includeRelations) -> {
              materializing.countDown();
              try {
                assertTrue(release.await(10, TimeUnit.SECONDS));
              } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(exception);
              }
              return modelWithStatement();
            },
            new SparqlFederationGuard(null));

    try (final var executor = Executors.newVirtualThreadPerTaskExecutor()) {
      final var running =
          executor.submit(() -> blockingService.query(GLOSSARY_ID, request("ASK {}")));
      try {
        assertTrue(materializing.await(10, TimeUnit.SECONDS));
        final var rejected =
            new OntologySparqlQueryService(
                (id, includeRelations) -> {
                  throw new AssertionError("A rejected query must not materialize its graph");
                },
                new SparqlFederationGuard(null));
        assertThrows(
            SparqlQueryExecutionGuard.QueryCapacityException.class,
            () -> rejected.query(GLOSSARY_ID, request("ASK {}")));
      } finally {
        release.countDown();
      }
      assertTrue(running.get(30, TimeUnit.SECONDS).body().contains("true"));
    }
  }

  @Test
  void executesTupleQueriesAndClosesTheMaterializedModel() {
    final Model model = modelWithStatement();
    final SparqlQuery request =
        request("SELECT ?subject WHERE { ?subject <urn:predicate> <urn:object> }")
            .withFormat(SparqlQuery.Format.JSON);

    final OntologySparqlQueryService.QueryResult result =
        service(model).query(GLOSSARY_ID, request);

    assertEquals("application/sparql-results+json", result.mediaType());
    assertTrue(result.body().contains("urn:subject"));
    assertTrue(model.isClosed());
  }

  @Test
  void serializesRdf12TripleTermsAndDirectionalLanguageLiterals() {
    final SparqlQuery request =
        request(
                """
                VERSION "1.2"
                SELECT (TRIPLE(<https://example.com/subject>,
                               <https://example.com/predicate>,
                               "قطة"@ar--rtl) AS ?statement)
                WHERE {}
                """)
            .withFormat(SparqlQuery.Format.JSON);

    final OntologySparqlQueryService.QueryResult result =
        service(ModelFactory.createDefaultModel()).query(GLOSSARY_ID, request);
    final JsonNode statement =
        JsonUtils.readTree(result.body()).at("/results/bindings/0/statement");

    assertEquals("triple", statement.path("type").asText());
    assertEquals("https://example.com/subject", statement.at("/value/subject/value").asText());
    assertEquals("ar", statement.at("/value/object/xml:lang").asText());
    assertEquals("rtl", statement.at("/value/object/its:dir").asText());
  }

  @Test
  void serializesAskAndGraphQueriesInTheirRequestedFormats() {
    final OntologySparqlQueryService.QueryResult ask =
        service(modelWithStatement())
            .query(
                GLOSSARY_ID,
                request("ASK { <urn:subject> <urn:predicate> <urn:object> }")
                    .withFormat(SparqlQuery.Format.XML));
    final OntologySparqlQueryService.QueryResult graph =
        service(modelWithStatement())
            .query(
                GLOSSARY_ID,
                request(
                        "CONSTRUCT { ?subject ?predicate ?object } "
                            + "WHERE { ?subject ?predicate ?object }")
                    .withFormat(SparqlQuery.Format.TURTLE));

    assertTrue(ask.body().contains("<boolean>true</boolean>"));
    assertTrue(graph.body().contains("<urn:subject>"));
  }

  @Test
  void appliesRdfsInferenceInsideTheOntologyScope() {
    final Model model = ModelFactory.createDefaultModel();
    final Resource child = model.createResource("urn:Child");
    final Resource parent = model.createResource("urn:Parent");
    child.addProperty(RDFS.subClassOf, parent);
    model.createResource("urn:instance").addProperty(RDF.type, child);
    final SparqlQuery request =
        request("ASK { <urn:instance> a <urn:Parent> }").withInference(SparqlQuery.Inference.RDFS);

    final OntologySparqlQueryService.QueryResult result =
        service(model).query(GLOSSARY_ID, request);

    assertTrue(result.body().contains("true"));
  }

  @Test
  void rejectsMutationAndMalformedQueries() {
    final OntologySparqlQueryService service = service(modelWithStatement());

    assertThrows(
        IllegalArgumentException.class,
        () -> service.query(GLOSSARY_ID, request("INSERT DATA { <urn:s> <urn:p> <urn:o> }")));
    assertThrows(
        IllegalArgumentException.class, () -> service.query(GLOSSARY_ID, request("not sparql")));
  }

  @Test
  void rejectsRemoteDatasetAndServiceAccess() {
    final OntologySparqlQueryService service = service(modelWithStatement());

    assertThrows(
        IllegalArgumentException.class,
        () ->
            service.query(
                GLOSSARY_ID,
                request("SELECT * FROM <https://example.com/data> WHERE { ?s ?p ?o }")));
    assertThrows(
        SparqlFederationGuard.FederationDisallowedException.class,
        () ->
            service.query(
                GLOSSARY_ID,
                request("SELECT * WHERE { SERVICE <https://example.com/sparql> { ?s ?p ?o } }")));
  }

  @Test
  void rejectsAServiceHiddenInsideAProjectedExistsWithoutContactingIt() {
    try (RecordingSparqlEndpoint endpoint = RecordingSparqlEndpoint.start()) {
      final SparqlQuery request =
          request(
              "SELECT (EXISTS { SERVICE <%s> { ?s ?p ?o } } AS ?reachable) WHERE { }"
                  .formatted(endpoint.uri()));

      assertThrows(
          SparqlFederationGuard.FederationDisallowedException.class,
          () -> service(modelWithStatement()).query(GLOSSARY_ID, request));
      assertEquals(0, endpoint.requestCount());
    }
  }

  /**
   * The ontology model is self-contained, so execution refuses SERVICE outright: a SERVICE the
   * federation guard lets through, by allowlist or by a syntax position it does not inspect, must
   * still never make the server send a request.
   */
  @ParameterizedTest
  @ValueSource(
      strings = {
        "SELECT * WHERE { SERVICE <%s> { ?s ?p ?o } }",
        "SELECT (EXISTS { SERVICE <%s> { ?s ?p ?o } } AS ?reachable) WHERE { }",
        "SELECT * WHERE { ?s ?p ?o BIND(EXISTS { SERVICE <%s> { ?a ?b ?c } } AS ?reachable) }"
      })
  void refusesToCallAServiceEndpointEvenWhenTheGuardAllowsIt(final String template) {
    try (RecordingSparqlEndpoint endpoint = RecordingSparqlEndpoint.start()) {
      final OntologySparqlQueryService service = serviceAllowing(endpoint, modelWithStatement());
      final SparqlQuery request = request(template.formatted(endpoint.uri()));

      assertThrows(QueryDeniedException.class, () -> service.query(GLOSSARY_ID, request));
      assertEquals(0, endpoint.requestCount());
    }
  }

  /** Jena turns a failed EXISTS inside a filter into "no match" rather than an error. */
  @ParameterizedTest
  @ValueSource(
      strings = {
        "ASK { FILTER EXISTS { SERVICE <%s> { ?s ?p ?o } } }",
        "ASK { ?s ?p ?o EXISTS { SERVICE <%s> { ?a ?b ?c } } }"
      })
  void aRefusedServiceInsideAFilterNeverMatches(final String template) {
    try (RecordingSparqlEndpoint endpoint = RecordingSparqlEndpoint.start()) {
      final OntologySparqlQueryService service = serviceAllowing(endpoint, modelWithStatement());

      final OntologySparqlQueryService.QueryResult result =
          service.query(GLOSSARY_ID, request(template.formatted(endpoint.uri())));

      assertFalse(JsonUtils.readTree(result.body()).path("boolean").asBoolean(), result.body());
      assertEquals(0, endpoint.requestCount());
    }
  }

  @Test
  void rejectsFormatsThatDoNotMatchTheQueryShape() {
    final OntologySparqlQueryService service = service(modelWithStatement());

    assertThrows(
        IllegalArgumentException.class,
        () ->
            service.query(
                GLOSSARY_ID,
                request("SELECT * WHERE { ?s ?p ?o }").withFormat(SparqlQuery.Format.TURTLE)));
  }

  @Test
  void rejectsUnboundedTimeoutsAndGlobalCustomInference() {
    final OntologySparqlQueryService service = service(modelWithStatement());

    assertThrows(
        IllegalArgumentException.class,
        () -> service.query(GLOSSARY_ID, request("ASK { ?s ?p ?o }").withTimeout(300_001)));
    assertThrows(
        IllegalArgumentException.class,
        () -> service.query(GLOSSARY_ID, request("ASK { ?s ?p ?o }").withTimeout(0)));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            service.query(
                GLOSSARY_ID,
                request("ASK { ?s ?p ?o }").withInference(SparqlQuery.Inference.CUSTOM)));
  }

  @Test
  void appliesDefaultLimitsAndRejectsLimitsAboveTheMaximum() {
    final Model model = ModelFactory.createDefaultModel();
    for (int index = 0; index < SparqlQueryLimits.DEFAULT_RESULT_LIMIT + 1; index++) {
      model.add(
          model.createResource("urn:subject:" + index),
          model.createProperty("urn:predicate"),
          model.createResource("urn:object"));
    }

    final OntologySparqlQueryService.QueryResult result =
        service(model)
            .query(
                GLOSSARY_ID,
                request("SELECT ?subject WHERE { ?subject <urn:predicate> <urn:object> }")
                    .withFormat(SparqlQuery.Format.CSV));

    assertEquals(SparqlQueryLimits.DEFAULT_RESULT_LIMIT + 1, result.body().lines().count());
    assertThrows(
        IllegalArgumentException.class,
        () ->
            service(modelWithStatement())
                .query(GLOSSARY_ID, request("SELECT * WHERE { ?s ?p ?o } LIMIT 10001")));
  }

  @Test
  void rejectsJsonLdForAGraphResultCarryingTripleTerms() {
    final SparqlQuery request =
        request("CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }").withFormat(SparqlQuery.Format.JSONLD);

    final UnsupportedRdfSerializationException failure =
        assertThrows(
            UnsupportedRdfSerializationException.class,
            () -> service(modelWithTripleTerm()).query(GLOSSARY_ID, request));

    assertTrue(failure.getMessage().contains("turtle"));
  }

  @Test
  void serializesTripleTermsAsTurtle() {
    final SparqlQuery request =
        request("CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }").withFormat(SparqlQuery.Format.TURTLE);

    final OntologySparqlQueryService.QueryResult result =
        service(modelWithTripleTerm()).query(GLOSSARY_ID, request);

    assertTrue(result.body().contains("<<("));
    assertTrue(result.body().contains("@ar--rtl"));
  }

  private static Model modelWithTripleTerm() {
    final Model model = ModelFactory.createDefaultModel();
    model
        .getGraph()
        .add(
            Triple.create(
                NodeFactory.createURI("urn:reifier"),
                NodeFactory.createURI("http://www.w3.org/1999/02/22-rdf-syntax-ns#reifies"),
                NodeFactory.createTripleTerm(
                    NodeFactory.createURI("urn:subject"),
                    NodeFactory.createURI("urn:predicate"),
                    NodeFactory.createLiteralDirLang("\u0642\u0637\u0629", "ar", "rtl"))));
    return model;
  }

  private static OntologySparqlQueryService service(final Model model) {
    return new OntologySparqlQueryService(
        (glossaryId, includeRelations) -> model, new SparqlFederationGuard(null));
  }

  private static OntologySparqlQueryService serviceAllowing(
      final RecordingSparqlEndpoint endpoint, final Model model) {
    final RdfConfiguration rdfConfiguration =
        new RdfConfiguration()
            .withFederation(
                new SparqlFederationConfig()
                    .withEnabled(true)
                    .withAllowedEndpoints(List.of(URI.create(endpoint.uri()))));
    return new OntologySparqlQueryService(
        (glossaryId, includeRelations) -> model, new SparqlFederationGuard(rdfConfiguration));
  }

  private static Model modelWithStatement() {
    final Model model = ModelFactory.createDefaultModel();
    model.add(
        model.createResource("urn:subject"),
        model.createProperty("urn:predicate"),
        model.createResource("urn:object"));
    return model;
  }

  private static SparqlQuery request(final String query) {
    return new SparqlQuery().withQuery(query);
  }

  /**
   * A SPARQL endpoint on the loopback interface that answers every request with one result row and
   * counts the requests it receives, standing in for an internal host only the server can reach.
   */
  private static final class RecordingSparqlEndpoint implements AutoCloseable {
    private static final byte[] ONE_ROW =
        """
        {"head":{"vars":["s","p","o"]},"results":{"bindings":[{\
        "s":{"type":"uri","value":"urn:s"},\
        "p":{"type":"uri","value":"urn:p"},\
        "o":{"type":"uri","value":"urn:o"}}]}}"""
            .getBytes(StandardCharsets.UTF_8);

    private final HttpServer server;
    private final AtomicInteger requests = new AtomicInteger();

    private RecordingSparqlEndpoint(final HttpServer server) {
      this.server = server;
    }

    static RecordingSparqlEndpoint start() {
      try {
        final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        final RecordingSparqlEndpoint endpoint = new RecordingSparqlEndpoint(server);
        server.createContext("/", endpoint::answer);
        server.start();
        return endpoint;
      } catch (IOException exception) {
        throw new UncheckedIOException("Cannot start the recording SPARQL endpoint", exception);
      }
    }

    private void answer(final HttpExchange exchange) throws IOException {
      requests.incrementAndGet();
      exchange.getResponseHeaders().add("Content-Type", "application/sparql-results+json");
      exchange.sendResponseHeaders(200, ONE_ROW.length);
      try (OutputStream body = exchange.getResponseBody()) {
        body.write(ONE_ROW);
      }
    }

    String uri() {
      return "http://127.0.0.1:" + server.getAddress().getPort() + "/sparql";
    }

    int requestCount() {
      return requests.get();
    }

    @Override
    public void close() {
      server.stop(0);
    }
  }
}
