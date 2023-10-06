package org.openmetadata.service.util;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.migration.utils.MigrationFile;

import java.io.File;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;

public class MigrationWorkflowTest extends OpenMetadataApplicationTest {

  @Test
  void test_getMigrationFiles() {

    MigrationWorkflow migrationWorkflow =
        new MigrationWorkflow(
            jdbi,
            "nativePath",
            ConnectionType.MYSQL,
           "extensionPath",
            false);

    List<MigrationFile> omMigrationList = List.of(
        new MigrationFile(new File("/bootstrap/sql/migrations/native/1.1.0/mysql"), null, ConnectionType.MYSQL),
        new MigrationFile(new File("/bootstrap/sql/migrations/native/1.2.0/mysql"), null, ConnectionType.MYSQL),
        new MigrationFile(new File("/bootstrap/sql/migrations/native/1.2.1/mysql"), null, ConnectionType.MYSQL)
    );


    Mockito.when(migrationWorkflow.getMigrationFilesFromPath("nativePath", any(ConnectionType.class)))
        .thenAnswer(i -> omMigrationList);

    List<MigrationFile> foundList = migrationWorkflow.getMigrationFilesFromPath("nativePath", ConnectionType.MYSQL);
  }
}
