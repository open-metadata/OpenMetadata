package org.openmetadata.service.migration.utils;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.flywaydb.core.api.configuration.ClassicConfiguration;
import org.flywaydb.core.api.configuration.Configuration;
import org.flywaydb.core.internal.parser.Parser;
import org.flywaydb.core.internal.parser.ParsingContext;
import org.flywaydb.core.internal.resource.filesystem.FileSystemResource;
import org.flywaydb.core.internal.sqlscript.SqlStatementIterator;
import org.flywaydb.database.mysql.MySQLParser;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.util.EntityUtil;

class MigrationSqlStatementHashTest {

  @Test
  void mysql1127MigrationStatementsHaveUniqueHashesWithinEachFile() {
    assertUniqueStatementHashes(
        resolveRepoRoot()
            .resolve("bootstrap/sql/migrations/native/1.12.7/mysql/schemaChanges.sql"));
    assertUniqueStatementHashes(
        resolveRepoRoot()
            .resolve(
                "bootstrap/sql/migrations/native/1.12.7/mysql/postDataMigrationSQLScript.sql"));
  }

  @Test
  void mysql1127MigrationFilesDoNotQueryInformationSchema() throws Exception {
    assertDoesNotReferenceInformationSchema(
        resolveRepoRoot()
            .resolve("bootstrap/sql/migrations/native/1.12.7/mysql/schemaChanges.sql"));
    assertDoesNotReferenceInformationSchema(
        resolveRepoRoot()
            .resolve(
                "bootstrap/sql/migrations/native/1.12.7/mysql/postDataMigrationSQLScript.sql"));
  }

  private void assertUniqueStatementHashes(Path sqlFile) {
    List<String> statements = parseStatements(sqlFile);
    Map<String, Long> duplicateHashes =
        statements.stream()
            .collect(
                Collectors.groupingBy(EntityUtil::hash, LinkedHashMap::new, Collectors.counting()))
            .entrySet()
            .stream()
            .filter(entry -> entry.getValue() > 1)
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

    assertTrue(
        duplicateHashes.isEmpty(),
        () -> "Duplicate migration statement hashes found in " + sqlFile + ": " + duplicateHashes);
  }

  private List<String> parseStatements(Path sqlFile) {
    Configuration configuration = new ClassicConfiguration();
    Parser parser = new MySQLParser(configuration, new ParsingContext());
    try (SqlStatementIterator iterator =
        parser.parse(
            new FileSystemResource(null, sqlFile.toString(), StandardCharsets.UTF_8, true))) {
      List<String> statements = new ArrayList<>();
      while (iterator.hasNext()) {
        statements.add(iterator.next().getSql());
      }
      return statements;
    } catch (Exception e) {
      throw new RuntimeException("Failed to parse migration SQL file " + sqlFile, e);
    }
  }

  private void assertDoesNotReferenceInformationSchema(Path sqlFile) throws Exception {
    String sql = Files.readString(sqlFile, StandardCharsets.UTF_8).toLowerCase();
    assertFalse(
        sql.contains("information_schema"), () -> sqlFile + " should not query INFORMATION_SCHEMA");
  }

  private Path resolveRepoRoot() {
    Path current = Paths.get("").toAbsolutePath();
    while (current != null
        && !Files.isDirectory(current.resolve("bootstrap/sql/migrations/native"))) {
      current = current.getParent();
    }
    assertNotNull(
        current, "Unable to locate repository root containing bootstrap/sql/migrations/native");
    return current;
  }
}
