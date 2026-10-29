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
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryOutcomes;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Exercises the outcome write and the metadata writes that must keep its counts, on both engines
 * (ADR:2026-10-14-memory-outcome-counters-are-recounted-telemetry).
 */
@Testcontainers(disabledWithoutDocker = true)
@Execution(ExecutionMode.SAME_THREAD)
class ContextMemoryOutcomeWriteSqlTest {
  private static final String DATABASE = "memory_outcomes";
  private static final String PASSWORD = "memory-outcomes-test";

  @Test
  void outcomeWritesAreAbsoluteMonotonicAndKeptByMetadataWritesOnMysql() {
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
  void outcomeWritesAreAbsoluteMonotonicAndKeptByMetadataWritesOnPostgres() {
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
    createTable(jdbi, mysql);
    CollectionDAO.ContextMemoryDAO dao = jdbi.onDemand(CollectionDAO.ContextMemoryDAO.class);
    ContextMemory memory = seed(jdbi, mysql, memory(), false);

    aRecountReplacesTheCountsAndKeepsEverythingElse(jdbi, dao, memory);
    anOlderRecountNeverOverwritesANewerOne(jdbi, dao, memory);
    metadataWritesKeepTheStoredCounts(jdbi, dao, memory);
    aDeletedMemoryIsNotCounted(jdbi, mysql, dao);
  }

  private void aRecountReplacesTheCountsAndKeepsEverythingElse(
      Jdbi jdbi, CollectionDAO.ContextMemoryDAO dao, ContextMemory memory) {
    assertEquals(1, write(dao, memory.getId(), counts(4, 200L)));
    assertEquals(1, write(dao, memory.getId(), counts(7, 300L)));

    ContextMemory stored = read(jdbi, memory.getId());
    assertEquals(counts(7, 300L), stored.getOutcomes());
    assertEquals(memory.withOutcomes(counts(7, 300L)), stored);
  }

  private void anOlderRecountNeverOverwritesANewerOne(
      Jdbi jdbi, CollectionDAO.ContextMemoryDAO dao, ContextMemory memory) {
    assertEquals(0, write(dao, memory.getId(), counts(2, 250L)));
    assertEquals(1, write(dao, memory.getId(), counts(7, 300L)), "a retry of the same recount");
    assertEquals(counts(7, 300L), read(jdbi, memory.getId()).getOutcomes());
  }

  private void metadataWritesKeepTheStoredCounts(
      Jdbi jdbi, CollectionDAO.ContextMemoryDAO dao, ContextMemory memory) {
    ContextMemory forged =
        read(jdbi, memory.getId()).withAnswer("Edited claim").withOutcomes(counts(999, 999L));
    assertEquals(
        1,
        dao.updatePreservingUsage(
            memory.getId(), memory.getFullyQualifiedName(), JsonUtils.pojoToJson(forged)));

    ContextMemory stored = read(jdbi, memory.getId());
    assertEquals("Edited claim", stored.getAnswer());
    assertEquals(counts(7, 300L), stored.getOutcomes());
  }

  private void aDeletedMemoryIsNotCounted(
      Jdbi jdbi, boolean mysql, CollectionDAO.ContextMemoryDAO dao) {
    ContextMemory deleted = seed(jdbi, mysql, memory().withName("deleted"), true);
    assertEquals(0, write(dao, deleted.getId(), counts(1, 100L)));
    assertNull(read(jdbi, deleted.getId()).getOutcomes());
  }

  private static MemoryOutcomes counts(int applied, long countedAt) {
    return new MemoryOutcomes()
        .withAppliedCount(applied)
        .withPositiveCount(1)
        .withNegativeCount(2)
        .withCorrectedCount(3)
        .withLastAppliedAt(countedAt - 10)
        .withLastCorrectedAt(countedAt - 20)
        .withCountedAt(countedAt);
  }

  private static int write(CollectionDAO.ContextMemoryDAO dao, UUID id, MemoryOutcomes outcomes) {
    return dao.recordOutcomes(id, JsonUtils.pojoToJson(outcomes), outcomes.getCountedAt());
  }

  private static ContextMemory memory() {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName("memory")
        .withFullyQualifiedName("memory")
        .withVersion(0.2)
        .withUpdatedAt(100L)
        .withAnswer("Old claim")
        .withUsageCount(5)
        .withEntityStatus(ContextMemoryStatus.APPROVED);
  }

  private static void createTable(Jdbi jdbi, boolean mysql) {
    String jsonType = mysql ? "JSON" : "JSONB";
    jdbi.useHandle(
        handle ->
            handle.execute(
                "CREATE TABLE context_memory (id VARCHAR(36) PRIMARY KEY, nameHash VARCHAR(256), "
                    + "json "
                    + jsonType
                    + " NOT NULL, deleted BOOLEAN NOT NULL)"));
  }

  private static ContextMemory seed(
      Jdbi jdbi, boolean mysql, ContextMemory memory, boolean deleted) {
    String jsonValue = mysql ? "CAST(:json AS JSON)" : ":json::jsonb";
    jdbi.useHandle(
        handle ->
            handle
                .createUpdate(
                    "INSERT INTO context_memory VALUES (:id, :nameHash, "
                        + jsonValue
                        + ", :deleted)")
                .bind("id", memory.getId().toString())
                .bind("nameHash", memory.getName())
                .bind("json", JsonUtils.pojoToJson(memory))
                .bind("deleted", deleted)
                .execute());
    return memory;
  }

  private static ContextMemory read(Jdbi jdbi, UUID id) {
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
