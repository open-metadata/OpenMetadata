package org.openmetadata.service.migration.api;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;

class MigrationProcessImplTest {

  @TempDir Path tempDir;

  private MigrationDAO migrationDAO;
  private OpenMetadataApplicationConfig config;

  @BeforeEach
  void setUp() {
    migrationDAO = mock(MigrationDAO.class);
    config = mock(OpenMetadataApplicationConfig.class);
  }

  @Test
  void delegatesReprocessingFlagToMigrationFile() throws IOException {
    MigrationFile file = createMigrationDir("1.12.3", "", "");
    file.setReprocessing(true);

    MigrationProcessImpl process = new MigrationProcessImpl(file);

    assertTrue(process.isReprocessing());
  }

  @Test
  void delegatesHasNewStatementsToMigrationFile() throws IOException {
    when(migrationDAO.checkIfQueryPreviouslyRan(anyString())).thenReturn(null);
    MigrationFile file = createMigrationDir("1.12.3", "ALTER TABLE test ADD COLUMN a INT;", "");
    file.parseSQLFiles();

    MigrationProcessImpl process = new MigrationProcessImpl(file);

    assertTrue(process.hasNewStatements());
  }

  @Test
  void reportsNoNewStatementsWhenMigrationFileHasNone() throws IOException {
    when(migrationDAO.checkIfQueryPreviouslyRan(anyString())).thenReturn(null);
    MigrationFile file = createMigrationDir("1.12.3", "", "");
    file.parseSQLFiles();

    MigrationProcessImpl process = new MigrationProcessImpl(file);

    assertFalse(process.hasNewStatements());
  }

  private MigrationFile createMigrationDir(
      String version, String schemaChangesSql, String postDdlSql) throws IOException {
    Path versionDir = tempDir.resolve(version);
    Path mysqlDir = versionDir.resolve("mysql");
    Files.createDirectories(mysqlDir);
    Files.writeString(mysqlDir.resolve("schemaChanges.sql"), schemaChangesSql);
    Files.writeString(mysqlDir.resolve("postDataMigrationSQLScript.sql"), postDdlSql);

    return new MigrationFile(
        versionDir.toFile(), migrationDAO, ConnectionType.MYSQL, config, false);
  }
}
