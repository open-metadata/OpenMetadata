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

package org.openmetadata.service.migration.utils.v208;

import java.util.Optional;
import org.jdbi.v3.core.Handle;

/**
 * Adds idx_audit_log_entity_type_ts before the 2.0.8 post-data script, whose audit_log_event
 * cleanup filters on {@code entity_type = 'user'}. Without the index each of those UPDATEs scans
 * the whole table, which takes hours on a large audit log.
 *
 * <p>Same name and columns as the index 2.1.0 adds, so 2.1.0 finds it and skips its own. Runs from
 * the Java migration per ADR:2026-10-22-guarded-index-ddl-runs-from-a-java-data-migration, so the
 * released 2.0.8 SQL is unchanged and no database that already ran it replays anything. Each step
 * checks the catalog first; on PostgreSQL an INVALID index left by an interrupted concurrent build
 * is dropped and built again.
 */
public final class AuditLogEntityTypeIndex {
  public static final String STEP_NAME = "auditLogEntityTypeIndex";

  private static final String MYSQL_INDEX_EXISTS =
      """
      SELECT COUNT(*) FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'audit_log_event'
        AND index_name = 'idx_audit_log_entity_type_ts'
      """;
  // InnoDB builds a secondary index in place and keeps accepting writes meanwhile.
  private static final String MYSQL_ADD_INDEX =
      "CREATE INDEX idx_audit_log_entity_type_ts ON audit_log_event (entity_type, event_ts DESC)";

  private static final String POSTGRES_INDEX_IS_VALID =
      """
      SELECT i.indisvalid FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema() AND c.relname = 'idx_audit_log_entity_type_ts'
      """;
  private static final String POSTGRES_DROP_INVALID_INDEX =
      "DROP INDEX CONCURRENTLY IF EXISTS idx_audit_log_entity_type_ts";
  // CONCURRENTLY takes no write lock; it needs autocommit, which the migration handle has.
  private static final String POSTGRES_ADD_INDEX =
      """
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_entity_type_ts
        ON audit_log_event (entity_type, event_ts DESC)
      """;

  private AuditLogEntityTypeIndex() {}

  public static void addOnMySql(final Handle handle) {
    final boolean exists = handle.createQuery(MYSQL_INDEX_EXISTS).mapTo(Integer.class).one() > 0;
    if (!exists) {
      handle.execute(MYSQL_ADD_INDEX);
    }
  }

  public static void addOnPostgres(final Handle handle) {
    final Optional<Boolean> indexValidity =
        handle.createQuery(POSTGRES_INDEX_IS_VALID).mapTo(Boolean.class).findOne();
    final boolean isValid = indexValidity.orElse(false);
    if (indexValidity.isPresent() && !isValid) {
      handle.execute(POSTGRES_DROP_INVALID_INDEX);
    }
    if (!isValid) {
      handle.execute(POSTGRES_ADD_INDEX);
    }
  }
}
