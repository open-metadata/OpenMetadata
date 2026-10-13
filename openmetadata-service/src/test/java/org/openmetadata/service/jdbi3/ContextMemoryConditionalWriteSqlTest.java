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

import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Exercises the actual conditional SQL after a same-version user correction. */
@Testcontainers(disabledWithoutDocker = true)
@Execution(ExecutionMode.SAME_THREAD)
class ContextMemoryConditionalWriteSqlTest {
  private static final String DATABASE = "memory_guard";
  private static final String PASSWORD = "memory-guard-test";

  @Test
  void conditionalWritesRejectConsolidatedEditsOnMysql() {
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
      runChecks(url, "root", "com.mysql.cj.jdbc.Driver", true);
    }
  }

  @Test
  void conditionalWritesRejectConsolidatedEditsOnPostgres() {
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
      runChecks(url, "postgres", "org.postgresql.Driver", false);
    }
  }

  private void runChecks(String url, String username, String driver, boolean mysql) {
    Jdbi jdbi = Jdbi.create(url, username, PASSWORD);
    jdbi.installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlObjects.class).setSqlLocator(new ConnectionAwareAnnotationSqlLocator(driver));
    ContextMemory snapshot = memorySnapshot();
    ContextMemory corrected =
        JsonUtils.deepCopy(snapshot, ContextMemory.class)
            .withUpdatedAt(101L)
            .withAnswer("Corrected claim");
    seedCorrectedMemory(jdbi, mysql, corrected);
    assertConditionalWrites(jdbi, snapshot, corrected);
  }

  private void assertConditionalWrites(Jdbi jdbi, ContextMemory snapshot, ContextMemory corrected) {
    CollectionDAO.ContextMemoryDAO dao = jdbi.onDemand(CollectionDAO.ContextMemoryDAO.class);
    ContextMemory approved =
        JsonUtils.deepCopy(corrected, ContextMemory.class)
            .withVersion(0.3)
            .withUpdatedAt(102L)
            .withEntityStatus(ContextMemoryStatus.APPROVED);
    assertEquals(0, writeLifecycle(dao, approved, snapshot));
    assertEquals(corrected, readMemory(jdbi, snapshot.getId()));
    assertEquals(1, writeLifecycle(dao, approved, corrected));
    assertEquals(approved, readMemory(jdbi, snapshot.getId()));
  }

  private ContextMemory memorySnapshot() {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName("memory")
        .withFullyQualifiedName("memory")
        .withVersion(0.2)
        .withUpdatedAt(100L)
        .withAnswer("Old claim")
        .withEntityStatus(ContextMemoryStatus.UNPROCESSED);
  }

  private void seedCorrectedMemory(Jdbi jdbi, boolean mysql, ContextMemory corrected) {
    String jsonType = mysql ? "JSON" : "JSONB";
    String jsonValue = mysql ? "CAST(:json AS JSON)" : ":json::jsonb";
    jdbi.useHandle(
        handle -> {
          handle.execute(
              "CREATE TABLE context_memory (id VARCHAR(36) PRIMARY KEY, nameHash VARCHAR(256), json "
                  + jsonType
                  + " NOT NULL)");
          handle
              .createUpdate("INSERT INTO context_memory VALUES (:id, :nameHash, " + jsonValue + ")")
              .bind("id", corrected.getId().toString())
              .bind("nameHash", corrected.getFullyQualifiedName())
              .bind("json", JsonUtils.pojoToJson(corrected))
              .execute();
        });
  }

  private int writeLifecycle(
      CollectionDAO.ContextMemoryDAO dao, ContextMemory updated, ContextMemory snapshot) {
    return dao.updateWithVersionAndTimestamp(
        snapshot.getId(),
        snapshot.getFullyQualifiedName(),
        JsonUtils.pojoToJson(updated),
        snapshot.getVersion().toString(),
        snapshot.getUpdatedAt());
  }

  private ContextMemory readMemory(Jdbi jdbi, UUID id) {
    return jdbi.withHandle(
        handle ->
            JsonUtils.readValue(
                handle
                    .createQuery("SELECT json FROM context_memory WHERE id = :id")
                    .bind("id", id.toString())
                    .mapTo(String.class)
                    .one(),
                ContextMemory.class));
  }
}
