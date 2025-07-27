package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.resources.EntityResourceTest.PII_SENSITIVE_TAG_LABEL;
import static org.openmetadata.service.resources.EntityResourceTest.TIER1_TAG_LABEL;
import static org.openmetadata.service.resources.EntityResourceTest.USER1_REF;
import static org.openmetadata.service.resources.EntityResourceTest.USER_ADDRESS_TAG_LABEL;
import static org.openmetadata.service.resources.databases.TableResourceTest.getColumn;
import static org.openmetadata.service.util.RdfTestUtils.*;
import static org.openmetadata.service.util.TestUtils.*;

import java.io.IOException;
import java.net.URISyntaxException;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.databases.DatabaseResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;

/**
 * Specific tests for Table entity RDF relationships
 */
@Slf4j
public class RdfTableRelationshipTest extends OpenMetadataApplicationTest {

  private static DatabaseServiceResourceTest serviceResourceTest;
  private static DatabaseResourceTest databaseResourceTest;
  private static DatabaseSchemaResourceTest schemaResourceTest;
  private static TableResourceTest tableResourceTest;

  @BeforeAll
  public static void setup() throws IOException, URISyntaxException {
    serviceResourceTest = new DatabaseServiceResourceTest();
    databaseResourceTest = new DatabaseResourceTest();
    schemaResourceTest = new DatabaseSchemaResourceTest();
    tableResourceTest = new TableResourceTest();

    serviceResourceTest.setup(null);
    databaseResourceTest.setup(null);
    schemaResourceTest.setup(null);
    tableResourceTest.setup(null);
  }

  @Test
  void testTableWithFullHierarchy(TestInfo test) throws IOException {
    if (!isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create database service
    CreateDatabaseService createService =
        serviceResourceTest
            .createRequest(test)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql);
    DatabaseService service = serviceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create database
    CreateDatabase createDatabase =
        databaseResourceTest.createRequest(test).withService(service.getFullyQualifiedName());
    Database database = databaseResourceTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);

    // Create schema
    CreateDatabaseSchema createSchema =
        schemaResourceTest.createRequest(test).withDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = schemaResourceTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);

    // Create table with columns
    CreateTable createTable =
        tableResourceTest
            .createRequest(test)
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(
                listOf(
                    getColumn("id", ColumnDataType.INT, USER_ADDRESS_TAG_LABEL),
                    getColumn("name", ColumnDataType.VARCHAR, PII_SENSITIVE_TAG_LABEL),
                    getColumn("email", ColumnDataType.VARCHAR, PII_SENSITIVE_TAG_LABEL)))
            .withOwners(listOf(USER1_REF))
            .withTags(listOf(TIER1_TAG_LABEL));

    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Verify all entities exist in RDF
    LOG.info("Verifying service entity in RDF");
    verifyEntityInRdf(service, RdfUtils.getRdfType("databaseService"));

    LOG.info("Verifying database entity in RDF");
    verifyEntityInRdf(database, RdfUtils.getRdfType("database"));

    LOG.info("Verifying schema entity in RDF");
    verifyEntityInRdf(schema, RdfUtils.getRdfType("databaseSchema"));

    LOG.info("Verifying table entity in RDF");
    verifyEntityInRdf(table, RdfUtils.getRdfType("table"));

    // Verify hierarchical relationships
    LOG.info("Verifying service CONTAINS database");
    verifyContainsRelationshipInRdf(service.getEntityReference(), database.getEntityReference());

    LOG.info("Verifying database CONTAINS schema");
    verifyContainsRelationshipInRdf(database.getEntityReference(), schema.getEntityReference());

    LOG.info("Verifying schema CONTAINS table");
    verifyContainsRelationshipInRdf(schema.getEntityReference(), table.getEntityReference());

    // Verify owner relationship
    LOG.info("Verifying table hasOwner USER1");
    verifyOwnerInRdf(table.getFullyQualifiedName(), USER1_REF);

    // Verify table tags
    LOG.info("Verifying table tags");
    verifyTagsInRdf(table.getFullyQualifiedName(), table.getTags());
  }

  @Test
  void testTableSoftDeleteAndRestore(TestInfo test) throws IOException {
    if (!isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create table
    CreateTable createTable =
        tableResourceTest
            .createRequest(test)
            .withDatabaseSchema(TEST_SCHEMA_REFERENCE.getFullyQualifiedName())
            .withOwners(listOf(USER1_REF));
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Verify table and relationships exist
    LOG.info("Verifying table exists before deletion");
    verifyEntityInRdf(table, RdfUtils.getRdfType("table"));
    verifyContainsRelationshipInRdf(TEST_SCHEMA_REFERENCE, table.getEntityReference());
    verifyOwnerInRdf(table.getFullyQualifiedName(), USER1_REF);

    // Soft delete the table
    tableResourceTest.deleteEntity(table.getId(), ADMIN_AUTH_HEADERS);

    // Verify table still exists in RDF after soft delete
    LOG.info("Verifying table still exists after soft delete");
    verifyEntityInRdf(table, RdfUtils.getRdfType("table"));
    verifyContainsRelationshipInRdf(TEST_SCHEMA_REFERENCE, table.getEntityReference());
    verifyOwnerInRdf(table.getFullyQualifiedName(), USER1_REF);

    // Restore the table
    Table restored = tableResourceTest.restoreEntity(table.getId(), ADMIN_AUTH_HEADERS);

    // Verify table and relationships still exist after restore
    LOG.info("Verifying table exists after restore");
    verifyEntityInRdf(restored, RdfUtils.getRdfType("table"));
    verifyContainsRelationshipInRdf(TEST_SCHEMA_REFERENCE, restored.getEntityReference());
    verifyOwnerInRdf(restored.getFullyQualifiedName(), USER1_REF);
  }

  @Test
  void testTableHardDelete(TestInfo test) throws IOException {
    if (!isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create table
    CreateTable createTable =
        tableResourceTest
            .createRequest(test)
            .withDatabaseSchema(TEST_SCHEMA_REFERENCE.getFullyQualifiedName());
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Verify table exists
    LOG.info("Verifying table exists before hard deletion");
    verifyEntityInRdf(table, RdfUtils.getRdfType("table"));
    verifyContainsRelationshipInRdf(TEST_SCHEMA_REFERENCE, table.getEntityReference());

    // Hard delete the table
    tableResourceTest.deleteEntity(table.getId(), true, true, ADMIN_AUTH_HEADERS);

    // Verify table no longer exists in RDF after hard delete
    LOG.info("Verifying table does not exist after hard delete");
    verifyEntityNotInRdf(table.getFullyQualifiedName());

    // Verify relationships are also removed
    RdfRepository repository = RdfRepository.getInstance();
    if (repository != null && repository.isEnabled()) {
      // Check that CONTAINS relationship is removed
      String sparql =
          String.format(
              "PREFIX om: <https://open-metadata.org/ontology/> "
                  + "ASK { "
                  + "  ?parent om:contains <%s> . "
                  + "}",
              "https://open-metadata.org/entity/table/" + table.getId());

      boolean exists =
          repository
              .executeSparqlQuery(sparql, "application/sparql-results+json")
              .contains("\"boolean\": true");
      assertFalse(exists, "CONTAINS relationship should be removed after hard delete");
    }
  }

  @Test
  void testTableUpdatePreservesRelationships(TestInfo test) throws IOException {
    if (!isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create table
    CreateTable createTable =
        tableResourceTest
            .createRequest(test)
            .withDatabaseSchema(TEST_SCHEMA_REFERENCE.getFullyQualifiedName())
            .withOwners(listOf(USER1_REF))
            .withTags(listOf(TIER1_TAG_LABEL));
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Verify initial state
    LOG.info("Verifying initial table state");
    verifyEntityInRdf(table, RdfUtils.getRdfType("table"));
    verifyContainsRelationshipInRdf(TEST_SCHEMA_REFERENCE, table.getEntityReference());
    verifyOwnerInRdf(table.getFullyQualifiedName(), USER1_REF);
    verifyTagsInRdf(table.getFullyQualifiedName(), table.getTags());

    // Update table description
    table.setDescription("Updated description");
    Table updated = tableResourceTest.updateEntity(table, ADMIN_AUTH_HEADERS);

    // Verify relationships are preserved after update
    LOG.info("Verifying relationships after update");
    verifyEntityInRdf(updated, RdfUtils.getRdfType("table"));
    verifyContainsRelationshipInRdf(TEST_SCHEMA_REFERENCE, updated.getEntityReference());
    verifyOwnerInRdf(updated.getFullyQualifiedName(), USER1_REF);
    verifyTagsInRdf(updated.getFullyQualifiedName(), updated.getTags());
  }
}
