package org.openmetadata.service.resources.rdf;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.TestUtils.*;

import java.io.IOException;
import java.net.URISyntaxException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.util.RdfTestUtils;

/**
 * Tests for RDF functionality. These tests verify that entities are properly stored in the RDF
 * knowledge graph when RDF is enabled.
 *
 * <p>The tests extend TableResourceTest to leverage its entity creation infrastructure and verify
 * that RDF storage is working correctly with the single unified knowledge graph.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class RdfResourceTest extends TableResourceTest {

  // RDF type for Table entities (from RdfUtils.java)
  private static final String TABLE_RDF_TYPE = "dcat:Dataset";

  @Override
  @BeforeAll
  public void setup(TestInfo test) throws URISyntaxException, IOException {
    // Skip full setup if RDF is not enabled
    if (!"true".equals(System.getProperty("enableRdf"))) {
      return;
    }
    super.setup(test);
  }

  @Test
  void testEntityStoredInRdf(TestInfo test) throws Exception {
    if (!"true".equals(System.getProperty("enableRdf"))) {
      return; // Skip if RDF is not enabled
    }

    // Create a table
    CreateTable createTable = createRequest(test.getDisplayName() + "_rdf_storage");
    Table table = createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Verify the entity was stored in RDF as dcat:Dataset
    RdfTestUtils.verifyEntityInRdf(table, TABLE_RDF_TYPE);
  }

  @Test
  void testMultipleEntitiesStoredInRdf(TestInfo test) throws Exception {
    if (!"true".equals(System.getProperty("enableRdf"))) {
      return; // Skip if RDF is not enabled
    }

    // Create multiple tables
    CreateTable createTable1 = createRequest(test.getDisplayName() + "_rdf_multi1");
    Table table1 = createEntity(createTable1, ADMIN_AUTH_HEADERS);

    CreateTable createTable2 = createRequest(test.getDisplayName() + "_rdf_multi2");
    Table table2 = createEntity(createTable2, ADMIN_AUTH_HEADERS);

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
    CreateTable createTable = createRequest(test.getDisplayName() + "_rdf_delete");
    Table table = createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Verify it's in RDF first
    RdfTestUtils.verifyEntityInRdf(table, TABLE_RDF_TYPE);

    // Hard delete the table (recursive=true, hardDelete=true)
    deleteEntity(table.getId(), true, true, ADMIN_AUTH_HEADERS);

    // After hard delete, entity should be removed from RDF
    RdfTestUtils.verifyEntityNotInRdf(table.getFullyQualifiedName());
  }
}
