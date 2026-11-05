package org.openmetadata.service.migration.utils;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
class MySqlCollationCheckTest {
  private static final String PASSWORD = "collation-check-test";
  private static final String SHIPPED = MySqlCollationCheck.REQUIRED_COLLATION;
  private static final String UNICODE = "utf8mb4_unicode_ci";
  private static final String GENERAL = "utf8mb4_general_ci";
  private static final List<String> COMPATIBLE_DEFAULTS =
      List.of(SHIPPED, "utf8mb3_general_ci", "latin1_swedish_ci", "utf8mb4_bin");
  private static final List<String> CLASHING_COLLATIONS = List.of(UNICODE, GENERAL);
  private static final List<String> CORE_ID_COLUMNS =
      List.of(
          "column entity_extension.id",
          "column entity_relationship.fromId",
          "column entity_relationship.toId");

  @Container
  static final GenericContainer<?> MYSQL =
      new GenericContainer<>(DockerImageName.parse("mysql:8.0"))
          .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
          .withExposedPorts(3306);

  @BeforeAll
  static void createDatabases() {
    COMPATIBLE_DEFAULTS.forEach(
        collation -> createDatabaseWithCoreTables("default_" + collation, collation, ""));
    CLASHING_COLLATIONS.forEach(
        collation -> {
          createDatabaseWithCoreTables("default_" + collation, collation, "");
          createDatabaseWithCoreTables(
              "drifted_" + collation, SHIPPED, " CHARACTER SET utf8mb4 COLLATE " + collation);
        });
    createDatabaseWithCoreTables("table_default_only", SHIPPED, " COLLATE " + UNICODE);
    jdbi("table_default_only")
        .useHandle(
            handle -> {
              handle.execute("ALTER TABLE entity_relationship COLLATE " + SHIPPED);
              handle.execute("ALTER TABLE entity_extension COLLATE " + SHIPPED);
            });
    createDatabase("empty_" + UNICODE, UNICODE);
  }

  @ParameterizedTest
  @MethodSource("compatibleDefaults")
  void passesOnACollationThatComparesWithTheShippedOne(String collation) {
    assertDoesNotThrow(() -> MySqlCollationCheck.verify(jdbi("default_" + collation)));
  }

  @Test
  void ignoresAnAsciiExtensionColumnNextToTheShippedIdColumn() {
    List<String> clashes = jdbi("default_" + SHIPPED).withHandle(MySqlCollationCheck::findClashes);

    assertEquals(List.of(), clashes);
  }

  @ParameterizedTest
  @MethodSource("clashingCollations")
  void reportsAClashingDatabaseDefaultAndTheCoreIdColumnsThatInheritedIt(String collation) {
    List<String> clashes =
        jdbi("default_" + collation).withHandle(MySqlCollationCheck::findClashes);

    assertEquals(
        List.of(
            "the database default uses " + collation,
            CORE_ID_COLUMNS.get(0) + " uses " + collation,
            CORE_ID_COLUMNS.get(1) + " uses " + collation,
            CORE_ID_COLUMNS.get(2) + " uses " + collation),
        clashes);
  }

  @ParameterizedTest
  @MethodSource("clashingCollations")
  void reportsCoreIdColumnsThatDriftedFromTheDatabaseDefault(String collation) {
    List<String> clashes =
        jdbi("drifted_" + collation).withHandle(MySqlCollationCheck::findClashes);

    assertEquals(
        CORE_ID_COLUMNS.stream().map(column -> column + " uses " + collation).toList(), clashes);
  }

  @Test
  void reportsColumnsLeftBehindWhenOnlyTheTableDefaultWasChanged() {
    List<String> clashes = jdbi("table_default_only").withHandle(MySqlCollationCheck::findClashes);

    assertEquals(
        CORE_ID_COLUMNS.stream().map(column -> column + " uses " + UNICODE).toList(), clashes);
  }

  @ParameterizedTest
  @MethodSource("clashingCollations")
  void databaseDefaultCheckIgnoresDriftedTables(String collation) {
    Jdbi drifted = jdbi("drifted_" + collation);

    assertEquals(List.of(), drifted.withHandle(MySqlCollationCheck::findDatabaseDefaultClashes));
    assertDoesNotThrow(() -> MySqlCollationCheck.verifyDatabaseDefault(drifted));
  }

  @Test
  void databaseDefaultCheckStopsOnAClashingDefault() {
    IllegalStateException failure =
        assertThrows(
            IllegalStateException.class,
            () -> MySqlCollationCheck.verifyDatabaseDefault(jdbi("default_" + UNICODE)));

    assertTrue(failure.getMessage().contains("the database default uses " + UNICODE));
    assertFalse(failure.getMessage().contains("column "));
  }

  @Test
  void stopsAFreshInstallOnAClashingDefaultWithAnActionableMessage() {
    IllegalStateException failure =
        assertThrows(
            IllegalStateException.class,
            () -> MySqlCollationCheck.verify(jdbi("empty_" + UNICODE)));

    assertTrue(failure.getMessage().contains("the database default uses " + UNICODE));
    assertTrue(failure.getMessage().contains("ALTER DATABASE `empty_" + UNICODE + "`"));
    assertTrue(failure.getMessage().contains("COLLATE " + SHIPPED));
  }

  static List<String> compatibleDefaults() {
    return COMPATIBLE_DEFAULTS;
  }

  static List<String> clashingCollations() {
    return CLASHING_COLLATIONS;
  }

  private static void createDatabaseWithCoreTables(
      String database, String defaultCollation, String tableCollation) {
    createDatabase(database, defaultCollation);
    jdbi(database)
        .useHandle(
            handle -> {
              handle.execute(
                  "CREATE TABLE entity_relationship (fromId VARCHAR(36) NOT NULL,"
                      + " toId VARCHAR(36) NOT NULL)"
                      + tableCollation);
              handle.execute(
                  "CREATE TABLE entity_extension (id VARCHAR(36) NOT NULL,"
                      + " extension VARCHAR(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL)"
                      + tableCollation);
            });
  }

  private static void createDatabase(String database, String collation) {
    String characterSet = collation.substring(0, collation.indexOf('_'));
    jdbi("mysql")
        .useHandle(
            handle ->
                handle.execute(
                    "CREATE DATABASE %s CHARACTER SET %s COLLATE %s"
                        .formatted(database, characterSet, collation)));
  }

  private static Jdbi jdbi(String database) {
    return Jdbi.create(
        "jdbc:mysql://%s:%d/%s?allowPublicKeyRetrieval=true&useSSL=false"
            .formatted(MYSQL.getHost(), MYSQL.getMappedPort(3306), database),
        "root",
        PASSWORD);
  }
}
