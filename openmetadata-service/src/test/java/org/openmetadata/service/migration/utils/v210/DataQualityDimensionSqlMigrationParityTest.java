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

package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * {@code data_quality_dimension} is an entity table, so {@code EntityDAO.insert} writes only
 * {@code fqnHash} and {@code json} — the {@code id} column has to be generated from the json
 * document or every insert fails ("Field 'id' doesn't have a default value" on MySQL, "null value
 * in column id" on PostgreSQL). This guards both halves of that: the table exists in the clean
 * schema as well as in the 2.1.0 upgrade, and in both its {@code id} is a generated column.
 */
class DataQualityDimensionSqlMigrationParityTest {
  private static final String TABLE = "data_quality_dimension";
  private static final Pattern ID_COLUMN =
      Pattern.compile("\\bid\\b[^,]*?generated always as", Pattern.DOTALL);

  @ParameterizedTest(name = "{0} clean and 2.1.0 upgrade schemas create the dimension table")
  @MethodSource("dialects")
  void dimensionTableExistsInCleanAndUpgradeSchemas(final DialectSql dialect) throws IOException {
    assertGeneratedIdColumn(read(dialect.cleanSchema()), dialect.name() + " clean schema");
    assertGeneratedIdColumn(read(dialect.schemaChanges()), dialect.name() + " 2.1.0 migration");
  }

  private static void assertGeneratedIdColumn(final String sql, final String description) {
    final String createTable = createTableStatement(sql, description);
    final Matcher idColumn = ID_COLUMN.matcher(createTable);
    assertTrue(
        idColumn.find(),
        description + " must derive " + TABLE + ".id from the json document: " + createTable);
  }

  /** The {@code CREATE TABLE} body for {@link #TABLE}, so neighbouring tables are not matched. */
  private static String createTableStatement(final String sql, final String description) {
    final Matcher statement =
        Pattern.compile("create table[^(]*\\b" + TABLE + "\\b[^(]*\\((.*?)\\n\\)", Pattern.DOTALL)
            .matcher(sql);
    assertTrue(statement.find(), description + " does not create " + TABLE);

    return statement.group(1);
  }

  private static String read(final Path path) throws IOException {
    return Files.readString(path).toLowerCase(Locale.ROOT);
  }

  private static Stream<DialectSql> dialects() {
    final Path root = repositoryRoot();
    final Path migrations = root.resolve("bootstrap/sql/migrations/native/2.1.0");
    return Stream.of(dialect(root, migrations, "mysql"), dialect(root, migrations, "postgres"));
  }

  private static DialectSql dialect(final Path root, final Path migrations, final String name) {
    return new DialectSql(
        name,
        root.resolve("bootstrap/sql/schema/" + name + ".sql"),
        migrations.resolve(name + "/schemaChanges.sql"));
  }

  private static Path repositoryRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.exists(current.resolve("bootstrap/sql/schema/mysql.sql"))) {
      current = current.getParent();
    }
    if (current == null) {
      throw new IllegalStateException("Unable to locate the OpenMetadata repository root");
    }
    return current;
  }

  private record DialectSql(String name, Path cleanSchema, Path schemaChanges) {
    @Override
    public String toString() {
      return name;
    }
  }
}
