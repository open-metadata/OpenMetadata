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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.ScratchDatabase;
import org.openmetadata.service.jdbi3.FqnKeyedRowCleanup.EntityTable;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Runs the cleanup's UNION probes on a MySQL server whose default collation is not the one newer
 * tables declare. The three tables carry the hash collations a real install mixes: ascii_bin, a
 * table declared utf8mb4_0900_ai_ci, and query_entity's column, which takes the server default.
 */
@Execution(ExecutionMode.SAME_THREAD)
class FqnKeyedRowCleanupMySqlIT {
  private static final String DATABASE = "fqn_cleanup";
  private static final String HASH = "h0.h1";
  private static final Map<String, String> BINDINGS = Map.of("hash0", HASH);
  private static final List<String> TABLE_NAMES =
      List.of("test_suite", "ai_application_entity", "query_entity");

  @Test
  void bareHashColumnsOfMixedCollationsCannotBeUnioned() {
    withSeededTagUsage(
        tagUsage -> {
          UnableToExecuteStatementException error =
              assertThrows(
                  UnableToExecuteStatementException.class, () -> namesakeHashes(tagUsage, false));
          assertTrue(error.getMessage().contains("Illegal mix of collations"), error.getMessage());
        });
  }

  @Test
  void theNamesakeProbeFindsTheHashInEveryTable() {
    withSeededTagUsage(
        tagUsage -> assertEquals(List.of(HASH, HASH, HASH), namesakeHashes(tagUsage, true)));
  }

  @Test
  void theNestedProbeFindsTheRowsUnderAPrefixInEveryTable() {
    withSeededTagUsage(
        tagUsage -> {
          List<String> hashes =
              tagUsage.listEntityFqnHashes(
                  FqnKeyedRowCleanup.allUnderProbes(tables(true), "under", 10),
                  Map.of("under", "h0.%"));
          assertEquals(List.of(HASH, HASH, HASH), hashes);
        });
  }

  private static void withSeededTagUsage(Consumer<ClassificationTagDAOs.TagUsageDAO> body) {
    assumeTrue(ScratchDatabase.dialect() == ConnectionType.MYSQL, "MySQL only");
    ScratchDatabase.withJdbi(
        jdbi -> {
          jdbi.useHandle(
              handle ->
                  handle.execute(
                      "ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"));
          seedTables(jdbi);
          body.accept(jdbi.onDemand(ClassificationTagDAOs.TagUsageDAO.class));
        });
  }

  private static List<String> namesakeHashes(
      ClassificationTagDAOs.TagUsageDAO tagUsage, boolean onMySql) {
    return tagUsage.listEntityFqnHashes(
        FqnKeyedRowCleanup.inProbes(tables(onMySql), BINDINGS.keySet()), BINDINGS);
  }

  private static List<EntityTable> tables(boolean onMySql) {
    return TABLE_NAMES.stream().map(name -> new EntityTable(name, "fqnHash", onMySql)).toList();
  }

  private static void seedTables(Jdbi jdbi) {
    jdbi.useHandle(
        handle -> {
          handle.execute(
              "CREATE TABLE test_suite (fqnHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin,"
                  + " KEY fqn_hash (fqnHash))");
          handle.execute(
              "CREATE TABLE ai_application_entity (fqnHash VARCHAR(768), KEY fqn_hash (fqnHash))"
                  + " DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci");
          handle.execute(
              "CREATE TABLE query_entity (fqnHash VARCHAR(256), KEY fqn_hash (fqnHash))");
          TABLE_NAMES.forEach(
              table ->
                  handle
                      .createUpdate(
                          "INSERT INTO %s (fqnHash) VALUES (:hash), ('other')".formatted(table))
                      .bind("hash", HASH)
                      .execute());
        });
  }
}
