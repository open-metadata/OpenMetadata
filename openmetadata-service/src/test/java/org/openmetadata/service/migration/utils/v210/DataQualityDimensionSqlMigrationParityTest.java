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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * {@code data_quality_dimension} is an entity table, so {@code EntityDAO.insert} writes only
 * {@code fqnHash} and {@code json} — the {@code id} column has to be generated from the json
 * document or every insert fails ("Field 'id' doesn't have a default value" on MySQL, "null value
 * in column id" on PostgreSQL). This guards that the 2.1.0 migration creates the table that way on
 * both dialects. The {@code bootstrap/sql/schema} dumps are deliberately not checked: nothing runs
 * them — a fresh install is bootstrapped by the Flyway baseline and then the native migrations —
 * so the table only has to exist in the migration.
 */
class DataQualityDimensionSqlMigrationParityTest {
  private static final String TABLE = "data_quality_dimension";
  private static final Pattern ID_COLUMN =
      Pattern.compile("\\bid\\b[^,]*?generated always as", Pattern.DOTALL);

  @ParameterizedTest(name = "the {0} 2.1.0 migration creates the dimension table")
  @MethodSource("dialects")
  void dimensionTableExistsInUpgradeSchema(final DialectSql dialect) throws IOException {
    assertGeneratedIdColumn(read(dialect.schemaChanges()), dialect.name() + " 2.1.0 migration");
  }

  /**
   * Column types are necessarily dialect specific ({@code jsonb} vs {@code json}, {@code boolean}
   * vs {@code tinyint(1)}), but the column set and the two properties that change behaviour —
   * whether a column is generated from the json document and whether it is nullable — must not
   * diverge between the two dialects.
   */
  @Test
  void columnShapeMatchesAcrossDialects() throws IOException {
    Map<String, String> reference = null;
    String referenceDescription = null;
    for (final DialectSql dialect : dialects().toList()) {
      final Path sql = dialect.schemaChanges();
      final String description = dialect.name() + " " + sql.getFileName();
      final Map<String, String> shape = columnShape(createTableStatement(read(sql), description));
      if (reference == null) {
        reference = shape;
        referenceDescription = description;
      } else {
        final String reason = referenceDescription + " and " + description + " disagree";
        assertEquals(reference, shape, reason);
      }
    }
  }

  /** Column name -&gt; the properties that have to agree, in declaration order. */
  private static Map<String, String> columnShape(final String createTable) {
    final Map<String, String> shape = new LinkedHashMap<>();
    for (final String line : createTable.split("\n")) {
      final String column = line.trim().replaceAll("^`|`$", "");
      if (column.isEmpty()
          || column.startsWith("--")
          || column.startsWith("primary key")
          || column.startsWith("constraint")
          || column.startsWith("unique key")
          || column.startsWith("key ")) {
        continue;
      }
      final String name = column.split("[\\s`(]+")[0].replace("`", "");
      shape.put(
          name,
          (column.contains("generated always as") ? "generated" : "stored")
              + (column.contains("not null") ? " not-null" : " nullable"));
    }
    return shape;
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
    final Path migrations = repositoryRoot().resolve("bootstrap/sql/migrations/native/2.1.0");
    return Stream.of(dialect(migrations, "mysql"), dialect(migrations, "postgres"));
  }

  private static DialectSql dialect(final Path migrations, final String name) {
    return new DialectSql(name, migrations.resolve(name + "/schemaChanges.sql"));
  }

  private static Path repositoryRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.exists(current.resolve("bootstrap/sql/migrations"))) {
      current = current.getParent();
    }
    if (current == null) {
      throw new IllegalStateException("Unable to locate the OpenMetadata repository root");
    }
    return current;
  }

  private record DialectSql(String name, Path schemaChanges) {
    @Override
    public String toString() {
      return name;
    }
  }
}
