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

  // Splits a SQL script into top-level statements on unquoted, uncommented semicolons.
  // Handles line comments, block comments, single- and double-quoted string literals
  // (with doubled-quote escapes), backtick-quoted MySQL identifiers, and backslash-
  // escaped characters inside strings. Avoids depending on Flyway's internal parser APIs.
  private List<String> parseStatements(Path sqlFile) {
    String sql;
    try {
      sql = Files.readString(sqlFile, StandardCharsets.UTF_8);
    } catch (Exception e) {
      throw new RuntimeException("Failed to read migration SQL file " + sqlFile, e);
    }

    List<String> statements = new ArrayList<>();
    StringBuilder current = new StringBuilder();
    int i = 0;
    int n = sql.length();
    char quote = 0;

    while (i < n) {
      char c = sql.charAt(i);
      char next = i + 1 < n ? sql.charAt(i + 1) : '\0';

      if (quote == 0) {
        if (c == '-' && next == '-') {
          while (i < n && sql.charAt(i) != '\n') {
            i++;
          }
          continue;
        }
        if (c == '/' && next == '*') {
          i += 2;
          while (i + 1 < n && !(sql.charAt(i) == '*' && sql.charAt(i + 1) == '/')) {
            i++;
          }
          i = Math.min(n, i + 2);
          continue;
        }
        if (c == '\'' || c == '"' || c == '`') {
          quote = c;
          current.append(c);
          i++;
          continue;
        }
        if (c == ';') {
          addIfNotBlank(statements, current.toString());
          current.setLength(0);
          i++;
          continue;
        }
        current.append(c);
        i++;
      } else {
        if (c == '\\' && next != '\0') {
          current.append(c).append(next);
          i += 2;
          continue;
        }
        if (c == quote && next == quote) {
          current.append(c).append(next);
          i += 2;
          continue;
        }
        if (c == quote) {
          quote = 0;
        }
        current.append(c);
        i++;
      }
    }

    addIfNotBlank(statements, current.toString());
    return statements;
  }

  private void addIfNotBlank(List<String> statements, String statement) {
    String trimmed = statement.trim();
    if (!trimmed.isEmpty()) {
      statements.add(trimmed);
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
