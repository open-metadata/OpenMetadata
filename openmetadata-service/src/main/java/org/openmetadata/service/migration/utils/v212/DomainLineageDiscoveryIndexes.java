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

package org.openmetadata.service.migration.utils.v212;

import java.util.List;
import java.util.Optional;
import org.jdbi.v3.core.Handle;

/**
 * Postgres prefix indexes for the tables a container's domain change scans with {@code fqnHash
 * LIKE 'hash.%'} to find its lineage-bearing descendants
 * (ADR:2026-11-20-a-domain-lineage-edge-counts-the-edges-its-domains-assets-hold-in-effect). The
 * default-opclass fqnHash indexes cannot serve that under a non-C collation, so these seven tables,
 * left out of the 1.13.0 {@code *_fqnhash_pattern} set, would be scanned whole on every such write.
 * {@code test_suite} is the large one: it holds a basic suite per table. MySQL's fqnHash btree
 * already serves a constant prefix.
 *
 * <p>Built here rather than in schemaChanges.sql, per
 * ADR:2026-10-22-guarded-index-ddl-runs-from-a-java-data-migration: an interrupted CONCURRENTLY
 * build leaves an INVALID index that IF NOT EXISTS would skip on every retry, so each index is
 * checked first and an invalid one is dropped and built again.
 */
public final class DomainLineageDiscoveryIndexes {

  public static final String STEP_NAME = "addDomainLineageDiscoveryIndexes";

  /** One index: its name and the table whose fqnHash it covers. */
  record PrefixIndex(String name, String table) {}

  static final List<PrefixIndex> INDEXES =
      List.of(
          new PrefixIndex("idx_stored_procedure_entity_fqnhash_pattern", "stored_procedure_entity"),
          new PrefixIndex("idx_pipeline_entity_fqnhash_pattern", "pipeline_entity"),
          new PrefixIndex("idx_llm_model_entity_fqnhash_pattern", "llm_model_entity"),
          new PrefixIndex("idx_mcp_server_entity_fqnhash_pattern", "mcp_server_entity"),
          new PrefixIndex("idx_test_suite_fqnhash_pattern", "test_suite"),
          new PrefixIndex("idx_tag_fqnhash_pattern", "tag"),
          new PrefixIndex(
              "idx_ai_framework_control_entity_fqnhash_pattern", "ai_framework_control_entity"));

  private static final String INDEX_IS_VALID =
      """
      SELECT i.indisvalid FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema() AND c.relname = :name
      """;

  private DomainLineageDiscoveryIndexes() {}

  public static void addOnPostgres(final Handle handle) {
    INDEXES.forEach(index -> add(handle, index));
  }

  // CONCURRENTLY takes no write lock; it needs autocommit, which the migration handle has.
  private static void add(final Handle handle, final PrefixIndex index) {
    final Optional<Boolean> validity =
        handle
            .createQuery(INDEX_IS_VALID)
            .bind("name", index.name())
            .mapTo(Boolean.class)
            .findOne();
    final boolean isValid = validity.orElse(false);
    if (validity.isPresent() && !isValid) {
      handle.execute("DROP INDEX CONCURRENTLY IF EXISTS " + index.name());
    }
    if (!isValid) {
      handle.execute(
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS "
              + index.name()
              + " ON "
              + index.table()
              + " (fqnHash text_pattern_ops)");
    }
  }
}
