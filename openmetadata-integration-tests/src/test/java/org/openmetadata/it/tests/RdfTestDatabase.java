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

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;

/** Isolated SQL database with the real RDF release migrations applied twice. */
final class RdfTestDatabase implements AutoCloseable {
  enum Backend {
    POSTGRES,
    MYSQL
  }

  private final Backend backend;
  private final String databaseName;
  private final Jdbi jdbi;

  RdfTestDatabase(final Backend backend) {
    this.backend = backend;
    databaseName = "projection_test_" + UUID.randomUUID().toString().replace("-", "");
    final Jdbi admin = SqlTestContainers.connect(backend, "rdf");
    SqlTestContainers.awaitReady(admin);
    admin.useHandle(
        handle ->
            handle.execute(
                "CREATE DATABASE "
                    + databaseName
                    + (backend == Backend.MYSQL
                        ? " CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
                        : "")));
    jdbi = SqlTestContainers.connect(backend, databaseName);
    initializeSchema();
  }

  static Stream<Backend> backends() {
    final String lane = System.getProperty("databaseType", "");
    return Arrays.stream(Backend.values())
        .filter(backend -> lane.isBlank() || backend.name().equalsIgnoreCase(lane));
  }

  static boolean mysqlEnabled() {
    return backends().anyMatch(backend -> backend == Backend.MYSQL);
  }

  Jdbi jdbi() {

    return jdbi;
  }

  private void initializeSchema() {
    createTable("1.3.0", "change_event_consumers");
    createTable("1.13.0", "rdf_index_job");
    createTable("1.13.0", "rdf_index_partition");
    applyTableChanges("2.1.0", "rdf_inference_rule");
    applyReleaseMigration();
    applyReleaseMigration();
    applyTableChanges("2.1.0", "rdf_active_dataset");
    applyTableChanges("2.1.0", "rdf_projection_health");
  }

  void applyReleaseMigration() {
    applyMigration("2.0.2");
    applyDeadLetterReplayMigration();
  }

  /** Every statement of a release that names the table, in file order, on one connection. */
  private void applyTableChanges(final String version, final String table) {
    final List<String> changes =
        migrationStatements(version).stream()
            .filter(statement -> statement.contains(table))
            .toList();
    if (changes.isEmpty()) {
      throw new IllegalStateException("Missing migration for " + table);
    }
    jdbi.useHandle(handle -> changes.forEach(handle::execute));
  }

  /** 2.2.0 adds the dead-letter replay marker; MySQL adds it through a prepared statement. */
  private void applyDeadLetterReplayMigration() {
    jdbi.useHandle(
        handle ->
            migrationStatements("2.2.0").stream()
                .filter(
                    statement ->
                        statement.contains("replayedAt")
                            || statement.contains("rdf_dead_letter_replayed"))
                .forEach(handle::execute));
  }

  void applyMigration(final String version) {
    jdbi.useHandle(handle -> migrationStatements(version).forEach(handle::execute));
  }

  void applyProjectionMigrations() {
    jdbi.useHandle(
        handle ->
            migrationStatements("2.2.0").stream()
                .filter(statement -> statement.contains("metadata_projection_"))
                .forEach(handle::execute));
  }

  void createTable(final String version, final String table) {
    final String create =
        migrationStatements(version).stream()
            .filter(statement -> statement.contains("CREATE TABLE IF NOT EXISTS " + table + " ("))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("Missing migration for " + table));
    jdbi.useHandle(handle -> handle.execute(create));
  }

  private List<String> migrationStatements(final String version) {
    final String dialect = backend == Backend.MYSQL ? "mysql" : "postgres";
    final Path path =
        repositoryRoot()
            .resolve(
                "bootstrap/sql/migrations/native/"
                    + version
                    + "/"
                    + dialect
                    + "/schemaChanges.sql");
    return MigrationFile.parseSQLFile(
        path.toFile(), backend == Backend.MYSQL ? ConnectionType.MYSQL : ConnectionType.POSTGRES);
  }

  static Path repositoryRoot() {
    Path path = Path.of("").toAbsolutePath();
    while (path != null && !Files.isDirectory(path.resolve("bootstrap/sql/migrations"))) {
      path = path.getParent();
    }
    if (path == null) {
      throw new IllegalStateException("Cannot locate repository migrations");
    }
    return path;
  }

  @Override
  public void close() {
    SqlTestContainers.connect(backend, "rdf")
        .useHandle(handle -> handle.execute("DROP DATABASE " + databaseName));
  }
}
