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

package org.openmetadata.it.tests.ontology;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.function.Consumer;
import org.jdbi.v3.core.Handle;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.ScratchDatabase;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.approval.GovernanceApprovalRegistry;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRelationshipRepository;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;

public final class OntologyTestDatabase {
  private OntologyTestDatabase() {}

  public static void withDatabase(Consumer<Handle> assertion) {
    ScratchDatabase.withJdbi(
        jdbi -> {
          // An explicitly opened handle is not bound to the thread, so DAOs attached from other
          // threads or configured after the handle opened see their own connections and config.
          try (Handle handle = jdbi.open()) {
            assertion.accept(handle);
          }
        });
  }

  public static void withRepositories(Handle handle, Runnable assertion) {
    final var registry = EntityRegistrySnapshot.capture();
    try (OntologyFixtureWork work = new OntologyFixtureWork()) {
      Entity.setJdbi(handle.getJdbi());
      Entity.setCollectionDAO(handle.getJdbi().onDemand(CollectionDAO.class));
      Entity.setEntityRelationshipRepository(
          new EntityRelationshipRepository(Entity.getCollectionDAO()));
      new SystemRepository();
      new WorkflowDefinitionRepository();
      GovernanceApprovalRegistry.invalidate();
      assertion.run();
    } finally {
      GovernanceApprovalRegistry.invalidate();
      registry.restore();
    }
  }

  public static String user() {
    return ScratchDatabase.dialect() == ConnectionType.MYSQL
        ? "root"
        : TestSuiteBootstrap.getDatabaseContainer().getUsername();
  }

  public static String password() {
    return TestSuiteBootstrap.getDatabaseContainer().getPassword();
  }

  public static void migrateRepositoryTables(Handle handle, ConnectionType dialect) {
    Path sqlDirectory =
        repositoryRoot().resolve("bootstrap/sql/migrations/flyway").resolve(dialect.label);
    for (String migration :
        List.of("v001__create_db_connection_info.sql", "v004__create_db_connection_info.sql")) {
      MigrationFile.parseSQLFile(sqlDirectory.resolve(migration).toFile(), dialect).stream()
          .filter(
              statement ->
                  statement.matches(
                      "(?s).*CREATE TABLE IF NOT EXISTS (entity_relationship|entity_extension|openmetadata_settings|tag_usage|tag|glossary_entity|glossary_term_entity|change_event|user_entity) \\(.*"))
          .forEach(handle::execute);
    }
    for (String version : List.of("1.6.0", "2.0.0", "2.1.0")) {
      Path migration =
          repositoryRoot()
              .resolve("bootstrap/sql/migrations/native")
              .resolve(version)
              .resolve(dialect == ConnectionType.MYSQL ? "mysql" : "postgres")
              .resolve("schemaChanges.sql");
      MigrationFile.parseSQLFile(migration.toFile(), dialect).stream()
          .filter(
              statement ->
                  statement.matches(
                      "(?s).*CREATE TABLE IF NOT EXISTS (workflow_definition_entity|task_entity|custom_property_reference|ontology_axiom_entity|ontology_change_set_entity|change_request) \\(.*"))
          .forEach(handle::execute);
    }
    migrateTableColumns(handle, dialect, "1.13.0", "entity_relationship", "relationType");
    migrateTableColumns(handle, dialect, "1.1.0", "tag_usage", "tagFQNHash");
    migrateTableColumns(handle, dialect, "1.1.0", "tag", "fqnHash");
    migrateTableColumns(handle, dialect, "1.1.0", "glossary_term_entity", "fqnHash");
    migrateTableColumns(handle, dialect, "1.1.0", "user_entity", "nameHash");
    migrateTableColumns(handle, dialect, "1.10.0", "tag_usage", "reason");
    migrateTableColumns(handle, dialect, "1.11.0", "tag_usage", "targetfqnhash_lower");
    migrateTableColumns(handle, dialect, "1.11.5", "tag_usage", "appliedAt");
    migrateTableColumns(handle, dialect, "1.12.0", "tag_usage", "metadata");
  }

  private static void migrateTableColumns(
      Handle handle, ConnectionType dialect, String version, String table, String column) {
    int existing =
        handle
            .createQuery(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = :table"
                    + " AND lower(column_name) = :column AND table_schema = "
                    + (dialect == ConnectionType.MYSQL ? "DATABASE()" : "current_schema()"))
            .bind("table", table)
            .bind("column", column.toLowerCase(Locale.ROOT))
            .mapTo(Integer.class)
            .one();
    if (existing == 0) {
      Path migration =
          repositoryRoot()
              .resolve("bootstrap/sql/migrations/native")
              .resolve(version)
              .resolve(dialect == ConnectionType.MYSQL ? "mysql" : "postgres")
              .resolve("schemaChanges.sql");
      MigrationFile.parseSQLFile(migration.toFile(), dialect).stream()
          .filter(statement -> statement.matches("(?s).*ALTER TABLE " + table + "\\s.*"))
          .forEach(handle::execute);
      if (table.equals("tag_usage") && version.equals("1.1.0")) {
        MigrationFile.parseSQLFile(
                migration.resolveSibling("postDataMigrationSQLScript.sql").toFile(), dialect)
            .stream()
            .filter(statement -> statement.matches("(?s).*ALTER TABLE tag_usage\\s.*"))
            .forEach(handle::execute);
      }
    }
  }

  public static void migrate(Handle handle, ConnectionType dialect) {
    migrateRepositoryTables(handle, dialect);
    Path migration =
        repositoryRoot()
            .resolve("bootstrap/sql/migrations/native/2.1.0")
            .resolve(dialect == ConnectionType.MYSQL ? "mysql" : "postgres")
            .resolve("schemaChanges.sql");
    // Only ontology statements: the rest of the file needs tables this database lacks.
    MigrationFile.parseSQLFile(migration.toFile(), dialect).stream()
        .dropWhile(statement -> !statement.contains("CREATE TABLE IF NOT EXISTS ontology_entity ("))
        .filter(statement -> statement.toLowerCase(Locale.ROOT).contains("ontology"))
        .forEach(handle::execute);
  }

  public static Path repositoryRoot() {
    Path root = Path.of("").toAbsolutePath();
    while (root != null && !Files.isDirectory(root.resolve("bootstrap/sql"))) {
      root = root.getParent();
    }
    if (root == null) {
      throw new IllegalStateException("Cannot locate SQL migrations");
    }
    return root;
  }
}
