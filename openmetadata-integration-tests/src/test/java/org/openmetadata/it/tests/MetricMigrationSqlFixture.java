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

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.flywaydb.core.api.configuration.ClassicConfiguration;
import org.flywaydb.core.api.configuration.Configuration;
import org.flywaydb.core.internal.database.postgresql.PostgreSQLParser;
import org.flywaydb.core.internal.parser.Parser;
import org.flywaydb.core.internal.parser.ParsingContext;
import org.flywaydb.core.internal.resource.filesystem.FileSystemResource;
import org.flywaydb.core.internal.sqlscript.SqlStatementIterator;
import org.flywaydb.database.mysql.MySQLParser;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

final class MetricMigrationSqlFixture {
  private MetricMigrationSqlFixture() {}

  static MigrationScripts readMigrationScripts(ConnectionType connectionType) throws Exception {
    String dialect = connectionType == ConnectionType.MYSQL ? "mysql" : "postgres";
    Path migrationDirectory = migrationDirectory().resolve(dialect);
    return new MigrationScripts(
        parseSql(migrationDirectory.resolve("schemaChanges.sql"), connectionType),
        parseSql(migrationDirectory.resolve("postDataMigrationSQLScript.sql"), connectionType));
  }

  private static List<String> parseSql(Path path, ConnectionType connectionType) throws Exception {
    Parser parser = sqlParser(connectionType);
    List<String> statements = new ArrayList<>();
    FileSystemResource resource =
        new FileSystemResource(null, path.toString(), StandardCharsets.UTF_8, true);
    try (SqlStatementIterator iterator = parser.parse(resource)) {
      while (iterator.hasNext()) {
        statements.add(iterator.next().getSql());
      }
    }
    return List.copyOf(statements);
  }

  private static Parser sqlParser(ConnectionType connectionType) {
    Configuration configuration = new ClassicConfiguration();
    ParsingContext parsingContext = new ParsingContext();
    return connectionType == ConnectionType.MYSQL
        ? new MySQLParser(configuration, parsingContext)
        : new PostgreSQLParser(configuration, parsingContext);
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
