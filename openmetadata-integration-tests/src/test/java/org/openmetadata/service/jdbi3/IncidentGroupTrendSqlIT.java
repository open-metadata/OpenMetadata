/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.tests.migration.ScratchDatabasePerTest;
import org.openmetadata.it.util.ScratchDatabase;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v211.IncidentOpenIntervalMigration;
import org.openmetadata.service.util.FullyQualifiedName;

@ExtendWith(ScratchDatabasePerTest.class)
@Execution(ExecutionMode.SAME_THREAD)
class IncidentGroupTrendSqlIT {
  private Jdbi fixture() {
    Jdbi jdbi = ScratchDatabasePerTest.jdbi();
    createFixture(jdbi, dialect());
    return jdbi;
  }

  private static String dialect() {
    return ScratchDatabase.dialect() == ConnectionType.MYSQL ? "mysql" : "postgres";
  }

  private static File migrationFile(String dialect) {
    Path current = Path.of(System.getProperty("basedir", ".")).toAbsolutePath();
    while (current != null && !Files.isDirectory(current.resolve("bootstrap/sql/migrations"))) {
      current = current.getParent();
    }
    if (current == null) {
      throw new IllegalStateException("Could not locate bootstrap/sql/migrations directory");
    }
    return current
        .resolve("bootstrap/sql/migrations/native/2.1.1/%s/schemaChanges.sql".formatted(dialect))
        .toFile();
  }

  private String intervalSchema(String dialect) {
    return MigrationFile.parseSqlUnits(
            migrationFile(dialect),
            "mysql".equals(dialect) ? ConnectionType.MYSQL : ConnectionType.POSTGRES)
        .getFirst()
        .statements()
        .getFirst();
  }

  private void createFixture(Jdbi jdbi, String dialect) {
    String schema = intervalSchema(dialect);
    jdbi.useHandle(
        handle -> {
          handle.execute(
              "CREATE TABLE test_case (fqnHash VARCHAR(36), incidentTableFqn VARCHAR(36), deleted BOOLEAN, id VARCHAR(36))");
          handle.execute(
              "CREATE TABLE test_case_incident (stateId VARCHAR(36) PRIMARY KEY, entityFQNHash VARCHAR(768), createdAt BIGINT, updatedAt BIGINT, latestRecordId VARCHAR(36), testCaseResolutionStatusType VARCHAR(36), assignee VARCHAR(256), severity VARCHAR(36))");
          handle.execute(
              "CREATE TABLE test_case_resolution_status_time_series (stateId VARCHAR(36), id VARCHAR(36), timestamp BIGINT, testCaseResolutionStatusType VARCHAR(36), entityFQNHash VARCHAR(768), assignee VARCHAR(256), json "
                  + ("mysql".equals(dialect) ? "JSON" : "JSONB")
                  + ")");
          handle.execute(
              "CREATE TABLE IF NOT EXISTS entity_relationship (fromId VARCHAR(36), toId VARCHAR(36), fromEntity VARCHAR(36), toEntity VARCHAR(36), relation INTEGER)");
          handle.execute(schema);
          handle.execute(schema);
          handle.execute(
              "CREATE INDEX incident_history_state_timestamp ON test_case_resolution_status_time_series (stateId, timestamp)");
          handle.execute(
              "INSERT INTO test_case (fqnHash,incidentTableFqn,deleted) VALUES ('test', 'table', FALSE), ('other', 'other_table', FALSE), ('deleted', 'table', TRUE)");
          handle.execute(
              "INSERT INTO test_case_incident (stateId, entityFQNHash, createdAt) VALUES ('a','test',50),('b','test',110),('c','test',120),('d','test',700),('e','other',50),('f','deleted',50),"
                  + "('g','test',10),('h','test',10),('j','test',10),('k','test',10)");
          handle.execute(
              "INSERT INTO test_case_resolution_status_time_series (stateId,id,timestamp,testCaseResolutionStatusType) VALUES "
                  + "('a','1',50,'New'),('a','2',110,'Ack'),('a','3',120,'Assigned'),"
                  + "('b','4',110,'New'),('c','5',120,'New'),('d','6',700,'New'),"
                  + "('a','7',800,'Resolved'),('a','8',850,'Resolved'),"
                  + "('b','9',800,'Assigned'),('b','a',800,'Resolved'),"
                  + "('e','b',50,'New'),('f','c',50,'New'),"
                  + "('g','g1',10,'New'),('g','g2',90,'Resolved'),"
                  + "('h','h1',10,'New'),('h','h2',90,'Resolved'),('h','h3',300,'Assigned'),"
                  + "('j','j1',10,'New'),('j','j2',100,'Resolved'),"
                  + "('k','k2',90,'Assigned'),('k','k1',90,'Resolved'),('k','k3',200,'Resolved')");
        });
    jdbi.useHandle(IncidentOpenIntervalMigration::backfill);
    jdbi.useHandle(IncidentOpenIntervalMigration::backfill);
    assertEquals(11, intervalCount(jdbi, null));
  }

  @Test
  void openCountsIncludeResolutionsAndBaseline() {
    Jdbi jdbi = fixture();
    var dao = jdbi.onDemand(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class);
    var window = new IncidentGroupTrend(100, 900);
    var rows =
        dao.listIncidentGroupTrendCounts(
            "tc.incidentTableFqn",
            "",
            "WHERE 1=1",
            IncidentGroupTrend.samplesSql(),
            List.of("table"),
            window.bindings());
    // Open periods [start,end): a [50,800), b [110,800), c [120,infinity), d [700,infinity),
    // g [10,90), h [10,90) + [300,infinity), j [10,100), k [90,200).
    // e belongs to another table and f to a deleted test; equal-time records use the largest id.
    assertEquals(List.of(2, 3, 4, 4, 4, 4, 5, 3, 3), IncidentGroupTrend.counts(rows));
    assertEquals(
        Set.of("table"),
        rows.stream()
            .map(TimeSeriesDAOs.IncidentGroupTrendCount::groupKey)
            .collect(Collectors.toSet()));
  }

  @Test
  void duplicateMembershipDoesNotDoubleCount() {
    Jdbi jdbi = fixture();
    var dao = jdbi.onDemand(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class);
    var window = new IncidentGroupTrend(100, 900);
    var rows =
        dao.listIncidentGroupTrendCounts(
            "tc.incidentTableFqn",
            "",
            "WHERE 1=1",
            IncidentGroupTrend.samplesSql(),
            List.of("table"),
            window.bindings());
    assertEquals(
        IncidentGroupTrend.counts(rows),
        IncidentGroupTrend.counts(
            dao.listIncidentGroupTrendCounts(
                "tc.incidentTableFqn",
                "CROSS JOIN (SELECT 1 AS value UNION ALL SELECT 2) duplicate_membership",
                "WHERE 1=1",
                IncidentGroupTrend.samplesSql(),
                List.of("table"),
                window.bindings())));
  }

  @Test
  void repeatedOpenStatusesKeepOnePeriod() {
    Jdbi jdbi = fixture();
    var dao = jdbi.onDemand(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class);
    var window = new IncidentGroupTrend(100, 900);
    // A return to New on an open incident and repeated assignments do not open another incident.
    jdbi.useHandle(
        handle ->
            handle.execute(
                "INSERT INTO test_case_resolution_status_time_series (stateId,id,timestamp,testCaseResolutionStatusType) VALUES ('c','d',850,'New'),('c','e',870,'Assigned')"));
    dao.recordOpenInterval("c", 870, true);
    assertEquals(
        List.of(2, 3, 4, 4, 4, 4, 5, 3, 3),
        IncidentGroupTrend.counts(
            dao.listIncidentGroupTrendCounts(
                "tc.incidentTableFqn",
                "",
                "WHERE 1=1",
                IncidentGroupTrend.samplesSql(),
                List.of("table"),
                window.bindings())));
  }

  @Test
  void auditRetentionPreservesProjectedHistory() {
    Jdbi jdbi = fixture();
    var dao = jdbi.onDemand(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class);
    var window = new IncidentGroupTrend(100, 900);
    // Retention of audit records must not erase already projected open periods.
    jdbi.useHandle(handle -> handle.execute("DELETE FROM test_case_resolution_status_time_series"));
    assertEquals(
        List.of(2, 3, 4, 4, 4, 4, 5, 3, 3),
        IncidentGroupTrend.counts(
            dao.listIncidentGroupTrendCounts(
                "tc.incidentTableFqn",
                "",
                "WHERE 1=1",
                IncidentGroupTrend.samplesSql(),
                List.of("table"),
                window.bindings())));
  }

  @Test
  void missingGroupHasZeroCounts() {
    Jdbi jdbi = fixture();
    var dao = jdbi.onDemand(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class);
    var window = new IncidentGroupTrend(100, 900);
    var empty =
        dao.listIncidentGroupTrendCounts(
            "tc.incidentTableFqn",
            "",
            "WHERE 1=1",
            IncidentGroupTrend.samplesSql(),
            List.of("missing"),
            window.bindings());
    assertEquals(List.of(0, 0, 0, 0, 0, 0, 0, 0, 0), IncidentGroupTrend.counts(empty));
  }

  @Test
  void backfillSpansBatchesAndIsIdempotent() {
    verifyMigrationBatches(fixture());
  }

  @Test
  void liveWritesMaintainPeriods() {
    verifyWritesAndDeletion(fixture());
  }

  @Test
  void rollbacksDoNotLeaveProjections() {
    verifyRollback(fixture());
  }

  @Test
  void recordDeletionRebuildsHistory() {
    Jdbi jdbi = fixture();
    verifyRecordDeletion(
        jdbi, jdbi.onDemand(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class));
  }

  @Test
  void reorderedWritesUseMonotonicTimestamps() {
    verifyReorderedWrites(fixture());
  }

  @Test
  void olderMigrationsCanWriteBeforeIntervalSchema() {
    verifyWritesBeforeIntervalMigration(fixture(), intervalSchema(dialect()));
  }

  @Test
  void capturedDeletionPreservesRecreatedTest() {
    verifyCapturedDeletion(fixture());
  }

  @Test
  void cleanupStatementCountIsIndependentOfHistoryLength() {
    Jdbi jdbi = fixture();
    assertEquals(bulkDeletionStatementCount(jdbi, 2), bulkDeletionStatementCount(jdbi, 50));
  }

  @Test
  void movedIncidentKeepsStableOwner() {
    verifyMovedOwner(fixture());
  }

  @Test
  void cleanupCommitsCompletedBatchesBeforeALaterFailure() {
    Jdbi jdbi = fixture();
    List<String> incidentIds = IntStream.range(0, 501).mapToObj(i -> "cleanup-" + i).toList();
    jdbi.useHandle(
        handle -> {
          var incidents =
              handle.prepareBatch(
                  "INSERT INTO test_case_incident (stateId, entityFQNHash, createdAt) VALUES (:id, 'cleanup', 10)");
          var history =
              handle.prepareBatch(
                  "INSERT INTO test_case_resolution_status_time_series (stateId, id, timestamp) VALUES (:id, :record, 10)");
          for (String id : incidentIds) {
            incidents.bind("id", id).add();
            history.bind("id", id).bind("record", UUID.randomUUID().toString()).add();
          }
          incidents.execute();
          history.execute();
          handle.execute(
              "CREATE TABLE cleanup_guard (stateId VARCHAR(36), FOREIGN KEY (stateId) REFERENCES test_case_incident(stateId))");
          handle.execute("INSERT INTO cleanup_guard VALUES ('cleanup-500')");
        });
    Set<UUID> removed = new HashSet<>();
    try {
      assertThrows(
          RuntimeException.class,
          () ->
              TestCaseRepository.deleteIncidentHistory(
                  jdbi.onDemand(CollectionDAO.class), List.of(), incidentIds, removed::addAll));
      assertEquals(
          500, removed.size(), "completed batches publish their deleted records after commit");
      assertEquals(
          List.of("cleanup-500"),
          jdbi.withHandle(
              handle ->
                  handle
                      .createQuery(
                          "SELECT stateId FROM test_case_incident WHERE entityFQNHash = 'cleanup'")
                      .mapTo(String.class)
                      .list()));
      assertEquals(
          1,
          jdbi.onDemand(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class)
              .countTestCaseResolutionStatusesForStateId("cleanup-500"));
    } finally {
      jdbi.useHandle(handle -> handle.execute("DROP TABLE cleanup_guard"));
    }
    TestCaseRepository.deleteIncidentHistory(
        jdbi.onDemand(CollectionDAO.class), List.of(), incidentIds, removed::addAll);
    assertEquals(501, removed.size(), "retrying the captured scope is idempotent");
  }

  private void verifyMigrationBatches(Jdbi jdbi) {
    jdbi.useHandle(
        handle -> {
          var incidents =
              handle.prepareBatch(
                  "INSERT INTO test_case_incident (stateId, entityFQNHash, createdAt) VALUES (:id, 'batch', 10)");
          var statuses =
              handle.prepareBatch(
                  "INSERT INTO test_case_resolution_status_time_series (stateId, id, timestamp, testCaseResolutionStatusType) VALUES (:id, :id, 10, 'New')");
          for (int index = 0; index < 1001; index++) {
            String id = "batch-" + index;
            incidents.bind("id", id).add();
            statuses.bind("id", id).add();
          }
          incidents.execute();
          statuses.execute();
          IncidentOpenIntervalMigration.backfill(handle);
          IncidentOpenIntervalMigration.backfill(handle);
          assertEquals(1012, intervalCount(jdbi, null));
          handle.execute("DELETE FROM test_case_incident WHERE entityFQNHash = 'batch'");
          handle.execute(
              "DELETE FROM test_case_resolution_status_time_series WHERE stateId LIKE 'batch-%'");
        });
    assertEquals(11, intervalCount(jdbi, null));
  }

  private void verifyWritesBeforeIntervalMigration(Jdbi jdbi, String schema) {
    var dao = jdbi.onDemand(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class);
    jdbi.useHandle(
        handle -> {
          handle.execute("DROP TABLE test_case_incident_open_interval");
          handle.execute(
              "INSERT INTO test_case_resolution_status_time_series (stateId,id,timestamp,testCaseResolutionStatusType) VALUES ('migration','migration',10,'New')");
        });
    dao.upsertIncident("migration", "test", "New", null, null, 10, "migration", true);
    assertThrows(
        RuntimeException.class,
        () -> dao.upsertIncident("not-migrating", "test", "New", null, null, 10, "normal", false));
    jdbi.useHandle(
        handle -> {
          assertEquals(
              0,
              handle
                  .createQuery(
                      "SELECT COUNT(*) FROM test_case_incident WHERE stateId = 'not-migrating'")
                  .mapTo(Integer.class)
                  .one());
          handle.execute(schema);
          IncidentOpenIntervalMigration.backfill(handle);
        });
    assertEquals(10L, openedAt(jdbi, "migration"));
    dao.upsertIncident("migration", "test", "Resolved", null, null, 20, "close", true);
    assertFalse(dao.hasOpenInterval("migration"));
    jdbi.useHandle(
        handle -> {
          handle.execute("DELETE FROM test_case_incident WHERE stateId = 'migration'");
          handle.execute(
              "DELETE FROM test_case_resolution_status_time_series WHERE stateId = 'migration'");
        });
  }

  private void verifyReorderedWrites(Jdbi jdbi) {
    assertEquals(10L, persistStatus(jdbi, "ordered", "New", 10));
    assertEquals(20L, persistStatus(jdbi, "ordered", "Resolved", 20));
    // Both requests read the old incident before the resolving request obtained the write lock.
    assertEquals(21L, persistStatus(jdbi, "ordered", "Ack", 15));
    assertEquals(22L, persistStatus(jdbi, "ordered", "Resolved", 21));
    jdbi.useHandle(
        handle -> {
          List<String> periods =
              handle
                  .createQuery(
                      "SELECT openedAt, closedAt FROM test_case_incident_open_interval WHERE stateId = 'ordered' ORDER BY openedAt")
                  .map((rs, ctx) -> rs.getLong("openedAt") + ":" + rs.getLong("closedAt"))
                  .list();
          assertEquals(List.of("10:20", "21:22"), periods);
          assertEquals(
              List.of(10L, 20L, 21L, 22L),
              handle
                  .createQuery(
                      "SELECT timestamp FROM test_case_resolution_status_time_series WHERE stateId = 'ordered' ORDER BY timestamp")
                  .mapTo(Long.class)
                  .list());
          handle.execute("DELETE FROM test_case_incident WHERE stateId = 'ordered'");
          handle.execute(
              "DELETE FROM test_case_resolution_status_time_series WHERE stateId = 'ordered'");
        });
  }

  private long persistStatus(Jdbi jdbi, String stateId, String status, long timestamp) {
    return jdbi.inTransaction(
        handle -> {
          var dao = handle.attach(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class);
          String recordId = UUID.randomUUID().toString();
          long ordered =
              dao.nextIncidentTimestamp(stateId, "ordered-test", status, timestamp, recordId);
          handle.execute(
              "INSERT INTO test_case_resolution_status_time_series (stateId,id,timestamp,testCaseResolutionStatusType) VALUES (?,?,?,?)",
              stateId,
              recordId,
              ordered,
              status);
          dao.upsertIncident(stateId, "ordered-test", status, null, null, ordered, recordId, false);
          return ordered;
        });
  }

  private int intervalCount(Jdbi jdbi, String stateId) {
    return jdbi.withHandle(
        handle ->
            handle
                .createQuery(
                    "SELECT COUNT(*) FROM test_case_incident_open_interval"
                        + (stateId == null ? "" : " WHERE stateId = :stateId"))
                .bind("stateId", stateId)
                .configure(SqlStatements.class, config -> config.setUnusedBindingAllowed(true))
                .mapTo(Integer.class)
                .one());
  }

  private void verifyWritesAndDeletion(Jdbi jdbi) {
    var dao = jdbi.onDemand(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class);
    dao.upsertIncident("live", "live-test", "New", null, null, 10, "1", false);
    dao.upsertIncident("live", "live-test", "Ack", null, null, 20, "2", false);
    dao.upsertIncident("live", "live-test", "Assigned", null, null, 30, "3", false);
    assertEquals(1, intervalCount(jdbi, "live"));
    dao.upsertIncident("live", "live-test", "Resolved", null, null, 40, "4", false);
    dao.upsertIncident("live", "live-test", "Resolved", null, null, 50, "5", false);
    long closedAt =
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT closedAt FROM test_case_incident_open_interval WHERE stateId = 'live'")
                    .mapTo(Long.class)
                    .one());
    assertEquals(40L, closedAt);
    dao.upsertIncident("live", "live-test", "New", null, null, 60, "6", false);
    assertEquals(2, intervalCount(jdbi, "live"));
    dao.delete("live-test");
    assertEquals(0, intervalCount(jdbi, "live"));
  }

  private void verifyRollback(Jdbi jdbi) {
    assertThrows(
        IllegalStateException.class,
        () ->
            jdbi.useTransaction(
                handle -> {
                  handle
                      .attach(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class)
                      .upsertIncident("rollback", "test", "New", null, null, 10, "1", false);
                  throw new IllegalStateException("rollback");
                }));
    assertEquals(0, intervalCount(jdbi, "rollback"));
    int remaining =
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM test_case_incident WHERE stateId = 'rollback'")
                    .mapTo(Integer.class)
                    .one());
    assertEquals(0, remaining);
  }

  private void verifyRecordDeletion(
      Jdbi jdbi, CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO dao) {
    UUID opening = UUID.randomUUID();
    UUID closing = UUID.randomUUID();
    jdbi.useHandle(
        handle -> {
          handle.execute(
              "INSERT INTO test_case_resolution_status_time_series (stateId,id,timestamp,testCaseResolutionStatusType) VALUES (?, ?, 10, 'New')",
              "delete",
              opening.toString());
          handle.execute(
              "INSERT INTO test_case_resolution_status_time_series (stateId,id,timestamp,testCaseResolutionStatusType) VALUES (?, ?, 20, 'Resolved')",
              "delete",
              closing.toString());
        });
    dao.upsertIncident("delete", "test", "New", null, null, 10, opening.toString(), false);
    dao.upsertIncident("delete", "test", "Resolved", null, null, 20, closing.toString(), false);
    dao.deleteById(closing);
    assertEquals(10L, openedAt(jdbi, "delete"));
    assertEquals("New", summaryField(jdbi, "delete", "testCaseResolutionStatusType"));
    assertEquals(opening.toString(), summaryField(jdbi, "delete", "latestRecordId"));
    assertEquals("10", summaryField(jdbi, "delete", "updatedAt"));
    UUID assigned = UUID.randomUUID();
    jdbi.useHandle(
        handle ->
            handle.execute(
                "INSERT INTO test_case_resolution_status_time_series "
                    + "(stateId,id,timestamp,testCaseResolutionStatusType,assignee,json) "
                    + "VALUES ('delete',?,15,'Assigned','alice','{\"severity\":\"Tier1\"}')",
                assigned.toString()));
    dao.upsertIncident(
        "delete", "test", "Assigned", "alice", "Tier1", 15, assigned.toString(), false);
    dao.deleteById(opening);
    assertEquals(15L, openedAt(jdbi, "delete"));
    assertEquals("15", summaryField(jdbi, "delete", "createdAt"));
    assertEquals("Assigned", summaryField(jdbi, "delete", "testCaseResolutionStatusType"));
    assertEquals("alice", summaryField(jdbi, "delete", "assignee"));
    assertEquals("Tier1", summaryField(jdbi, "delete", "severity"));
    dao.deleteById(assigned);
    assertEquals(0, intervalCount(jdbi, "delete"));
  }

  private void verifyCapturedDeletion(Jdbi jdbi) {
    var dao = jdbi.onDemand(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class);
    dao.upsertIncident("old", "recreated_test", "New", null, null, 10, "old_record", false);
    List<String> captured = dao.listIncidentIdsForTestCases(List.of("recreated_test"));
    assertEquals(List.of("old"), captured);
    dao.upsertIncident("replacement", "recreated_test", "New", null, null, 20, "new_record", false);
    dao.deleteIncidentsByStateIds(captured);
    assertEquals(0, intervalCount(jdbi, "old"));
    assertEquals(1, intervalCount(jdbi, "replacement"));
    assertEquals(
        List.of("replacement"), dao.listIncidentIdsForTestCases(List.of("recreated_test")));
    dao.deleteIncidentsByStateIds(List.of("replacement"));
  }

  private int bulkDeletionStatementCount(Jdbi jdbi, int historyLength) {
    List<UUID> history =
        IntStream.range(0, historyLength).mapToObj(i -> UUID.randomUUID()).toList();
    UUID legacy = UUID.randomUUID();
    var dao = jdbi.onDemand(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class);
    dao.upsertIncident(
        "bulk", "bulk_test", "New", null, null, 10, history.getLast().toString(), false);
    Set<UUID> expected = new HashSet<>(history);
    expected.add(legacy);
    jdbi.useHandle(
        handle -> {
          for (UUID id : expected) {
            handle.execute(
                "INSERT INTO test_case_resolution_status_time_series (stateId,id,timestamp) VALUES (?,?,10)",
                id.equals(legacy) ? null : "bulk",
                id.toString());
            handle.execute(
                "INSERT INTO entity_relationship VALUES ('owner',?,'testCase','testCaseResolutionStatus',9)",
                id.toString());
          }
        });
    AtomicInteger statements = new AtomicInteger();
    Set<UUID> removed = new HashSet<>();
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logBeforeExecution(StatementContext context) {
            statements.incrementAndGet();
          }
        });
    TestCaseRepository.deleteIncidentHistory(
        jdbi.onDemand(CollectionDAO.class),
        List.of(history.getFirst(), legacy),
        List.of("bulk"),
        removed::addAll);
    jdbi.setSqlLogger(new SqlLogger() {});
    assertEquals(expected, removed);
    assertEquals(0, intervalCount(jdbi, "bulk"));
    assertEquals(0, dao.countTestCaseResolutionStatusesForStateId("bulk"));
    jdbi.useHandle(
        handle -> {
          assertEquals(
              0,
              handle
                  .createQuery(
                      "SELECT COUNT(*) FROM test_case_resolution_status_time_series WHERE id = :id")
                  .bind("id", legacy.toString())
                  .mapTo(int.class)
                  .one());
          assertEquals(
              0,
              handle
                  .createQuery("SELECT COUNT(*) FROM entity_relationship WHERE fromId = 'owner'")
                  .mapTo(int.class)
                  .one());
        });
    assertTrue(statements.get() > 0, "count SQL on the cleanup transaction");
    return statements.get();
  }

  private void verifyMovedOwner(Jdbi jdbi) {
    var dao = jdbi.onDemand(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class);
    UUID record = UUID.randomUUID();
    dao.upsertIncident("moved", "before_move", "New", null, null, 10, record.toString(), false);
    jdbi.useHandle(
        handle -> {
          handle.execute(
              "INSERT INTO test_case (id,fqnHash,deleted) VALUES ('moved_owner',?,FALSE)",
              FullyQualifiedName.buildHash("after_move"));
          handle.execute(
              "INSERT INTO test_case_resolution_status_time_series "
                  + "(stateId,id,entityFQNHash,timestamp,testCaseResolutionStatusType) VALUES ('moved',?,?,10,'New')",
              record.toString(),
              FullyQualifiedName.buildHash("before_move"));
          handle.execute(
              "INSERT INTO entity_relationship VALUES ('moved_owner',?,'testCase','testCaseResolutionStatus',9)",
              record.toString());
        });
    assertTrue(dao.listStatusIdsForTestCases(List.of("before_move")).isEmpty());
    assertTrue(dao.listIncidentIdsForTestCases(List.of("before_move")).isEmpty());
    assertEquals(List.of("moved"), dao.listIncidentIdsForStatusRecords(List.of(record.toString())));
    jdbi.useHandle(
        handle ->
            handle.execute(
                "DELETE FROM test_case_resolution_status_time_series WHERE stateId = 'moved'"));
    assertTrue(dao.listIncidentIdsForTestCases(List.of("before_move")).isEmpty());
    assertEquals(List.of("moved"), dao.listIncidentIdsForTestCaseIds(List.of("moved_owner")));
    jdbi.useHandle(
        handle -> handle.execute("DELETE FROM entity_relationship WHERE fromId = 'moved_owner'"));
    assertTrue(dao.listStatusIdsForTestCases(List.of("before_move")).isEmpty());
    assertEquals(List.of("moved"), dao.listIncidentIdsForTestCases(List.of("before_move")));
    dao.deleteIncidentsByStateIds(List.of("moved"));
    assertEquals(0, dao.countTestCaseResolutionStatusesForStateId("moved"));
    assertEquals(0, intervalCount(jdbi, "moved"));
    jdbi.useHandle(handle -> handle.execute("DELETE FROM test_case WHERE id = 'moved_owner'"));
  }

  private Long openedAt(Jdbi jdbi, String stateId) {
    return jdbi.withHandle(
        handle ->
            handle
                .createQuery(
                    "SELECT openedAt FROM test_case_incident_open_interval WHERE stateId = :id AND closedAt IS NULL")
                .bind("id", stateId)
                .mapTo(Long.class)
                .findOne()
                .orElse(null));
  }

  private String summaryField(Jdbi jdbi, String stateId, String field) {
    return jdbi.withHandle(
        handle ->
            handle
                .createQuery(
                    "SELECT " + field + " FROM test_case_incident WHERE stateId = :stateId")
                .bind("stateId", stateId)
                .mapTo(String.class)
                .one());
  }
}
