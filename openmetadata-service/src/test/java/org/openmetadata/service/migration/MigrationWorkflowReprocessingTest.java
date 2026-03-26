package org.openmetadata.service.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.migration.utils.FlywayMigrationFile;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.util.EntityUtil;

class MigrationWorkflowReprocessingTest {

  @TempDir Path tempDir;

  private MigrationDAO migrationDAO;
  private OpenMetadataApplicationConfig config;
  private Jdbi jdbi;

  @BeforeEach
  void setUp() {
    migrationDAO = mock(MigrationDAO.class);
    config = mock(OpenMetadataApplicationConfig.class);
    jdbi = mock(Jdbi.class);
    when(jdbi.onDemand(any())).thenReturn(migrationDAO);
  }

  private MigrationFile createMigrationDir(String version, String schemaChangesSql)
      throws IOException {
    Path versionDir = tempDir.resolve(version);
    Path mysqlDir = versionDir.resolve("mysql");
    Files.createDirectories(mysqlDir);

    Files.writeString(mysqlDir.resolve("schemaChanges.sql"), schemaChangesSql);
    Files.writeString(mysqlDir.resolve("postDataMigrationSQLScript.sql"), "");

    return new MigrationFile(
        versionDir.toFile(), migrationDAO, ConnectionType.MYSQL, config, false);
  }

  // --- MigrationFile tests ---

  @Test
  void testMigrationFileReprocessingFlag() throws IOException {
    MigrationFile file = createMigrationDir("1.12.3", "");
    assertFalse(file.isReprocessing());

    file.setReprocessing(true);
    assertTrue(file.isReprocessing());
  }

  @Test
  void testHasNewStatementsWhenEmpty() throws IOException {
    when(migrationDAO.checkIfQueryPreviouslyRan(anyString())).thenReturn(null);
    MigrationFile file = createMigrationDir("1.12.3", "");
    file.parseSQLFiles();
    assertFalse(file.hasNewStatements());
  }

  @Test
  void testHasNewStatementsWithNewSql() throws IOException {
    when(migrationDAO.checkIfQueryPreviouslyRan(anyString())).thenReturn(null);
    MigrationFile file = createMigrationDir("1.12.3", "ALTER TABLE test ADD COLUMN a INT;");
    file.parseSQLFiles();
    assertTrue(file.hasNewStatements());
  }

  @Test
  void testHasNewStatementsAllPreviouslyRan() throws IOException {
    when(migrationDAO.checkIfQueryPreviouslyRan(anyString())).thenReturn("already ran");
    MigrationFile file = createMigrationDir("1.12.3", "ALTER TABLE test ADD COLUMN a INT;");
    file.parseSQLFiles();
    assertFalse(file.hasNewStatements());
  }

  @Test
  void testHasNewStatementsPartiallyRan() throws IOException {
    when(migrationDAO.checkIfQueryPreviouslyRan(anyString()))
        .thenReturn("already ran")
        .thenReturn(null);
    MigrationFile file =
        createMigrationDir(
            "1.12.3", "ALTER TABLE test ADD COLUMN a INT;\nALTER TABLE test ADD COLUMN b INT;");
    file.parseSQLFiles();
    assertTrue(file.hasNewStatements());
    assertEquals(1, file.getSchemaChanges().size());
  }

  @Test
  void testCopyWithReprocessingDoesNotDuplicateParsedStatements() throws IOException {
    when(migrationDAO.checkIfQueryPreviouslyRan(anyString())).thenReturn(null);
    MigrationFile file = createMigrationDir("1.12.3", "ALTER TABLE test ADD COLUMN a INT;");
    file.parseSQLFiles();

    MigrationFile copied = file.copyWithReprocessing(true);
    copied.parseSQLFiles();

    assertEquals(1, copied.getSchemaChanges().size());
    assertTrue(copied.isReprocessing());
  }

  @Test
  void testVersionComparison() throws IOException {
    MigrationFile v1123 = createMigrationDir("1.12.3", "");
    assertFalse(v1123.biggerThan("1.12.3"));
    assertTrue(v1123.biggerThan("1.12.2"));
    assertFalse(v1123.biggerThan("1.12.4"));
    assertFalse(v1123.biggerThan("1.13.0"));
  }

  // --- MigrationWorkflow.getMigrationsToApply tests ---

  @Test
  void testGetMigrationsToApplyIncludesCurrentMaxVersion() throws IOException {
    MigrationFile v1121 = createMigrationDir("1.12.1", "");
    MigrationFile v1122 = createMigrationDir("1.12.2", "");
    MigrationFile v1123 = createMigrationDir("1.12.3", "ALTER TABLE test ADD COLUMN new_col INT;");

    List<MigrationFile> available = List.of(v1121, v1122, v1123);
    List<String> executed = List.of("1.12.1", "1.12.2", "1.12.3");

    MigrationWorkflow workflow =
        new MigrationWorkflow(jdbi, "", ConnectionType.MYSQL, "", "", config, false);
    List<MigrationFile> toApply = workflow.getMigrationsToApply(executed, available);

    assertEquals(1, toApply.size());
    assertEquals("1.12.3", toApply.get(0).version);
    assertTrue(toApply.get(0).isReprocessing());
  }

  @Test
  void testGetMigrationsToApplyIncludesCurrentMaxAndNewer() throws IOException {
    MigrationFile v1122 = createMigrationDir("1.12.2", "");
    MigrationFile v1123 = createMigrationDir("1.12.3", "");
    MigrationFile v1130 = createMigrationDir("1.13.0", "");

    List<MigrationFile> available = List.of(v1122, v1123, v1130);
    List<String> executed = List.of("1.12.2", "1.12.3");

    MigrationWorkflow workflow =
        new MigrationWorkflow(jdbi, "", ConnectionType.MYSQL, "", "", config, false);
    List<MigrationFile> toApply = workflow.getMigrationsToApply(executed, available);

    assertEquals(2, toApply.size());
    assertEquals("1.12.3", toApply.get(0).version);
    assertTrue(toApply.get(0).isReprocessing());
    assertEquals("1.13.0", toApply.get(1).version);
    assertFalse(toApply.get(1).isReprocessing());
  }

  @Test
  void testGetMigrationsToApplyIncludesCurrentMaxAsReprocessingAndNewerVersions()
      throws IOException {
    MigrationFile v1121 = createMigrationDir("1.12.1", "");
    MigrationFile v1122 = createMigrationDir("1.12.2", "");
    MigrationFile v1123 = createMigrationDir("1.12.3", "");

    List<MigrationFile> available = List.of(v1121, v1122, v1123);
    List<String> executed = List.of("1.12.1", "1.12.2");

    MigrationWorkflow workflow =
        new MigrationWorkflow(jdbi, "", ConnectionType.MYSQL, "", "", config, false);
    List<MigrationFile> toApply = workflow.getMigrationsToApply(executed, available);

    assertEquals(2, toApply.size());
    assertEquals("1.12.2", toApply.get(0).version);
    assertTrue(toApply.get(0).isReprocessing());
    assertEquals("1.12.3", toApply.get(1).version);
    assertFalse(toApply.get(1).isReprocessing());
  }

  @Test
  void testGetMigrationsToApplyOlderVersionsExcluded() throws IOException {
    MigrationFile v1121 = createMigrationDir("1.12.1", "");
    MigrationFile v1122 = createMigrationDir("1.12.2", "");
    MigrationFile v1123 = createMigrationDir("1.12.3", "");

    List<MigrationFile> available = List.of(v1121, v1122, v1123);
    List<String> executed = List.of("1.12.1", "1.12.2", "1.12.3");

    MigrationWorkflow workflow =
        new MigrationWorkflow(jdbi, "", ConnectionType.MYSQL, "", "", config, false);
    List<MigrationFile> toApply = workflow.getMigrationsToApply(executed, available);

    assertEquals(1, toApply.size());
    assertEquals("1.12.3", toApply.get(0).version);
    assertTrue(toApply.get(0).isReprocessing());
  }

  @Test
  void testGetMigrationsToApplyExtensionMigrationsUnaffected() throws IOException {
    Path extDir = tempDir.resolve("1.12.3-collate");
    Path mysqlDir = extDir.resolve("mysql");
    Files.createDirectories(mysqlDir);
    Files.writeString(mysqlDir.resolve("schemaChanges.sql"), "");
    Files.writeString(mysqlDir.resolve("postDataMigrationSQLScript.sql"), "");
    MigrationFile extMigration =
        new MigrationFile(extDir.toFile(), migrationDAO, ConnectionType.MYSQL, config, true);

    MigrationFile v1123 = createMigrationDir("1.12.3", "");

    List<MigrationFile> available = List.of(v1123, extMigration);
    List<String> executed = List.of("1.12.3");

    MigrationWorkflow workflow =
        new MigrationWorkflow(jdbi, "", ConnectionType.MYSQL, "", "", config, false);
    List<MigrationFile> toApply = workflow.getMigrationsToApply(executed, available);

    assertEquals(2, toApply.size());

    MigrationFile nativeMigration =
        toApply.stream()
            .filter(m -> !m.isExtension)
            .findFirst()
            .orElseThrow(() -> new AssertionError("Expected a native migration in toApply"));
    assertTrue(nativeMigration.isReprocessing());

    MigrationFile extensionMigration =
        toApply.stream()
            .filter(m -> m.isExtension)
            .findFirst()
            .orElseThrow(() -> new AssertionError("Expected an extension migration in toApply"));
    assertFalse(extensionMigration.isReprocessing());
  }

  @Test
  void testGetMigrationsToApplyWithExtensionVersionExecuted() throws IOException {
    // When extension versions like 1.12.3-collate are in executedMigrations,
    // the max should still resolve to the native version 1.12.3 for reprocessing
    MigrationFile v1123 = createMigrationDir("1.12.3", "ALTER TABLE test ADD COLUMN a INT;");

    List<MigrationFile> available = List.of(v1123);
    List<String> executed = List.of("1.12.3", "1.12.3-collate");

    MigrationWorkflow workflow =
        new MigrationWorkflow(jdbi, "", ConnectionType.MYSQL, "", "", config, false);
    List<MigrationFile> toApply = workflow.getMigrationsToApply(executed, available);

    assertEquals(1, toApply.size());
    assertEquals("1.12.3", toApply.get(0).version);
    assertTrue(toApply.get(0).isReprocessing());
  }

  @Test
  void testGetMigrationsToApplyNoExecutedMigrations() throws IOException {
    MigrationFile v1121 = createMigrationDir("1.12.1", "");
    MigrationFile v1122 = createMigrationDir("1.12.2", "");

    List<MigrationFile> available = List.of(v1121, v1122);
    List<String> executed = new ArrayList<>();

    MigrationWorkflow workflow =
        new MigrationWorkflow(jdbi, "", ConnectionType.MYSQL, "", "", config, false);
    List<MigrationFile> toApply = workflow.getMigrationsToApply(executed, available);

    assertEquals(2, toApply.size());
    assertFalse(toApply.get(0).isReprocessing());
    assertFalse(toApply.get(1).isReprocessing());
  }

  // --- FlywayMigrationFile tests ---

  @Test
  void testFlywayMigrationFileCopyWithReprocessing() throws IOException {
    Path sqlFile = tempDir.resolve("V1__init.sql");
    Files.writeString(sqlFile, "CREATE TABLE test (id INT);");

    FlywayMigrationFile original =
        new FlywayMigrationFile(sqlFile.toFile(), migrationDAO, ConnectionType.MYSQL, config);

    original.getSchemaChanges().add("CREATE TABLE test (id INT)");
    original.getPostDDLScripts().add("ALTER TABLE test ADD INDEX idx_id (id)");

    MigrationFile copy = original.copyWithReprocessing(true);

    assertTrue(copy instanceof FlywayMigrationFile);
    assertTrue(copy.isReprocessing());
    assertEquals(1, copy.getSchemaChanges().size());
    assertEquals("CREATE TABLE test (id INT)", copy.getSchemaChanges().get(0));
    assertEquals(1, copy.getPostDDLScripts().size());
    assertEquals("ALTER TABLE test ADD INDEX idx_id (id)", copy.getPostDDLScripts().get(0));
    assertFalse(original.isReprocessing());
  }

  // --- Continuous deployment scenario tests ---

  @Test
  void testContinuousDeploymentNewSqlPickedUp() throws IOException {
    // Day 1: deployed 1.12.3 with one SQL statement
    // Day 3: added a second SQL statement to the same version file
    // Only the new statement should be picked up

    String day1Sql = "ALTER TABLE test ADD COLUMN a INT;";
    String day3Sql = "ALTER TABLE test ADD COLUMN b VARCHAR(255);";

    MigrationFile file = createMigrationDir("1.12.3", day1Sql + "\n" + day3Sql);
    file.parseSQLFiles();

    // The parser returns the parsed SQL — compute checksums from what the parser actually produces
    // Both statements are new (no prior runs), so both appear
    List<String> parsed = file.getSchemaChanges();
    assertEquals(2, parsed.size());

    // Now test with day1's parsed SQL marked as already ran
    String day1ParsedChecksum = EntityUtil.hash(parsed.get(0));
    when(migrationDAO.checkIfQueryPreviouslyRan(day1ParsedChecksum)).thenReturn(day1Sql);

    // Re-create and re-parse to simulate next run
    MigrationFile file2 = createMigrationDir("1.12.3-v2", day1Sql + "\n" + day3Sql);
    file2.parseSQLFiles();

    assertEquals(1, file2.getSchemaChanges().size());
    assertTrue(file2.hasNewStatements());
  }

  @Test
  void testContinuousDeploymentNoNewSql() throws IOException {
    when(migrationDAO.checkIfQueryPreviouslyRan(anyString())).thenReturn("already ran");

    MigrationFile file = createMigrationDir("1.12.3", "ALTER TABLE test ADD COLUMN a INT;");
    file.setReprocessing(true);
    file.parseSQLFiles();

    assertFalse(file.hasNewStatements());
  }

  @Test
  void testReprocessingVersionDroppedWhenNoNewSql() throws IOException {
    // When reprocessing and all SQL already ran, version should not appear in migrations to apply
    when(migrationDAO.checkIfQueryPreviouslyRan(anyString())).thenReturn("already ran");

    MigrationFile v1123 = createMigrationDir("1.12.3", "ALTER TABLE test ADD COLUMN a INT;");

    List<MigrationFile> available = List.of(v1123);
    List<String> executed = List.of("1.12.3");

    MigrationWorkflow workflow =
        new MigrationWorkflow(jdbi, "", ConnectionType.MYSQL, "", "", config, false);
    List<MigrationFile> toApply = workflow.getMigrationsToApply(executed, available);

    // v1123 is included as reprocessing candidate
    assertEquals(1, toApply.size());
    assertTrue(toApply.get(0).isReprocessing());

    // After parsing, it has no new statements — filterAndGetMigrationsToRun would drop it.
    // We test this via parseSQLFiles + hasNewStatements since the full filter is in
    // loadMigrations()
    toApply.get(0).parseSQLFiles();
    assertFalse(toApply.get(0).hasNewStatements());
  }
}
