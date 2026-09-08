/*
 *  Copyright 2021 Collate
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
package org.openmetadata.it.tests.migration;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.openmetadata.it.tests.migration.BaselineScratchSupport.ScratchDatabase;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.testcontainers.containers.Container.ExecResult;

/**
 * Dumps a chain-installed scratch database into the committed baseline artifact:
 * {@code schema.sql} via the dialect's native dump tool (run inside the shared container),
 * post-processed for idempotency.
 *
 * <p>Excluded from the artifact: the runner-owned migration history tables and Flowable's {@code
 * ACT_%}/{@code FLW_%} tables (Flowable creates and upgrades its own schema at runtime; freezing it
 * would pin a Flowable version).
 */
class BaselineArtifactWriter {

  private static final List<String> FLOWABLE_TABLE_PREFIXES = List.of("ACT_", "FLW_");
  private static final String SCHEMA_FILE = "schema.sql";
  private static final String SERVER_CHANGE_LOG = "SERVER_CHANGE_LOG";
  private static final String SERVER_MIGRATION_SQL_LOGS = "SERVER_MIGRATION_SQL_LOGS";

  private final ScratchDatabase database;
  private final ConnectionType connectionType;
  private final String sourceRevision;

  BaselineArtifactWriter(
      ScratchDatabase database, ConnectionType connectionType, String sourceRevision) {
    this.database = database;
    this.connectionType = connectionType;
    this.sourceRevision = sourceRevision;
  }

  void write(Path baselineRoot) throws IOException, InterruptedException {
    String dialectDir = connectionType == ConnectionType.MYSQL ? "mysql" : "postgres";
    Path outputDir = Files.createDirectories(baselineRoot.resolve(dialectDir));
    String schema = buildHeader() + dumpSchema(listIncludedTables()) + counterBootstrap();
    Files.writeString(outputDir.resolve(SCHEMA_FILE), schema, StandardCharsets.UTF_8);
  }

  /**
   * Initial values for counter tables. These are schema bootstrap, not data: the row carries no
   * information, the table is useless without it, and nothing else ever creates it (the legacy
   * {@code task_sequence} row came from the Flyway v002 schema file, and {@code
   * FeedRepository.getNextTaskId} still reads it). Same pattern the live 2.0.0 migration uses for
   * its {@code new_task_sequence} replacement.
   */
  private String counterBootstrap() {
    // The two dialects declare task_sequence differently (MySQL: AUTO_INCREMENT id only;
    // PostgreSQL: serial id plus a vestigial `dummy` column), so each seeds its own column.
    return connectionType == ConnectionType.MYSQL
        ? """

          INSERT INTO task_sequence (id) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM task_sequence);
          """
        : """

          INSERT INTO task_sequence (dummy) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM task_sequence);
          """;
  }

  /** All scratch tables minus the history tables and Flowable's self-managed schema, sorted. */
  private List<String> listIncludedTables() {
    List<String> result = new ArrayList<>();
    for (String table : listAllTables()) {
      if (!isExcluded(table)) {
        result.add(table);
      }
    }
    result.sort(String::compareTo);
    return result;
  }

  private boolean isExcluded(String table) {
    return BaselineScratchSupport.isExcludedFromBaseline(table);
  }

  private List<String> listAllTables() {
    String query =
        connectionType == ConnectionType.MYSQL
            ? "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'"
            : "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'";
    return database.jdbi().withHandle(h -> h.createQuery(query).mapTo(String.class).list());
  }

  private String dumpSchema(List<String> includedTables) throws IOException, InterruptedException {
    String raw =
        connectionType == ConnectionType.MYSQL
            ? execDump(mysqlSchemaCommand(includedTables))
            : execDump(postgresSchemaCommand());
    return connectionType == ConnectionType.MYSQL
        ? postProcessMysqlSchema(raw)
        : postProcessPostgresSchema(raw);
  }

  private String[] mysqlSchemaCommand(List<String> includedTables) {
    List<String> command =
        new ArrayList<>(
            List.of(
                "mysqldump",
                "-uroot",
                "-p" + database.password(),
                "--no-data",
                "--skip-lock-tables",
                "--no-tablespaces",
                "--skip-add-drop-table",
                "--skip-comments",
                database.name()));
    command.addAll(includedTables);
    return command.toArray(new String[0]);
  }

  private String[] postgresSchemaCommand() {
    List<String> command =
        new ArrayList<>(
            List.of(
                "pg_dump",
                "-U",
                database.username(),
                "--schema-only",
                "--no-owner",
                "--no-privileges",
                "--no-comments"));
    command.add("-T");
    command.add(SERVER_CHANGE_LOG.toLowerCase(Locale.ROOT));
    command.add("-T");
    command.add(SERVER_MIGRATION_SQL_LOGS.toLowerCase(Locale.ROOT));
    for (String prefix : FLOWABLE_TABLE_PREFIXES) {
      command.add("-T");
      command.add(prefix.toLowerCase(Locale.ROOT) + "*");
      command.add("-T");
      command.add(prefix + "*");
    }
    command.add(database.name());
    return command.toArray(new String[0]);
  }

  private String execDump(String[] command) throws IOException, InterruptedException {
    ExecResult result = BaselineScratchSupport.databaseContainer().execInContainer(command);
    if (result.getExitCode() != 0) {
      throw new IllegalStateException(
          "Dump command failed (exit " + result.getExitCode() + "): " + result.getStderr());
    }
    return result.getStdout();
  }

  private String postProcessMysqlSchema(String raw) {
    List<String> lines = new ArrayList<>();
    lines.add("SET FOREIGN_KEY_CHECKS = 0;");
    for (String line : raw.split("\n", -1)) {
      String processed = line.stripTrailing();
      if (!isMysqlNoiseLine(processed)) {
        processed = processed.replaceFirst("^CREATE TABLE `", "CREATE TABLE IF NOT EXISTS `");
        processed = processed.replaceAll(" AUTO_INCREMENT=\\d+", "");
        lines.add(processed);
      }
    }
    lines.add("SET FOREIGN_KEY_CHECKS = 1;");
    return collapseBlankLines(lines);
  }

  private boolean isMysqlNoiseLine(String line) {
    return line.startsWith("/*!") || line.startsWith("--") || line.startsWith("SET ");
  }

  private String postProcessPostgresSchema(String raw) {
    List<String> lines = new ArrayList<>();
    for (String line : raw.split("\n", -1)) {
      String processed = line.stripTrailing();
      if (!isPostgresNoiseLine(processed)) {
        // Negative lookahead: pg_dump already emits IF NOT EXISTS for some statements
        // (extensions), and a re-run of the post-processor must stay idempotent.
        processed =
            processed.replaceFirst(
                "^CREATE TABLE (?!IF NOT EXISTS)", "CREATE TABLE IF NOT EXISTS ");
        processed =
            processed.replaceFirst(
                "^CREATE SEQUENCE (?!IF NOT EXISTS)", "CREATE SEQUENCE IF NOT EXISTS ");
        processed =
            processed.replaceFirst(
                "^CREATE INDEX (?!IF NOT EXISTS)", "CREATE INDEX IF NOT EXISTS ");
        processed =
            processed.replaceFirst(
                "^CREATE UNIQUE INDEX (?!IF NOT EXISTS)", "CREATE UNIQUE INDEX IF NOT EXISTS ");
        processed =
            processed.replaceFirst(
                "^CREATE EXTENSION (?!IF NOT EXISTS)", "CREATE EXTENSION IF NOT EXISTS ");
        // PostgreSQL has no CREATE FUNCTION IF NOT EXISTS. A function survives the table-only wipe
        // that resume performs, so a bare CREATE would make the second attempt fail.
        processed = processed.replaceFirst("^CREATE FUNCTION ", "CREATE OR REPLACE FUNCTION ");
        lines.add(processed);
      }
    }
    return collapseBlankLines(lines);
  }

  private boolean isPostgresNoiseLine(String line) {
    return line.startsWith("SET ")
        || line.startsWith("SELECT pg_catalog.set_config")
        || line.startsWith("--")
        || line.startsWith("\\");
  }

  private String collapseBlankLines(List<String> lines) {
    StringBuilder result = new StringBuilder();
    boolean previousBlank = false;
    for (String line : lines) {
      boolean blank = line.isBlank();
      if (!blank || !previousBlank) {
        result.append(line).append('\n');
      }
      previousBlank = blank;
    }
    return result.toString();
  }

  private String buildHeader() {
    return """
        -- Consolidated OpenMetadata migration baseline (%s)
        -- Covers: %s (everything strictly below 2.0.0)
        -- Generated from git revision: %s
        -- Regenerate with: scripts/generate_migration_baseline.sh
        -- FROZEN: never edit by hand; schema changes go into bootstrap/sql/migrations/native/2.1.0+.

        """
        .formatted(
            connectionType == ConnectionType.MYSQL ? "MySQL" : "PostgreSQL",
            "flyway v000-v015 + native 1.1.0-1.13.4",
            sourceRevision);
  }
}
