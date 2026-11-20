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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.mockito.MockedStatic;
import org.openmetadata.schema.tests.type.IncidentGroupBy;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@Execution(ExecutionMode.SAME_THREAD)
class IncidentGroupQueriesSqlTest {
  private static final String PASSWORD = "incident-groups-test";

  @Test
  void groupsPreservePreviewsWithoutRedundantQueriesOnPostgres() {
    try (var database =
        new GenericContainer<>("postgres:15")
            .withEnv("POSTGRES_PASSWORD", PASSWORD)
            .withExposedPorts(5432)
            .waitingFor(
                Wait.forLogMessage(".*database system is ready to accept connections.*\\n", 2))) {
      database.start();
      runChecks(
          connect(
              "jdbc:postgresql://%s:%d/postgres"
                  .formatted(database.getHost(), database.getMappedPort(5432)),
              "postgres",
              "org.postgresql.Driver"),
          false);
    }
  }

  @Test
  void groupsPreservePreviewsWithoutRedundantQueriesOnMysql() {
    try (var database =
        new GenericContainer<>("mysql:8.3.0")
            .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
            .withEnv("MYSQL_DATABASE", "incident_groups")
            .withEnv("MYSQL_ROOT_HOST", "%")
            .withExposedPorts(3306)
            .waitingFor(
                Wait.forSuccessfulCommand(
                    "mysql --protocol=TCP --host=127.0.0.1 --user=root --password="
                        + PASSWORD
                        + " --execute='SELECT 1'"))) {
      database.start();
      runChecks(
          connect(
              "jdbc:mysql://%s:%d/incident_groups?allowPublicKeyRetrieval=true&useSSL=false"
                  .formatted(database.getHost(), database.getMappedPort(3306)),
              "root",
              "com.mysql.cj.jdbc.Driver"),
          true);
    }
  }

  private Jdbi connect(String url, String username, String driver) {
    var jdbi = Jdbi.create(url, username, PASSWORD).installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlObjects.class).setSqlLocator(new ConnectionAwareAnnotationSqlLocator(driver));
    return jdbi;
  }

  private void runChecks(Jdbi jdbi, boolean mysql) {
    jdbi.getConfig(SqlStatements.class).setUnusedBindingAllowed(true);
    createFixture(jdbi, mysql);
    var config = mock(DatasourceConfig.class);
    when(config.isMySQL()).thenReturn(mysql);
    try (MockedStatic<DatasourceConfig> datasource = mockStatic(DatasourceConfig.class)) {
      datasource.when(DatasourceConfig::getInstance).thenReturn(config);
      verifyGroups(jdbi);
    }
  }

  private void createFixture(Jdbi jdbi, boolean mysql) {
    jdbi.useHandle(
        handle -> {
          handle.execute(
              "CREATE TABLE test_case (id VARCHAR(36), fqnHash VARCHAR(36), entityLink VARCHAR(256), deleted BOOLEAN)");
          handle.execute(
              "CREATE TABLE entity_relationship (fromId VARCHAR(36), toId VARCHAR(36), fromEntity VARCHAR(36), toEntity VARCHAR(36), relation INT)");
          handle.execute(
              "CREATE TABLE test_case_incident (stateId VARCHAR(36), entityFQNHash VARCHAR(36), testCaseResolutionStatusType VARCHAR(36), severity VARCHAR(36), assignee VARCHAR(36), createdAt BIGINT, updatedAt BIGINT)");
          handle.execute(
              "INSERT INTO test_case VALUES ('t1','f1','<#E::table::table1>',FALSE),('t2','f2','<#E::table::table1::columns::c>',FALSE),('t3','f3','<#E::table::table2>',FALSE),('t4','f4','<#E::table::table3>',TRUE)");
          handle.execute(
              "INSERT INTO entity_relationship VALUES ('d1','t1','testDefinition','testCase',0),('d2','t2','testDefinition','testCase',0),('d1','t4','testDefinition','testCase',0),('owner','t1','user','testCase',8),('owner','t2','user','testCase',8)");
          handle.execute(
              "INSERT INTO test_case_incident VALUES ('i1','f1','Assigned','Severity1','alice',1,2),('i2','f1','New','Severity2',NULL,2,3),('i3','f2','Ack','Severity2','alice',3,4),('i4','f3','New','Severity3',NULL,4,5),('i5','f1','Resolved','Severity1','alice',5,6),('i6','f4','New','Severity1',NULL,6,7)");
          String tableFqn =
              mysql
                  ? "TRIM(TRAILING '>' FROM SUBSTRING_INDEX(SUBSTRING_INDEX(entityLink,'::',3),'::',-1))"
                  : "TRIM(TRAILING '>' FROM SPLIT_PART(entityLink,'::',3))";
          handle.execute(
              "CREATE TABLE test_case_incident_dimension AS SELECT id,fqnHash,deleted,"
                  + tableFqn
                  + " AS tableFqn FROM test_case");
          handle.execute(
              "CREATE TABLE test_case_incident_definition AS SELECT fromId,toId FROM entity_relationship WHERE fromEntity='testDefinition' AND toEntity='testCase' AND relation=0");
        });
  }

  private void verifyGroups(Jdbi jdbi) {
    var statements = new ArrayList<String>();
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logAfterExecution(StatementContext context) {
            statements.add(context.getRenderedSql());
          }
        });
    var dao = jdbi.onDemand(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class);
    var tables =
        dao.listIncidentGroups(
            IncidentGroupBy.Table, new ListFilter(null), "incidentCount DESC", 25, 0);
    assertEquals(
        List.of(3, 1),
        tables.counts().stream()
            .map(TimeSeriesDAOs.TestCaseIncidentGroupCount::incidentCount)
            .toList());
    assertEquals(Map.of("table1", List.of("table1"), "table2", List.of("table2")), tables.tables());
    assertEquals(Map.of("table1", List.of("d1", "d2")), tables.testDefinitions());
    assertEquals(0, tables.counts().getLast().testDefinitionCount());
    assertEquals(2, statements.size(), "Table grouping must not query its own table preview");
    statements.clear();
    var definitions =
        dao.listIncidentGroups(
            IncidentGroupBy.TestDefinition, new ListFilter(null), "incidentCount DESC", 25, 0);
    assertEquals(
        List.of(2, 1),
        definitions.counts().stream()
            .map(TimeSeriesDAOs.TestCaseIncidentGroupCount::incidentCount)
            .toList());
    assertEquals(Map.of("d1", List.of("table1"), "d2", List.of("table1")), definitions.tables());
    assertEquals(Map.of("d1", List.of("d1"), "d2", List.of("d2")), definitions.testDefinitions());
    assertEquals(
        2, statements.size(), "Definition grouping must not query its own definition preview");
    var owners =
        dao.listIncidentGroups(
            IncidentGroupBy.Owner, new ListFilter(null), "incidentCount DESC", 25, 0);
    assertEquals(2, owners.total());
    assertEquals(Map.of("owner", List.of("table1"), "", List.of("table2")), owners.tables());
    assertEquals(Map.of("owner", List.of("d1", "d2")), owners.testDefinitions());
    var filtered =
        dao.listIncidentGroups(
            IncidentGroupBy.Table,
            new ListFilter(null).addQueryParam("testCaseResolutionStatusType", "Assigned,Ack"),
            "incidentCount DESC",
            25,
            0);
    assertEquals(2, filtered.counts().getFirst().incidentCount());
    assertEquals(List.of("table1"), filtered.tables().get("table1"));
    var last =
        dao.listIncidentGroups(
            IncidentGroupBy.Table, new ListFilter(null), "incidentCount DESC", 1, 1);
    assertEquals(2, last.total());
    assertEquals(Map.of("table2", List.of("table2")), last.tables());
    var empty =
        dao.listIncidentGroups(
            IncidentGroupBy.Table, new ListFilter(null), "incidentCount DESC", 1, 2);
    assertEquals(2, empty.total());
    assertEquals(List.of(), empty.counts());
    assertEquals(Map.of(), empty.tables());
    assertEquals(Map.of(), empty.testDefinitions());
  }
}
