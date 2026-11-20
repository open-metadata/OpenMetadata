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
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.github.dockerjava.api.model.Ulimit;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.migration.utils.v211.IncidentOpenIntervalMigration;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@Execution(ExecutionMode.SAME_THREAD)
class IncidentGroupTrendSqlTest {
  private static final String DATABASE = "incident_trend";
  private static final String PASSWORD = "incident-history-test";

  @Test
  void openCountsIncludeResolutionsAndBaselineOnMysql() throws Exception {
    try (GenericContainer<?> database =
        new GenericContainer<>("mysql:8.3.0")
            .withEnv("MYSQL_DATABASE", DATABASE)
            .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
            .withEnv("MYSQL_ROOT_HOST", "%")
            .withTmpFs(Map.of("/var/lib/mysql", "rw,size=512m"))
            .withCreateContainerCmdModifier(
                cmd ->
                    cmd.getHostConfig().withUlimits(List.of(new Ulimit("nofile", 65536L, 65536L))))
            .withCommand("--skip-log-bin")
            .withExposedPorts(3306)
            .waitingFor(
                Wait.forSuccessfulCommand(
                        "mysql --protocol=TCP --host=127.0.0.1 --user=root --password="
                            + PASSWORD
                            + " --execute='SELECT 1'")
                    .withStartupTimeout(Duration.ofMinutes(3)))) {
      database.start();
      String url =
          "jdbc:mysql://%s:%d/%s?allowPublicKeyRetrieval=true&useSSL=false"
              .formatted(database.getHost(), database.getMappedPort(3306), DATABASE);
      runChecks(connect(url, "root", "com.mysql.cj.jdbc.Driver"), "mysql");
    }
  }

  @Test
  void openCountsIncludeResolutionsAndBaselineOnPostgres() throws Exception {
    try (GenericContainer<?> database =
        new GenericContainer<>("postgres:15")
            .withEnv("POSTGRES_DB", DATABASE)
            .withEnv("POSTGRES_PASSWORD", PASSWORD)
            .withExposedPorts(5432)
            .waitingFor(
                Wait.forLogMessage(".*database system is ready to accept connections.*\\n", 2))) {
      database.start();
      String url =
          "jdbc:postgresql://%s:%d/%s"
              .formatted(database.getHost(), database.getMappedPort(5432), DATABASE);
      runChecks(connect(url, "postgres", "org.postgresql.Driver"), "postgres");
    }
  }

  private Jdbi connect(String url, String username, String driver) {
    Jdbi jdbi = Jdbi.create(url, username, PASSWORD);
    jdbi.installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlObjects.class).setSqlLocator(new ConnectionAwareAnnotationSqlLocator(driver));
    return jdbi;
  }

  private void runChecks(Jdbi jdbi, String dialect) throws Exception {
    String schema =
        Files.readString(
            Path.of("../bootstrap/sql/migrations/native/2.1.1/" + dialect + "/schemaChanges.sql"));
    jdbi.useHandle(
        handle -> {
          handle.execute(
              "CREATE TABLE test_case (fqnHash VARCHAR(36), incidentTableFqn VARCHAR(36), deleted BOOLEAN)");
          handle.execute(
              "CREATE TABLE test_case_incident (stateId VARCHAR(36) PRIMARY KEY, entityFQNHash VARCHAR(768), createdAt BIGINT, updatedAt BIGINT, latestRecordId VARCHAR(36), testCaseResolutionStatusType VARCHAR(36), assignee VARCHAR(256), severity VARCHAR(36))");
          handle.execute(
              "CREATE TABLE test_case_resolution_status_time_series (stateId VARCHAR(36), id VARCHAR(36), timestamp BIGINT, testCaseResolutionStatusType VARCHAR(36), entityFQNHash VARCHAR(768))");
          handle.execute(schema);
          handle.execute(schema);
          handle.execute(
              "CREATE INDEX incident_history_state_timestamp ON test_case_resolution_status_time_series (stateId, timestamp)");
          handle.execute(
              "INSERT INTO test_case VALUES ('test', 'table', FALSE), ('other', 'other_table', FALSE), ('deleted', 'table', TRUE)");
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
    verifyMigrationBatches(jdbi);
    verifyWritesAndDeletion(jdbi);
    verifyReorderedWrites(jdbi);
    verifyWritesBeforeIntervalMigration(jdbi, schema);
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
    assertEquals(List.of(2, 3, 4, 4, 4, 4, 5, 3, 3), IncidentGroupTrend.counts(rows));
    assertEquals(
        Set.of("table"),
        rows.stream()
            .map(TimeSeriesDAOs.IncidentGroupTrendCount::groupKey)
            .collect(Collectors.toSet()));

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
        () -> dao.upsertIncident("not-migrating", "test", "New", null, null, 10, "normal"));
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
    assertEquals(10L, dao.findOpenInterval("migration"));
    dao.upsertIncident("migration", "test", "Resolved", null, null, 20, "close", true);
    assertEquals(null, dao.findOpenInterval("migration"));
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
          dao.upsertIncident(stateId, "ordered-test", status, null, null, ordered, recordId);
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
    dao.upsertIncident("live", "live-test", "New", null, null, 10, "1");
    dao.upsertIncident("live", "live-test", "Ack", null, null, 20, "2");
    dao.upsertIncident("live", "live-test", "Assigned", null, null, 30, "3");
    assertEquals(1, intervalCount(jdbi, "live"));
    dao.upsertIncident("live", "live-test", "Resolved", null, null, 40, "4");
    dao.upsertIncident("live", "live-test", "Resolved", null, null, 50, "5");
    long closedAt =
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT closedAt FROM test_case_incident_open_interval WHERE stateId = 'live'")
                    .mapTo(Long.class)
                    .one());
    assertEquals(40L, closedAt);
    dao.upsertIncident("live", "live-test", "New", null, null, 60, "6");
    assertEquals(2, intervalCount(jdbi, "live"));
    dao.delete("live-test");
    assertEquals(0, intervalCount(jdbi, "live"));
    verifyRollback(jdbi);
    verifyRecordDeletion(jdbi, dao);
  }

  private void verifyRollback(Jdbi jdbi) {
    assertThrows(
        IllegalStateException.class,
        () ->
            jdbi.useTransaction(
                handle -> {
                  handle
                      .attach(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class)
                      .upsertIncident("rollback", "test", "New", null, null, 10, "1");
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
    dao.upsertIncident("delete", "test", "New", null, null, 10, opening.toString());
    dao.upsertIncident("delete", "test", "Resolved", null, null, 20, closing.toString());
    dao.deleteById(closing);
    assertEquals(10L, dao.findOpenInterval("delete"));
    dao.deleteById(opening);
    assertEquals(0, intervalCount(jdbi, "delete"));
  }
}
