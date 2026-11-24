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

import java.util.List;
import java.util.Map;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.service.jdbi3.FqnKeyedRowCleanup.EntityTable;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.util.TestDatabaseImages;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Runs the cleanup's UNION probes on a MySQL server whose default collation is not the one newer
 * tables declare. The three tables carry the hash collations a real install mixes: ascii_bin, a
 * table declared utf8mb4_0900_ai_ci, and query_entity's column, which takes the server default.
 */
@Testcontainers(disabledWithoutDocker = true)
@Execution(ExecutionMode.SAME_THREAD)
class FqnKeyedRowCleanupMySqlTest {
  private static final String DATABASE = "fqn_cleanup";
  private static final String PASSWORD = "fqn-cleanup-test";
  private static final String HASH = "h0.h1";
  private static final Map<String, String> BINDINGS = Map.of("hash0", HASH);
  private static final List<String> TABLE_NAMES =
      List.of("test_suite", "ai_application_entity", "query_entity");

  private static GenericContainer<?> database;
  private static ClassificationTagDAOs.TagUsageDAO tagUsage;

  @BeforeAll
  static void startMySql() {
    database =
        new GenericContainer<>(TestDatabaseImages.mysql())
            .withEnv("MYSQL_DATABASE", DATABASE)
            .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
            .withEnv("MYSQL_ROOT_HOST", "%")
            .withCommand("--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci")
            .withExposedPorts(3306)
            .waitingFor(
                Wait.forSuccessfulCommand(
                    "mysql --protocol=TCP --host=127.0.0.1 --user=root --password=%s --execute='SELECT 1'"
                        .formatted(PASSWORD)));
    database.start();
    Jdbi jdbi =
        Jdbi.create(
            "jdbc:mysql://%s:%d/%s?allowPublicKeyRetrieval=true&useSSL=false"
                .formatted(database.getHost(), database.getMappedPort(3306), DATABASE),
            "root",
            PASSWORD);
    jdbi.installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(new ConnectionAwareAnnotationSqlLocator("com.mysql.cj.jdbc.Driver"));
    seedTables(jdbi);
    tagUsage = jdbi.onDemand(ClassificationTagDAOs.TagUsageDAO.class);
  }

  @AfterAll
  static void stopMySql() {
    database.stop();
  }

  @Test
  void bareHashColumnsOfMixedCollationsCannotBeUnioned() {
    UnableToExecuteStatementException error =
        assertThrows(UnableToExecuteStatementException.class, () -> namesakeHashes(false));
    assertTrue(error.getMessage().contains("Illegal mix of collations"), error.getMessage());
  }

  @Test
  void theNamesakeProbeFindsTheHashInEveryTable() {
    assertEquals(List.of(HASH, HASH, HASH), namesakeHashes(true));
  }

  @Test
  void theNestedProbeFindsTheRowsUnderAPrefixInEveryTable() {
    List<String> hashes =
        tagUsage.listEntityFqnHashes(
            FqnKeyedRowCleanup.allUnderProbes(tables(true), "under", 10), Map.of("under", "h0.%"));
    assertEquals(List.of(HASH, HASH, HASH), hashes);
  }

  private static List<String> namesakeHashes(boolean onMySql) {
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
