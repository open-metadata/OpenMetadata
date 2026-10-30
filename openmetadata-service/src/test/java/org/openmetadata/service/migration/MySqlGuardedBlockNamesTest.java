/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;

/**
 * The runner skips any statement whose exact text already ran, in any version. Two MySQL guarded
 * blocks that share a prepared statement name also share their PREPARE and EXECUTE text, so only
 * the first block runs and the others are silently skipped. Every block needs its own names.
 */
class MySqlGuardedBlockNamesTest {

  private static final List<String> MYSQL_FILES =
      List.of("mysql/schemaChanges.sql", "mysql/postDataMigrationSQLScript.sql");
  private static final Pattern LEADING_COMMENTS =
      Pattern.compile("\\A(?:\\s*(?:--[^\\n]*|#[^\\n]*|/\\*(?!!).*?\\*/))*\\s*", Pattern.DOTALL);
  private static final Pattern PREPARE =
      Pattern.compile("\\APREPARE\\s+(\\w+)\\s+FROM\\b", Pattern.CASE_INSENSITIVE);
  private static final Pattern SET_VARIABLE =
      Pattern.compile("\\ASET\\s+@(?!@)", Pattern.CASE_INSENSITIVE);

  // Shipped before this guard existed, so four of its five blocks never ran. 2.1.0 re-applies the
  // two indexes. The tag_usage.metadata and audit_log_event.search_text columns need nothing: the
  // released 1.12.0 and 1.12.1 folders add them, and both run before 2.0.0.
  private static final Set<String> SHIPPED_REUSES =
      Set.of("2.0.0/mysql/schemaChanges.sql prepared statement name 'stmt'");

  @Test
  void everyGuardedBlockHasItsOwnNames() throws IOException {
    Path nativeRoot = nativeMigrationsRoot();
    Map<String, String> firstUse = new HashMap<>();
    List<String> problems = new ArrayList<>();
    for (Path file : mysqlFiles(nativeRoot)) {
      String location = nativeRoot.relativize(file).toString();
      for (String statement : MigrationFile.parseSQLFile(file.toFile(), ConnectionType.MYSQL)) {
        track(location, statement, firstUse, problems);
      }
    }
    assertEquals(List.of(), problems);
  }

  private static void track(
      String location, String statement, Map<String, String> firstUse, List<String> problems) {
    String key = trackedKey(statement);
    String earlier = key == null ? null : firstUse.putIfAbsent(key, location);
    if (earlier != null && !SHIPPED_REUSES.contains(location + " " + key)) {
      problems.add(String.format("%s reuses the %s first used in %s", location, key, earlier));
    }
  }

  private static String trackedKey(String statement) {
    String body = LEADING_COMMENTS.matcher(statement).replaceFirst("");
    Matcher prepare = PREPARE.matcher(body);
    if (prepare.find()) {
      return "prepared statement name '" + prepare.group(1) + "'";
    }
    return SET_VARIABLE.matcher(body).find() ? "statement \"" + statement + "\"" : null;
  }

  private static List<Path> mysqlFiles(Path nativeRoot) throws IOException {
    try (Stream<Path> versions = Files.list(nativeRoot)) {
      return versions
          .filter(Files::isDirectory)
          .sorted(Comparator.comparing(MySqlGuardedBlockNamesTest::versionNumbers, Arrays::compare))
          .flatMap(version -> MYSQL_FILES.stream().map(version::resolve))
          .filter(Files::isRegularFile)
          .toList();
    }
  }

  private static int[] versionNumbers(Path versionDir) {
    return Arrays.stream(versionDir.getFileName().toString().split("\\."))
        .mapToInt(Integer::parseInt)
        .toArray();
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
