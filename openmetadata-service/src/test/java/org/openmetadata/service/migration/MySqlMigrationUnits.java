package org.openmetadata.service.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.SqlUnit;

/**
 * Checks that every MySQL migration file under a root parses into the units the runner executes,
 * with one guarded block per PREPARE. A file that does not parse stops every migrate and server
 * start, so each distribution runs this over its own migrations.
 */
public final class MySqlMigrationUnits {
  private static final Pattern PREPARE =
      Pattern.compile("^\\s*PREPARE\\s", Pattern.CASE_INSENSITIVE | Pattern.MULTILINE);

  private MySqlMigrationUnits() {}

  public static void assertEveryFileParsesIntoUnits(Path migrationsRoot) throws IOException {
    for (Path file : mysqlFiles(migrationsRoot)) {
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

  private static List<Path> mysqlFiles(Path migrationsRoot) throws IOException {
    try (Stream<Path> files = Files.walk(migrationsRoot)) {
      return files
          .filter(path -> path.getParent().getFileName().toString().equals("mysql"))
          .filter(path -> path.toString().endsWith(".sql"))
          .sorted()
          .toList();
    }
  }
}
