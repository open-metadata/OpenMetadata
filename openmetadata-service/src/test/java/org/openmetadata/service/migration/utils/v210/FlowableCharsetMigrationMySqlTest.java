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
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
class FlowableCharsetMigrationMySqlTest {
  private static final String DATABASE = "legacy_openmetadata";
  private static final String PASSWORD = "flowable-test";
  private static final String DATABASE_COLLATION = "utf8mb4_unicode_ci";
  private static final String FLOWABLE_COLLATION = "utf8mb4_0900_ai_ci";

  @Container
  static final GenericContainer<?> MYSQL =
      new GenericContainer<>(DockerImageName.parse("mysql:8.0"))
          .withEnv("MYSQL_DATABASE", DATABASE)
          .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
          .withExposedPorts(3306)
          .withCommand("--character-set-server=utf8mb3", "--collation-server=utf8mb3_general_ci");

  @Test
  void convertsLegacyFlowableTablesWithoutBreakingForeignKeys() {
    try (Handle handle = openHandle()) {
      createMixedCharsetSchema(handle);
      handle.execute("ALTER DATABASE CHARACTER SET utf8mb4 COLLATE " + DATABASE_COLLATION);

      assertEquals(3, FlowableCharsetMigration.alignFlowableTableCharsets(handle));

      assertConvertedSchema(handle);
      assertForeignKeyEnforced(handle);
      assertReplayAndRepair(handle);
    }
  }

  private static Handle openHandle() {
    final String jdbcUrl =
        "jdbc:mysql://%s:%d/%s?allowPublicKeyRetrieval=true&useSSL=false"
            .formatted(MYSQL.getHost(), MYSQL.getMappedPort(3306), DATABASE);
    return Jdbi.create(jdbcUrl, "root", PASSWORD).open();
  }

  private static void createMixedCharsetSchema(final Handle handle) {
    handle.execute(
        "CREATE TABLE ACT_RE_DEPLOYMENT (ID_ VARCHAR(64) PRIMARY KEY) "
            + "DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci");
    handle.execute(
        "CREATE TABLE ACT_GE_BYTEARRAY (ID_ VARCHAR(64) PRIMARY KEY, DEPLOYMENT_ID_ VARCHAR(64), "
            + "CONSTRAINT ACT_FK_BYTEARR_DEPL FOREIGN KEY (DEPLOYMENT_ID_) "
            + "REFERENCES ACT_RE_DEPLOYMENT (ID_)) "
            + "DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci");
    handle.execute(
        "CREATE TABLE ACT_HI_PROCINST (ID_ VARCHAR(64) PRIMARY KEY) "
            + "DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci");
    handle.execute(
        "CREATE TABLE application_table (ID_ VARCHAR(64) PRIMARY KEY) "
            + "DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci");
    handle.execute("INSERT INTO ACT_RE_DEPLOYMENT VALUES ('deployment-1')");
    handle.execute("INSERT INTO ACT_GE_BYTEARRAY VALUES ('bytes-1', 'deployment-1')");
  }

  private static void assertConvertedSchema(final Handle handle) {
    assertEquals(List.of(FLOWABLE_COLLATION), flowableTableCollations(handle));
    assertEquals(List.of("utf8mb4"), flowableColumnCharsets(handle));
    assertEquals(DATABASE_COLLATION, currentDatabaseCollation(handle));
    assertEquals("utf8mb3_general_ci", applicationTableCollation(handle));
    assertEquals(
        1, handle.createQuery("SELECT @@SESSION.FOREIGN_KEY_CHECKS").mapTo(int.class).one());
  }

  private static List<String> flowableTableCollations(final Handle handle) {
    return handle
        .createQuery(
            """
            SELECT DISTINCT TABLE_COLLATION
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND LEFT(UPPER(TABLE_NAME), 4) = 'ACT_'
            ORDER BY TABLE_COLLATION
            """)
        .mapTo(String.class)
        .list();
  }

  private static List<String> flowableColumnCharsets(final Handle handle) {
    return handle
        .createQuery(
            """
            SELECT DISTINCT CHARACTER_SET_NAME
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND LEFT(UPPER(TABLE_NAME), 4) = 'ACT_'
              AND CHARACTER_SET_NAME IS NOT NULL
            ORDER BY CHARACTER_SET_NAME
            """)
        .mapTo(String.class)
        .list();
  }

  private static String currentDatabaseCollation(final Handle handle) {
    return handle
        .createQuery(
            """
            SELECT DEFAULT_COLLATION_NAME
            FROM information_schema.SCHEMATA
            WHERE SCHEMA_NAME = DATABASE()
            """)
        .mapTo(String.class)
        .one();
  }

  private static String applicationTableCollation(final Handle handle) {
    return handle
        .createQuery(
            """
            SELECT TABLE_COLLATION
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_table'
            """)
        .mapTo(String.class)
        .one();
  }

  private static void assertForeignKeyEnforced(final Handle handle) {
    assertEquals(1, flowableForeignKeyCount(handle));
    assertThrows(
        UnableToExecuteStatementException.class,
        () ->
            handle.execute(
                "INSERT INTO ACT_GE_BYTEARRAY VALUES ('bytes-invalid', 'missing-deployment')"));
  }

  private static void assertReplayAndRepair(final Handle handle) {
    assertEquals(0, FlowableCharsetMigration.alignFlowableTableCharsets(handle));
    handle.execute(
        "ALTER TABLE ACT_HI_PROCINST CONVERT TO CHARACTER SET utf8mb4 COLLATE "
            + DATABASE_COLLATION);

    assertEquals(3, FlowableCharsetMigration.alignFlowableTableCharsets(handle));
    assertConvertedSchema(handle);
  }

  private static int flowableForeignKeyCount(final Handle handle) {
    return handle
        .createQuery(
            """
            SELECT COUNT(*)
            FROM information_schema.REFERENTIAL_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'ACT_FK_BYTEARR_DEPL'
            """)
        .mapTo(int.class)
        .one();
  }
}
