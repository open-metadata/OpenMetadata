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

package org.openmetadata.it.tests;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.SqlStatementSplitter;

final class MetricMigrationSqlFixture {
  private MetricMigrationSqlFixture() {}

  static MigrationScripts readMigrationScripts(ConnectionType connectionType) throws Exception {
    String dialect = connectionType == ConnectionType.MYSQL ? "mysql" : "postgres";
    Path migrationDirectory = migrationDirectory().resolve(dialect);
    return new MigrationScripts(
        SqlStatementSplitter.splitFile(
            migrationDirectory.resolve("schemaChanges.sql"), connectionType),
        SqlStatementSplitter.splitFile(
            migrationDirectory.resolve("postDataMigrationSQLScript.sql"), connectionType));
  }

  private static Path migrationDirectory() {
    Path moduleRelative = Path.of("..", "bootstrap", "sql", "migrations", "native", "2.1.0");
    Path rootRelative = Path.of("bootstrap", "sql", "migrations", "native", "2.1.0");
    return Files.exists(moduleRelative) ? moduleRelative : rootRelative;
  }

  static ConnectionType currentConnectionType() {
    return "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"))
        ? ConnectionType.MYSQL
        : ConnectionType.POSTGRES;
  }

  record MigrationScripts(List<String> schemaStatements, List<String> postStatements) {}
}
