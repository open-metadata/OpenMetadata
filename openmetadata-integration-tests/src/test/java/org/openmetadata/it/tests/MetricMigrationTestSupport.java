/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.openmetadata.it.tests.MetricMigrationSqlFixture.MigrationScripts;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

final class MetricMigrationTestSupport {
  static final String METRIC_GROUP_TABLE = "metric_group_entity";
  static final String METRIC_TABLE = "metric_entity";
  static final String RELATIONSHIP_TABLE = "entity_relationship";
  static final String INCIDENT_TABLE = "test_case_incident";
  static final String METRIC_GROUP_NAME_INDEX = "metric_group_entity_name_index";
  static final String METRIC_GROUP_DELETED_INDEX = "idx_metric_group_entity_deleted_name_id";
  static final String MEMBERSHIP_INDEX = "uq_metric_group_single_membership";
  static final String MEMBERSHIP_COLUMN = "metricGroupMetricId";
  static final String MYSQL_MEMBERSHIP_COLUMN_DDL_VARIABLE = "metric_group_membership_column_ddl";
  static final String MYSQL_MEMBERSHIP_COLUMN_STATEMENT = "metric_group_membership_column_stmt";
  static final String MYSQL_MEMBERSHIP_INDEX_DDL_VARIABLE = "metric_group_membership_index_ddl";
  static final String MYSQL_MEMBERSHIP_INDEX_STATEMENT = "metric_group_membership_index_stmt";
  static final List<IndexExpectation> INCIDENT_INDEXES =
      List.of(
          new IndexExpectation(
              "test_case_resolution_status_time_series",
              "idx_test_case_resolution_status_state_id"),
          new IndexExpectation(
              "test_case_resolution_status_time_series", "idx_test_case_resolution_status_fqn_ts"),
          new IndexExpectation("test_case", "idx_test_case_id"),
          new IndexExpectation(
              "test_case_resolution_status_time_series",
              "idx_test_case_resolution_status_assignee"),
          new IndexExpectation(INCIDENT_TABLE, "idx_tci_status_fqn"),
          new IndexExpectation(INCIDENT_TABLE, "idx_tci_fqn"),
          new IndexExpectation(INCIDENT_TABLE, "idx_tci_assignee"),
          new IndexExpectation(INCIDENT_TABLE, "idx_tci_updated"));
  private static final String METRIC_GROUP = "metricGroup";
  private static final String METRIC = "metric";
  private static final String TABLE = "table";
  private static final String TEAM = "team";
  private static final GroupFixture METRIC_GROUP_FIXTURE =
      new GroupFixture(
          "group-fixture-id", "migration-group", "migration-group-hash", 123L, "migration-test");
  private static final GroupFixture DUPLICATE_FQN_GROUP_FIXTURE =
      new GroupFixture(
          "duplicate-group-fixture-id",
          "duplicate-migration-group",
          METRIC_GROUP_FIXTURE.fqnHash(),
          456L,
          "migration-test");
  private static final int HAS_RELATION = 10;

  private MetricMigrationTestSupport() {}

  static void assertCleanBootstrapSchema(Jdbi jdbi, ConnectionType connectionType) {
    jdbi.useHandle(
        handle -> {
          assertTrue(tableExists(handle, METRIC_GROUP_TABLE, connectionType));
          assertTrue(tableExists(handle, INCIDENT_TABLE, connectionType));
          assertTrue(
              indexExists(handle, METRIC_GROUP_TABLE, METRIC_GROUP_NAME_INDEX, connectionType));
          assertTrue(
              indexExists(handle, METRIC_GROUP_TABLE, METRIC_GROUP_DELETED_INDEX, connectionType));
          assertMembershipIndex(handle, RELATIONSHIP_TABLE, MEMBERSHIP_INDEX, connectionType);
          for (IndexExpectation index : INCIDENT_INDEXES) {
            assertTrue(
                indexExists(handle, index.table(), index.name(), connectionType),
                index.table() + "." + index.name());
          }
        });
  }

  static void runUpgradeScenario(
      Jdbi jdbi, MigrationScripts scripts, ConnectionType connectionType) {
    MigrationFixture fixture = MigrationFixture.create();
    try {
      jdbi.useHandle(handle -> runUpgradeScenario(handle, fixture, scripts, connectionType));
    } finally {
      dropFixture(jdbi, fixture);
    }
  }

  private static void runUpgradeScenario(
      Handle handle,
      MigrationFixture fixture,
      MigrationScripts scripts,
      ConnectionType connectionType) {
    createRelationshipFixture(handle, fixture.relationshipTable());
    insertPreexistingRelationships(handle, fixture.relationshipTable());
    executeMetricSchema(handle, fixture, scripts);
    assertMetricGroupTable(handle, fixture, connectionType);
    assertMembershipConstraint(handle, fixture, connectionType);
    createMetricFixture(handle, fixture.metricTable(), connectionType);
    insertPreexistingMetrics(handle, fixture.metricTable(), connectionType);
    executeStatusBackfill(handle, fixture, scripts);
    assertMetricStatuses(handle, fixture.metricTable(), connectionType);
  }

  private static void executeMetricSchema(
      Handle handle, MigrationFixture fixture, MigrationScripts scripts) {
    List<String> statements =
        metricSchemaStatements(scripts).stream()
            .map(statement -> fixtureStatement(statement, fixture))
            .toList();
    statements.forEach(handle::execute);
    statements.forEach(handle::execute);
  }

  private static void executeStatusBackfill(
      Handle handle, MigrationFixture fixture, MigrationScripts scripts) {
    String statement =
        metricPostStatements(scripts).getFirst().replace(METRIC_TABLE, fixture.metricTable());
    handle.execute(statement);
    handle.execute(statement);
  }

  private static void createRelationshipFixture(Handle handle, String tableName) {
    handle.execute(
        "CREATE TABLE "
            + tableName
            + " (fromId VARCHAR(36) NOT NULL, toId VARCHAR(36) NOT NULL, "
            + "fromEntity VARCHAR(256) NOT NULL, toEntity VARCHAR(256) NOT NULL, "
            + "relation SMALLINT NOT NULL, relationType VARCHAR(64) NOT NULL DEFAULT '', "
            + "PRIMARY KEY (fromId, toId, relation, relationType))");
  }

  private static void insertPreexistingRelationships(Handle handle, String tableName) {
    insertRelationship(
        handle, tableName, "group-a", "metric-a", METRIC_GROUP, METRIC, HAS_RELATION);
    insertRelationship(handle, tableName, "team-a", "metric-a", TEAM, METRIC, HAS_RELATION);
    insertRelationship(
        handle, tableName, "group-b", "metric-b", METRIC_GROUP, METRIC, HAS_RELATION);
    insertRelationship(handle, tableName, "group-a", "table-a", METRIC_GROUP, TABLE, HAS_RELATION);
  }

  private static void assertMembershipConstraint(
      Handle handle, MigrationFixture fixture, ConnectionType connectionType) {
    assertEquals(4, countRows(handle, fixture.relationshipTable()));
    assertMembershipIndex(
        handle, fixture.relationshipTable(), fixture.membershipIndex(), connectionType);
    assertGeneratedMembershipValues(handle, fixture.relationshipTable(), connectionType);
    assertThrows(
        UnableToExecuteStatementException.class,
        () ->
            insertRelationship(
                handle,
                fixture.relationshipTable(),
                "group-c",
                "metric-a",
                METRIC_GROUP,
                METRIC,
                HAS_RELATION));
    insertRelationship(
        handle, fixture.relationshipTable(), "team-b", "metric-a", TEAM, METRIC, HAS_RELATION);
    insertRelationship(
        handle, fixture.relationshipTable(), "group-c", "metric-a", METRIC_GROUP, METRIC, 0);
    assertEquals(6, countRows(handle, fixture.relationshipTable()));
  }

  private static void insertRelationship(
      Handle handle,
      String tableName,
      String fromId,
      String toId,
      String fromEntity,
      String toEntity,
      int relation) {
    handle
        .createUpdate(
            "INSERT INTO "
                + tableName
                + " (fromId, toId, fromEntity, toEntity, relation) "
                + "VALUES (:fromId, :toId, :fromEntity, :toEntity, :relation)")
        .bind("fromId", fromId)
        .bind("toId", toId)
        .bind("fromEntity", fromEntity)
        .bind("toEntity", toEntity)
        .bind("relation", relation)
        .execute();
  }

  private static void assertGeneratedMembershipValues(
      Handle handle, String relationshipTable, ConnectionType connectionType) {
    if (connectionType == ConnectionType.MYSQL) {
      int generatedValues =
          handle
              .createQuery(
                  "SELECT COUNT(*) FROM "
                      + relationshipTable
                      + " WHERE "
                      + MEMBERSHIP_COLUMN
                      + " IS NOT NULL")
              .mapTo(Integer.class)
              .one();
      assertEquals(2, generatedValues);
      assertTrue(isStoredGeneratedColumn(handle, relationshipTable, MEMBERSHIP_COLUMN));
    }
  }

  private static void assertMetricGroupTable(
      Handle handle, MigrationFixture fixture, ConnectionType connectionType) {
    assertTrue(tableExists(handle, fixture.groupTable(), connectionType));
    assertTrue(indexExists(handle, fixture.groupTable(), fixture.groupNameIndex(), connectionType));
    assertTrue(
        indexExists(handle, fixture.groupTable(), fixture.groupDeletedIndex(), connectionType));
    insertMetricGroup(handle, fixture.groupTable(), connectionType, METRIC_GROUP_FIXTURE);
    assertMetricGroupProjection(readMetricGroup(handle, fixture.groupTable()));
    assertMetricGroupFqnIsUnique(handle, fixture.groupTable(), connectionType);
  }

  private static void assertMetricGroupProjection(GroupProjection projection) {
    assertEquals(METRIC_GROUP_FIXTURE.id(), projection.id());
    assertEquals(METRIC_GROUP_FIXTURE.name(), projection.name());
    assertEquals(METRIC_GROUP_FIXTURE.updatedAt(), projection.updatedAt());
    assertEquals(METRIC_GROUP_FIXTURE.updatedBy(), projection.updatedBy());
    assertFalse(projection.deleted());
  }

  private static void assertMetricGroupFqnIsUnique(
      Handle handle, String groupTable, ConnectionType connectionType) {
    assertThrows(
        UnableToExecuteStatementException.class,
        () -> insertMetricGroup(handle, groupTable, connectionType, DUPLICATE_FQN_GROUP_FIXTURE));
    assertEquals(1, countRows(handle, groupTable));
  }

  private static void insertMetricGroup(
      Handle handle, String groupTable, ConnectionType connectionType, GroupFixture groupFixture) {
    String jsonValue = connectionType == ConnectionType.MYSQL ? ":json" : "CAST(:json AS JSONB)";
    handle
        .createUpdate(
            "INSERT INTO " + groupTable + " (json, fqnHash) VALUES (" + jsonValue + ", :hash)")
        .bind("json", metricGroupJson(groupFixture))
        .bind("hash", groupFixture.fqnHash())
        .execute();
  }

  private static String metricGroupJson(GroupFixture groupFixture) {
    return "{\"id\":\""
        + groupFixture.id()
        + "\",\"name\":\""
        + groupFixture.name()
        + "\",\"updatedAt\":"
        + groupFixture.updatedAt()
        + ",\"updatedBy\":\""
        + groupFixture.updatedBy()
        + "\",\"deleted\":false}";
  }

  private static GroupProjection readMetricGroup(Handle handle, String groupTable) {
    return handle
        .createQuery(
            "SELECT id, name, updatedAt, updatedBy, deleted FROM " + groupTable + " LIMIT 1")
        .map(
            (row, context) ->
                new GroupProjection(
                    row.getString("id"),
                    row.getString("name"),
                    row.getLong("updatedAt"),
                    row.getString("updatedBy"),
                    row.getBoolean("deleted")))
        .one();
  }

  private static void createMetricFixture(
      Handle handle, String metricTable, ConnectionType connectionType) {
    String jsonType = connectionType == ConnectionType.MYSQL ? "JSON" : "JSONB";
    handle.execute(
        "CREATE TABLE "
            + metricTable
            + " (id VARCHAR(36) PRIMARY KEY, json "
            + jsonType
            + " NOT NULL)");
  }

  private static void insertPreexistingMetrics(
      Handle handle, String metricTable, ConnectionType connectionType) {
    insertMetric(handle, metricTable, connectionType, "missing", "{\"name\":\"missing\"}");
    insertMetric(
        handle,
        metricTable,
        connectionType,
        "jsonNull",
        "{\"name\":\"jsonNull\",\"entityStatus\":null}");
    insertMetric(
        handle,
        metricTable,
        connectionType,
        "unprocessed",
        "{\"name\":\"unprocessed\",\"entityStatus\":\"Unprocessed\"}");
    insertMetric(
        handle,
        metricTable,
        connectionType,
        "approved",
        "{\"name\":\"approved\",\"entityStatus\":\"Approved\"}");
    insertMetric(
        handle,
        metricTable,
        connectionType,
        "inReview",
        "{\"name\":\"inReview\",\"entityStatus\":\"In Review\"}");
    insertMetric(
        handle,
        metricTable,
        connectionType,
        "rejected",
        "{\"name\":\"rejected\",\"entityStatus\":\"Rejected\"}");
  }

  private static void insertMetric(
      Handle handle, String metricTable, ConnectionType connectionType, String id, String json) {
    String jsonValue = connectionType == ConnectionType.MYSQL ? ":json" : "CAST(:json AS JSONB)";
    handle
        .createUpdate("INSERT INTO " + metricTable + " (id, json) VALUES (:id, " + jsonValue + ")")
        .bind("id", id)
        .bind("json", json)
        .execute();
  }

  private static void assertMetricStatuses(
      Handle handle, String metricTable, ConnectionType connectionType) {
    Map<String, MetricProjection> metrics =
        handle
            .createQuery(metricProjectionQuery(metricTable, connectionType))
            .map(
                (row, context) ->
                    new MetricProjection(
                        row.getString("id"), row.getString("status"), row.getString("name")))
            .list()
            .stream()
            .collect(Collectors.toMap(MetricProjection::id, projection -> projection));
    assertEquals(6, metrics.size());
    assertEquals("Approved", metrics.get("missing").status());
    assertEquals("Approved", metrics.get("jsonNull").status());
    assertEquals("Approved", metrics.get("unprocessed").status());
    assertEquals("Approved", metrics.get("approved").status());
    assertEquals("In Review", metrics.get("inReview").status());
    assertEquals("Rejected", metrics.get("rejected").status());
    metrics.forEach((id, projection) -> assertEquals(id, projection.name()));
  }

  private static String metricProjectionQuery(String metricTable, ConnectionType connectionType) {
    return connectionType == ConnectionType.MYSQL
        ? "SELECT id, JSON_UNQUOTE(JSON_EXTRACT(json, '$.entityStatus')) AS status, "
            + "JSON_UNQUOTE(JSON_EXTRACT(json, '$.name')) AS name FROM "
            + metricTable
        : "SELECT id, json->>'entityStatus' AS status, json->>'name' AS name FROM " + metricTable;
  }

  private static void assertMembershipIndex(
      Handle handle, String tableName, String indexName, ConnectionType connectionType) {
    assertTrue(indexExists(handle, tableName, indexName, connectionType));
    assertTrue(indexIsUnique(handle, tableName, indexName, connectionType));
    if (connectionType == ConnectionType.MYSQL) {
      assertEquals(List.of(MEMBERSHIP_COLUMN), indexColumns(handle, tableName, indexName));
      assertTrue(isStoredGeneratedColumn(handle, tableName, MEMBERSHIP_COLUMN));
    } else {
      assertPostgresPartialMembershipIndex(indexDefinition(handle, tableName, indexName));
    }
  }

  private static void assertPostgresPartialMembershipIndex(String definition) {
    assertNotNull(definition);
    String normalized = definition.toLowerCase(Locale.ROOT);
    assertTrue(normalized.contains("create unique index"));
    assertTrue(normalized.contains("(toid)"));
    assertTrue(normalized.contains("fromentity"));
    assertTrue(normalized.contains("'metricgroup'"));
    assertTrue(normalized.contains("toentity"));
    assertTrue(normalized.contains("'metric'"));
    assertTrue(normalized.contains("relation = 10"));
  }

  static List<String> metricSchemaStatements(MigrationScripts scripts) {
    return scripts.schemaStatements().stream()
        .filter(MetricMigrationTestSupport::isMetricSchemaStatement)
        .toList();
  }

  private static boolean isMetricSchemaStatement(String statement) {
    return statement.contains(METRIC_GROUP_TABLE)
        || statement.contains(MEMBERSHIP_COLUMN)
        || statement.contains(MEMBERSHIP_INDEX)
        || statement.contains(MYSQL_MEMBERSHIP_COLUMN_DDL_VARIABLE)
        || statement.contains(MYSQL_MEMBERSHIP_COLUMN_STATEMENT)
        || statement.contains(MYSQL_MEMBERSHIP_INDEX_DDL_VARIABLE)
        || statement.contains(MYSQL_MEMBERSHIP_INDEX_STATEMENT);
  }

  static List<String> metricPostStatements(MigrationScripts scripts) {
    return scripts.postStatements().stream()
        .filter(statement -> statement.contains("UPDATE " + METRIC_TABLE))
        .toList();
  }

  private static String fixtureStatement(String statement, MigrationFixture fixture) {
    return statement
        .replace(METRIC_GROUP_NAME_INDEX, fixture.groupNameIndex())
        .replace(METRIC_GROUP_DELETED_INDEX, fixture.groupDeletedIndex())
        .replace(MEMBERSHIP_INDEX, fixture.membershipIndex())
        .replace(METRIC_GROUP_TABLE, fixture.groupTable())
        .replace(RELATIONSHIP_TABLE, fixture.relationshipTable());
  }

  private static boolean tableExists(
      Handle handle, String tableName, ConnectionType connectionType) {
    String query =
        connectionType == ConnectionType.MYSQL
            ? "SELECT COUNT(*) FROM information_schema.tables "
                + "WHERE table_schema = DATABASE() AND table_name = :tableName"
            : "SELECT COUNT(*) FROM information_schema.tables "
                + "WHERE table_schema = current_schema() AND table_name = :tableName";
    return metadataCount(handle, query, tableName, null) == 1;
  }

  private static boolean indexExists(
      Handle handle, String tableName, String indexName, ConnectionType connectionType) {
    String query =
        connectionType == ConnectionType.MYSQL
            ? "SELECT COUNT(DISTINCT index_name) FROM information_schema.statistics "
                + "WHERE table_schema = DATABASE() AND table_name = :tableName "
                + "AND index_name = :indexName"
            : "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = current_schema() "
                + "AND tablename = :tableName AND indexname = :indexName";
    return metadataCount(handle, query, tableName, indexName) == 1;
  }

  private static boolean indexIsUnique(
      Handle handle, String tableName, String indexName, ConnectionType connectionType) {
    boolean result;
    if (connectionType == ConnectionType.MYSQL) {
      String query =
          "SELECT COUNT(DISTINCT index_name) FROM information_schema.statistics "
              + "WHERE table_schema = DATABASE() AND table_name = :tableName "
              + "AND index_name = :indexName AND non_unique = 0";
      result = metadataCount(handle, query, tableName, indexName) == 1;
    } else {
      String definition = indexDefinition(handle, tableName, indexName);
      result = definition != null && definition.toUpperCase(Locale.ROOT).contains("UNIQUE INDEX");
    }
    return result;
  }

  private static List<String> indexColumns(Handle handle, String tableName, String indexName) {
    return handle
        .createQuery(
            "SELECT column_name FROM information_schema.statistics "
                + "WHERE table_schema = DATABASE() AND table_name = :tableName "
                + "AND index_name = :indexName ORDER BY seq_in_index")
        .bind("tableName", tableName)
        .bind("indexName", indexName)
        .mapTo(String.class)
        .list();
  }

  private static boolean isStoredGeneratedColumn(
      Handle handle, String tableName, String columnName) {
    String extra =
        handle
            .createQuery(
                "SELECT extra FROM information_schema.columns "
                    + "WHERE table_schema = DATABASE() AND table_name = :tableName "
                    + "AND column_name = :columnName")
            .bind("tableName", tableName)
            .bind("columnName", columnName)
            .mapTo(String.class)
            .one();
    return extra.toUpperCase(Locale.ROOT).contains("STORED GENERATED");
  }

  private static String indexDefinition(Handle handle, String tableName, String indexName) {
    return handle
        .createQuery(
            "SELECT indexdef FROM pg_indexes WHERE schemaname = current_schema() "
                + "AND tablename = :tableName AND indexname = :indexName")
        .bind("tableName", tableName)
        .bind("indexName", indexName)
        .mapTo(String.class)
        .findOne()
        .orElse(null);
  }

  private static int metadataCount(
      Handle handle, String query, String tableName, String indexName) {
    var queryHandle = handle.createQuery(query).bind("tableName", tableName);
    if (indexName != null) {
      queryHandle.bind("indexName", indexName);
    }
    return queryHandle.mapTo(Integer.class).one();
  }

  private static int countRows(Handle handle, String tableName) {
    return handle.createQuery("SELECT COUNT(*) FROM " + tableName).mapTo(Integer.class).one();
  }

  private static void dropFixture(Jdbi jdbi, MigrationFixture fixture) {
    jdbi.useHandle(
        handle -> {
          handle.execute("DROP TABLE IF EXISTS " + fixture.metricTable());
          handle.execute("DROP TABLE IF EXISTS " + fixture.groupTable());
          handle.execute("DROP TABLE IF EXISTS " + fixture.relationshipTable());
        });
  }

  private record MigrationFixture(
      String groupTable,
      String relationshipTable,
      String metricTable,
      String groupNameIndex,
      String groupDeletedIndex,
      String membershipIndex) {
    private static MigrationFixture create() {
      String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
      return new MigrationFixture(
          "it_metric_group_" + suffix,
          "it_metric_relationship_" + suffix,
          "it_metric_status_" + suffix,
          "it_mg_name_" + suffix,
          "it_mg_deleted_" + suffix,
          "it_mg_member_" + suffix);
    }
  }

  private record MetricProjection(String id, String status, String name) {}

  private record GroupFixture(
      String id, String name, String fqnHash, long updatedAt, String updatedBy) {}

  private record GroupProjection(
      String id, String name, long updatedAt, String updatedBy, boolean deleted) {}

  record IndexExpectation(String table, String name) {}
}
