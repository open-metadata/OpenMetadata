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
package org.openmetadata.it.tests.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.util.List;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.ScratchDatabase;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

@Execution(ExecutionMode.SAME_THREAD)
class IncidentHistorySqlIT {
  @Test
  void historyUsesSqlLimitsAndStableCursorsOnMysql() {
    assumeTrue(ScratchDatabase.dialect() == ConnectionType.MYSQL, "MySQL only");
    ScratchDatabase.withJdbi(jdbi -> runChecks(jdbi, true));
  }

  @Test
  void historyUsesSqlLimitsAndStableCursorsOnPostgres() {
    assumeTrue(ScratchDatabase.dialect() == ConnectionType.POSTGRES, "PostgreSQL only");
    ScratchDatabase.withJdbi(jdbi -> runChecks(jdbi, false));
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
