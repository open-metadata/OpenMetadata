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

package org.openmetadata.service.migration.utils.v208;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Runs the alignment on a real MySQL server, against the column states upgraded databases are in.
 * An unchanged InnoDB table id means MySQL did not copy the table.
 */
@Testcontainers(disabledWithoutDocker = true)
class EntityExtensionCollationAlignmentTest {
  private static final String PASSWORD = "collation-alignment-test";
  private static final String DATABASE = "collation_test";
  private static final String ASCII_COLUMN = "VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin";
  private static final String DEFAULT_COLUMN = "VARCHAR(512)";
  private static final String MYSQL_8_DEFAULT = "utf8mb4 COLLATE utf8mb4_0900_ai_ci";
  private static final String OLDER_DEFAULT = "utf8mb4 COLLATE utf8mb4_general_ci";
  private static final String ENTITY = "2f4c7a1e-0000-4000-8000-000000000001";
  private static final String OTHER_ENTITY = "2f4c7a1e-0000-4000-8000-000000000002";

  @Container
  static final GenericContainer<?> MYSQL =
      new GenericContainer<>(DockerImageName.parse("mysql:8.0"))
          .withEnv("MYSQL_DATABASE", DATABASE)
          .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
          .withExposedPorts(3306);

  private Handle handle;

  @BeforeEach
  void setUp() {
    handle =
        Jdbi.create(
                "jdbc:mysql://%s:%d/%s?allowPublicKeyRetrieval=true&useSSL=false"
                    .formatted(MYSQL.getHost(), MYSQL.getMappedPort(3306), DATABASE),
                "root",
                PASSWORD)
            .open();
    handle.execute("DROP TABLE IF EXISTS entity_extension");
  }

  @AfterEach
  void tearDown() {
    handle.close();
  }

  @Test
  void alignsAnAsciiColumnToTheTableDefault() {
    createTable(ASCII_COLUMN, MYSQL_8_DEFAULT);
    insert(ENTITY, "table.version.0.1", "table.customProperties.owner");
    final List<String> rowsBefore = rows();

    assertTrue(EntityExtensionCollationAlignment.alignOnMySql(handle));

    assertEquals("varchar(512) utf8mb4 utf8mb4_0900_ai_ci", columnState());
    assertEquals(rowsBefore, rows());
  }

  @Test
  void leavesAColumnThatMatchesItsTableUntouched() {
    createTable(DEFAULT_COLUMN, MYSQL_8_DEFAULT);
    insert(ENTITY, "table.version.0.1");
    final long tableId = tableId();

    assertFalse(EntityExtensionCollationAlignment.alignOnMySql(handle));

    assertEquals(tableId, tableId());
    assertEquals("varchar(512) utf8mb4 utf8mb4_0900_ai_ci", columnState());
  }

  @Test
  void alignsToTheTablesOwnDefaultWhenItIsNotTheMySql8One() {
    createTable(ASCII_COLUMN, OLDER_DEFAULT);
    insert(ENTITY, "table.version.0.1");

    assertTrue(EntityExtensionCollationAlignment.alignOnMySql(handle));

    assertEquals("varchar(512) utf8mb4 utf8mb4_general_ci", columnState());
  }

  @Test
  void stopsBeforeCopyingWhenKeysOfOneEntityWouldCollide() {
    createTable(ASCII_COLUMN, MYSQL_8_DEFAULT);
    insert(ENTITY, "table.customProperties.Foo", "table.customProperties.foo");
    insert(OTHER_ENTITY, "table.customProperties.Bar");
    final long tableId = tableId();

    final IllegalStateException error =
        assertThrows(
            IllegalStateException.class,
            () -> EntityExtensionCollationAlignment.alignOnMySql(handle));

    assertTrue(
        error
            .getMessage()
            .contains(ENTITY + ": table.customProperties.Foo, table.customProperties.foo"),
        error.getMessage());
    assertFalse(error.getMessage().contains(OTHER_ENTITY), error.getMessage());
    assertEquals(tableId, tableId());
    assertEquals("varchar(512) ascii ascii_bin", columnState());
  }

  @Test
  void keysThatDifferOnlyInCaseOnDifferentEntitiesDoNotCollide() {
    createTable(ASCII_COLUMN, MYSQL_8_DEFAULT);
    insert(ENTITY, "table.customProperties.Foo");
    insert(OTHER_ENTITY, "table.customProperties.foo");

    assertTrue(EntityExtensionCollationAlignment.alignOnMySql(handle));

    assertEquals(2, rows().size());
  }

  @Test
  void aSecondRunChangesNothing() {
    createTable(ASCII_COLUMN, MYSQL_8_DEFAULT);
    insert(ENTITY, "table.version.0.1");
    EntityExtensionCollationAlignment.alignOnMySql(handle);
    final long tableId = tableId();

    assertFalse(EntityExtensionCollationAlignment.alignOnMySql(handle));

    assertEquals(tableId, tableId());
  }

  private void createTable(final String extensionColumn, final String tableDefault) {
    handle.execute(
        """
        CREATE TABLE entity_extension (
          id VARCHAR(36) NOT NULL,
          extension %s NOT NULL,
          jsonSchema VARCHAR(256) NOT NULL,
          json JSON NOT NULL,
          updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS
            (CAST(json_unquote(json_extract(json, '$.updatedAt')) AS UNSIGNED)) STORED,
          PRIMARY KEY (id, extension),
          INDEX idx_entity_extension_updated_at_id (updatedAt DESC, id DESC)
        ) DEFAULT CHARSET=%s
        """
            .formatted(extensionColumn, tableDefault));
  }

  private void insert(final String id, final String... extensions) {
    for (final String extension : extensions) {
      handle.execute(
          "INSERT INTO entity_extension (id, extension, jsonSchema, json) VALUES (?, ?, 'table', ?)",
          id,
          extension,
          "{\"updatedAt\": 1, \"key\": \"" + extension + "\"}");
    }
  }

  private List<String> rows() {
    return handle
        .createQuery(
            "SELECT CONCAT(id, ' ', extension, ' ', json) FROM entity_extension"
                + " ORDER BY id, BINARY extension")
        .mapTo(String.class)
        .list();
  }

  private String columnState() {
    return handle
        .createQuery(
            "SELECT CONCAT_WS(' ', COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME)"
                + " FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()"
                + " AND TABLE_NAME = 'entity_extension' AND COLUMN_NAME = 'extension'")
        .mapTo(String.class)
        .one();
  }

  private long tableId() {
    return handle
        .createQuery(
            "SELECT TABLE_ID FROM information_schema.INNODB_TABLES"
                + " WHERE NAME = CONCAT(DATABASE(), '/entity_extension')")
        .mapTo(Long.class)
        .one();
  }
}
