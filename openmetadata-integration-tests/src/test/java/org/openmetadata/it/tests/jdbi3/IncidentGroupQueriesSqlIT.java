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

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.ScratchDatabase;
import org.openmetadata.schema.tests.type.IncidentGroupBy;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TimeSeriesDAOs;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.resources.databases.DatasourceConfig;

@Execution(ExecutionMode.SAME_THREAD)
class IncidentGroupQueriesSqlIT {
  @Test
  void groupsPreservePreviewsWithoutRedundantQueriesOnPostgres() {
    assumeTrue(ScratchDatabase.dialect() == ConnectionType.POSTGRES, "PostgreSQL only");
    ScratchDatabase.withJdbi(jdbi -> runChecks(jdbi, false));
  }

  @Test
  void groupsPreservePreviewsWithoutRedundantQueriesOnMysql() {
    assumeTrue(ScratchDatabase.dialect() == ConnectionType.MYSQL, "MySQL only");
    ScratchDatabase.withJdbi(jdbi -> runChecks(jdbi, true));
  }

  private void runChecks(Jdbi jdbi, boolean mysql) {
    createFixture(jdbi, mysql);
    DatasourceConfig.initialize(ScratchDatabase.dialect().label);
    verifyGroups(jdbi);
  }

  private void createFixture(Jdbi jdbi, boolean mysql) {
    var schema =
        MigrationFile.parseSqlUnits(
            migrationFile(mysql ? "mysql" : "postgres"),
            mysql ? ConnectionType.MYSQL : ConnectionType.POSTGRES);
    jdbi.useHandle(
        handle -> {
          handle.execute(
              "CREATE TABLE test_case (id VARCHAR(36), fqnHash VARCHAR(36), json "
                  + (mysql ? "JSON" : "JSONB")
                  + " NOT NULL, entityFQN VARCHAR(712) GENERATED ALWAYS AS ("
                  + (mysql ? "json ->> '$.entityFQN') VIRTUAL" : "json ->> 'entityFQN') STORED")
                  + " NOT NULL, entityLink VARCHAR(512) GENERATED ALWAYS AS ("
                  + (mysql ? "json ->> '$.entityLink'" : "json ->> 'entityLink'")
                  + ") STORED NOT NULL, deleted BOOLEAN)");
          handle.execute(
              "CREATE TABLE entity_relationship (fromId VARCHAR(36), toId VARCHAR(36), fromEntity VARCHAR(36), toEntity VARCHAR(36), relation INT)");
          handle.execute(
              "CREATE TABLE test_case_incident (stateId VARCHAR(36) PRIMARY KEY, entityFQNHash VARCHAR(36), testCaseResolutionStatusType VARCHAR(36), severity VARCHAR(36), assignee VARCHAR(36), createdAt BIGINT, updatedAt BIGINT)");
          schema.forEach(unit -> unit.statements().forEach(handle::execute));
          String[] links = {
            "<#E::table::table1>",
            "<#E::table::table1::columns::c>",
            "<#E::table::table2>",
            "<#E::table::table3>"
          };
          for (int i = 0; i < links.length; i++) {
            handle
                .createUpdate(
                    "INSERT INTO test_case (id,fqnHash,json,deleted) VALUES (:id,:hash,"
                        + (mysql ? ":json" : "CAST(:json AS jsonb)")
                        + ",:deleted)")
                .bind("id", "t" + (i + 1))
                .bind("hash", "f" + (i + 1))
                .bind("json", "{\"entityFQN\":\"table\",\"entityLink\":\"" + links[i] + "\"}")
                .bind("deleted", i == 3)
                .execute();
          }
          handle.execute(
              "INSERT INTO entity_relationship VALUES ('d1','t1','testDefinition','testCase',0),('d2','t2','testDefinition','testCase',0),('d1','t4','testDefinition','testCase',0),('owner','t1','user','testCase',8),('owner','t2','user','testCase',8)");
          handle.execute(
              "INSERT INTO test_case_incident VALUES ('i1','f1','Assigned','Severity1','alice',1,2),('i2','f1','New','Severity2',NULL,2,3),('i3','f2','Ack','Severity2','alice',3,4),('i4','f3','New','Severity3',NULL,4,5),('i5','f1','Resolved','Severity1','alice',5,6),('i6','f4','New','Severity1',NULL,6,7)");
        });
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
