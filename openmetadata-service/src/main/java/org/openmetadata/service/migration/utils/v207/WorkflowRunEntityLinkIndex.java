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

import org.jdbi.v3.core.Handle;

/**
 * Adds the MySQL half of idx_wf_instance_entity_link: the entityLinkHash VIRTUAL column and the
 * index over it. The PostgreSQL half is an expression index in 2.0.7/postgres/schemaChanges.sql.
 *
 * <p>This runs from Java rather than as SET/PREPARE/EXECUTE in schemaChanges.sql because the
 * migration runner records each SQL statement once it succeeds and skips it on a retry: an EXECUTE
 * that failed or was interrupted would rerun in a fresh session without its PREPARE and fail on
 * every retry. Each step here checks information_schema first, so a rerun carries on from wherever
 * the previous attempt stopped. See ADR:2026-10-22-governance-workflow-runs-keep-each-entitys-latest-run.
 */
public final class WorkflowRunEntityLinkIndex {

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

  private WorkflowRunEntityLinkIndex() {}

  public static void addOnMySql(final Handle handle) {
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
