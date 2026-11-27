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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.ScratchDatabase;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

@Execution(ExecutionMode.SAME_THREAD)
class IncidentGroupingIndexSqlIT {
  @Test
  void indexTracksSourceTransactionsOnPostgres() {
    assumeTrue(ScratchDatabase.dialect() == ConnectionType.POSTGRES, "PostgreSQL only");
    ScratchDatabase.withJdbi(jdbi -> runChecks(jdbi, false));
  }

  @Test
  void indexTracksSourceTransactionsOnMysql() {
    assumeTrue(ScratchDatabase.dialect() == ConnectionType.MYSQL, "MySQL only");
    ScratchDatabase.withJdbi(jdbi -> runChecks(jdbi, true));
  }

  private void runChecks(Jdbi jdbi, boolean mysql) {
    String prefix = "表".repeat(3071);
    String existingName = prefix + "甲";
    String newName = prefix + "乙";
    jdbi.useHandle(
        handle -> {
          String json = mysql ? "JSON" : "JSONB";
          String id = mysql ? "JSON_UNQUOTE(JSON_EXTRACT(json,'$.id'))" : "json->>'id'";
          String deleted = mysql ? "JSON_EXTRACT(json,'$.deleted')" : "(json->>'deleted')::boolean";
          String link = mysql ? "json ->> '$.entityLink'" : "json ->> 'entityLink'";
          String fqn = mysql ? "json ->> '$.entityFQN'" : "json ->> 'entityFQN'";
          String hashType =
              mysql ? "VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin" : "VARCHAR(768)";
          handle.execute(
              "CREATE TABLE SERVER_MIGRATION_SQL_LOGS (version VARCHAR(256), sqlStatement VARCHAR(10000), checksum VARCHAR(256) PRIMARY KEY, executedAt TIMESTAMP)");
          handle.execute(
              "CREATE TABLE test_case_incident (stateId VARCHAR(36) PRIMARY KEY)"
                  + (mysql ? " DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci" : ""));
          handle.execute(
              "CREATE TABLE test_case (json "
                  + json
                  + " NOT NULL, fqnHash "
                  + hashType
                  + " PRIMARY KEY, id VARCHAR(36) GENERATED ALWAYS AS ("
                  + id
                  + ") STORED, deleted BOOLEAN GENERATED ALWAYS AS ("
                  + deleted
                  + ") STORED, entityFQN VARCHAR("
                  + (mysql ? 1024 : 712)
                  + ") GENERATED ALWAYS AS ("
                  + fqn
                  + (mysql ? ") VIRTUAL" : ") STORED")
                  + " NOT NULL, entityLink VARCHAR(512) GENERATED ALWAYS AS ("
                  + link
                  + ") STORED NOT NULL)");
          insertCase(handle, "before", "before", "<#E::table::table1::columns::column>", mysql);
        });
    applySchema(jdbi, mysql, 2);
    jdbi.useHandle(
        handle ->
            insertCase(
                handle,
                "existing-long",
                "existing-long",
                "<#E::table::" + existingName + "::columns::c>",
                mysql));
    applySchema(jdbi, mysql);
    assertEquals("table1", table(jdbi, "before"));
    jdbi.useHandle(handle -> insertCase(handle, "after", "after", "<#E::table::table2>", mysql));
    assertEquals("table2", table(jdbi, "after"));
    jdbi.useHandle(
        handle ->
            handle.execute(
                "UPDATE test_case SET fqnHash='renamed',json="
                    + (mysql
                        ? "JSON_SET(json,'$.entityLink','<#E::table::renamed>','$.deleted',TRUE)"
                        : "json || '{\"entityLink\":\"<#E::table::renamed>\",\"deleted\":true}'::jsonb")
                    + " WHERE fqnHash='before'"));
    assertEquals(null, table(jdbi, "before"));
    assertEquals("renamed", table(jdbi, "renamed"));
    assertEquals(true, deleted(jdbi));
    jdbi.useHandle(
        handle ->
            handle.execute(
                "UPDATE test_case SET json="
                    + (mysql
                        ? "JSON_SET(json,'$.deleted',FALSE)"
                        : "json || '{\"deleted\":false}'::jsonb")
                    + " WHERE fqnHash='renamed'"));
    assertEquals(false, deleted(jdbi));
    assertThrows(
        IllegalStateException.class,
        () ->
            jdbi.useTransaction(
                handle -> {
                  handle.execute("DELETE FROM test_case WHERE fqnHash='renamed'");
                  insertCase(handle, "rollback", "rollback", "<#E::table::rollback>", mysql);
                  throw new IllegalStateException("rollback");
                }));
    assertEquals("renamed", table(jdbi, "renamed"));
    assertEquals(null, table(jdbi, "rollback"));
    jdbi.useHandle(handle -> handle.execute("DELETE FROM test_case WHERE fqnHash='after'"));
    assertEquals(null, table(jdbi, "after"));
    assertEquals(existingName, table(jdbi, "existing-long"));
    jdbi.useHandle(
        handle ->
            insertCase(handle, "a".repeat(768), "wide", "<#E::table::" + newName + ">", mysql));
    assertEquals(newName, table(jdbi, "a".repeat(768)));
    assertEquals(
        List.of("a".repeat(768)),
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery("SELECT fqnHash FROM test_case WHERE incidentTableFqn = :name")
                    .bind("name", newName)
                    .mapTo(String.class)
                    .list()));
    applySchema(jdbi, mysql);
    applySchema(jdbi, mysql);
    assertEquals("renamed", table(jdbi, "renamed"));
    assertEquals(newName, table(jdbi, "a".repeat(768)));
  }

  private void applySchema(Jdbi jdbi, boolean mysql) {
    applySchema(jdbi, mysql, Integer.MAX_VALUE);
  }

  private void applySchema(Jdbi jdbi, boolean mysql, int statementLimit) {
    File file = migrationFile(mysql ? "mysql" : "postgres");
    jdbi.useHandle(
        handle ->
            MigrationProcessImpl.performSqlExecutionAndUpdate(
                handle,
                handle.attach(MigrationDAO.class),
                MigrationFile.parseSqlUnits(
                        file, mysql ? ConnectionType.MYSQL : ConnectionType.POSTGRES)
                    .stream()
                    .limit(statementLimit)
                    .toList(),
                "2.1.1",
                false));
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

  private void insertCase(Handle handle, String hash, String id, String link, boolean mysql) {
    String entityFqn =
        link.substring("<#E::table::".length(), link.length() - 1).replace("::columns::", ".");
    String json =
        "{\"id\":\""
            + id
            + "\",\"entityLink\":\""
            + link
            + "\",\"entityFQN\":\""
            + entityFqn
            + "\",\"deleted\":false}";
    handle
        .createUpdate(
            "INSERT INTO test_case (fqnHash,json) VALUES (:hash,"
                + (mysql ? ":json" : "CAST(:json AS jsonb)")
                + ")")
        .bind("hash", hash)
        .bind("json", json)
        .execute();
  }

  private String table(Jdbi jdbi, String hash) {
    return jdbi.withHandle(
        handle ->
            handle
                .createQuery("SELECT incidentTableFqn FROM test_case WHERE fqnHash=:hash")
                .bind("hash", hash)
                .mapTo(String.class)
                .findOne()
                .orElse(null));
  }

  private boolean deleted(Jdbi jdbi) {
    return jdbi.withHandle(
        handle ->
            handle
                .createQuery("SELECT deleted FROM test_case WHERE fqnHash='renamed'")
                .mapTo(Boolean.class)
                .one());
  }
}
