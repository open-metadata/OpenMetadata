package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.service.rdf.RdfUpdater;

/**
 * Integration tests for RDF resource operations.
 *
 * <p>Tests verify that entities are properly stored in the RDF knowledge graph when RDF is enabled.
 * Uses the Fuseki SPARQL endpoint to verify entity creation, updates, and deletion.
 *
 * <p>Test isolation: Uses TestNamespace for unique entity naming
 * Parallelization: Safe for concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 *
 * <p>Migrated from: org.openmetadata.service.resources.rdf.RdfResourceTest
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class RdfResourceIT {

  private static final String TABLE_RDF_TYPE = "dcat:Dataset";
  private static final String BASE_URI = "https://open-metadata.org/";
  private static final String OM_NS = BASE_URI + "ontology/";
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();

  @BeforeAll
  static void enableRdf() {
    assumeTrue(
        RdfTestUtils.isRdfEnabled(),
        "RDF is disabled for this test run. Use the RDF test profile to execute RdfResourceIT.");
    RdfConfiguration rdfConfig = new RdfConfiguration();
    rdfConfig.setEnabled(true);
    rdfConfig.setBaseUri(URI.create(BASE_URI));
    rdfConfig.setStorageType(RdfConfiguration.StorageType.FUSEKI);
    rdfConfig.setRemoteEndpoint(URI.create(TestSuiteBootstrap.getFusekiEndpoint()));
    rdfConfig.setUsername("admin");
    rdfConfig.setPassword("test-admin");
    rdfConfig.setDataset("openmetadata");
    RdfUpdater.initialize(rdfConfig);
  }

  @AfterAll
  static void disableRdf() {
    RdfUpdater.disable();
  }

  @Test
  void testEntityStoredInRdf(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable createRequest = new CreateTable();
    createRequest.setName(ns.prefix("rdfStorageTable"));
    createRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    createRequest.setDescription("Table for RDF storage test");

    List<Column> columns =
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("name", "VARCHAR").dataLength(255).build());
    createRequest.setColumns(columns);

    Table table = Tables.create(createRequest);
    assertNotNull(table.getId());

    RdfTestUtils.verifyEntityInRdf(table, TABLE_RDF_TYPE);
  }

  @Test
  void testMultipleEntitiesStoredInRdf(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable createRequest1 = new CreateTable();
    createRequest1.setName(ns.prefix("rdfMulti1"));
    createRequest1.setDatabaseSchema(schema.getFullyQualifiedName());
    createRequest1.setDescription("First table for RDF multi test");
    createRequest1.setColumns(
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("data", "VARCHAR").dataLength(100).build()));

    Table table1 = Tables.create(createRequest1);
    assertNotNull(table1.getId());

    CreateTable createRequest2 = new CreateTable();
    createRequest2.setName(ns.prefix("rdfMulti2"));
    createRequest2.setDatabaseSchema(schema.getFullyQualifiedName());
    createRequest2.setDescription("Second table for RDF multi test");
    createRequest2.setColumns(
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("value", "VARCHAR").dataLength(100).build()));

    Table table2 = Tables.create(createRequest2);
    assertNotNull(table2.getId());

    RdfTestUtils.verifyEntityInRdf(table1, TABLE_RDF_TYPE);
    RdfTestUtils.verifyEntityInRdf(table2, TABLE_RDF_TYPE);
  }

  @Test
  void testEntityDeleteFromRdf(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable createRequest = new CreateTable();
    createRequest.setName(ns.prefix("rdfDeleteTable"));
    createRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    createRequest.setDescription("Table for RDF delete test");
    createRequest.setColumns(
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("info", "VARCHAR").dataLength(200).build()));

    Table table = Tables.create(createRequest);
    assertNotNull(table.getId());

    RdfTestUtils.verifyEntityInRdf(table, TABLE_RDF_TYPE);

    Tables.delete(
        table.getId().toString(), java.util.Map.of("hardDelete", "true", "recursive", "true"));

    Awaitility.await()
        .atMost(Duration.ofSeconds(10))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(() -> RdfTestUtils.verifyEntityNotInRdf(table.getFullyQualifiedName()));
  }

  @Test
  void testEntityUpdateInRdf(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable createRequest = new CreateTable();
    createRequest.setName(ns.prefix("rdfUpdateTable"));
    createRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    createRequest.setDescription("Table for RDF update test");
    createRequest.setColumns(
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("original", "VARCHAR").dataLength(100).build()));

    Table table = Tables.create(createRequest);
    assertNotNull(table.getId());

    Awaitility.await()
        .atMost(Duration.ofSeconds(10))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(() -> RdfTestUtils.verifyEntityInRdf(table, TABLE_RDF_TYPE));

    table.setDescription("Updated description for RDF test");
    Table updated = Tables.update(table.getId().toString(), table);
    assertNotNull(updated);

    Awaitility.await()
        .atMost(Duration.ofSeconds(10))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(() -> RdfTestUtils.verifyEntityUpdatedInRdf(updated));
  }

  // ---------------------------------------------------------------------------
  // Phase-1 knowledge-graph fidelity tests (P1.1, P1.2, P1.7, P1.9).
  // These exercise the new column / constraint / SHACL / ontology behavior
  // against the same Fuseki container used by the tests above.
  // ---------------------------------------------------------------------------

  @Test
  void testColumnIsNamedRdfResource(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable createRequest = new CreateTable();
    createRequest.setName(ns.prefix("rdfColumnUriTable"));
    createRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    createRequest.setColumns(
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().build(),
            ColumnBuilder.of("email", "VARCHAR").dataLength(255).unique().build()));

    Table table = Tables.create(createRequest);
    assertNotNull(table.getId());

    String idColumnFqn = table.getFullyQualifiedName() + ".id";
    String emailColumnFqn = table.getFullyQualifiedName() + ".email";

    Awaitility.await()
        .atMost(Duration.ofSeconds(15))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(
            () -> {
              assertTrue(
                  columnIsTypedAsOmColumn(idColumnFqn),
                  "PK column should be a named om:Column resource at the FQN-derived URI");
              assertTrue(
                  columnIsTypedAsOmColumn(emailColumnFqn),
                  "UNIQUE column should be a named om:Column resource at the FQN-derived URI");
            });
  }

  @Test
  void testColumnConstraintFlagsInRdf(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable createRequest = new CreateTable();
    createRequest.setName(ns.prefix("rdfConstraintTable"));
    createRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    createRequest.setColumns(
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().build(),
            ColumnBuilder.of("email", "VARCHAR").dataLength(255).unique().build(),
            ColumnBuilder.of("country", "VARCHAR").dataLength(2).notNull().build()));

    Table table = Tables.create(createRequest);
    String idFqn = table.getFullyQualifiedName() + ".id";
    String emailFqn = table.getFullyQualifiedName() + ".email";
    String countryFqn = table.getFullyQualifiedName() + ".country";

    Awaitility.await()
        .atMost(Duration.ofSeconds(15))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(
            () -> {
              assertTrue(
                  columnHasBooleanProperty(idFqn, "isPrimaryKey", true),
                  "Primary-key column should set om:isPrimaryKey true");
              assertTrue(
                  columnHasBooleanProperty(idFqn, "isNullable", false),
                  "Primary-key column should set om:isNullable false");
              assertTrue(
                  columnHasBooleanProperty(idFqn, "isUnique", true),
                  "Primary-key column should also set om:isUnique true (PKs are unique)");
              assertTrue(
                  columnHasBooleanProperty(emailFqn, "isUnique", true),
                  "UNIQUE column should set om:isUnique true");
              assertTrue(
                  columnHasBooleanProperty(countryFqn, "isNullable", false),
                  "NOT_NULL column should set om:isNullable false");
            });
  }

  @Test
  void testForeignKeyReferencesInRdf(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable customers = new CreateTable();
    customers.setName(ns.prefix("rdfFkCustomers"));
    customers.setDatabaseSchema(schema.getFullyQualifiedName());
    customers.setColumns(
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().build(),
            ColumnBuilder.of("name", "VARCHAR").dataLength(255).build()));
    Table customersTable = Tables.create(customers);

    String customerIdFqn = customersTable.getFullyQualifiedName() + ".id";

    CreateTable orders = new CreateTable();
    orders.setName(ns.prefix("rdfFkOrders"));
    orders.setDatabaseSchema(schema.getFullyQualifiedName());
    orders.setColumns(
        List.of(
            ColumnBuilder.of("order_id", "BIGINT").primaryKey().build(),
            ColumnBuilder.of("customer_id", "BIGINT").notNull().build()));

    TableConstraint fk =
        new TableConstraint()
            .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
            .withColumns(List.of("customer_id"))
            .withReferredColumns(List.of(customerIdFqn))
            .withRelationshipType(TableConstraint.RelationshipType.MANY_TO_ONE);
    orders.setTableConstraints(List.of(fk));

    Table ordersTable = Tables.create(orders);

    String orderCustomerIdFqn = ordersTable.getFullyQualifiedName() + ".customer_id";

    Awaitility.await()
        .atMost(Duration.ofSeconds(15))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(
            () -> {
              assertTrue(
                  columnReferencesColumn(orderCustomerIdFqn, customerIdFqn),
                  "FOREIGN_KEY constraint should produce direct om:references triple between source and referred column");
              assertTrue(
                  tableHasConstraintOfType(ordersTable.getFullyQualifiedName(), "FOREIGN_KEY"),
                  "Table should declare a FOREIGN_KEY om:TableConstraint resource");
            });
  }

  @Test
  void testOntologyEndpointServesBumpedVersion() throws Exception {
    String url = SdkClients.getServerUrl() + "/v1/rdf/ontology";
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Accept", "text/turtle")
            .GET()
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertNotNull(response);
    assertTrue(
        response.statusCode() == 200,
        "GET /v1/rdf/ontology should return 200, got " + response.statusCode());
    String body = response.body();
    assertTrue(body.contains("1.1.0"), "Ontology document should declare the bumped version 1.1.0");
    assertTrue(
        body.contains("om:Column") && body.contains("om:TableConstraint"),
        "Ontology document should declare core om:Column and om:TableConstraint classes");
  }

  @Test
  void testShaclValidateEndpointReturnsReport(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable createRequest = new CreateTable();
    createRequest.setName(ns.prefix("rdfShaclTable"));
    createRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    createRequest.setColumns(List.of(ColumnBuilder.of("id", "BIGINT").primaryKey().build()));
    Table table = Tables.create(createRequest);

    String entityUri = BASE_URI + "entity/table/" + table.getId();
    String url =
        SdkClients.getServerUrl()
            + "/v1/rdf/validate?entityUri="
            + URLEncoder.encode(entityUri, StandardCharsets.UTF_8);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Accept", "text/turtle")
            .POST(HttpRequest.BodyPublishers.noBody())
            .build();

    Awaitility.await()
        .atMost(Duration.ofSeconds(15))
        .pollInterval(Duration.ofSeconds(1))
        .untilAsserted(
            () -> {
              HttpResponse<String> response =
                  HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
              assertTrue(
                  response.statusCode() == 200,
                  "POST /v1/rdf/validate should return 200, got " + response.statusCode());
              String body = response.body();
              assertTrue(
                  body.contains("ValidationReport") || body.contains("conforms"),
                  "Response should be a SHACL validation report");
              assertTrue(
                  response.headers().firstValue("OM-SHACL-Conforms").isPresent(),
                  "Endpoint should set OM-SHACL-Conforms header");
            });
  }

  // ---- helpers for the fidelity tests ----

  private boolean columnIsTypedAsOmColumn(String columnFqn) {
    String columnUri =
        BASE_URI + "entity/column/" + URLEncoder.encode(columnFqn, StandardCharsets.UTF_8);
    String sparql =
        String.format(
            "PREFIX om: <%s> "
                + "ASK { GRAPH ?g { <%s> a om:Column ; om:fullyQualifiedName \"%s\" } }",
            OM_NS, columnUri, columnFqn);
    return RdfTestUtils.executeSparqlAsk(sparql);
  }

  private boolean columnHasBooleanProperty(String columnFqn, String predicate, boolean expected) {
    String columnUri =
        BASE_URI + "entity/column/" + URLEncoder.encode(columnFqn, StandardCharsets.UTF_8);
    String sparql =
        String.format(
            "PREFIX om: <%s> "
                + "PREFIX xsd: <http://www.w3.org/2001/XMLSchema#> "
                + "ASK { GRAPH ?g { <%s> om:%s \"%s\"^^xsd:boolean } }",
            OM_NS, columnUri, predicate, expected);
    return RdfTestUtils.executeSparqlAsk(sparql);
  }

  private boolean columnReferencesColumn(String fromFqn, String toFqn) {
    String fromUri =
        BASE_URI + "entity/column/" + URLEncoder.encode(fromFqn, StandardCharsets.UTF_8);
    String toUri = BASE_URI + "entity/column/" + URLEncoder.encode(toFqn, StandardCharsets.UTF_8);
    String sparql =
        String.format(
            "PREFIX om: <%s> ASK { GRAPH ?g { <%s> om:references <%s> } }", OM_NS, fromUri, toUri);
    return RdfTestUtils.executeSparqlAsk(sparql);
  }

  private boolean tableHasConstraintOfType(String tableFqn, String constraintType) {
    String escaped = tableFqn.replace("\\", "\\\\").replace("\"", "\\\"");
    String sparql =
        String.format(
            "PREFIX om: <%s> "
                + "ASK { GRAPH ?g { "
                + "  ?table om:fullyQualifiedName \"%s\" ; "
                + "         om:hasConstraint ?c . "
                + "  ?c om:constraintType \"%s\" . "
                + "} }",
            OM_NS, escaped, constraintType);
    return RdfTestUtils.executeSparqlAsk(sparql);
  }
}
