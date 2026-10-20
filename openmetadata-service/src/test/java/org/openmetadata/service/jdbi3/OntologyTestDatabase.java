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

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.function.Consumer;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;

final class OntologyTestDatabase {
  private static final String DATABASE = "ontology_entities";
  static final String PASSWORD = "ontology-storage-test";

  private OntologyTestDatabase() {}

  static void withDatabase(ConnectionType dialect, Consumer<Handle> assertion) {
    String externalUrl =
        System.getProperty("ontology.test." + dialect.name().toLowerCase(Locale.ROOT) + ".url");
    if (externalUrl != null) {
      try (Handle handle = openHandle(Jdbi.create(externalUrl), dialect)) {
        assertion.accept(handle);
      }
      return;
    }
    try (GenericContainer<?> database = database(dialect)) {
      database.start();
      try (Handle handle = connect(database, dialect)) {
        assertion.accept(handle);
      }
    }
  }

  private static GenericContainer<?> database(ConnectionType dialect) {
    return dialect == ConnectionType.MYSQL
        ? new GenericContainer<>("mysql:8.0")
            .withEnv("MYSQL_DATABASE", DATABASE)
            .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
            .withEnv("MYSQL_ROOT_HOST", "%")
            .withExposedPorts(3306)
            .waitingFor(Wait.forLogMessage(".*ready for connections.*port: 3306.*\\n", 1))
        : new GenericContainer<>("postgres:15")
            .withEnv("POSTGRES_DB", DATABASE)
            .withEnv("POSTGRES_PASSWORD", PASSWORD)
            .withExposedPorts(5432)
            .waitingFor(
                Wait.forLogMessage(".*database system is ready to accept connections.*\\n", 2));
  }

  private static Handle connect(GenericContainer<?> database, ConnectionType dialect) {
    boolean mysql = dialect == ConnectionType.MYSQL;
    String url =
        "jdbc:%s://%s:%d/%s%s"
            .formatted(
                mysql ? "mysql" : "postgresql",
                database.getHost(),
                database.getMappedPort(mysql ? 3306 : 5432),
                DATABASE,
                mysql
                    ? "?allowPublicKeyRetrieval=true&useSSL=false&connectTimeout=5000&socketTimeout=30000"
                    : "");
    return openHandle(Jdbi.create(url, mysql ? "root" : "postgres", PASSWORD), dialect);
  }

  private static Handle openHandle(Jdbi jdbi, ConnectionType dialect) {
    jdbi.installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlStatements.class).setUnusedBindingAllowed(true);
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(new ConnectionAwareAnnotationSqlLocator(dialect.label));
    return jdbi.open();
  }

  static void migrateRepositoryTables(Handle handle, ConnectionType dialect) {
    Path sqlDirectory =
        repositoryRoot().resolve("bootstrap/sql/migrations/flyway").resolve(dialect.label);
    for (String migration :
        List.of("v001__create_db_connection_info.sql", "v004__create_db_connection_info.sql")) {
      MigrationFile.parseSQLFile(sqlDirectory.resolve(migration).toFile(), dialect).stream()
          .filter(
              statement ->
                  statement.matches(
                      "(?s).*CREATE TABLE IF NOT EXISTS (entity_relationship|entity_extension|openmetadata_settings|tag_usage|tag|glossary_entity|glossary_term_entity|change_event) \\(.*"))
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
    migrateBackgroundJobs(handle, dialect);
    migrateTableColumns(handle, dialect, "1.13.0", "entity_relationship", "relationType");
    migrateTableColumns(handle, dialect, "1.1.0", "tag_usage", "tagFQNHash");
    migrateTableColumns(handle, dialect, "1.1.0", "tag", "fqnHash");
    migrateTableColumns(handle, dialect, "1.1.0", "glossary_term_entity", "fqnHash");
    migrateTableColumns(handle, dialect, "1.10.0", "tag_usage", "reason");
    migrateTableColumns(handle, dialect, "1.11.0", "tag_usage", "targetfqnhash_lower");
    migrateTableColumns(handle, dialect, "1.11.5", "tag_usage", "appliedAt");
    migrateTableColumns(handle, dialect, "1.12.0", "tag_usage", "metadata");
  }

  private static void migrateBackgroundJobs(Handle handle, ConnectionType dialect) {
    Path migration =
        repositoryRoot()
            .resolve("bootstrap/sql/migrations/native/1.6.2")
            .resolve(dialect == ConnectionType.MYSQL ? "mysql" : "postgres")
            .resolve("schemaChanges.sql");
    MigrationFile.parseSQLFile(migration.toFile(), dialect).stream()
        .filter(statement -> statement.contains("CREATE TABLE background_jobs ("))
        .map(
            statement ->
                statement.replace(
                    "CREATE TABLE background_jobs (",
                    "CREATE TABLE IF NOT EXISTS background_jobs ("))
        .forEach(handle::execute);
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

  static void migrate(Handle handle, ConnectionType dialect) {
    migrateRepositoryTables(handle, dialect);
    Path migration =
        repositoryRoot()
            .resolve("bootstrap/sql/migrations/native/2.1.0")
            .resolve(dialect == ConnectionType.MYSQL ? "mysql" : "postgres")
            .resolve("schemaChanges.sql");
    MigrationFile.parseSQLFile(migration.toFile(), dialect).stream()
        .dropWhile(statement -> !statement.contains("CREATE TABLE IF NOT EXISTS ontology_entity ("))
        .forEach(handle::execute);
  }

  static Path repositoryRoot() {
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
