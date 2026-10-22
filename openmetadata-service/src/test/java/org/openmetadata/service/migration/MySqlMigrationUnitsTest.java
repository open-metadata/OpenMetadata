package org.openmetadata.service.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.SqlUnit;

/**
 * Every shipped MySQL migration file must parse into units: a malformed guarded block would
 * otherwise fail on a customer database. Each PREPARE starts exactly one block.
 */
class MySqlMigrationUnitsTest {
  private static final Pattern PREPARE =
      Pattern.compile("^\\s*PREPARE\\s", Pattern.CASE_INSENSITIVE | Pattern.MULTILINE);

  @Test
  void everyMySqlMigrationFileParsesIntoUnits() throws IOException {
    for (Path file : mysqlFiles()) {
      List<SqlUnit> units = MigrationFile.parseSqlUnits(file.toFile(), ConnectionType.MYSQL);

      long blocks = units.stream().filter(SqlUnit::isBlock).count();
      assertEquals(prepareCount(file), blocks, file.toString());
      assertTrue(units.stream().noneMatch(unit -> unit.text().isBlank()), file.toString());
    }
  }

  private static long prepareCount(Path file) {
    return MigrationFile.parseSQLFile(file.toFile(), ConnectionType.MYSQL).stream()
        .filter(statement -> PREPARE.matcher(withoutCommentLines(statement)).find())
        .count();
  }

  private static String withoutCommentLines(String statement) {
    return statement
        .lines()
        .filter(line -> !line.strip().startsWith("--"))
        .reduce("", String::concat);
  }

  private static List<Path> mysqlFiles() throws IOException {
    try (Stream<Path> files = Files.walk(nativeMigrationsRoot())) {
      return files
          .filter(path -> path.getParent().getFileName().toString().equals("mysql"))
          .filter(path -> path.toString().endsWith(".sql"))
          .sorted()
          .toList();
    }
  }

  private static Path nativeMigrationsRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.isDirectory(current.resolve("bootstrap/sql/migrations"))) {
      current = current.getParent();
    }
    if (current == null) {
      throw new IllegalStateException("Unable to locate the OpenMetadata repository root");
    }
    return current.resolve("bootstrap/sql/migrations/native");
  }
}
