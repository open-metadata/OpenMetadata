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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.metricSchemaStatements;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.openmetadata.it.tests.MetricMigrationSqlFixture.MigrationScripts;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

final class MergedMetricMigrationTestSupport {
  private static final String CREATE_TABLE_IF_NOT_EXISTS = "CREATE TABLE IF NOT EXISTS";
  private static final String METRIC_GROUP = "metricGroup";
  private static final String METRIC = "metric";
  private static final int HAS_RELATION = 10;
  private static final String INCIDENT_STATE_ID = "00000000-0000-0000-0000-000000000101";
  private static final String FIRST_RECORD_ID = "00000000-0000-0000-0000-000000000201";
  private static final String LATEST_RECORD_ID = "00000000-0000-0000-0000-000000000203";
  private static final String ENTITY_FQN_HASH = "merged-migration-test-fqn-hash";
  private static final String INITIAL_ASSIGNEE = "initial-reviewer";
  private static final String ASSIGNEE = "migration-reviewer";
  private static final long CREATED_AT = 100L;
  private static final long UPDATED_AT = 200L;
  private static final String JSON_SCHEMA = "testCaseResolutionStatus";

  private MergedMetricMigrationTestSupport() {}

  static void runMergedUpgradeScenario(
      Jdbi jdbi, MigrationScripts scripts, ConnectionType connectionType) {
    MergedMetricMigrationFixture fixture = MergedMetricMigrationFixture.create();
    try {
      jdbi.useHandle(handle -> runScenario(handle, fixture, scripts, connectionType));
    } finally {
      dropFixture(jdbi, fixture);
    }
  }

  private static void runScenario(
      Handle handle,
      MergedMetricMigrationFixture fixture,
      MigrationScripts scripts,
      ConnectionType connectionType) {
    createPriorShapeTables(handle, fixture, connectionType);
    seedPriorRows(handle, fixture, connectionType);
    executeMergedMigration(handle, fixture, scripts, connectionType);
    assertIncidentOutcome(handle, fixture, connectionType);
    assertMetricOutcome(handle, fixture, connectionType);
  }

  private static void createPriorShapeTables(
      Handle handle, MergedMetricMigrationFixture fixture, ConnectionType connectionType) {
    createResolutionStatusTable(handle, fixture, connectionType);
    handle.execute("CREATE TABLE " + fixture.testCaseTable() + " (id VARCHAR(36) NOT NULL)");
    createRelationshipTable(handle, fixture, connectionType);
    createMetricTable(handle, fixture, connectionType);
  }

  private static void createResolutionStatusTable(
      Handle handle, MergedMetricMigrationFixture fixture, ConnectionType connectionType) {
    String jsonType = connectionType == ConnectionType.MYSQL ? "JSON" : "JSONB";
    String hashType =
        connectionType == ConnectionType.MYSQL
            ? "VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin"
            : "VARCHAR(768)";
    handle.execute(
        "CREATE TABLE "
            + fixture.resolutionStatusTable()
            + " (id VARCHAR(36) NOT NULL, stateId VARCHAR(36) NOT NULL, "
            + "assignee VARCHAR(256), timestamp BIGINT NOT NULL, "
            + "testCaseResolutionStatusType VARCHAR(36) NOT NULL, jsonSchema VARCHAR(256) NOT NULL, "
            + "json "
            + jsonType
            + " NOT NULL, entityFQNHash "
            + hashType
            + ")");
  }

  private static void createRelationshipTable(
      Handle handle, MergedMetricMigrationFixture fixture, ConnectionType connectionType) {
    String jsonType = connectionType == ConnectionType.MYSQL ? "JSON" : "JSONB";
    handle.execute(
        "CREATE TABLE "
            + fixture.relationshipTable()
            + " (fromId VARCHAR(36) NOT NULL, toId VARCHAR(36) NOT NULL, "
            + "fromEntity VARCHAR(256) NOT NULL, toEntity VARCHAR(256) NOT NULL, "
            + "relation SMALLINT NOT NULL, relationType VARCHAR(64) NOT NULL DEFAULT '', json "
            + jsonType
            + ", "
            + "PRIMARY KEY (fromId, toId, relation, relationType))");
  }

  private static void createMetricTable(
      Handle handle, MergedMetricMigrationFixture fixture, ConnectionType connectionType) {
    String jsonType = connectionType == ConnectionType.MYSQL ? "JSON" : "JSONB";
    handle.execute(
        "CREATE TABLE "
            + fixture.metricTable()
            + " (id VARCHAR(36) PRIMARY KEY, json "
            + jsonType
            + " NOT NULL)");
  }

  private static void seedPriorRows(
      Handle handle, MergedMetricMigrationFixture fixture, ConnectionType connectionType) {
    seedIncidentRows(handle, fixture, connectionType);
    seedRelationshipRows(handle, fixture);
    seedMetricRows(handle, fixture, connectionType);
  }

  private static void seedIncidentRows(
      Handle handle, MergedMetricMigrationFixture fixture, ConnectionType connectionType) {
    insertIncidentRow(handle, fixture, connectionType, firstIncidentRecord());
    insertIncidentRow(handle, fixture, connectionType, latestIncidentRecord());
  }

  private static IncidentRecord firstIncidentRecord() {
    return new IncidentRecord(
        FIRST_RECORD_ID,
        INCIDENT_STATE_ID,
        INITIAL_ASSIGNEE,
        CREATED_AT,
        TestCaseResolutionStatusTypes.New.value(),
        Severity.Severity3.value(),
        ENTITY_FQN_HASH);
  }

  private static IncidentRecord latestIncidentRecord() {
    return new IncidentRecord(
        LATEST_RECORD_ID,
        INCIDENT_STATE_ID,
        ASSIGNEE,
        UPDATED_AT,
        TestCaseResolutionStatusTypes.Assigned.value(),
        Severity.Severity1.value(),
        ENTITY_FQN_HASH);
  }

  private static void insertIncidentRow(
      Handle handle,
      MergedMetricMigrationFixture fixture,
      ConnectionType connectionType,
      IncidentRecord record) {
    String jsonValue = connectionType == ConnectionType.MYSQL ? ":json" : "CAST(:json AS JSONB)";
    handle
        .createUpdate(
            "INSERT INTO "
                + fixture.resolutionStatusTable()
                + " (id, stateId, assignee, timestamp, testCaseResolutionStatusType, "
                + "jsonSchema, json, entityFQNHash) VALUES "
                + "(:id, :stateId, :assignee, :timestamp, :status, :jsonSchema, "
                + jsonValue
                + ", :entityFQNHash)")
        .bind("id", record.id())
        .bind("stateId", record.stateId())
        .bind("assignee", record.assignee())
        .bind("timestamp", record.timestamp())
        .bind("status", record.status())
        .bind("jsonSchema", JSON_SCHEMA)
        .bind("json", "{\"severity\":\"" + record.severity() + "\"}")
        .bind("entityFQNHash", record.entityFQNHash())
        .execute();
  }

  private static void seedRelationshipRows(Handle handle, MergedMetricMigrationFixture fixture) {
    insertRelationship(handle, fixture, "group-a", "metric-a");
    insertRelationship(handle, fixture, "group-b", "metric-b");
  }

  private static void insertRelationship(
      Handle handle, MergedMetricMigrationFixture fixture, String groupId, String metricId) {
    handle
        .createUpdate(
            "INSERT INTO "
                + fixture.relationshipTable()
                + " (fromId, toId, fromEntity, toEntity, relation) "
                + "VALUES (:groupId, :metricId, :fromEntity, :toEntity, :relation)")
        .bind("groupId", groupId)
        .bind("metricId", metricId)
        .bind("fromEntity", METRIC_GROUP)
        .bind("toEntity", METRIC)
        .bind("relation", HAS_RELATION)
        .execute();
  }

  private static void seedMetricRows(
      Handle handle, MergedMetricMigrationFixture fixture, ConnectionType connectionType) {
    insertMetric(handle, fixture, connectionType, "missing", "{\"name\":\"missing\"}");
    insertMetric(
        handle,
        fixture,
        connectionType,
        "unprocessed",
        "{\"name\":\"unprocessed\",\"entityStatus\":\"Unprocessed\"}");
    insertMetric(
        handle,
        fixture,
        connectionType,
        "inReview",
        "{\"name\":\"inReview\",\"entityStatus\":\"In Review\"}");
  }

  private static void insertMetric(
      Handle handle,
      MergedMetricMigrationFixture fixture,
      ConnectionType connectionType,
      String id,
      String json) {
    String jsonValue = connectionType == ConnectionType.MYSQL ? ":json" : "CAST(:json AS JSONB)";
    handle
        .createUpdate(
            "INSERT INTO " + fixture.metricTable() + " (id, json) VALUES (:id, " + jsonValue + ")")
        .bind("id", id)
        .bind("json", json)
        .execute();
  }

  private static void executeMergedMigration(
      Handle handle,
      MergedMetricMigrationFixture fixture,
      MigrationScripts scripts,
      ConnectionType connectionType) {
    executeStatements(handle, rewriteStatements(scripts.schemaStatements(), fixture));
    replaySupportedSchema(handle, fixture, scripts, connectionType);
    List<String> postStatements = rewriteStatements(scripts.postStatements(), fixture);
    executeStatements(handle, postStatements);
    executeStatements(handle, postStatements);
  }

  private static void replaySupportedSchema(
      Handle handle,
      MergedMetricMigrationFixture fixture,
      MigrationScripts scripts,
      ConnectionType connectionType) {
    List<String> replayStatements = scripts.schemaStatements();
    if (connectionType == ConnectionType.MYSQL) {
      Set<String> metricStatements = Set.copyOf(metricSchemaStatements(scripts));
      replayStatements =
          replayStatements.stream()
              .filter(
                  statement ->
                      statement.contains(CREATE_TABLE_IF_NOT_EXISTS)
                          || metricStatements.contains(statement))
              .toList();
    }
    executeStatements(handle, rewriteStatements(replayStatements, fixture));
  }

  private static List<String> rewriteStatements(
      List<String> statements, MergedMetricMigrationFixture fixture) {
    return statements.stream().map(fixture::rewrite).toList();
  }

  private static void executeStatements(Handle handle, List<String> statements) {
    statements.forEach(handle::execute);
  }

  private static void assertIncidentOutcome(
      Handle handle, MergedMetricMigrationFixture fixture, ConnectionType connectionType) {
    assertTrue(tableExists(handle, fixture.incidentTable(), connectionType));
    assertIncidentIndexes(handle, fixture, connectionType);
    IncidentProjection projection = readIncident(handle, fixture);
    assertEquals(INCIDENT_STATE_ID, projection.stateId());
    assertEquals(ENTITY_FQN_HASH, projection.entityFqnHash());
    assertEquals(TestCaseResolutionStatusTypes.Assigned.value(), projection.status());
    assertEquals(ASSIGNEE, projection.assignee());
    assertEquals(Severity.Severity1.value(), projection.severity());
    assertEquals(CREATED_AT, projection.createdAt());
    assertEquals(UPDATED_AT, projection.updatedAt());
    assertEquals(LATEST_RECORD_ID, projection.latestRecordId());
  }

  private static void assertIncidentIndexes(
      Handle handle, MergedMetricMigrationFixture fixture, ConnectionType connectionType) {
    for (IndexTarget index : fixture.incidentIndexes()) {
      assertTrue(
          indexExists(handle, index.table(), index.index(), connectionType),
          index.table() + "." + index.index());
    }
  }

  private static IncidentProjection readIncident(
      Handle handle, MergedMetricMigrationFixture fixture) {
    List<IncidentProjection> incidents =
        handle
            .createQuery(
                "SELECT stateId, entityFQNHash, testCaseResolutionStatusType, assignee, severity, "
                    + "createdAt, updatedAt, latestRecordId FROM "
                    + fixture.incidentTable())
            .map(
                (row, context) ->
                    new IncidentProjection(
                        row.getString("stateId"),
                        row.getString("entityFQNHash"),
                        row.getString("testCaseResolutionStatusType"),
                        row.getString("assignee"),
                        row.getString("severity"),
                        row.getLong("createdAt"),
                        row.getLong("updatedAt"),
                        row.getString("latestRecordId")))
            .list();
    assertEquals(1, incidents.size());
    return incidents.getFirst();
  }

  private static void assertMetricOutcome(
      Handle handle, MergedMetricMigrationFixture fixture, ConnectionType connectionType) {
    assertTrue(tableExists(handle, fixture.metricGroupTable(), connectionType));
    assertTrue(
        indexExists(handle, fixture.metricGroupTable(), fixture.groupNameIndex(), connectionType));
    assertTrue(
        indexExists(
            handle, fixture.metricGroupTable(), fixture.groupDeletedIndex(), connectionType));
    assertTrue(
        indexExists(
            handle, fixture.relationshipTable(), fixture.membershipIndex(), connectionType));
    assertSingleMembership(handle, fixture);
    assertMetricStatuses(handle, fixture, connectionType);
    assertMetricGroupPersistence(handle, fixture, connectionType);
  }

  private static void assertSingleMembership(Handle handle, MergedMetricMigrationFixture fixture) {
    assertThrows(
        UnableToExecuteStatementException.class,
        () -> insertRelationship(handle, fixture, "group-c", "metric-a"));
    assertEquals(
        2,
        handle
            .createQuery("SELECT COUNT(*) FROM " + fixture.relationshipTable())
            .mapTo(Integer.class)
            .one());
  }

  private static void assertMetricStatuses(
      Handle handle, MergedMetricMigrationFixture fixture, ConnectionType connectionType) {
    String statusExpression =
        connectionType == ConnectionType.MYSQL
            ? "JSON_UNQUOTE(JSON_EXTRACT(json, '$.entityStatus'))"
            : "json->>'entityStatus'";
    Map<String, String> statuses =
        handle
            .createQuery(
                "SELECT id, " + statusExpression + " AS status FROM " + fixture.metricTable())
            .map((row, context) -> Map.entry(row.getString("id"), row.getString("status")))
            .list()
            .stream()
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    assertEquals("Approved", statuses.get("missing"));
    assertEquals("Approved", statuses.get("unprocessed"));
    assertEquals("In Review", statuses.get("inReview"));
  }

  private static void assertMetricGroupPersistence(
      Handle handle, MergedMetricMigrationFixture fixture, ConnectionType connectionType) {
    insertMetricGroup(handle, fixture, connectionType, "group-id");
    assertThrows(
        UnableToExecuteStatementException.class,
        () -> insertMetricGroup(handle, fixture, connectionType, "duplicate-group-id"));
    assertEquals(
        1,
        handle
            .createQuery("SELECT COUNT(*) FROM " + fixture.metricGroupTable())
            .mapTo(Integer.class)
            .one());
  }

  private static void insertMetricGroup(
      Handle handle,
      MergedMetricMigrationFixture fixture,
      ConnectionType connectionType,
      String groupId) {
    String jsonValue = connectionType == ConnectionType.MYSQL ? ":json" : "CAST(:json AS JSONB)";
    handle
        .createUpdate(
            "INSERT INTO "
                + fixture.metricGroupTable()
                + " (json, fqnHash) VALUES ("
                + jsonValue
                + ", :fqnHash)")
        .bind("json", metricGroupJson(groupId))
        .bind("fqnHash", "merged-group-fqn-hash")
        .execute();
  }

  private static String metricGroupJson(String groupId) {
    return "{\"id\":\""
        + groupId
        + "\",\"name\":\"merged-group\",\"updatedAt\":123,"
        + "\"updatedBy\":\"migration-test\",\"deleted\":false}";
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

  private static int metadataCount(
      Handle handle, String query, String tableName, String indexName) {
    var queryHandle = handle.createQuery(query).bind("tableName", tableName);
    if (indexName != null) {
      queryHandle.bind("indexName", indexName);
    }
    return queryHandle.mapTo(Integer.class).one();
  }

  private static void dropFixture(Jdbi jdbi, MergedMetricMigrationFixture fixture) {
    jdbi.useHandle(
        handle -> {
          handle.execute("DROP TABLE IF EXISTS " + fixture.metricGroupTable());
          handle.execute("DROP TABLE IF EXISTS " + fixture.incidentTable());
          handle.execute("DROP TABLE IF EXISTS " + fixture.metricTable());
          handle.execute("DROP TABLE IF EXISTS " + fixture.relationshipTable());
          handle.execute("DROP TABLE IF EXISTS " + fixture.testCaseTable());
          handle.execute("DROP TABLE IF EXISTS " + fixture.resolutionStatusTable());
        });
  }

  private record IncidentRecord(
      String id,
      String stateId,
      String assignee,
      long timestamp,
      String status,
      String severity,
      String entityFQNHash) {}

  private record IncidentProjection(
      String stateId,
      String entityFqnHash,
      String status,
      String assignee,
      String severity,
      long createdAt,
      long updatedAt,
      String latestRecordId) {}
}
