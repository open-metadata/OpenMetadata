package org.openmetadata.service.migration.utils;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
class MySqlCollationCheckTest {
  private static final String PASSWORD = "collation-check-test";
  private static final String UNICODE = "utf8mb4_unicode_ci";

  @Container
  static final GenericContainer<?> MYSQL =
      new GenericContainer<>(DockerImageName.parse("mysql:8.0"))
          .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
          .withExposedPorts(3306);

  @BeforeAll
  static void createDatabases() {
    jdbi("mysql")
        .useHandle(
            handle -> {
              handle.execute("CREATE DATABASE shipped");
              handle.execute("CREATE DATABASE unicode_default COLLATE " + UNICODE);
              handle.execute("CREATE DATABASE drifted_table");
            });
    createCoreTables("shipped", "");
    createCoreTables("unicode_default", "");
    createCoreTables("drifted_table", " COLLATE " + UNICODE);
    jdbi("mysql")
        .useHandle(handle -> handle.execute("CREATE DATABASE unicode_empty COLLATE " + UNICODE));
  }

  @Test
  void passesOnTheShippedCollation() {
    assertDoesNotThrow(() -> MySqlCollationCheck.verify(jdbi("shipped")));
  }

  @Test
  void reportsTheDatabaseDefaultAndTheCoreTablesThatInheritedIt() {
    List<String> mismatches =
        jdbi("unicode_default").withHandle(MySqlCollationCheck::findMismatches);

    assertEquals(
        List.of(
            "table entity_extension uses " + UNICODE,
            "table entity_relationship uses " + UNICODE,
            "the database default uses " + UNICODE),
        mismatches);
  }

  @Test
  void reportsACoreTableWhoseCollationDriftedFromTheDatabaseDefault() {
    List<String> mismatches = jdbi("drifted_table").withHandle(MySqlCollationCheck::findMismatches);

    assertEquals(
        List.of(
            "table entity_extension uses " + UNICODE, "table entity_relationship uses " + UNICODE),
        mismatches);
  }

  @Test
  void stopsAFreshInstallOnTheWrongDefaultWithAnActionableMessage() {
    IllegalStateException failure =
        assertThrows(
            IllegalStateException.class, () -> MySqlCollationCheck.verify(jdbi("unicode_empty")));

    assertTrue(failure.getMessage().contains("the database default uses " + UNICODE));
    assertTrue(failure.getMessage().contains("ALTER DATABASE `unicode_empty`"));
    assertTrue(failure.getMessage().contains(MySqlCollationCheck.REQUIRED_COLLATION));
  }

  private static void createCoreTables(String database, String collation) {
    jdbi(database)
        .useHandle(
            handle -> {
              handle.execute(
                  "CREATE TABLE entity_relationship (fromId VARCHAR(36) NOT NULL)" + collation);
              handle.execute("CREATE TABLE entity_extension (id VARCHAR(36) NOT NULL)" + collation);
            });
  }

  private static Jdbi jdbi(String database) {
    return Jdbi.create(
        "jdbc:mysql://%s:%d/%s?allowPublicKeyRetrieval=true&useSSL=false"
            .formatted(MYSQL.getHost(), MYSQL.getMappedPort(3306), database),
        "root",
        PASSWORD);
  }
}
