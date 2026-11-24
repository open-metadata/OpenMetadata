/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.migration.utils.v202;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;

/**
 * MigrationFile resolves a version directory to its Migration class by package-name convention and
 * falls back to the no-op default when the class is absent, so a mismatch between the SQL directory
 * name and the Java package silently skips the whole data migration with no error. Pin the wiring
 * for 2.0.2 instead of finding out on an upgrade.
 */
class MigrationWiringTest {

  private static final Path MIGRATIONS_ROOT =
      Paths.get("..", "bootstrap", "sql", "migrations", "native");

  private File versionDir() {
    File dir = MIGRATIONS_ROOT.resolve("2.0.2").toFile();
    assertTrue(dir.isDirectory(), "missing native migration directory: " + dir);
    return dir;
  }

  @ParameterizedTest
  @EnumSource(ConnectionType.class)
  void theVersionDirectoryResolvesToTheV202MigrationClass(ConnectionType connectionType) {
    MigrationFile file =
        new MigrationFile(
            versionDir(),
            mock(MigrationDAO.class),
            connectionType,
            mock(OpenMetadataApplicationConfig.class),
            false);

    assertEquals("v202", file.getVersionPackageName());
    String dbPackage = connectionType == ConnectionType.MYSQL ? "mysql" : "postgres";
    assertEquals(
        "org.openmetadata.service.migration." + dbPackage + ".v202.Migration",
        file.getMigrationProcessClassName(),
        "2.0.2 fell back to the default no-op migration class; the data migration would not run");
  }

  @Test
  void bothDialectsShipASchemaChangesFile() {
    // The runner reads schemaChanges.sql per dialect; a missing one is a startup-time surprise.
    for (String dialect : new String[] {"mysql", "postgres"}) {
      assertTrue(
          MIGRATIONS_ROOT
              .resolve("2.0.2")
              .resolve(dialect)
              .resolve("schemaChanges.sql")
              .toFile()
              .isFile(),
          "missing " + dialect + "/schemaChanges.sql for 2.0.2");
      assertTrue(
          MIGRATIONS_ROOT
              .resolve("2.0.2")
              .resolve(dialect)
              .resolve("postDataMigrationSQLScript.sql")
              .toFile()
              .isFile(),
          "missing " + dialect + "/postDataMigrationSQLScript.sql for 2.0.2");
    }
  }
}
