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

package org.openmetadata.service.migration.utils.v2010;

import java.util.Optional;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

public final class LogicalTestSuitePipelineMigration {
  private static final String MYSQL_INDEX_EXISTS =
      """
      SELECT COUNT(*) FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'test_suite'
        AND index_name = 'idx_test_suite_id'
      """;
  // InnoDB builds a secondary index in place and keeps accepting writes meanwhile.
  private static final String MYSQL_ADD_INDEX = "CREATE INDEX idx_test_suite_id ON test_suite (id)";

  private static final String POSTGRES_INDEX_IS_VALID =
      """
      SELECT i.indisvalid FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema() AND c.relname = 'idx_test_suite_id'
      """;
  private static final String POSTGRES_DROP_INVALID_INDEX =
      "DROP INDEX CONCURRENTLY IF EXISTS idx_test_suite_id";
  // CONCURRENTLY takes no write lock; it needs autocommit, which the migration handle has.
  private static final String POSTGRES_ADD_INDEX =
      """
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_suite_id
        ON test_suite (id)
      """;

  private static final String MYSQL_CLEANUP =
      """
      UPDATE entity_relationship AS relationship
      JOIN test_suite AS suite ON suite.id = relationship.fromId
      JOIN ingestion_pipeline_entity AS pipeline ON pipeline.id = relationship.toId
      SET pipeline.json = JSON_REMOVE(pipeline.json, '$.sourceConfig.config.entityFullyQualifiedName')
      WHERE relationship.fromEntity = 'testSuite'
        AND relationship.toEntity = 'ingestionPipeline'
        AND relationship.relation = 0
        AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(suite.json, '$.basic')), 'false') <> 'true'
        AND JSON_UNQUOTE(JSON_EXTRACT(pipeline.json, '$.pipelineType')) = 'TestSuite'
        AND JSON_CONTAINS_PATH(pipeline.json, 'one', '$.sourceConfig.config.entityFullyQualifiedName')
      """;

  private static final String POSTGRES_CLEANUP =
      """
      UPDATE ingestion_pipeline_entity AS pipeline
      SET json = pipeline.json::jsonb #- '{sourceConfig,config,entityFullyQualifiedName}'
      FROM entity_relationship AS relationship
      JOIN test_suite AS suite ON suite.id = relationship.fromId
      WHERE pipeline.id = relationship.toId
        AND relationship.fromEntity = 'testSuite'
        AND relationship.toEntity = 'ingestionPipeline'
        AND relationship.relation = 0
        AND (suite.json ->> 'basic') IS DISTINCT FROM 'true'
        AND pipeline.json ->> 'pipelineType' = 'TestSuite'
        AND pipeline.json::jsonb #> '{sourceConfig,config,entityFullyQualifiedName}' IS NOT NULL
      """;

  private LogicalTestSuitePipelineMigration() {}

  public static void migrate(final Handle handle, final ConnectionType connectionType) {
    if (connectionType == ConnectionType.MYSQL) {
      addOnMySql(handle);
      handle.execute(MYSQL_CLEANUP);
    } else {
      addOnPostgres(handle);
      handle.execute(POSTGRES_CLEANUP);
    }
  }

  private static void addOnMySql(final Handle handle) {
    final boolean exists = handle.createQuery(MYSQL_INDEX_EXISTS).mapTo(Integer.class).one() > 0;
    if (!exists) {
      handle.execute(MYSQL_ADD_INDEX);
    }
  }

  private static void addOnPostgres(final Handle handle) {
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
