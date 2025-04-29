package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.spy;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.migration.utils.MigrationFile;

public class MigrationWorkflowTest extends OpenMetadataApplicationTest {

  public static MigrationWorkflow migrationWorkflow;
  public static List<MigrationFile> omMigrationList;
  public static List<MigrationFile> collateMigrationList;

  @BeforeAll
  public static void setup() {
    migrationWorkflow =
        spy(
            new MigrationWorkflow(
                jdbi, "nativePath", ConnectionType.MYSQL, "extensionPath", null, false));

    omMigrationList =
        List.of(
            new MigrationFile(
                new File("/bootstrap/sql/migrations/native/1.1.0"),
                null,
                ConnectionType.MYSQL,
                migrationWorkflow.getOpenMetadataApplicationConfig(),
                false),
            new MigrationFile(
                new File("/bootstrap/sql/migrations/native/1.2.0"),
                null,
                ConnectionType.MYSQL,
                migrationWorkflow.getOpenMetadataApplicationConfig(),
                false),
            new MigrationFile(
                new File("/bootstrap/sql/migrations/native/1.2.1"),
                null,
                ConnectionType.MYSQL,
                migrationWorkflow.getOpenMetadataApplicationConfig(),
                false));

    collateMigrationList =
        List.of(
            new MigrationFile(
                new File("/bootstrap-collate/sql/migrations/native/1.1.0-collate"),
                null,
                ConnectionType.MYSQL,
                migrationWorkflow.getOpenMetadataApplicationConfig(),
                true),
            new MigrationFile(
                new File("/bootstrap-collate/sql/migrations/native/1.2.2-collate"),
                null,
                ConnectionType.MYSQL,
                migrationWorkflow.getOpenMetadataApplicationConfig(),
                true));
  }

  @Test
  void test_getMigrationFiles() {
    Mockito.doReturn(omMigrationList)
        .when(migrationWorkflow)
        .getMigrationFilesFromPath(
            eq("nativePath"), any(ConnectionType.class), eq(null), eq(false));
    Mockito.doReturn(collateMigrationList)
        .when(migrationWorkflow)
        .getMigrationFilesFromPath(
            eq("extensionPath"), any(ConnectionType.class), eq(null), eq(true));

    List<MigrationFile> foundList =
        migrationWorkflow.getMigrationFiles(
            "nativePath",
            ConnectionType.MYSQL,
            migrationWorkflow.getOpenMetadataApplicationConfig(),
            "extensionPath");

    assertEquals(
        List.of("1.1.0", "1.1.0-collate", "1.2.0", "1.2.1", "1.2.2-collate"),
        foundList.stream().map(f -> f.dir.getName()).collect(Collectors.toList()));
  }

  @Test
  void test_getMigrationsToApply() {

    List<MigrationFile> availableMigrations = new ArrayList<>();
    availableMigrations.addAll(omMigrationList);
    availableMigrations.addAll(collateMigrationList);

    // If we only have executed native migrations, we'll execute the Collate ones
    assertEquals(
        List.of("1.1.0-collate", "1.2.2-collate"),
        migrationWorkflow
            .getMigrationsToApply(List.of("1.1.0", "1.2.0", "1.2.1"), availableMigrations)
            .stream()
            .map(f -> f.dir.getName())
            .collect(Collectors.toList()));

    // We might have some native migrations, but not all
    assertEquals(
        List.of("1.2.1", "1.2.2-collate"),
        migrationWorkflow
            .getMigrationsToApply(List.of("1.1.0", "1.1.0-collate", "1.2.0"), availableMigrations)
            .stream()
            .map(f -> f.dir.getName())
            .collect(Collectors.toList()));
  }
}
