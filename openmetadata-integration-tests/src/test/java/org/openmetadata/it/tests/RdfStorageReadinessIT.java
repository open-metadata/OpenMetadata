package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
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
import org.testcontainers.images.builder.Transferable;

/**
 * Pins the RDF readiness contract against real servers. The OpenMetadata Graph Store extension is
 * optional: indexing must proceed on Apache Jena Fuseki without it and on datasets that lack its
 * recommended timeouts. Readiness fails, naming the real cause and leaving the dataset as it found
 * it, only when the dataset cannot be used: it is missing, refuses the credentials or writes, or
 * its default graph hides the named graphs indexing writes into.
 */
class RdfStorageReadinessIT {
  private static final String BASE = "https://open-metadata.org/";
  private static final String NAME = BASE + "ontology/name";
  private static final String ADMIN_PASSWORD = "test-admin";
  private static final String WRITER_PASSWORD = "test-writer";
  private static final String ADMIN_CREATED_DATASET = "readiness_admin_created";
  private static final String STOCK_DATASET = "stock";
  private static final String STOCK_WITHOUT_UNION = "stock_without_union";
  private static final String STOCK_READ_ONLY = "stock_read_only";
  private static final String STOCK_WITHOUT_UPDATE = "stock_without_update";
  private static final String STOCK_CONFIG_PATH = "/tmp/stock-config.ttl";
  private static final String READ_WRITE =
      "fuseki:serviceQuery \"sparql\" ; fuseki:serviceUpdate \"update\" ;"
          + " fuseki:serviceReadWriteGraphStore \"data\"";
  private static final String READ_ONLY =
      "fuseki:serviceQuery \"sparql\" ; fuseki:serviceReadGraphStore \"data\"";
  private static final String WITHOUT_UPDATE =
      "fuseki:serviceQuery \"sparql\" ; fuseki:serviceReadWriteGraphStore \"data\"";
  private static final String UNION_DISABLED = "does not enable tdb2:unionDefaultGraph";
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
            .withCopyToContainer(Transferable.of(stockConfig()), STOCK_CONFIG_PATH)
            .withCreateContainerCmdModifier(command -> command.withEntrypoint("java"))
            .withCommand(
                "-Xmx512m",
                "-cp",
                "/fuseki/fuseki-server.jar",
                "org.apache.jena.fuseki.main.cmds.FusekiMainCmd",
                "--config=" + STOCK_CONFIG_PATH)
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
      assertReadyLeavingNoTrace(storage);
      assertBulkAppendIsReadable(storage);
    }
  }

  @Test
  void fusekiWithoutTheExtensionIsReadyAndAcceptsBulkAppends() {
    try (JenaFusekiStorage storage = storage(stock, STOCK_DATASET, null, null)) {
      assertReadyLeavingNoTrace(storage);
      assertBulkAppendIsReadable(storage);
    }
  }

  @Test
  void datasetCreatedThroughTheAdminApiFailsNamingUnionDefaultGraph() {
    try (JenaFusekiStorage storage =
        storage(shipped, ADMIN_CREATED_DATASET, "admin", ADMIN_PASSWORD)) {
      final String failure = assertNotReadyLeavingNoTrace(storage);
      assertTrue(failure.contains(UNION_DISABLED), failure);
      assertTrue(failure.contains("'" + ADMIN_CREATED_DATASET + "'"), failure);
    }
  }

  @Test
  void fusekiWithoutUnionDefaultGraphFailsNamingIt() {
    try (JenaFusekiStorage storage = storage(stock, STOCK_WITHOUT_UNION, null, null)) {
      final String failure = assertNotReadyLeavingNoTrace(storage);
      assertTrue(failure.contains(UNION_DISABLED), failure);
      assertTrue(failure.contains("'" + STOCK_WITHOUT_UNION + "'"), failure);
    }
  }

  @Test
  void readOnlyDatasetFailsNamingTheMethodsItAllows() {
    try (JenaFusekiStorage storage = storage(stock, STOCK_READ_ONLY, null, null)) {
      final String failure = assertNotReadyLeavingNoTrace(storage);
      assertTrue(
          failure.contains("is read-only (its Graph Store allows GET,HEAD,OPTIONS)"), failure);
    }
  }

  @Test
  void datasetWithoutSparqlUpdateFailsNamingTheRejection() {
    try (JenaFusekiStorage storage = storage(stock, STOCK_WITHOUT_UPDATE, null, null)) {
      final String failure = assertNotReadyLeavingNoTrace(storage);
      assertTrue(failure.contains("did not accept a SPARQL update (HTTP 400)"), failure);
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

  /** Readiness writes a probe triple, so its triple count must be back where it started. */
  private static void assertReadyLeavingNoTrace(final JenaFusekiStorage storage) {
    final long before = storage.getTripleCount();
    assertDoesNotThrow(storage::ensureStorageReady);
    assertEquals(before, storage.getTripleCount(), "readiness must remove its probe triple");
  }

  private static String assertNotReadyLeavingNoTrace(final JenaFusekiStorage storage) {
    final long before = storage.getTripleCount();
    final IllegalStateException failure =
        assertThrows(IllegalStateException.class, storage::ensureStorageReady);
    assertEquals(
        before, storage.getTripleCount(), "failed readiness must leave the dataset as found");
    return failure.getMessage();
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

  /** One dataset per shape readiness must judge, each on its own TDB2 location. */
  private static String stockConfig() {
    return String.join(
        "\n",
        "@prefix fuseki: <http://jena.apache.org/fuseki#> .",
        "@prefix tdb2: <http://jena.apache.org/2016/tdb#> .",
        stockService(STOCK_DATASET, READ_WRITE, true),
        stockService(STOCK_WITHOUT_UNION, READ_WRITE, false),
        stockService(STOCK_READ_ONLY, READ_ONLY, true),
        stockService(STOCK_WITHOUT_UPDATE, WITHOUT_UPDATE, true));
  }

  private static String stockService(
      final String dataset, final String endpoints, final boolean unionDefaultGraph) {
    return """
        <#%1$s> a fuseki:Service ;
            fuseki:name "%1$s" ;
            %2$s ;
            fuseki:dataset [ a tdb2:DatasetTDB2 ;
                             tdb2:location "/tmp/tdb2/%1$s" ;
                             tdb2:unionDefaultGraph %3$s ] .
        """
        .formatted(dataset, endpoints, unionDefaultGraph);
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
