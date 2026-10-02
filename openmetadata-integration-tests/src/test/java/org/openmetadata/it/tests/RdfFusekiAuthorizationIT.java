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
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.images.builder.ImageFromDockerfile;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.utility.MountableFile;

class RdfFusekiAuthorizationIT {
  private static final String BOUNDARY = "rdf-upload-test";
  private static final String GRAPH = "urn:review:upload";
  private static final HttpClient HTTP = HttpClient.newHttpClient();
  private static GenericContainer<?> fuseki;
  private static String endpoint;

  @BeforeAll
  static void start() throws Exception {
    fuseki =
        shippedFuseki()
            .withExposedPorts(3030)
            .withEnv("FUSEKI_ADMIN_PASSWORD", "test-admin")
            .withEnv("FUSEKI_OPENMETADATA_PASSWORD", "test-writer")
            .withEnv("JVM_ARGS", "-Xms512m -Xmx512m")
            .waitingFor(Wait.forHttp("/$/ping").withStartupTimeout(Duration.ofMinutes(2)))
            .withCopyFileToContainer(
                MountableFile.forHostPath(
                    RdfTestDatabase.repositoryRoot()
                        .resolve("docker/rdf-store/shiro.ini.template")),
                "/fuseki/shiro.ini.template");
    fuseki.start();
    endpoint = "http://" + fuseki.getHost() + ":" + fuseki.getMappedPort(3030);
    for (String dataset : List.of("openmetadata_a", "openmetadata_b")) {
      final var response =
          send(
              request("/$/datasets")
                  .header("Authorization", basic("admin:test-admin"))
                  .header("Content-Type", "application/x-www-form-urlencoded")
                  .POST(HttpRequest.BodyPublishers.ofString("dbName=" + dataset + "&dbType=tdb2")));
      assertTrue(response.statusCode() / 100 == 2 || response.statusCode() == 409, response.body());
    }
  }

  private static GenericContainer<?> shippedFuseki() {
    // General RDF profiles can use third-party images that do not contain our Shiro template.
    final String image = System.getProperty("rdfAuthorizationContainerImage");
    return image != null
        ? new GenericContainer<>(DockerImageName.parse(image))
        : new GenericContainer<>(
            new ImageFromDockerfile()
                .withFileFromPath(
                    ".", RdfTestDatabase.repositoryRoot().resolve("docker/rdf-store")));
  }

  @AfterAll
  static void stop() {
    if (fuseki != null) {
      fuseki.close();
    }
    HTTP.close();
  }

  @ParameterizedTest
  @ValueSource(strings = {"openmetadata", "openmetadata_a", "openmetadata_b"})
  void writerHasTheSameUploadPermissionsAsAdmin(final String dataset) throws Exception {
    final String subject = "urn:review:" + UUID.randomUUID();
    final var admin =
        send(upload(dataset, subject).header("Authorization", basic("admin:test-admin")));
    final var response =
        send(upload(dataset, subject).header("Authorization", basic("openmetadata:test-writer")));
    // Assemblers can omit the legacy upload handler; compare authorization independently of it.
    assertTrue(admin.statusCode() / 100 == 2 || admin.statusCode() == 405, admin.body());
    assertEquals(admin.statusCode(), response.statusCode(), response.body());
  }

  @ParameterizedTest
  @ValueSource(strings = {"openmetadata", "openmetadata_a", "openmetadata_b"})
  void writerCanUploadThroughGraphStore(final String dataset) throws Exception {
    final String subject = "urn:review:" + UUID.randomUUID();
    final var response =
        send(
            request("/" + dataset + "/data?graph=" + GRAPH)
                .header("Authorization", basic("openmetadata:test-writer"))
                .header("Content-Type", "text/turtle")
                .POST(
                    HttpRequest.BodyPublishers.ofString(
                        "<" + subject + "> <urn:review:predicate> <urn:review:object> .")));
    assertEquals(2, response.statusCode() / 100, response.body());
    assertTrue(contains(dataset, subject));
  }

  @ParameterizedTest
  @ValueSource(strings = {"openmetadata", "openmetadata_a", "openmetadata_b"})
  void anonymousUploadCannotMutateAnyDataset(final String dataset) throws Exception {
    final String subject = "urn:review:" + UUID.randomUUID();
    assertEquals(401, send(upload(dataset, subject)).statusCode());
    assertFalse(contains(dataset, subject));
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

  private static boolean contains(final String dataset, final String subject) throws Exception {
    final var response =
        send(
            request("/" + dataset + "/query")
                .header("Content-Type", "application/sparql-query")
                .header("Accept", "application/sparql-results+json")
                .POST(
                    HttpRequest.BodyPublishers.ofString(
                        "ASK { GRAPH <" + GRAPH + "> { <" + subject + "> ?p ?o } }")));
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
