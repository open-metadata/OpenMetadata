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
import java.time.Duration;
import java.util.List;
import org.awaitility.Awaitility;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.testcontainers.containers.GenericContainer;

/** Isolated SQL database with the real RDF release migrations applied twice. */
final class RdfTestDatabase implements AutoCloseable {
  enum Backend {
    POSTGRES,
    MYSQL
  }

  private final Backend backend;
  private final GenericContainer<?> container;
  private final Jdbi jdbi;

  RdfTestDatabase(final Backend backend) {
    this.backend = backend;
    final int port = backend == Backend.POSTGRES ? 5432 : 3306;
    container =
        new GenericContainer<>(backend == Backend.POSTGRES ? "postgres:15" : "mysql:8.0")
            .withExposedPorts(port)
            .withEnv("POSTGRES_PASSWORD", "rdf-test")
            .withEnv("POSTGRES_DB", "rdf")
            .withEnv("MYSQL_ROOT_PASSWORD", "rdf-test")
            .withEnv("MYSQL_DATABASE", "rdf")
            .withStartupTimeout(Duration.ofMinutes(3));
    container.start();
    final String driver = backend == Backend.POSTGRES ? "postgresql" : "mysql";
    final String suffix =
        backend == Backend.MYSQL ? "?allowPublicKeyRetrieval=true&useSSL=false" : "";
    final String url =
        "jdbc:"
            + driver
            + "://"
            + container.getHost()
            + ":"
            + container.getMappedPort(port)
            + "/rdf"
            + suffix;
    jdbi = Jdbi.create(url, backend == Backend.POSTGRES ? "postgres" : "root", "rdf-test");
    Awaitility.await()
        .atMost(Duration.ofMinutes(2))
        .ignoreExceptions()
        .until(
            () ->
                jdbi.withHandle(handle -> handle.createQuery("SELECT 1").mapTo(Integer.class).one())
                    == 1);
    initializeSchema();
  }

  Jdbi jdbi() {
    return jdbi;
  }

  private void initializeSchema() {
    createTable("1.3.0", "change_event_consumers");
    createTable("1.13.0", "rdf_index_job");
    createTable("1.13.0", "rdf_index_partition");
    createTable("2.1.0", "rdf_inference_rule");
    applyReleaseMigration();
    applyReleaseMigration();
  }

  void applyReleaseMigration() {
    jdbi.useHandle(handle -> migrationStatements("2.0.2").forEach(handle::execute));
  }

  private void createTable(final String version, final String table) {
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
    container.close();
  }
}
