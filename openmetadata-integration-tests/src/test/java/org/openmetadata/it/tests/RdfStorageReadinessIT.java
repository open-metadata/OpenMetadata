package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.rdf.RdfWriteMode;
import org.openmetadata.service.rdf.storage.JenaFusekiStorage;
import org.openmetadata.service.rdf.storage.RdfStorageInterface.EntityWriteRequest;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.images.builder.ImageFromDockerfile;

/**
 * Pins the RDF readiness contract against real servers. The OpenMetadata Graph Store extension is
 * optional: indexing must proceed on Apache Jena Fuseki without it and on datasets that lack the
 * recommended settings, and fail only with the real cause when the dataset cannot be used at all.
 */
class RdfStorageReadinessIT {
  private static final String BASE = "https://open-metadata.org/";
  private static final String NAME = BASE + "ontology/name";
  private static final String ADMIN_PASSWORD = "test-admin";
  private static final String WRITER_PASSWORD = "test-writer";
  private static final String ADMIN_CREATED_DATASET = "readiness_admin_created";
  private static final String STOCK_DATASET = "stock";
  private static final int FUSEKI_PORT = 3030;
  private static final HttpClient HTTP = HttpClient.newHttpClient();

  private static GenericContainer<?> shipped;
  private static GenericContainer<?> stock;

  @BeforeAll
  static void start() throws Exception {
    final ImageFromDockerfile image =
        new ImageFromDockerfile()
            .withFileFromPath(".", RdfTestDatabase.repositoryRoot().resolve("docker/rdf-store"));
    shipped =
        new GenericContainer<>(image)
            .withExposedPorts(FUSEKI_PORT)
            .withEnv("FUSEKI_ADMIN_PASSWORD", ADMIN_PASSWORD)
            .withEnv("FUSEKI_OPENMETADATA_PASSWORD", WRITER_PASSWORD)
            .withEnv("JVM_ARGS", "-Xms512m -Xmx512m")
            .waitingFor(Wait.forHttp("/$/ping").withStartupTimeout(Duration.ofMinutes(2)));
    // The same Fuseki distribution launched directly, so the extension is never on the classpath.
    stock =
        new GenericContainer<>(image)
            .withExposedPorts(FUSEKI_PORT)
            .withCreateContainerCmdModifier(command -> command.withEntrypoint("java"))
            .withCommand(
                "-Xmx512m",
                "-cp",
                "/fuseki/fuseki-server.jar",
                "org.apache.jena.fuseki.main.cmds.FusekiMainCmd",
                "--mem",
                "--update",
                "/" + STOCK_DATASET)
            .waitingFor(Wait.forHttp("/$/ping").withStartupTimeout(Duration.ofMinutes(2)));
    shipped.start();
    stock.start();
    createDatasetThroughAdminApi(ADMIN_CREATED_DATASET);
  }

  @AfterAll
  static void stop() {
    if (stock != null) {
      stock.close();
    }
    if (shipped != null) {
      shipped.close();
    }
    HTTP.close();
  }

  @Test
  void provisionedDatasetIsReadyAndAcceptsBulkAppends() {
    try (JenaFusekiStorage storage = storage(shipped, "openmetadata", "admin", ADMIN_PASSWORD)) {
      assertDoesNotThrow(storage::ensureStorageReady);
      assertBulkAppendIsReadable(storage);
    }
  }

  @Test
  void fusekiWithoutTheExtensionIsReadyAndAcceptsBulkAppends() {
    try (JenaFusekiStorage storage = storage(stock, STOCK_DATASET, null, null)) {
      assertDoesNotThrow(storage::ensureStorageReady);
      assertBulkAppendIsReadable(storage);
    }
  }

  @Test
  void datasetCreatedThroughTheAdminApiIsReadyAndAcceptsBulkAppends() {
    try (JenaFusekiStorage storage =
        storage(shipped, ADMIN_CREATED_DATASET, "admin", ADMIN_PASSWORD)) {
      assertDoesNotThrow(storage::ensureStorageReady);
      assertBulkAppendIsReadable(storage);
    }
  }

  @Test
  void unknownDatasetFailsNamingTheDataset() {
    try (JenaFusekiStorage storage = storage(shipped, "no_such_dataset", "admin", ADMIN_PASSWORD)) {
      final IllegalStateException failure =
          assertThrows(IllegalStateException.class, storage::ensureStorageReady);
      assertTrue(
          failure.getMessage().contains("'no_such_dataset' does not exist"), failure.getMessage());
    }
  }

  @Test
  void unknownDatasetOnStockFusekiFailsNamingTheDataset() {
    try (JenaFusekiStorage storage = storage(stock, "no_such_dataset", null, null)) {
      final IllegalStateException failure =
          assertThrows(IllegalStateException.class, storage::ensureStorageReady);
      assertTrue(
          failure.getMessage().contains("'no_such_dataset' does not exist"), failure.getMessage());
    }
  }

  @Test
  void rejectedPasswordFailsAsACredentialsProblem() {
    try (JenaFusekiStorage storage = storage(shipped, "openmetadata", "openmetadata", "wrong")) {
      final IllegalStateException failure =
          assertThrows(IllegalStateException.class, storage::ensureStorageReady);
      assertTrue(failure.getMessage().contains("credentials"), failure.getMessage());
    }
  }

  @Test
  void writerOutsideItsDatasetsFailsAsAnAuthorizationProblem() {
    try (JenaFusekiStorage storage =
        storage(shipped, ADMIN_CREATED_DATASET, "openmetadata", WRITER_PASSWORD)) {
      final IllegalStateException failure =
          assertThrows(IllegalStateException.class, storage::ensureStorageReady);
      assertTrue(failure.getMessage().contains("not authorized"), failure.getMessage());
    }
  }

  private static void assertBulkAppendIsReadable(final JenaFusekiStorage storage) {
    final UUID id = UUID.randomUUID();
    final Model model = ModelFactory.createDefaultModel();
    try {
      model
          .createResource(BASE + "entity/table/" + id)
          .addProperty(model.createProperty(NAME), "readiness");
      storage.bulkStoreEntities(
          List.of(new EntityWriteRequest("table", id, model)), RdfWriteMode.INSERT_ONLY);
    } finally {
      model.close();
    }
    final Model stored = storage.getEntity("table", id);
    assertNotNull(stored, "the bulk append must be readable back from the knowledge graph");
    stored.close();
  }

  private static JenaFusekiStorage storage(
      final GenericContainer<?> fuseki,
      final String dataset,
      final String username,
      final String password) {
    return new JenaFusekiStorage(
        new RdfConfiguration()
            .withEnabled(true)
            .withStorageType(RdfConfiguration.StorageType.FUSEKI)
            .withBaseUri(URI.create(BASE))
            .withRemoteEndpoint(URI.create(serverUrl(fuseki) + "/" + dataset))
            .withUsername(username)
            .withPassword(password)
            .withWriteMaxRetries(0));
  }

  private static void createDatasetThroughAdminApi(final String dataset) throws Exception {
    final HttpRequest request =
        HttpRequest.newBuilder(URI.create(serverUrl(shipped) + "/$/datasets"))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", basic("admin:" + ADMIN_PASSWORD))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString("dbName=" + dataset + "&dbType=tdb2"))
            .build();
    final HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    assertTrue(response.statusCode() / 100 == 2, response.body());
  }

  private static String serverUrl(final GenericContainer<?> fuseki) {
    return "http://" + fuseki.getHost() + ":" + fuseki.getMappedPort(FUSEKI_PORT);
  }

  private static String basic(final String credentials) {
    return "Basic "
        + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
  }
}
