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
import java.util.concurrent.atomic.AtomicLong;
import org.apache.jena.query.QueryFactory;
import org.apache.jena.query.ResultSet;
import org.apache.jena.rdf.model.Literal;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.bootstrap.FusekiTestImage;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.rdf.RdfWriteMode;
import org.openmetadata.service.rdf.storage.JenaFusekiStorage;
import org.openmetadata.service.rdf.storage.RdfStorageInterface.EntityWriteRequest;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.images.builder.Transferable;

/**
 * Pins the RDF readiness contract against real servers. OpenMetadata requires the OpenMetadata
 * Graph Store extension, loaded by the published image or put on an operator's own classpath; a
 * dataset without its recommended timeouts is still ready. Readiness fails, naming the real cause
 * and leaving the dataset as it found it, when the dataset cannot be used: it is missing, refuses
 * the credentials or writes, does not run the extension, or its default graph hides the named
 * graphs indexing writes into.
 */
class RdfStorageReadinessIT {
  private static final String BASE = "https://open-metadata.org/";
  private static final String NAME = BASE + "ontology/name";
  private static final String ADMIN_PASSWORD = FusekiTestImage.ADMIN_PASSWORD;
  private static final String WRITER_PASSWORD = "test-writer";
  private static final String ADMIN_CREATED_DATASET = "readiness_admin_created";
  private static final String SCOPED_DATASET = "openmetadata";
  private static final String OUTSIDE_SCOPE_DATASET = "readiness_outside_scope";
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
  private static final int FUSEKI_PORT = FusekiTestImage.PORT;
  private static final int LONG_LITERAL_LENGTH = 150_000;
  // An operator-managed shiro.ini (FUSEKI_MANAGE_SHIRO=false) with a writer limited to one dataset,
  // since the image's own rendering creates only the admin account.
  private static final String SCOPED_SHIRO =
      String.join(
          "\n",
          "[main]",
          "plainMatcher = org.apache.shiro.authc.credential.SimpleCredentialsMatcher",
          "iniRealm.credentialsMatcher = $plainMatcher",
          "[users]",
          "admin = " + ADMIN_PASSWORD + ", admin",
          "openmetadata = " + WRITER_PASSWORD + ", writer",
          "[roles]",
          "admin = *",
          "writer = *",
          "[urls]",
          "/$/ping = anon",
          "/" + SCOPED_DATASET + "/** = authcBasic, roles[writer]",
          "/** = authcBasic, roles[admin]",
          "");
  private static final HttpClient HTTP = HttpClient.newHttpClient();

  private static GenericContainer<?> shipped;
  private static GenericContainer<?> scoped;
  private static GenericContainer<?> assembled;
  private static GenericContainer<?> withoutExtension;

  @BeforeAll
  static void start() throws Exception {
    shipped = FusekiTestImage.forOpenMetadata("-Xms512m -Xmx512m");
    scoped =
        FusekiTestImage.forOpenMetadata("-Xms256m -Xmx256m")
            .withEnv("FUSEKI_MANAGE_SHIRO", "false")
            .withEnv("FUSEKI_DATASETS", SCOPED_DATASET + "," + OUTSIDE_SCOPE_DATASET)
            .withCopyToContainer(
                Transferable.of(SCOPED_SHIRO), FusekiTestImage.FUSEKI_BASE + "/shiro.ini");
    // Fuseki launched directly from an operator's own assembler, with only the extension added.
    // FusekiServerPlainCmd loads Fuseki modules from the classpath; FusekiMainCmd does not.
    assembled =
        FusekiTestImage.bare()
            .withCopyToContainer(Transferable.of(stockConfig()), STOCK_CONFIG_PATH)
            .withCreateContainerCmdModifier(command -> command.withEntrypoint("java"))
            .withCommand(
                "-Xmx512m",
                "-cp",
                FusekiTestImage.FUSEKI_SERVER_JAR + ":" + FusekiTestImage.EXTENSION_JAR,
                "org.apache.jena.fuseki.main.cmds.FusekiServerPlainCmd",
                "--config=" + STOCK_CONFIG_PATH)
            .waitingFor(Wait.forHttp("/$/ping").withStartupTimeout(Duration.ofMinutes(2)));
    // The image's stock launch: the extension's classes are never loaded.
    withoutExtension =
        FusekiTestImage.forOpenMetadata("-Xms256m -Xmx256m")
            .withEnv("OPENMETADATA_EXTENSION_ENABLED", "false");
    shipped.start();
    scoped.start();
    assembled.start();
    withoutExtension.start();
    createDatasetThroughAdminApi(ADMIN_CREATED_DATASET);
  }

  @AfterAll
  static void stop() {
    for (GenericContainer<?> fuseki : new GenericContainer<?>[] {assembled, withoutExtension}) {
      if (fuseki != null) {
        fuseki.close();
      }
    }
    if (shipped != null) {
      shipped.close();
    }
    if (scoped != null) {
      scoped.close();
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
  void operatorAssemblerWithTheExtensionIsReadyAndAcceptsBulkAppends() {
    try (JenaFusekiStorage storage = storage(assembled, STOCK_DATASET, null, null)) {
      assertReadyLeavingNoTrace(storage);
      assertBulkAppendIsReadable(storage);
    }
  }

  @Test
  void fusekiWithoutTheExtensionFailsNamingIt() {
    try (JenaFusekiStorage storage =
        storage(withoutExtension, SCOPED_DATASET, "admin", ADMIN_PASSWORD)) {
      final String failure = assertNotReadyLeavingNoTrace(storage);
      assertTrue(failure.contains("does not run the OpenMetadata Graph Store extension"), failure);
      assertTrue(failure.contains("OPENMETADATA_EXTENSION_ENABLED=true"), failure);
    }
  }

  @Test
  void ontologyActivationWithoutTheExtensionFailsNamingItAndWritesNothing() {
    final Model release = ModelFactory.createDefaultModel();
    // openmetadata_b: each storage loads the bundled ontology, whose blank nodes make a concurrent
    // second load add triples, so a dataset shared with another method breaks the count below.
    try (JenaFusekiStorage storage =
        storage(withoutExtension, "openmetadata_b", "admin", ADMIN_PASSWORD)) {
      release
          .createResource(BASE + "concept/" + UUID.randomUUID())
          .addProperty(release.createProperty(NAME), "activation");
      final long before = storage.getTripleCount();
      final IllegalStateException failure =
          assertThrows(
              IllegalStateException.class,
              () ->
                  storage.replaceGraph(
                      BASE + "graph/ontology/" + UUID.randomUUID(), UUID.randomUUID(), release));
      assertTrue(
          failure.getMessage().contains("does not run the OpenMetadata Graph Store extension"),
          failure.getMessage());
      assertEquals(before, storage.getTripleCount(), "a refused activation must write nothing");
    } finally {
      release.close();
    }
  }

  /** Activation uploads with Graph Store PUT, a different extension path from the bulk append. */
  @Test
  void ontologyActivationKeepsALiteralOverOneHundredKilobytes() {
    final String graph = BASE + "graph/ontology/" + UUID.randomUUID();
    final Model release = ModelFactory.createDefaultModel();
    // openmetadata_a: no other test writes there, and these methods run concurrently.
    try (JenaFusekiStorage storage = storage(shipped, "openmetadata_a", "admin", ADMIN_PASSWORD)) {
      release
          .createResource(BASE + "concept/" + UUID.randomUUID())
          .addProperty(release.createProperty(NAME), "x".repeat(LONG_LITERAL_LENGTH));
      storage.replaceGraph(graph, UUID.randomUUID(), release);
      final AtomicLong longest = new AtomicLong(-1);
      storage.readQuery(
          QueryFactory.create(
              "SELECT (MAX(STRLEN(STR(?o))) AS ?length) WHERE { GRAPH <"
                  + graph
                  + "> { ?s ?p ?o FILTER(isLiteral(?o)) } }"),
          30_000,
          execution -> {
            final ResultSet rows = execution.execSelect();
            if (rows.hasNext() && rows.next().getLiteral("length") instanceof Literal length) {
              longest.set(length.getLong());
            }
          });
      assertEquals(LONG_LITERAL_LENGTH, longest.get(), "-1 means the graph holds no literal");
    } finally {
      release.close();
    }
  }

  /** FUSEKI_UNION_DEFAULT_GRAPH applies server-wide, not only to the seeded datasets. */
  @Test
  void datasetCreatedThroughTheAdminApiInheritsTheUnionDefaultGraph() {
    try (JenaFusekiStorage storage =
        storage(shipped, ADMIN_CREATED_DATASET, "admin", ADMIN_PASSWORD)) {
      assertReadyLeavingNoTrace(storage);
      assertBulkAppendIsReadable(storage);
    }
  }

  @Test
  void fusekiWithoutUnionDefaultGraphFailsNamingIt() {
    try (JenaFusekiStorage storage = storage(assembled, STOCK_WITHOUT_UNION, null, null)) {
      final String failure = assertNotReadyLeavingNoTrace(storage);
      assertTrue(failure.contains(UNION_DISABLED), failure);
      assertTrue(failure.contains("'" + STOCK_WITHOUT_UNION + "'"), failure);
    }
  }

  @Test
  void readOnlyDatasetFailsNamingTheMethodsItAllows() {
    try (JenaFusekiStorage storage = storage(assembled, STOCK_READ_ONLY, null, null)) {
      final String failure = assertNotReadyLeavingNoTrace(storage);
      assertTrue(
          failure.contains("is read-only (its Graph Store allows GET,HEAD,OPTIONS)"), failure);
    }
  }

  @Test
  void datasetWithoutSparqlUpdateFailsNamingTheRejection() {
    try (JenaFusekiStorage storage = storage(assembled, STOCK_WITHOUT_UPDATE, null, null)) {
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
  void unknownDatasetWithoutTheExtensionFailsNamingTheDatasetNotTheExtension() {
    try (JenaFusekiStorage storage =
        storage(withoutExtension, "no_such_dataset", "admin", ADMIN_PASSWORD)) {
      final IllegalStateException failure =
          assertThrows(IllegalStateException.class, storage::ensureStorageReady);
      assertTrue(
          failure.getMessage().contains("'no_such_dataset' does not exist"), failure.getMessage());
    }
  }

  @Test
  void rejectedPasswordFailsAsACredentialsProblem() {
    try (JenaFusekiStorage storage = storage(shipped, "openmetadata", "admin", "wrong")) {
      final IllegalStateException failure =
          assertThrows(IllegalStateException.class, storage::ensureStorageReady);
      assertTrue(failure.getMessage().contains("credentials"), failure.getMessage());
    }
  }

  @Test
  void writerInsideItsDatasetIsReady() {
    try (JenaFusekiStorage storage =
        storage(scoped, SCOPED_DATASET, "openmetadata", WRITER_PASSWORD)) {
      assertReadyLeavingNoTrace(storage);
    }
  }

  @Test
  void writerOutsideItsDatasetsFailsAsAnAuthorizationProblem() {
    try (JenaFusekiStorage storage =
        storage(scoped, OUTSIDE_SCOPE_DATASET, "openmetadata", WRITER_PASSWORD)) {
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
