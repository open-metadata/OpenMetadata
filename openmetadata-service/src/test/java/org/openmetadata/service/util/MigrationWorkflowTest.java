package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.spy;

import java.io.File;
import java.util.List;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.migration.utils.MigrationFile;

public class MigrationWorkflowTest extends OpenMetadataApplicationTest {

  @Test
  void test_getMigrationFiles() {

    MigrationWorkflow migrationWorkflow =
        spy(new MigrationWorkflow(jdbi, "nativePath", ConnectionType.MYSQL, "extensionPath", false));

    List<MigrationFile> omMigrationList =
        List.of(
            new MigrationFile(new File("/bootstrap/sql/migrations/native/1.1.0"), null, ConnectionType.MYSQL),
            new MigrationFile(new File("/bootstrap/sql/migrations/native/1.2.0"), null, ConnectionType.MYSQL),
            new MigrationFile(new File("/bootstrap/sql/migrations/native/1.2.1"), null, ConnectionType.MYSQL));

    List<MigrationFile> collateMigrationList =
        List.of(
            new MigrationFile(
                new File("/bootstrap-collate/sql/migrations/native/1.1.0-collate"), null, ConnectionType.MYSQL),
            new MigrationFile(
                new File("/bootstrap-collate/sql/migrations/native/1.2.2-collate"), null, ConnectionType.MYSQL));

    Mockito.doReturn(omMigrationList)
        .when(migrationWorkflow)
        .getMigrationFilesFromPath(eq("nativePath"), any(ConnectionType.class));
    Mockito.doReturn(collateMigrationList)
        .when(migrationWorkflow)
        .getMigrationFilesFromPath(eq("extensionPath"), any(ConnectionType.class));

    List<MigrationFile> foundList =
        migrationWorkflow.getMigrationFiles("nativePath", ConnectionType.MYSQL, "extensionPath");

    assertEquals(
        foundList.stream().map(f -> f.dir.getName()).collect(Collectors.toList()),
        List.of("1.1.0", "1.1.0-collate", "1.2.0", "1.2.1", "1.2.2-collate"));
  }
}
