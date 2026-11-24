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

import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.ScratchDatabase;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/** Exercises the actual conditional SQL after a same-version user correction. */
@Execution(ExecutionMode.SAME_THREAD)
class ContextMemoryConditionalWriteSqlIT {
  private static final String PASSWORD = "memory-guard-test";

  @Test
  void conditionalWritesRejectConsolidatedEditsOnMysql() {
    assumeTrue(ScratchDatabase.dialect() == ConnectionType.MYSQL, "MySQL only");
    ScratchDatabase.withJdbi(jdbi -> runChecks(jdbi, true));
  }

  @Test
  void conditionalWritesRejectConsolidatedEditsOnPostgres() {
    assumeTrue(ScratchDatabase.dialect() == ConnectionType.POSTGRES, "PostgreSQL only");
    ScratchDatabase.withJdbi(jdbi -> runChecks(jdbi, false));
  }

  private void runChecks(Jdbi jdbi, boolean mysql) {
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
