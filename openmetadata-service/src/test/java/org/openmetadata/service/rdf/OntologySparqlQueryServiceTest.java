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
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.graph.Triple;
import org.apache.jena.query.QueryDeniedException;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.configuration.rdf.SparqlFederationConfig;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;

class OntologySparqlQueryServiceTest {
  private static final UUID GLOSSARY_ID = UUID.randomUUID();

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
