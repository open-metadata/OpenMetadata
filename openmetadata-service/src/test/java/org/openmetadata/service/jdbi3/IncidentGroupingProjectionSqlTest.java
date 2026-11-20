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

import java.io.File;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v212.IncidentGroupingMigration;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@Execution(ExecutionMode.SAME_THREAD)
class IncidentGroupingProjectionSqlTest {
  private static final String PASSWORD = "incident-groups-test";

  @Test
  void projectionTracksSourceTransactionsOnPostgres() {
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
  void projectionTracksSourceTransactionsOnMysql() {
    try (var database =
        new GenericContainer<>("mysql:8.3.0")
            .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
            .withEnv("MYSQL_DATABASE", "incident_projection")
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
              "jdbc:mysql://%s:%d/incident_projection?allowPublicKeyRetrieval=true&useSSL=false"
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
    jdbi.useHandle(
        handle -> {
          handle.execute(
              "CREATE TABLE SERVER_MIGRATION_SQL_LOGS (version VARCHAR(256), sqlStatement VARCHAR(10000), checksum VARCHAR(256) PRIMARY KEY, executedAt TIMESTAMP)");
          String json = mysql ? "JSON" : "JSONB";
          String extractId = mysql ? "JSON_UNQUOTE(JSON_EXTRACT(json,'$.id'))" : "json->>'id'";
          String extractEntity =
              mysql ? "JSON_UNQUOTE(JSON_EXTRACT(json,'$.entityFQN'))" : "json->>'entityFQN'";
          String extractLink =
              mysql ? "JSON_UNQUOTE(JSON_EXTRACT(json,'$.entityLink'))" : "json->>'entityLink'";
          String extractDeleted =
              mysql ? "JSON_EXTRACT(json,'$.deleted')" : "(json->>'deleted')::boolean";
          handle.execute(
              "CREATE TABLE test_case (json "
                  + json
                  + " NOT NULL, fqnHash VARCHAR(768) PRIMARY KEY, id VARCHAR(36) GENERATED ALWAYS AS ("
                  + extractId
                  + ") STORED, entityFQN VARCHAR(1024) GENERATED ALWAYS AS ("
                  + extractEntity
                  + ") STORED, entityLink VARCHAR(512) GENERATED ALWAYS AS ("
                  + extractLink
                  + ") STORED, deleted BOOLEAN GENERATED ALWAYS AS ("
                  + extractDeleted
                  + ") STORED)");
          handle.execute(
              "CREATE TABLE entity_relationship (fromId VARCHAR(36), toId VARCHAR(36), fromEntity VARCHAR(256), toEntity VARCHAR(256), relation INT, relationType VARCHAR(64) NOT NULL DEFAULT '', deleted BOOLEAN DEFAULT FALSE, PRIMARY KEY(fromId,toId,relation,relationType))");
          handle.execute(
              "CREATE INDEX idx_er_fromentity_toentity_relation_toid ON entity_relationship (fromEntity,toEntity,relation,toId)");
          insertCase(handle, "f1", "t1", "table1", false, mysql);
          handle.execute(
              "INSERT INTO entity_relationship (fromId,toId,fromEntity,toEntity,relation) VALUES ('d1','t1','testDefinition','testCase',0)");
        });
    applySchema(jdbi, mysql);
    jdbi.useHandle(IncidentGroupingMigration::backfill);
    jdbi.useHandle(IncidentGroupingMigration::backfill);
    assertEquals("table1", table(jdbi, "f1"));
    assertEquals(1, definitions(jdbi));
    jdbi.useHandle(handle -> insertCase(handle, "f2", "t2", "table2", false, mysql));
    assertEquals("table2", table(jdbi, "f2"));
    verifyUpdates(jdbi, mysql);
    verifyRelationships(jdbi);
    verifyRollback(jdbi, mysql);
    applySchema(jdbi, mysql);
    jdbi.useHandle(IncidentGroupingMigration::backfill);
    assertEquals("renamed", table(jdbi, "renamedHash"));
    verifyBatches(jdbi, mysql);
  }

  private void applySchema(Jdbi jdbi, boolean mysql) {
    File file =
        new File(
            "../bootstrap/sql/migrations/native/2.1.2/"
                + (mysql ? "mysql" : "postgres")
                + "/schemaChanges.sql");
    jdbi.useHandle(
        handle ->
            MigrationProcessImpl.performSqlExecutionAndUpdate(
                handle,
                handle.attach(MigrationDAO.class),
                MigrationFile.parseSqlUnits(
                    file, mysql ? ConnectionType.MYSQL : ConnectionType.POSTGRES),
                "2.1.2",
                false));
  }

  private void insertCase(
      Handle handle, String hash, String id, String table, boolean deleted, boolean mysql) {
    String json =
        "{\"id\":\""
            + id
            + "\",\"entityFQN\":\""
            + table
            + "\",\"entityLink\":\"<#E::table::"
            + table
            + "::columns::column>\",\"deleted\":"
            + deleted
            + "}";
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
                .createQuery(
                    "SELECT tableFqn FROM test_case_incident_dimension WHERE fqnHash=:hash")
                .bind("hash", hash)
                .mapTo(String.class)
                .findOne()
                .orElse(null));
  }

  private int definitions(Jdbi jdbi) {
    return jdbi.withHandle(
        handle ->
            handle
                .createQuery("SELECT COUNT(*) FROM test_case_incident_definition")
                .mapTo(Integer.class)
                .one());
  }

  private void verifyUpdates(Jdbi jdbi, boolean mysql) {
    jdbi.useHandle(
        handle -> {
          String update =
              mysql
                  ? "JSON_SET(json,'$.entityLink','<#E::table::renamed>','$.entityFQN','renamed','$.deleted',TRUE)"
                  : "json || '{\"entityLink\":\"<#E::table::renamed>\",\"entityFQN\":\"renamed\",\"deleted\":true}'::jsonb";
          handle.execute(
              "UPDATE test_case SET fqnHash='renamedHash',json=" + update + " WHERE fqnHash='f1'");
        });
    assertEquals(null, table(jdbi, "f1"));
    assertEquals("renamed", table(jdbi, "renamedHash"));
    assertEquals(
        true,
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT deleted FROM test_case_incident_dimension WHERE fqnHash='renamedHash'")
                    .mapTo(Boolean.class)
                    .one()));
    jdbi.useHandle(
        handle ->
            handle.execute(
                "UPDATE test_case SET json="
                    + (mysql
                        ? "JSON_SET(json,'$.deleted',FALSE)"
                        : "json || '{\"deleted\":false}'::jsonb")
                    + " WHERE fqnHash='renamedHash'"));
    assertEquals(
        false,
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT deleted FROM test_case_incident_dimension WHERE fqnHash='renamedHash'")
                    .mapTo(Boolean.class)
                    .one()));
    jdbi.useHandle(handle -> handle.execute("DELETE FROM test_case WHERE fqnHash='f2'"));
    assertEquals(null, table(jdbi, "f2"));
  }

  private void verifyRelationships(Jdbi jdbi) {
    jdbi.useHandle(
        handle -> {
          handle.execute(
              "INSERT INTO entity_relationship (fromId,toId,fromEntity,toEntity,relation,relationType) VALUES ('d1','t1','testDefinition','testCase',0,'duplicate'),('d2','t1','testDefinition','testCase',0,''),('owner','t1','user','testCase',8,'')");
        });
    assertEquals(3, definitions(jdbi));
    jdbi.useHandle(
        handle ->
            handle.execute(
                "DELETE FROM entity_relationship WHERE fromId='d1' AND relationType='duplicate'"));
    assertEquals(2, definitions(jdbi));
    jdbi.useHandle(
        handle ->
            handle.execute("UPDATE entity_relationship SET fromEntity='user' WHERE fromId='d2'"));
    assertEquals(1, definitions(jdbi));
    jdbi.useHandle(
        handle ->
            handle.execute(
                "UPDATE entity_relationship SET fromEntity='testDefinition' WHERE fromId='d2'"));
    assertEquals(2, definitions(jdbi));
    jdbi.useHandle(
        handle -> handle.execute("UPDATE entity_relationship SET deleted=TRUE WHERE fromId='d2'"));
    assertEquals(
        2, definitions(jdbi), "Grouping retains the original relationship-deletion semantics");
    jdbi.useHandle(
        handle ->
            handle.execute(
                "UPDATE entity_relationship SET fromId='d3',toId='t3',relationType='changed' WHERE fromId='d2'"));
    int changed =
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM test_case_incident_definition WHERE fromId='d3' AND toId='t3' AND relationType='changed'")
                    .mapTo(Integer.class)
                    .one());
    assertEquals(1, changed);
    assertEquals(2, definitions(jdbi));
  }

  private void verifyRollback(Jdbi jdbi, boolean mysql) {
    assertThrows(
        IllegalStateException.class,
        () ->
            jdbi.useTransaction(
                handle -> {
                  insertCase(handle, "rollback", "rollback", "rollback", false, mysql);
                  handle.execute("DELETE FROM entity_relationship WHERE fromId='d1'");
                  throw new IllegalStateException("rollback");
                }));
    assertEquals(null, table(jdbi, "rollback"));
    assertEquals(2, definitions(jdbi));
  }

  private void verifyBatches(Jdbi jdbi, boolean mysql) {
    jdbi.useTransaction(
        handle -> {
          for (int i = 0; i < 1001; i++) {
            insertCase(handle, "batch" + i, "batch" + i, "batch", false, mysql);
            handle.execute(
                "INSERT INTO entity_relationship (fromId,toId,fromEntity,toEntity,relation) VALUES ('batchdef','batch"
                    + i
                    + "','testDefinition','testCase',0)");
          }
          handle.execute("DELETE FROM test_case_incident_dimension WHERE id LIKE 'batch%'");
          handle.execute("DELETE FROM test_case_incident_definition WHERE fromId='batchdef'");
        });
    jdbi.useHandle(IncidentGroupingMigration::backfill);
    assertEquals(1003, definitions(jdbi));
    int dimensionCount =
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM test_case_incident_dimension")
                    .mapTo(Integer.class)
                    .one());
    assertEquals(1002, dimensionCount);
  }
}
