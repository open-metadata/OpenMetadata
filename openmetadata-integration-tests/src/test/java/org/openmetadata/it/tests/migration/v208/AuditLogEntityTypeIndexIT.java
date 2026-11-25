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

package org.openmetadata.it.tests.migration.v208;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.ScratchDatabase;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v208.AuditLogEntityTypeIndex;

/**
 * Adds the audit log entity-type index on the shipped audit_log_event table, runs again without
 * error, and leaves 2.1.0's own statement for the same index with nothing to do.
 */
@Execution(ExecutionMode.SAME_THREAD)
class AuditLogEntityTypeIndexIT {
  private static final String DATABASE = "audit_log_index";
  private static final String INDEX = "idx_audit_log_entity_type_ts";

  @Test
  void addsTheIndexOnceOnMysql() {
    assumeTrue(ScratchDatabase.dialect() == ConnectionType.MYSQL, "MySQL only");
    ScratchDatabase.withDatabase(
        handle -> {
          handle.execute(
              """
            CREATE TABLE audit_log_event (
              id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
              event_ts BIGINT NOT NULL,
              entity_type VARCHAR(128) DEFAULT NULL,
              event_json LONGTEXT NOT NULL,
              KEY idx_audit_log_event_ts (event_ts DESC)
            )""");

          AuditLogEntityTypeIndex.addOnMySql(handle);
          AuditLogEntityTypeIndex.addOnMySql(handle);
          // The guard 2.1.0's schemaChanges.sql runs before creating the same index.
          handle.execute(
              """
            SET @ddl = (SELECT IF(EXISTS (SELECT 1 FROM information_schema.statistics
              WHERE table_schema = DATABASE() AND table_name = 'audit_log_event'
              AND index_name = 'idx_audit_log_entity_type_ts'), 'SELECT 1',
              'CREATE INDEX idx_audit_log_entity_type_ts ON audit_log_event (entity_type, event_ts DESC)'))""");
          handle.execute("PREPARE stmt FROM @ddl");
          handle.execute("EXECUTE stmt");

          assertEquals(
              "entity_type:A,event_ts:D",
              handle
                  .createQuery(
                      """
                    SELECT GROUP_CONCAT(column_name, ':', collation ORDER BY seq_in_index)
                    FROM information_schema.statistics
                    WHERE table_schema = DATABASE() AND table_name = 'audit_log_event'
                      AND index_name = :index
                    """)
                  .bind("index", INDEX)
                  .mapTo(String.class)
                  .one());
        });
  }

  @Test
  void addsTheIndexOnceAndRebuildsAnInvalidOneOnPostgres() {
    assumeTrue(ScratchDatabase.dialect() == ConnectionType.POSTGRES, "PostgreSQL only");
    ScratchDatabase.withDatabase(
        handle -> {
          handle.execute(
              """
            CREATE TABLE audit_log_event (
              id BIGSERIAL PRIMARY KEY,
              event_ts BIGINT NOT NULL,
              entity_type VARCHAR(128),
              event_json TEXT NOT NULL
            )""");

          AuditLogEntityTypeIndex.addOnPostgres(handle);
          AuditLogEntityTypeIndex.addOnPostgres(handle);
          assertTrue(isValid(handle));

          // What an interrupted CONCURRENTLY build leaves behind.
          handle.execute(
              "UPDATE pg_index SET indisvalid = false WHERE indexrelid = '"
                  + INDEX
                  + "'::regclass");
          AuditLogEntityTypeIndex.addOnPostgres(handle);
          assertTrue(isValid(handle));

          // 2.1.0's schemaChanges.sql statement for the same index.
          handle.execute(
              "CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type_ts ON audit_log_event (entity_type, event_ts DESC)");

          assertEquals(
              "CREATE INDEX idx_audit_log_entity_type_ts ON public.audit_log_event USING btree (entity_type, event_ts DESC)",
              handle
                  .createQuery("SELECT indexdef FROM pg_indexes WHERE indexname = :index")
                  .bind("index", INDEX)
                  .mapTo(String.class)
                  .one());
        });
  }

  private static boolean isValid(Handle handle) {
    return handle
        .createQuery(
            "SELECT i.indisvalid FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = :index")
        .bind("index", INDEX)
        .mapTo(Boolean.class)
        .one();
  }
}
