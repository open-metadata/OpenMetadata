package org.openmetadata.service.migration.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;

class MigrationWorkflowTest {

  private Path tempDir;
  private MigrationDAO migrationDAO;
  private OpenMetadataApplicationConfig config;
  private MigrationWorkflow workflow;

  @BeforeEach
  void setUp() throws IOException {
    tempDir = Files.createTempDirectory("migration-test");
    migrationDAO = mock(MigrationDAO.class);
    config = mock(OpenMetadataApplicationConfig.class);
    Jdbi jdbi = mock(Jdbi.class);
    when(jdbi.onDemand(eq(MigrationDAO.class))).thenReturn(migrationDAO);
    workflow =
        new MigrationWorkflow(
            jdbi, tempDir.toString(), ConnectionType.MYSQL, null, null, config, false);
  }

  @AfterEach
  void tearDown() throws IOException {
    try (Stream<Path> paths = Files.walk(tempDir)) {
      paths.sorted(Comparator.reverseOrder()).map(Path::toFile).forEach(File::delete);
    }
  }

  private MigrationFile createMigrationFile(String version, boolean isExtension)
      throws IOException {
    Path parentDir = isExtension ? tempDir.resolve("extensions") : tempDir;
    Files.createDirectories(parentDir);
    Path versionDir = Files.createDirectory(parentDir.resolve(version));
    return new MigrationFile(
        versionDir.toFile(), migrationDAO, ConnectionType.MYSQL, config, isExtension);
  }

  @Test
  void getMigrationsToApply_backportedPatchVersionsAreIncluded() throws IOException {
    List<String> executedMigrations = List.of("1.11.10", "1.12.0", "1.12.1");
    List<MigrationFile> availableMigrations =
        List.of(
            createMigrationFile("1.11.10", false),
            createMigrationFile("1.11.11", false),
            createMigrationFile("1.11.12", false),
            createMigrationFile("1.12.0", false),
            createMigrationFile("1.12.1", false),
            createMigrationFile("1.12.2", false));

    List<MigrationFile> result =
        workflow.getMigrationsToApply(executedMigrations, availableMigrations);

    List<String> versions = result.stream().map(m -> m.version).toList();
    assertEquals(List.of("1.11.11", "1.11.12", "1.12.2"), versions);
  }

  @Test
  void getMigrationsToApply_collateVersionsAreIncluded() throws IOException {
    List<String> executedMigrations = List.of("1.11.10", "1.12.0", "1.12.1");
    List<MigrationFile> availableMigrations =
        List.of(
            createMigrationFile("1.11.10", false),
            createMigrationFile("1.11.11", false),
            createMigrationFile("1.12.0", false),
            createMigrationFile("1.12.1", false),
            createMigrationFile("1.12.1-collate", false),
            createMigrationFile("1.12.2", false));

    List<MigrationFile> result =
        workflow.getMigrationsToApply(executedMigrations, availableMigrations);

    List<String> versions = result.stream().map(m -> m.version).toList();
    assertEquals(List.of("1.11.11", "1.12.1-collate", "1.12.2"), versions);
  }

  @Test
  void getMigrationsToApply_collateVersionAlreadyExecuted() throws IOException {
    List<String> executedMigrations = List.of("1.11.10", "1.12.0", "1.12.1", "1.12.1-collate");
    List<MigrationFile> availableMigrations =
        List.of(
            createMigrationFile("1.11.10", false),
            createMigrationFile("1.12.0", false),
            createMigrationFile("1.12.1", false),
            createMigrationFile("1.12.1-collate", false),
            createMigrationFile("1.12.2", false));

    List<MigrationFile> result =
        workflow.getMigrationsToApply(executedMigrations, availableMigrations);

    List<String> versions = result.stream().map(m -> m.version).toList();
    assertEquals(List.of("1.12.2"), versions);
  }

  @Test
  void getMigrationsToApply_extensionMigrationsProcessedSeparately() throws IOException {
    List<String> executedMigrations = List.of("1.12.0", "1.12.1");
    List<MigrationFile> availableMigrations =
        List.of(
            createMigrationFile("1.12.0", false),
            createMigrationFile("1.12.1", false),
            createMigrationFile("1.12.2", false),
            createMigrationFile("1.12.1", true),
            createMigrationFile("1.12.2", true));

    List<MigrationFile> result =
        workflow.getMigrationsToApply(executedMigrations, availableMigrations);

    List<String> nativeVersions =
        result.stream().filter(m -> !m.isExtension).map(m -> m.version).toList();
    List<String> extensionVersions =
        result.stream().filter(m -> m.isExtension).map(m -> m.version).toList();

    assertEquals(List.of("1.12.2"), nativeVersions);
    assertEquals(List.of("1.12.2"), extensionVersions);
  }

  @Test
  void getMigrationsToApply_noExecutedMigrationsReturnsAll() throws IOException {
    List<String> executedMigrations = new ArrayList<>();
    List<MigrationFile> availableMigrations =
        List.of(
            createMigrationFile("1.11.10", false),
            createMigrationFile("1.12.0", false),
            createMigrationFile("1.12.0-collate", false));

    List<MigrationFile> result =
        workflow.getMigrationsToApply(executedMigrations, availableMigrations);

    assertEquals(3, result.size());
  }

  @Test
  void getMigrationsToApply_allMigrationsAlreadyExecuted() throws IOException {
    List<String> executedMigrations = List.of("1.12.0", "1.12.1", "1.12.1-collate");
    List<MigrationFile> availableMigrations =
        List.of(
            createMigrationFile("1.12.0", false),
            createMigrationFile("1.12.1", false),
            createMigrationFile("1.12.1-collate", false));

    List<MigrationFile> result =
        workflow.getMigrationsToApply(executedMigrations, availableMigrations);

    assertTrue(result.isEmpty());
  }

  @Test
  void getMigrationsToApply_multipleBackportedMinorVersions() throws IOException {
    List<String> executedMigrations = List.of("1.10.5", "1.11.0", "1.12.0", "1.12.1");
    List<MigrationFile> availableMigrations =
        List.of(
            createMigrationFile("1.10.5", false),
            createMigrationFile("1.10.6", false),
            createMigrationFile("1.11.0", false),
            createMigrationFile("1.11.1", false),
            createMigrationFile("1.11.1-collate", false),
            createMigrationFile("1.12.0", false),
            createMigrationFile("1.12.1", false),
            createMigrationFile("1.12.2", false));

    List<MigrationFile> result =
        workflow.getMigrationsToApply(executedMigrations, availableMigrations);

    List<String> versions = result.stream().map(m -> m.version).toList();
    assertEquals(List.of("1.10.6", "1.11.1", "1.11.1-collate", "1.12.2"), versions);
  }
}
