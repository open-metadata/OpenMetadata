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

package org.openmetadata.service.migration.v210;

import static java.util.Objects.requireNonNull;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * External S3 sample-data storage was removed in 2.1.0 (collate#5995), and with it the whole {@code
 * sampleDataStorageConfig} property: once the external branch was gone the field could only hold an
 * empty object, so it was dropped from every connection and profiler schema. Connection schemas set
 * {@code additionalProperties: false}, so a stored row that still carries the key stops
 * deserializing on upgrade, and the SQL backfill is the only thing that repairs those rows.
 *
 * <p>Because the property no longer exists in {@code openmetadata-spec}, the set of JSON paths a
 * stored document can hold it at is closed — no connector added later can introduce a new one.
 * {@link #PATHS_BY_TABLE} is that set as history fixed it, and the first test asserts both dialects
 * strip every entry. The second test is the other half of the guarantee: it fails if any schema
 * reintroduces the property, which would silently make that frozen inventory incomplete.
 */
class SampleDataStorageMigrationPathsTest {

  private static final String HOLDER = "sampleDataStorageConfig";

  private static final String SPEC_MODULE = "openmetadata-spec";
  private static final String SCHEMA_ROOT = "src/main/resources/json/schema";
  private static final String MIGRATION_DIR = "bootstrap/sql/migrations/native/2.1.0";
  private static final String MIGRATION_FILE = "postDataMigrationSQLScript.sql";

  /** Where a service connection sits inside the entity that stores it. */
  private static final String SERVICE = "connection.config";

  /** Test Connection persists the submitted form as an automations workflow request. */
  private static final String REQUEST = "request.connection.config";

  /**
   * Every path the removed property can occupy, per table. A connector reaches it either directly or
   * through one of three nesting properties — {@code metastoreConnection} (Hive), {@code connection}
   * (Superset, Airflow, Alation) or {@code databaseConnection} (SSIS, Wherescape) — and {@code
   * entity_extension} holds a version snapshot of every one of them.
   */
  private static final Map<String, Set<String>> PATHS_BY_TABLE =
      Map.of(
          "dbservice_entity",
          Set.of(path(SERVICE), path(SERVICE, "metastoreConnection")),
          "dashboard_service_entity",
          Set.of(path(SERVICE, "connection")),
          "pipeline_service_entity",
          Set.of(path(SERVICE, "connection"), path(SERVICE, "databaseConnection")),
          "metadata_service_entity",
          Set.of(path(SERVICE, "connection")),
          "automations_workflow",
          Set.of(
              path(REQUEST),
              path(REQUEST, "connection"),
              path(REQUEST, "metastoreConnection"),
              path(REQUEST, "databaseConnection")),
          "database_entity",
          Set.of(path("databaseProfilerConfig")),
          "database_schema_entity",
          Set.of(path("databaseSchemaProfilerConfig")),
          "entity_extension",
          Set.of(
              path(SERVICE),
              path(SERVICE, "metastoreConnection"),
              path(SERVICE, "connection"),
              path(SERVICE, "databaseConnection"),
              path(REQUEST),
              path(REQUEST, "connection"),
              path(REQUEST, "metastoreConnection"),
              path(REQUEST, "databaseConnection"),
              path("databaseProfilerConfig"),
              path("databaseSchemaProfilerConfig")));

  private static final Path REPO_ROOT = repoRoot();

  @Test
  void bothDialectsStripEveryPathAStoredDocumentCanHold() {
    String mysql = readMigration("mysql");
    String postgres = readMigration("postgres");
    PATHS_BY_TABLE.forEach((table, paths) -> assertTableStrips(table, paths, mysql, postgres));
  }

  @Test
  void noSchemaReintroducesTheRemovedProperty() {
    List<Path> offenders = schemasMentioningHolder();
    assertTrue(
        offenders.isEmpty(),
        HOLDER
            + " is back in "
            + offenders
            + " — add its JSON paths to PATHS_BY_TABLE and to both migration dialects, or the"
            + " stored rows carrying it will stop deserializing on upgrade");
  }

  private void assertTableStrips(String table, Set<String> paths, String mysql, String postgres) {
    String mysqlStatement = statementFor(mysql, table);
    String postgresStatement = statementFor(postgres, table);
    assertFalse(mysqlStatement.isEmpty(), "MySQL migration has no statement for " + table);
    assertFalse(postgresStatement.isEmpty(), "Postgres migration has no statement for " + table);
    paths.forEach(
        path -> {
          assertTrue(
              mysqlStatement.contains(mysqlPath(path)),
              table + " is not stripped at " + path + " by the MySQL migration");
          assertTrue(
              postgresStatement.contains(postgresPath(path)),
              table + " is not stripped at " + path + " by the Postgres migration");
        });
  }

  private List<Path> schemasMentioningHolder() {
    Path root = REPO_ROOT.resolve(SPEC_MODULE).resolve(SCHEMA_ROOT);
    List<Path> offenders = new ArrayList<>();
    try (Stream<Path> files = Files.walk(root)) {
      files
          .filter(SampleDataStorageMigrationPathsTest::isSchemaFile)
          .forEach(file -> collectIfMentioned(root, file, offenders));
    } catch (IOException e) {
      throw new UncheckedIOException("Cannot walk the schemas in " + root, e);
    }
    return offenders;
  }

  private static void collectIfMentioned(Path root, Path file, List<Path> offenders) {
    if (readFile(file).contains(HOLDER)) {
      offenders.add(root.relativize(file));
    }
  }

  private static String path(String root, String nesting) {
    return root + "." + nesting + "." + HOLDER;
  }

  private static String path(String root) {
    return root + "." + HOLDER;
  }

  /** The statements of one migration that touch {@code table} and mention the property. */
  private static String statementFor(String sql, String table) {
    List<String> matches = new ArrayList<>();
    for (String statement : sql.split(";")) {
      if (statement.contains("UPDATE " + table) && statement.contains(HOLDER)) {
        matches.add(statement);
      }
    }
    return String.join("\n", matches);
  }

  private static String mysqlPath(String path) {
    return "'$." + path + "'";
  }

  private static String postgresPath(String path) {
    return "'{" + path.replace('.', ',') + "}'";
  }

  private static boolean isSchemaFile(Path file) {
    return Files.isRegularFile(file) && file.getFileName().toString().endsWith(".json");
  }

  private static String readMigration(String dialect) {
    return readFile(REPO_ROOT.resolve(MIGRATION_DIR).resolve(dialect).resolve(MIGRATION_FILE));
  }

  private static String readFile(Path file) {
    try {
      return Files.readString(file);
    } catch (IOException e) {
      throw new UncheckedIOException("Cannot read " + file, e);
    }
  }

  private static Path repoRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.isDirectory(current.resolve(SPEC_MODULE))) {
      current = current.getParent();
    }
    return requireNonNull(
        current, "Cannot locate the repository root from " + Path.of("").toAbsolutePath());
  }
}
