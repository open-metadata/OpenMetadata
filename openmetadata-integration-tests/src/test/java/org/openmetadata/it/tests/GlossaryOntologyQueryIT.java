package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * {@code POST /v1/glossaries/{id}/sparql} runs SPARQL inside the OpenMetadata server for any user
 * who can view the glossary. It must never make the server send a request on the caller's behalf:
 * SERVICE is refused wherever the query places it, and the endpoint it names is never contacted.
 *
 * <p>The server runs in this JVM, so an endpoint on the loopback interface stands in for an
 * internal host only the server can reach.
 *
 * <p>The tests run one at a time as a user no other SPARQL test uses: the server admits two
 * concurrent SPARQL queries per user and answers a third with 429, even one it would refuse.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock("ontology-sparql-worker")
@ExtendWith(TestNamespaceExtension.class)
public class GlossaryOntologyQueryIT {

  @Test
  void aUserWithNoRolesCanQueryTheGlossaryOntology(TestNamespace ns) {
    final Glossary glossary = GlossaryTestFactory.createSimple(ns);

    final JsonNode result = query(SdkClients.user3Client(), glossary, "ASK { }");

    assertTrue(result.path("boolean").asBoolean(), result.toString());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "SELECT * WHERE { SERVICE <%s> { ?s ?p ?o } }",
        "SELECT (EXISTS { SERVICE <%s> { ?s ?p ?o } } AS ?reachable) WHERE { }",
        "ASK { FILTER EXISTS { SERVICE <%s> { ?s ?p ?o } } }",
        "SELECT * WHERE { ?s ?p ?o EXISTS { SERVICE <%s> { ?a ?b ?c } } }"
      })
  void aServiceClauseIsRefusedWithoutContactingItsEndpoint(String template, TestNamespace ns) {
    final Glossary glossary = GlossaryTestFactory.createWithName(ns, ns.uniqueShortId());
    try (InternalHost internalHost = InternalHost.start()) {
      final String sparql = template.formatted(internalHost.uri());

      final OpenMetadataException refused =
          assertThrows(
              OpenMetadataException.class, () -> query(SdkClients.user3Client(), glossary, sparql));

      assertEquals(403, refused.getStatusCode(), refused.getMessage());
      assertEquals(0, internalHost.requestCount());
    }
  }

  private static JsonNode query(
      final OpenMetadataClient client, final Glossary glossary, final String sparql) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/glossaries/" + glossary.getId() + "/sparql",
            new SparqlQuery().withQuery(sparql),
            JsonNode.class);
  }

  /** Answers every request with a secret and counts the requests it receives. */
  private static final class InternalHost implements AutoCloseable {
    private static final byte[] SECRET =
        "db_password=internal-only".getBytes(StandardCharsets.UTF_8);

    private final HttpServer server;
    private final AtomicInteger requests = new AtomicInteger();

    private InternalHost(final HttpServer server) {
      this.server = server;
    }

    static InternalHost start() {
      try {
        final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        final InternalHost host = new InternalHost(server);
        server.createContext("/", host::answer);
        server.start();
        return host;
      } catch (IOException exception) {
        throw new UncheckedIOException("Cannot start the internal host stand-in", exception);
      }
    }

    private void answer(final HttpExchange exchange) throws IOException {
      requests.incrementAndGet();
      exchange.getResponseHeaders().add("Content-Type", "text/plain");
      exchange.sendResponseHeaders(200, SECRET.length);
      try (OutputStream body = exchange.getResponseBody()) {
        body.write(SECRET);
      }
    }

    String uri() {
      return "http://127.0.0.1:" + server.getAddress().getPort() + "/internal/config.txt";
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
