package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

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
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
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

  @BeforeAll
  static void enableRdf() {
    assumeTrue(
        RdfTestUtils.isRdfEnabled(),
        "RDF is disabled for this test run. Use the RDF test profile to execute RdfResourceIT.");
    RdfConfiguration rdfConfig = new RdfConfiguration();
    rdfConfig.setEnabled(true);
    rdfConfig.setBaseUri(java.net.URI.create("https://open-metadata.org/"));
    rdfConfig.setStorageType(RdfConfiguration.StorageType.FUSEKI);
    rdfConfig.setRemoteEndpoint(java.net.URI.create(TestSuiteBootstrap.getFusekiEndpoint()));
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
}
