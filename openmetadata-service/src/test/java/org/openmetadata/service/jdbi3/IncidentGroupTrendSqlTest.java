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

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@Execution(ExecutionMode.SAME_THREAD)
class IncidentGroupTrendSqlTest {
  private static final String DATABASE = "incident_trend";
  private static final String PASSWORD = "incident-history-test";

  @Test
  void openCountsIncludeResolutionsAndBaselineOnMysql() {
    try (GenericContainer<?> database =
        new GenericContainer<>("mysql:8.3.0")
            .withEnv("MYSQL_DATABASE", DATABASE)
            .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
            .withEnv("MYSQL_ROOT_HOST", "%")
            .withExposedPorts(3306)
            .waitingFor(
                Wait.forSuccessfulCommand(
                    "mysql --protocol=TCP --host=127.0.0.1 --user=root --password="
                        + PASSWORD
                        + " --execute='SELECT 1'"))) {
      database.start();
      String url =
          "jdbc:mysql://%s:%d/%s?allowPublicKeyRetrieval=true&useSSL=false"
              .formatted(database.getHost(), database.getMappedPort(3306), DATABASE);
      runChecks(connect(url, "root", "com.mysql.cj.jdbc.Driver"), true);
    }
  }

  @Test
  void openCountsIncludeResolutionsAndBaselineOnPostgres() {
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
      runChecks(connect(url, "postgres", "org.postgresql.Driver"), false);
    }
  }

  private Jdbi connect(String url, String username, String driver) {
    Jdbi jdbi = Jdbi.create(url, username, PASSWORD);
    jdbi.installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlObjects.class).setSqlLocator(new ConnectionAwareAnnotationSqlLocator(driver));
    return jdbi;
  }

  private void runChecks(Jdbi jdbi, boolean mysql) {
    jdbi.useHandle(
        handle -> {
          handle.execute(
              "CREATE TABLE test_case (fqnHash VARCHAR(36), tableFqn VARCHAR(36), deleted BOOLEAN)");
          handle.execute(
              "CREATE TABLE test_case_incident (stateId VARCHAR(36), entityFQNHash VARCHAR(36), createdAt BIGINT)");
          handle.execute(
              "CREATE TABLE test_case_resolution_status_time_series (stateId VARCHAR(36), id VARCHAR(36), timestamp BIGINT, testCaseResolutionStatusType VARCHAR(36))");
          handle.execute(
              "INSERT INTO test_case VALUES ('test', 'table', FALSE), ('other', 'other_table', FALSE), ('deleted', 'table', TRUE)");
          handle.execute(
              "INSERT INTO test_case_incident VALUES ('a','test',50),('b','test',110),('c','test',120),('d','test',700),('e','other',50),('f','deleted',50)");
          handle.execute(
              "INSERT INTO test_case_resolution_status_time_series VALUES "
                  + "('a','1',50,'New'),('a','2',110,'Ack'),('a','3',120,'Assigned'),"
                  + "('b','4',110,'New'),('c','5',120,'New'),('d','6',700,'New'),"
                  + "('a','7',800,'Resolved'),('a','8',850,'Resolved'),"
                  + "('b','9',800,'Assigned'),('b','a',800,'Resolved'),"
                  + "('e','b',50,'New'),('f','c',50,'New')");
        });
    var dao = jdbi.onDemand(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class);
    var window = new IncidentGroupTrend(100, 900);
    var rows =
        dao.listIncidentGroupTrendCounts(
            "tc.tableFqn",
            "",
            "WHERE 1=1",
            IncidentGroupTrend.samplesSql(),
            "'New','Ack','Assigned'",
            List.of("table"),
            window.bindings());
    assertEquals(List.of(1, 3, 3, 3, 3, 3, 4, 2, 2), IncidentGroupTrend.counts(rows));
    assertEquals(
        Set.of("table"),
        rows.stream()
            .map(TimeSeriesDAOs.IncidentGroupTrendCount::groupKey)
            .collect(Collectors.toSet()));

    // A return to New on an open incident and repeated assignments do not open another incident.
    jdbi.useHandle(
        handle ->
            handle.execute(
                "INSERT INTO test_case_resolution_status_time_series VALUES ('c','d',850,'New'),('c','e',870,'Assigned')"));
    assertEquals(
        List.of(1, 3, 3, 3, 3, 3, 4, 2, 2),
        IncidentGroupTrend.counts(
            dao.listIncidentGroupTrendCounts(
                "tc.tableFqn",
                "",
                "WHERE 1=1",
                IncidentGroupTrend.samplesSql(),
                "'New','Ack','Assigned'",
                List.of("table"),
                window.bindings())));
    var empty =
        dao.listIncidentGroupTrendCounts(
            "tc.tableFqn",
            "",
            "WHERE 1=1",
            IncidentGroupTrend.samplesSql(),
            "'New','Ack','Assigned'",
            List.of("missing"),
            window.bindings());
    assertEquals(List.of(0, 0, 0, 0, 0, 0, 0, 0, 0), IncidentGroupTrend.counts(empty));
  }
}
