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
package org.openmetadata.it.tests;

import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;

/** Applies the production DDL for capture's source tables, including generated keys and indexes. */
final class ProjectionTestSchema {
  private static final List<String> VERSIONS =
      List.of(
          "1.1.0", "1.1.5", "1.2.0", "1.4.0", "1.4.5", "1.5.0", "1.8.2", "1.9.5", "1.10.0",
          "1.11.0", "1.11.5", "1.11.8", "1.12.0", "1.12.12", "1.13.0", "2.0.3", "2.1.0", "2.2.0");
  private final ConnectionType dialect;
  private final String table;

  private ProjectionTestSchema(final RdfTestDatabase.Backend backend, final String table) {
    this.dialect =
        backend == RdfTestDatabase.Backend.MYSQL ? ConnectionType.MYSQL : ConnectionType.POSTGRES;
    this.table = table;
  }

  static void create(final Jdbi jdbi, final RdfTestDatabase.Backend backend, final String table) {
    jdbi.useHandle(handle -> new ProjectionTestSchema(backend, table).apply(handle));
  }

  private void apply(final Handle handle) {
    final String driver =
        dialect == ConnectionType.MYSQL ? "com.mysql.cj.jdbc.Driver" : "org.postgresql.Driver";
    apply(handle, "flyway/" + driver + "/v001__create_db_connection_info.sql");
    apply(handle, "flyway/" + driver + "/v009__create_db_connection_info.sql");
    if (dialect == ConnectionType.POSTGRES) {
      handle.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    }
    for (final String version : VERSIONS) {
      final String directory =
          "native/" + version + "/" + dialect.name().toLowerCase(Locale.ROOT) + "/";
      apply(handle, directory + "schemaChanges.sql");
      if (version.equals("1.1.0")) {
        apply(handle, directory + "postDataMigrationSQLScript.sql");
      }
    }
  }

  private void apply(final Handle handle, final String relative) {
    final Path path =
        RdfTestDatabase.repositoryRoot().resolve("bootstrap/sql/migrations/" + relative);
    MigrationFile.parseSQLFile(path.toFile(), dialect).stream()
        .filter(this::belongsToTable)
        .forEach(handle::execute);
  }

  private boolean belongsToTable(final String sql) {
    final String ddl = sql.replaceAll("(?m)--[^\\n]*", "").strip();
    return Pattern.compile(
                "^(?:CREATE TABLE(?: IF NOT EXISTS)?|ALTER TABLE)\\s+" + table + "\\b",
                Pattern.CASE_INSENSITIVE)
            .matcher(ddl)
            .find()
        || Pattern.compile(
                "^CREATE (?:UNIQUE |FULLTEXT )?INDEX\\b.*?\\bON\\s+" + table + "\\s*\\(",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL)
            .matcher(ddl)
            .find()
        || Pattern.compile(
                "^DROP INDEX(?: CONCURRENTLY)?(?: IF EXISTS)?\\s+(?:idx_|index_)?"
                    + table
                    + "_[a-z0-9_]+\\b",
                Pattern.CASE_INSENSITIVE)
            .matcher(ddl)
            .find()
        || (table.equals("storage_container_entity")
            && ddl.contains("container_parent_")
            && ddl.matches("(?s)^(?:SET|PREPARE|EXECUTE|DEALLOCATE) .*"))
        || (table.equals("entity_relationship")
            && ddl.contains("metric_group_membership_")
            && ddl.matches("(?s)^(?:SET|PREPARE|EXECUTE|DEALLOCATE) .*"));
  }
}
