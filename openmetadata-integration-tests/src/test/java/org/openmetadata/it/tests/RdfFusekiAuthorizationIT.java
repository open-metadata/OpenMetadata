package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.bootstrap.FusekiTestImage;
import org.openmetadata.schema.utils.JsonUtils;
import org.testcontainers.containers.GenericContainer;

/**
 * The access contract of the published Fuseki image as OpenMetadata configures it: only the admin
 * account reaches any dataset, and every anonymous read or write is refused before it touches data.
 */
class RdfFusekiAuthorizationIT {
  private static final String BOUNDARY = "rdf-upload-test";
  private static final String GRAPH = "urn:review:upload";
  private static final String ADMIN =
      FusekiTestImage.ADMIN_USER + ":" + FusekiTestImage.ADMIN_PASSWORD;
  private static final HttpClient HTTP = HttpClient.newHttpClient();
  private static GenericContainer<?> fuseki;
  private static String endpoint;

  @BeforeAll
  static void start() {
    fuseki = FusekiTestImage.forOpenMetadata("-Xms512m -Xmx512m");
    fuseki.start();
    endpoint = FusekiTestImage.serverUrl(fuseki);
  }

  @AfterAll
  static void stop() {
    if (fuseki != null) {
      fuseki.close();
    }
    HTTP.close();
  }

  @Test
  void pingStaysAnonymousForHealthChecks() throws Exception {
    assertEquals(200, send(request("/$/ping").GET()).statusCode());
  }

  @ParameterizedTest
  @ValueSource(strings = {"openmetadata", "openmetadata_a", "openmetadata_b"})
  void adminCanWriteThroughGraphStore(final String dataset) throws Exception {
    final String subject = "urn:review:" + UUID.randomUUID();
    final var response =
        send(graphStorePost(dataset, subject).header("Authorization", basic(ADMIN)));
    assertEquals(2, response.statusCode() / 100, response.body());
    assertTrue(contains(dataset, subject));
  }

  @ParameterizedTest
  @ValueSource(strings = {"openmetadata", "openmetadata_a", "openmetadata_b"})
  void anonymousWritesCannotMutateAnyDataset(final String dataset) throws Exception {
    final String subject = "urn:review:" + UUID.randomUUID();
    assertEquals(401, send(upload(dataset, subject)).statusCode());
    assertEquals(401, send(graphStorePost(dataset, subject)).statusCode());
    assertEquals(
        401,
        send(request("/" + dataset + "/update")
                .header("Content-Type", "application/sparql-update")
                .POST(
                    HttpRequest.BodyPublishers.ofString(
                        "INSERT DATA { GRAPH <"
                            + GRAPH
                            + "> { <"
                            + subject
                            + "> <urn:review:predicate> <urn:review:object> } }")))
            .statusCode());
    assertFalse(contains(dataset, subject));
  }

  @ParameterizedTest
  @ValueSource(strings = {"openmetadata", "openmetadata_a", "openmetadata_b"})
  void anonymousQueriesAreRefused(final String dataset) throws Exception {
    for (String service : new String[] {"sparql", "query"}) {
      assertEquals(401, send(ask(dataset, service, "ASK { ?s ?p ?o }")).statusCode(), service);
    }
  }

  private static HttpRequest.Builder graphStorePost(final String dataset, final String subject) {
    return request("/" + dataset + "/data?graph=" + GRAPH)
        .header("Content-Type", "text/turtle")
        .POST(
            HttpRequest.BodyPublishers.ofString(
                "<" + subject + "> <urn:review:predicate> <urn:review:object> ."));
  }

  private static HttpRequest.Builder upload(final String dataset, final String subject) {
    final String body =
        "--"
            + BOUNDARY
            + "\r\n"
            + "Content-Disposition: form-data; name=\"graph\"\r\n\r\n"
            + GRAPH
            + "\r\n"
            + "--"
            + BOUNDARY
            + "\r\n"
            + "Content-Disposition: form-data; name=\"file\"; filename=\"review.ttl\"\r\n"
            + "Content-Type: text/turtle\r\n\r\n"
            + "<"
            + subject
            + "> <urn:review:predicate> <urn:review:object> .\r\n"
            + "--"
            + BOUNDARY
            + "--\r\n";
    return request("/" + dataset + "/upload")
        .header("Content-Type", "multipart/form-data; boundary=" + BOUNDARY)
        .POST(HttpRequest.BodyPublishers.ofString(body));
  }

  private static HttpRequest.Builder ask(
      final String dataset, final String service, final String query) {
    return request("/" + dataset + "/" + service)
        .header("Content-Type", "application/sparql-query")
        .header("Accept", "application/sparql-results+json")
        .POST(HttpRequest.BodyPublishers.ofString(query));
  }

  private static boolean contains(final String dataset, final String subject) throws Exception {
    final var response =
        send(
            ask(dataset, "query", "ASK { GRAPH <" + GRAPH + "> { <" + subject + "> ?p ?o } }")
                .header("Authorization", basic(ADMIN)));
    assertEquals(200, response.statusCode(), response.body());
    return JsonUtils.readTree(response.body()).path("boolean").asBoolean();
  }

  private static HttpRequest.Builder request(final String path) {
    return HttpRequest.newBuilder(URI.create(endpoint + path)).timeout(Duration.ofSeconds(10));
  }

  private static HttpResponse<String> send(final HttpRequest.Builder request) throws Exception {
    return HTTP.send(request.build(), HttpResponse.BodyHandlers.ofString());
  }

  private static String basic(final String credentials) {
    return "Basic "
        + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
  }
}
