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
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@Execution(ExecutionMode.SAME_THREAD)
class IncidentHistorySqlTest {
  private static final String DATABASE = "incident_history";
  private static final String PASSWORD = "incident-history-test";

  @Test
  void historyUsesSqlLimitsAndStableCursorsOnMysql() {
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
  void historyUsesSqlLimitsAndStableCursorsOnPostgres() {
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
              "CREATE TABLE test_case_resolution_status_time_series "
                  + "(stateId VARCHAR(36), id VARCHAR(36), timestamp BIGINT, json "
                  + (mysql ? "JSON" : "JSONB")
                  + ")");
          for (int id = 1; id <= 4; id++) {
            handle
                .createUpdate(
                    "INSERT INTO test_case_resolution_status_time_series VALUES "
                        + "(:stateId, :id, :timestamp, "
                        + (mysql ? ":json" : "CAST(:json AS jsonb)")
                        + ")")
                .bind("stateId", "incident-1")
                .bind("id", String.valueOf(id))
                .bind("timestamp", id == 1 ? 100 : 200)
                .bind("json", "{\"id\":\"" + id + "\"}")
                .execute();
          }
          handle.execute(
              "INSERT INTO test_case_resolution_status_time_series VALUES "
                  + "('incident-2', '5', 300, '{\"id\":\"5\"}')");
        });
    final var dao = jdbi.onDemand(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class);
    assertEquals(
        List.of("4", "3"),
        ids(dao.listTestCaseResolutionStatusesForStateId("incident-1", null, null, 2)));
    assertEquals(
        List.of("2", "1"),
        ids(dao.listTestCaseResolutionStatusesForStateId("incident-1", 200L, "3", 2)));
    assertEquals(
        List.of("4"),
        ids(dao.listTestCaseResolutionStatusesForStateId("incident-1", null, null, 1)));
    assertEquals(
        List.of(), dao.listTestCaseResolutionStatusesForStateId("incident-1", 100L, "1", 2));
    assertEquals(4, dao.countTestCaseResolutionStatusesForStateId("incident-1"));
    assertEquals(4, dao.listTestCaseResolutionStatusesForStateId("incident-1").size());
    jdbi.useHandle(
        handle ->
            handle.execute("DELETE FROM test_case_resolution_status_time_series WHERE id = '3'"));
    assertEquals(
        List.of("2", "1"),
        ids(dao.listTestCaseResolutionStatusesForStateId("incident-1", 200L, "3", 2)));
  }

  private List<String> ids(List<String> jsons) {
    return jsons.stream().map(json -> JsonUtils.readTree(json).get("id").asText()).toList();
  }
}
