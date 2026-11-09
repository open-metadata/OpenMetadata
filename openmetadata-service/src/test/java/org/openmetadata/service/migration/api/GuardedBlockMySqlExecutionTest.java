package org.openmetadata.service.migration.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.EntityUtil.hash;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.SqlUnit;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * A prepared statement only exists on the MySQL connection that prepared it. These tests run guarded
 * blocks through the runner on a real server, with the real migration log, to show that a block
 * runs on one connection, is recorded once after its last statement, and is skipped or rerun as a
 * whole.
 */
@Testcontainers(disabledWithoutDocker = true)
class GuardedBlockMySqlExecutionTest {
  private static final String PASSWORD = "guarded-block-test";
  private static final String DATABASE = "guarded_test";
  private static final String VERSION = "2.1.0";
  private static final String EARLIER_VERSION = "2.0.0";

  @Container
  static final GenericContainer<?> MYSQL =
      new GenericContainer<>(DockerImageName.parse("mysql:8.0"))
          .withEnv("MYSQL_DATABASE", DATABASE)
          .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
          .withExposedPorts(3306);

  @TempDir Path tempDir;

  private Jdbi jdbi;
  private MigrationDAO migrationDAO;

  record LogRow(String version, String checksum, String sqlStatement) {}

  @BeforeEach
  void setUp() {
    jdbi =
        Jdbi.create(
                "jdbc:mysql://%s:%d/%s?allowPublicKeyRetrieval=true&useSSL=false"
                    .formatted(MYSQL.getHost(), MYSQL.getMappedPort(3306), DATABASE),
                "root",
                PASSWORD)
            .installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlStatements.class).setUnusedBindingAllowed(true);
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(new ConnectionAwareAnnotationSqlLocator(ConnectionType.MYSQL.label));
    migrationDAO = jdbi.onDemand(MigrationDAO.class);
    try (Handle handle = jdbi.open()) {
      MigrationFile.parseSQLFile(migrationLogTables().toFile(), ConnectionType.MYSQL)
          .forEach(handle::execute);
      handle.execute("DELETE FROM SERVER_MIGRATION_SQL_LOGS");
      handle.execute("DROP TABLE IF EXISTS guarded");
      handle.execute("CREATE TABLE guarded (id INT)");
    }
  }

  @Test
  void appliesABlockAndRecordsItOnce() throws IOException {
    SqlUnit block = parse(addColumnBlock("c", "c_ddl", "c_stmt")).get(0);

    run(List.of(block));

    assertEquals(List.of("c", "id"), columns());
    assertEquals(List.of(new LogRow(VERSION, block.checksum(), block.text())), logRows());
  }

  @Test
  void skipsAnAppliedBlockOnTheNextRun() throws IOException {
    String sql = addColumnBlock("c", "c_ddl", "c_stmt");
    List<SqlUnit> units = parse(sql);
    run(units);

    Map<String, QueryStatus> rerun = run(units);

    assertEquals(QueryStatus.Status.SKIPPED, rerun.get(units.get(0).text()).getStatus());
    assertEquals(1, logRows().size());
    assertFalse(migrationFile(VERSION, sql).hasNewStatements());
  }

  @Test
  void recordsNothingWhenABlockFailsPartWay() throws IOException {
    List<SqlUnit> units =
        parse(
            """
            SET @missing_ddl = 'ALTER TABLE missing_table ADD COLUMN c INT';
            PREPARE missing_stmt FROM @missing_ddl;
            EXECUTE missing_stmt;
            DEALLOCATE PREPARE missing_stmt;
            """);

    assertThrows(RuntimeException.class, () -> run(units));

    assertEquals(List.of(), logRows());
  }

  @Test
  void aBlockInterruptedAfterPrepareRunsAgainOnANewConnection() throws IOException {
    String sql = addColumnBlock("c", "c_ddl", "c_stmt");
    SqlUnit block = parse(sql).get(0);
    try (Handle killed = jdbi.open()) {
      for (String statement : block.statements().subList(0, 2)) {
        killed.execute(statement);
        migrationDAO.upsertServerMigrationSQL(VERSION, statement, hash(statement));
      }
    }
    try (Handle rerun = jdbi.open()) {
      Exception lonelyExecute =
          assertThrows(Exception.class, () -> rerun.execute("EXECUTE c_stmt"));
      assertTrue(lonelyExecute.getMessage().contains("Unknown prepared statement handler"));
    }

    run(migrationFile(VERSION, sql).getSchemaChanges());

    assertEquals(List.of("c", "id"), columns());
    assertTrue(logRows().contains(new LogRow(VERSION, block.checksum(), block.text())));
  }

  @Test
  void blocksThatReuseAStatementNameBothRun() throws IOException {
    List<SqlUnit> units =
        parse(addColumnBlock("a", "ddl", "stmt") + addColumnBlock("b", "ddl", "stmt"));

    run(units);

    assertEquals(List.of("a", "b", "id"), columns());
    assertEquals(
        units.stream().map(SqlUnit::checksum).sorted().toList(),
        logRows().stream().map(LogRow::checksum).toList());
  }

  @Test
  void aBlockAnOldRunnerRecordedInItsOwnVersionIsApplied() throws IOException {
    String sql = addColumnBlock("c", "c_ddl", "c_stmt");
    recordOneByOne(parse(sql).get(0).statements(), VERSION);

    MigrationFile forced = migrationFile(VERSION, sql);
    MigrationFile reprocessed = migrationFile(VERSION, sql, true);

    assertFalse(forced.hasNewStatements());
    assertFalse(reprocessed.hasNewStatements());
  }

  @Test
  void aBlockWhoseSharedStatementsAnotherVersionRecordedRuns() throws IOException {
    String sql = addColumnBlock("c", "ddl_c", "stmt");
    SqlUnit block = parse(sql).get(0);
    List<String> statements = block.statements();
    recordOneByOne(statements.subList(0, 1), VERSION);
    recordOneByOne(statements.subList(1, statements.size()), EARLIER_VERSION);

    MigrationFile reprocessed = migrationFile(VERSION, sql, true);
    run(reprocessed.getSchemaChanges());

    assertEquals(List.of("c", "id"), columns());
    assertTrue(logRows().contains(new LogRow(VERSION, block.checksum(), block.text())));
  }

  @Test
  void aBlockRerunAfterItsRecordIsLostChangesNothing() throws IOException {
    List<SqlUnit> units = parse(addColumnBlock("c", "c_ddl", "c_stmt"));
    run(units);
    try (Handle handle = jdbi.open()) {
      handle.execute("DELETE FROM SERVER_MIGRATION_SQL_LOGS");
    }

    run(units);

    assertEquals(List.of("c", "id"), columns());
    assertEquals(1, logRows().size());
  }

  @Test
  void recordsAStatementLongerThanTheLogColumnCutOnAWholeCharacter() {
    String statement = "SELECT '" + "x".repeat(9991) + "😀" + "y".repeat(100) + "'";
    SqlUnit unit = SqlUnit.of(statement);

    run(List.of(unit));
    Map<String, QueryStatus> rerun = run(List.of(unit));

    assertEquals(
        List.of(new LogRow(VERSION, unit.checksum(), statement.substring(0, 9999))), logRows());
    assertEquals(QueryStatus.Status.SKIPPED, rerun.get(statement).getStatus());
  }

  private Map<String, QueryStatus> run(List<SqlUnit> units) {
    try (Handle handle = jdbi.open()) {
      return MigrationProcessImpl.performSqlExecutionAndUpdate(
          handle, handle.attach(MigrationDAO.class), units, VERSION, false);
    }
  }

  private void recordOneByOne(List<String> statements, String version) {
    statements.forEach(
        statement -> migrationDAO.upsertServerMigrationSQL(version, statement, hash(statement)));
  }

  private List<SqlUnit> parse(String sql) throws IOException {
    Path file = tempDir.resolve("parsed.sql");
    Files.writeString(file, sql);
    return MigrationFile.parseSqlUnits(file.toFile(), ConnectionType.MYSQL);
  }

  private MigrationFile migrationFile(String version, String sql) throws IOException {
    return migrationFile(version, sql, false);
  }

  private MigrationFile migrationFile(String version, String sql, boolean reprocessing)
      throws IOException {
    Path versionDir =
        Files.createDirectories(tempDir.resolve("reprocessing-" + reprocessing).resolve(version));
    Path mysqlDir = Files.createDirectories(versionDir.resolve("mysql"));
    Files.writeString(mysqlDir.resolve("schemaChanges.sql"), sql);
    MigrationFile file =
        new MigrationFile(versionDir.toFile(), migrationDAO, ConnectionType.MYSQL, null, false);
    file.setReprocessing(reprocessing);
    file.parseSQLFiles();
    return file;
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

  private List<String> columns() {
    try (Handle handle = jdbi.open()) {
      return handle
          .createQuery(
              "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE()"
                  + " AND table_name = 'guarded' ORDER BY column_name")
          .mapTo(String.class)
          .list();
    }
  }

  private List<LogRow> logRows() {
    try (Handle handle = jdbi.open()) {
      return handle
          .createQuery(
              "SELECT version, checksum, sqlStatement FROM SERVER_MIGRATION_SQL_LOGS"
                  + " ORDER BY checksum")
          .map(
              (row, context) ->
                  new LogRow(
                      row.getString("version"),
                      row.getString("checksum"),
                      row.getString("sqlStatement")))
          .list();
    }
  }

  private static Path migrationLogTables() {
    Path root = Path.of("").toAbsolutePath();
    while (root != null && !Files.isDirectory(root.resolve("bootstrap/sql"))) {
      root = root.getParent();
    }
    if (root == null) {
      throw new IllegalStateException("Cannot locate SQL migrations");
    }
    return root.resolve(
        "bootstrap/sql/migrations/flyway/com.mysql.cj.jdbc.Driver/v000__create_server_change_log.sql");
  }
}
