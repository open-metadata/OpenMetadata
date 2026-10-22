package org.openmetadata.service.migration.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.SqlUnit;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * A prepared statement only exists on the MySQL connection that prepared it. These tests run guarded
 * blocks through the runner on a real server to show that a unit keeps its statements on one
 * connection, and that the runner's log (an in-memory stand-in here) no longer lets one block hide
 * another.
 */
@Testcontainers(disabledWithoutDocker = true)
class GuardedBlockMySqlExecutionTest {
  private static final String PASSWORD = "guarded-block-test";
  private static final String DATABASE = "guarded_test";
  private static final String VERSION = "2.1.0";

  @Container
  static final GenericContainer<?> MYSQL =
      new GenericContainer<>(DockerImageName.parse("mysql:8.0"))
          .withEnv("MYSQL_DATABASE", DATABASE)
          .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
          .withExposedPorts(3306);

  @TempDir Path tempDir;

  private final Map<String, String> log = new HashMap<>();
  private final MigrationDAO migrationDAO = mock(MigrationDAO.class);

  @BeforeEach
  void setUp() {
    when(migrationDAO.getSqlQuery(anyString(), anyString()))
        .thenAnswer(invocation -> log.get(invocation.getArgument(1, String.class)));
    doAnswer(invocation -> log.put(invocation.getArgument(2), invocation.getArgument(1)))
        .when(migrationDAO)
        .upsertServerMigrationSQL(anyString(), anyString(), anyString());
    try (Handle handle = open()) {
      handle.execute("DROP TABLE IF EXISTS guarded");
      handle.execute("CREATE TABLE guarded (id INT)");
    }
  }

  @Test
  void aBlockInterruptedAfterPrepareRunsAgainOnANewConnection() throws IOException {
    List<SqlUnit> units = parse(addColumnBlock("c", "c_ddl", "c_stmt"));
    try (Handle killed = open()) {
      killed.execute(units.get(0).statements().get(0));
      killed.execute(units.get(0).statements().get(1));
    }

    try (Handle rerun = open()) {
      Exception lonelyExecute =
          assertThrows(Exception.class, () -> rerun.execute("EXECUTE c_stmt"));
      assertTrue(lonelyExecute.getMessage().contains("Unknown prepared statement handler"));

      MigrationProcessImpl.performSqlExecutionAndUpdate(rerun, migrationDAO, units, VERSION, false);

      assertEquals(List.of("c", "id"), columns(rerun));
    }
  }

  @Test
  void blocksThatReuseAStatementNameBothRun() throws IOException {
    String sql = addColumnBlock("a", "ddl", "stmt") + addColumnBlock("b", "ddl", "stmt");

    try (Handle handle = open()) {
      MigrationProcessImpl.performSqlExecutionAndUpdate(
          handle, migrationDAO, parse(sql), VERSION, false);

      assertEquals(List.of("a", "b", "id"), columns(handle));
    }
  }

  @Test
  void aSecondRunOfAnAppliedBlockChangesNothing() throws IOException {
    List<SqlUnit> units = parse(addColumnBlock("c", "c_ddl", "c_stmt"));

    try (Handle handle = open()) {
      MigrationProcessImpl.performSqlExecutionAndUpdate(
          handle, migrationDAO, units, VERSION, false);
      log.clear();
      MigrationProcessImpl.performSqlExecutionAndUpdate(
          handle, migrationDAO, units, VERSION, false);

      assertEquals(List.of("c", "id"), columns(handle));
    }
  }

  private List<SqlUnit> parse(String sql) throws IOException {
    Path file = tempDir.resolve("schemaChanges.sql");
    Files.writeString(file, sql);
    return MigrationFile.parseSqlUnits(file.toFile(), ConnectionType.MYSQL);
  }

  private static String addColumnBlock(String column, String variable, String statementName) {
    return """
        SET @%2$s = (
          SELECT IF(
            EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = DATABASE() AND table_name = 'guarded' AND column_name = '%1$s'
            ),
            'SELECT 1',
            'ALTER TABLE guarded ADD COLUMN %1$s INT'
          )
        );
        PREPARE %3$s FROM @%2$s;
        EXECUTE %3$s;
        DEALLOCATE PREPARE %3$s;
        """
        .formatted(column, variable, statementName);
  }

  private static List<String> columns(Handle handle) {
    return handle
        .createQuery(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE()"
                + " AND table_name = 'guarded' ORDER BY column_name")
        .mapTo(String.class)
        .list();
  }

  private static Handle open() {
    return Jdbi.create(
            "jdbc:mysql://%s:%d/%s?allowPublicKeyRetrieval=true&useSSL=false"
                .formatted(MYSQL.getHost(), MYSQL.getMappedPort(3306), DATABASE),
            "root",
            PASSWORD)
        .open();
  }
}
