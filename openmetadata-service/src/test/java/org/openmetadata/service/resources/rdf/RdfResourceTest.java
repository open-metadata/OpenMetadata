package org.openmetadata.service.resources.rdf;

import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.io.IOException;
import java.net.URISyntaxException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.util.RdfTestUtils;

/**
 * Tests for RDF functionality. These tests verify that entities are properly stored in the RDF
 * knowledge graph when RDF is enabled.
 *
 * <p>This test class extends OpenMetadataApplicationTest to get the test infrastructure (Dropwizard
 * app, test containers) but uses TableResourceTest as a helper for entity creation. It does NOT
 * extend TableResourceTest to avoid inheriting all its tests.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class RdfResourceTest extends OpenMetadataApplicationTest {

  // RDF type for Table entities (from RdfUtils.java)
  private static final String TABLE_RDF_TYPE = "dcat:Dataset";

  private TableResourceTest tableResourceTest;

  @BeforeAll
  public void setup(TestInfo test) throws URISyntaxException, IOException {
    // Skip setup if RDF is not enabled
    if (!"true".equals(System.getProperty("enableRdf"))) {
      return;
    }
    // Initialize the TableResourceTest helper for creating entities
    tableResourceTest = new TableResourceTest();
    tableResourceTest.setup(test);
  }

  @Test
  void testEntityStoredInRdf(TestInfo test) throws Exception {
    if (!"true".equals(System.getProperty("enableRdf"))) {
      return; // Skip if RDF is not enabled
    }

    // Create a table
    CreateTable createTable =
        tableResourceTest.createRequest(test.getDisplayName() + "_rdf_storage");
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Verify the entity was stored in RDF as dcat:Dataset
    RdfTestUtils.verifyEntityInRdf(table, TABLE_RDF_TYPE);
  }

  @Test
  void testMultipleEntitiesStoredInRdf(TestInfo test) throws Exception {
    if (!"true".equals(System.getProperty("enableRdf"))) {
      return; // Skip if RDF is not enabled
    }

    // Create multiple tables
    CreateTable createTable1 =
        tableResourceTest.createRequest(test.getDisplayName() + "_rdf_multi1");
    Table table1 = tableResourceTest.createEntity(createTable1, ADMIN_AUTH_HEADERS);

    CreateTable createTable2 =
        tableResourceTest.createRequest(test.getDisplayName() + "_rdf_multi2");
    Table table2 = tableResourceTest.createEntity(createTable2, ADMIN_AUTH_HEADERS);

    // Verify both entities are stored in RDF
    RdfTestUtils.verifyEntityInRdf(table1, TABLE_RDF_TYPE);
    RdfTestUtils.verifyEntityInRdf(table2, TABLE_RDF_TYPE);
  }

  @Test
  void testEntityDeleteFromRdf(TestInfo test) throws Exception {
    if (!"true".equals(System.getProperty("enableRdf"))) {
      return; // Skip if RDF is not enabled
    }

    // Create a table
    CreateTable createTable =
        tableResourceTest.createRequest(test.getDisplayName() + "_rdf_delete");
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Verify it's in RDF first
    RdfTestUtils.verifyEntityInRdf(table, TABLE_RDF_TYPE);

    // Hard delete the table (recursive=true, hardDelete=true)
    tableResourceTest.deleteEntity(table.getId(), true, true, ADMIN_AUTH_HEADERS);

    // After hard delete, entity should be removed from RDF
    RdfTestUtils.verifyEntityNotInRdf(table.getFullyQualifiedName());
  }
}
