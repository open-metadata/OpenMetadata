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

package org.openmetadata.service.migration.utils.v207;

import java.util.Optional;
import org.jdbi.v3.core.Handle;

/**
 * Adds idx_wf_instance_entity_link, which keys workflow runs by the md5 of their entityLink: an
 * expression index on PostgreSQL, an index over the entityLinkHash VIRTUAL column on MySQL.
 *
 * <p>Both run from the 2.0.7 Java migrations rather than schemaChanges.sql, per
 * ADR:2026-10-22-guarded-index-ddl-runs-from-a-java-data-migration: every step checks the catalog
 * first, so a rerun carries on from wherever an interrupted attempt stopped. On PostgreSQL that
 * includes an interrupted CONCURRENTLY build, which leaves an INVALID index that IF NOT EXISTS
 * alone would skip forever; it is dropped and rebuilt instead.
 */
public final class MigrationUtil {

  private static final String COLUMN_EXISTS =
      """
      SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'workflow_instance_time_series'
        AND column_name = 'entityLinkHash'
      """;
  private static final String INDEX_EXISTS =
      """
      SELECT COUNT(*) FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'workflow_instance_time_series'
        AND index_name = 'idx_wf_instance_entity_link'
      """;
  // VIRTUAL, so adding the column only changes table metadata.
  private static final String ADD_COLUMN =
      """
      ALTER TABLE workflow_instance_time_series ADD COLUMN entityLinkHash CHAR(32)
        CHARACTER SET ascii COLLATE ascii_bin
        GENERATED ALWAYS AS (MD5(COALESCE(json ->> '$.variables.global_relatedEntity', ''))) VIRTUAL
      """;
  // InnoDB builds a secondary index in place and keeps accepting writes meanwhile.
  private static final String ADD_INDEX =
      """
      CREATE INDEX idx_wf_instance_entity_link
        ON workflow_instance_time_series (entityLinkHash, workflowDefinitionId, timestamp)
      """;

  private static final String POSTGRES_INDEX_IS_VALID =
      """
      SELECT i.indisvalid FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema() AND c.relname = 'idx_wf_instance_entity_link'
      """;
  private static final String POSTGRES_DROP_INVALID_INDEX =
      "DROP INDEX CONCURRENTLY IF EXISTS idx_wf_instance_entity_link";
  // CONCURRENTLY takes no write lock; it needs autocommit, which the migration handle has.
  private static final String POSTGRES_ADD_INDEX =
      """
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wf_instance_entity_link
        ON workflow_instance_time_series (md5(COALESCE(entityLink, '')), workflowDefinitionId, timestamp)
      """;

  private MigrationUtil() {}

  public static void addWorkflowRunEntityLinkIndexOnPostgres(final Handle handle) {
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

  public static void addWorkflowRunEntityLinkIndexOnMySql(final Handle handle) {
    executeUnless(handle, COLUMN_EXISTS, ADD_COLUMN);
    executeUnless(handle, INDEX_EXISTS, ADD_INDEX);
  }

  private static void executeUnless(final Handle handle, final String exists, final String ddl) {
    final boolean alreadyDone = handle.createQuery(exists).mapTo(Integer.class).one() > 0;
    if (!alreadyDone) {
      handle.execute(ddl);
    }
  }
}
