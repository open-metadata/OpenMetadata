package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.*;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashSet;
import java.util.Set;
import javax.sql.DataSource;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

class IndexVerificationTest extends OpenMetadataApplicationTest {

  private static final Logger LOG = LoggerFactory.getLogger(IndexVerificationTest.class);

  @Test
  void testEntityRelationshipIndexesExist() throws Exception {
    Jdbi jdbi =
        Jdbi.create(
            APP.getConfiguration()
                .getDataSourceFactory()
                .build(APP.getEnvironment().metrics(), "test"));

    DataSource dataSource =
        APP.getConfiguration().getDataSourceFactory().build(APP.getEnvironment().metrics(), "test");

    try (Connection conn = dataSource.getConnection()) {
      String dbType = conn.getMetaData().getDatabaseProductName().toLowerCase();

      if (dbType.contains("mysql")) {
        verifyMySQLIndexes(conn);
      } else if (dbType.contains("postgres")) {
        verifyPostgreSQLIndexes(conn);
      }
    }
  }

  private void verifyMySQLIndexes(Connection conn) throws Exception {
    String query = "SHOW INDEX FROM entity_relationship";
    Set<String> expectedIndexes =
        Set.of(
            "idx_entity_relationship_from_composite",
            "idx_entity_relationship_to_composite",
            "idx_entity_relationship_relation",
            "idx_entity_relationship_bidirectional");

    Set<String> foundIndexes = new HashSet<>();

    try (Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery(query)) {
      while (rs.next()) {
        String indexName = rs.getString("Key_name");
        if (expectedIndexes.contains(indexName)) {
          foundIndexes.add(indexName);
          LOG.info("Found index: {}", indexName);
        }
      }
    }

    // Verify all expected indexes exist
    for (String expectedIndex : expectedIndexes) {
      assertTrue(foundIndexes.contains(expectedIndex), "Missing expected index: " + expectedIndex);
    }

    LOG.info("All MySQL entity_relationship indexes verified successfully");
  }

  private void verifyPostgreSQLIndexes(Connection conn) throws Exception {
    String query =
        """
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'entity_relationship'
        AND schemaname = 'public'
        """;

    Set<String> expectedIndexes =
        Set.of(
            "idx_entity_relationship_from_composite",
            "idx_entity_relationship_to_composite",
            "idx_entity_relationship_relation",
            "idx_entity_relationship_bidirectional",
            "idx_entity_relationship_ownership",
            "idx_entity_relationship_lineage");

    Set<String> foundIndexes = new HashSet<>();

    try (Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery(query)) {
      while (rs.next()) {
        String indexName = rs.getString("indexname");
        if (expectedIndexes.contains(indexName)) {
          foundIndexes.add(indexName);
          LOG.info("Found index: {}", indexName);
        }
      }
    }

    // Verify all expected indexes exist
    for (String expectedIndex : expectedIndexes) {
      assertTrue(foundIndexes.contains(expectedIndex), "Missing expected index: " + expectedIndex);
    }

    // Verify covering indexes (INCLUDE clause) for PostgreSQL
    verifyPostgreSQLCoveringIndexes(conn);

    LOG.info("All PostgreSQL entity_relationship indexes verified successfully");
  }

  private void verifyPostgreSQLCoveringIndexes(Connection conn) throws Exception {
    // Check that covering indexes have INCLUDE columns
    String query =
        """
        SELECT
          i.indexname,
          pg_get_indexdef(idx.indexrelid) as index_definition
        FROM pg_indexes i
        JOIN pg_class idx ON idx.relname = i.indexname
        WHERE i.tablename = 'entity_relationship'
        AND i.indexname IN ('idx_entity_relationship_from_composite', 'idx_entity_relationship_to_composite')
        """;

    try (Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery(query)) {
      while (rs.next()) {
        String indexName = rs.getString("indexname");
        String indexDef = rs.getString("index_definition");

        if (indexName.equals("idx_entity_relationship_from_composite")) {
          assertTrue(
              indexDef.contains("INCLUDE"),
              "From composite index should use INCLUDE for covering index");
          assertTrue(
              indexDef.contains("toid") || indexDef.contains("toId"),
              "From composite index should include toId");
        }

        if (indexName.equals("idx_entity_relationship_to_composite")) {
          assertTrue(
              indexDef.contains("INCLUDE"),
              "To composite index should use INCLUDE for covering index");
          assertTrue(
              indexDef.contains("fromid") || indexDef.contains("fromId"),
              "To composite index should include fromId");
        }

        LOG.info("Covering index {} verified: {}", indexName, indexDef);
      }
    }
  }

  @Test
  void testTagUsageIndexesExist() throws Exception {
    DataSource dataSource =
        APP.getConfiguration().getDataSourceFactory().build(APP.getEnvironment().metrics(), "test");

    try (Connection conn = dataSource.getConnection()) {
      String dbType = conn.getMetaData().getDatabaseProductName().toLowerCase();

      Set<String> expectedIndexes =
          Set.of(
              "idx_tag_usage_target_composite", "idx_tag_usage_tag_count", "idx_tag_usage_batch");

      Set<String> foundIndexes = new HashSet<>();

      if (dbType.contains("mysql")) {
        try (Statement stmt = conn.createStatement();
            ResultSet rs = stmt.executeQuery("SHOW INDEX FROM tag_usage")) {
          while (rs.next()) {
            String indexName = rs.getString("Key_name");
            if (expectedIndexes.contains(indexName)) {
              foundIndexes.add(indexName);
            }
          }
        }
      } else if (dbType.contains("postgres")) {
        String query =
            """
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'tag_usage'
            AND schemaname = 'public'
            """;

        try (Statement stmt = conn.createStatement();
            ResultSet rs = stmt.executeQuery(query)) {
          while (rs.next()) {
            String indexName = rs.getString("indexname");
            if (expectedIndexes.contains(indexName)) {
              foundIndexes.add(indexName);
            }
          }
        }
      }

      for (String expectedIndex : expectedIndexes) {
        assertTrue(
            foundIndexes.contains(expectedIndex),
            "Missing expected tag_usage index: " + expectedIndex);
      }

      LOG.info("All tag_usage indexes verified successfully");
    }
  }

  @Test
  void testQueryPlanUsesIndexes() throws Exception {
    // Test that actual queries use the indexes
    DataSource dataSource =
        APP.getConfiguration().getDataSourceFactory().build(APP.getEnvironment().metrics(), "test");

    try (Connection conn = dataSource.getConnection()) {
      String dbType = conn.getMetaData().getDatabaseProductName().toLowerCase();

      if (dbType.contains("mysql")) {
        testMySQLQueryPlan(conn);
      } else if (dbType.contains("postgres")) {
        testPostgreSQLQueryPlan(conn);
      }
    }
  }

  private void testMySQLQueryPlan(Connection conn) throws Exception {
    // Test 1: findTo query uses index (query by toId, toEntity, relation)
    String explainQueryTo =
        """
        EXPLAIN SELECT fromId, fromEntity, json
        FROM entity_relationship
        WHERE toId = '00000000-0000-0000-0000-000000000000'
        AND toEntity = 'table'
        AND relation = 8
        """;

    try (Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery(explainQueryTo)) {
      boolean usesIndex = false;
      while (rs.next()) {
        String possibleKeys = rs.getString("possible_keys");
        String key = rs.getString("key");

        // This query searches by toId, toEntity, relation - should use to_composite index
        if (possibleKeys != null && possibleKeys.contains("idx_entity_relationship_to_composite")) {
          usesIndex = true;
        }
        if (key != null
            && (key.contains("idx_entity_relationship_to_composite")
                || key.contains("to_index"))) { // to_index is also acceptable
          usesIndex = true;
        }

        LOG.info(
            "MySQL Query Plan for findTo - Type: {}, Possible Keys: {}, Key: {}",
            rs.getString("type"),
            possibleKeys,
            key);
      }

      assertTrue(
          usesIndex, "findTo query should use idx_entity_relationship_to_composite or to_index");
    }

    // Test 2: findFrom query uses index (query by fromId, fromEntity, relation)
    String explainQueryFrom =
        """
        EXPLAIN SELECT toId, toEntity, json
        FROM entity_relationship
        WHERE fromId = '00000000-0000-0000-0000-000000000000'
        AND fromEntity = 'table'
        AND relation = 8
        """;

    try (Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery(explainQueryFrom)) {
      boolean usesIndex = false;
      while (rs.next()) {
        String possibleKeys = rs.getString("possible_keys");
        String key = rs.getString("key");

        // This query searches by fromId, fromEntity, relation - should use from_composite index
        if (possibleKeys != null
            && possibleKeys.contains("idx_entity_relationship_from_composite")) {
          usesIndex = true;
        }
        if (key != null
            && (key.contains("idx_entity_relationship_from_composite")
                || key.contains("from_index"))) { // from_index is also acceptable
          usesIndex = true;
        }

        LOG.info(
            "MySQL Query Plan for findFrom - Type: {}, Possible Keys: {}, Key: {}",
            rs.getString("type"),
            possibleKeys,
            key);
      }

      assertTrue(
          usesIndex,
          "findFrom query should use idx_entity_relationship_from_composite or from_index");
    }
  }

  private void testPostgreSQLQueryPlan(Connection conn) throws Exception {
    // Test that findFrom query uses index
    String explainQuery =
        """
        EXPLAIN (FORMAT JSON)
        SELECT fromId, fromEntity, json
        FROM entity_relationship
        WHERE toId = '00000000-0000-0000-0000-000000000000'::uuid
        AND toEntity = 'table'
        AND relation = 8
        """;

    try (Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery(explainQuery)) {
      if (rs.next()) {
        String plan = rs.getString(1);

        // Check if index scan is used
        assertTrue(
            plan.contains("Index Scan") || plan.contains("Index Only Scan"),
            "Query should use index scan, but got: " + plan);

        assertTrue(
            plan.contains("idx_entity_relationship_from_composite")
                || plan.contains("idx_entity_relationship_to_composite"),
            "Query should use composite index");

        LOG.info("PostgreSQL query plan uses index correctly");
      }
    }
  }
}
