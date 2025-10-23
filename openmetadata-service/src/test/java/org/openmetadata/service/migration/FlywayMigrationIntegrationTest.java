/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v1110.MigrationUtil;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class FlywayMigrationIntegrationTest extends OpenMetadataApplicationTest {

  private static MigrationDAO migrationDAO;
  private static ConnectionType connectionType;
  private static MigrationUtil migrationUtil;

  @BeforeAll
  public static void setup() {
    migrationDAO = jdbi.onDemand(MigrationDAO.class);
    connectionType =
        ConnectionType.from(APP.getConfiguration().getDataSourceFactory().getDriverClass());
    migrationUtil = new MigrationUtil(connectionType, null);
  }

  @Test
  public void testFlywayMigrationVersionsQuery() {
    List<String> flywayVersions = migrationDAO.getFlywayMigrationVersions();
    assertNotNull(flywayVersions, "Flyway migration versions list should not be null");

    // Verify that versions are ordered correctly
    if (flywayVersions.size() > 1) {
      for (int i = 1; i < flywayVersions.size(); i++) {
        String previous = flywayVersions.get(i - 1);
        String current = flywayVersions.get(i);
        assertTrue(
            previous.compareTo(current) <= 0,
            String.format(
                "Flyway versions should be ordered: %s should be <= %s", previous, current));
      }
    }
  }

  @Test
  public void testServerChangeLogFlywayRecords() {
    List<MigrationDAO.ServerChangeLog> flywayRecords = migrationDAO.getFlywayMigrationRecords();

    for (MigrationDAO.ServerChangeLog record : flywayRecords) {
      // Verify that the record has the expected Flyway characteristics
      assertNotNull(record.getVersion(), "Version should not be null");
      assertNotNull(record.getMigrationFileName(), "Migration file name should not be null");
      assertTrue(
          record.getMigrationFileName().contains("flyway"),
          "Migration file name should contain 'flyway'");

      // Verify version format for Flyway migrations (should be 0.0.X format)
      if (record.getMigrationFileName().contains("flyway")) {
        assertTrue(
            record.getVersion().matches("^0\\.0\\.\\d+$"),
            String.format(
                "Flyway version should match 0.0.X format, but was: %s", record.getVersion()));
      }

      // Verify that the file name includes the full path for proper identification
      assertTrue(
          record.getMigrationFileName().contains("bootstrap/sql/migrations/flyway")
              || record.getMigrationFileName().contains("v0")
              || record.getMigrationFileName().endsWith(".sql"),
          "Migration file name should contain proper path or be a valid SQL file");
    }
  }

  @Test
  public void testMigrationDAOFlywayVersionsConsistency() {
    List<String> flywayVersions = migrationDAO.getFlywayMigrationVersions();
    List<MigrationDAO.ServerChangeLog> flywayRecords = migrationDAO.getFlywayMigrationRecords();

    assertEquals(
        flywayRecords.size(),
        flywayVersions.size(),
        "Flyway versions and records should have same count");

    // Verify that each version from getFlywayMigrationVersions has a corresponding record
    for (int i = 0; i < flywayVersions.size(); i++) {
      String version = flywayVersions.get(i);
      MigrationDAO.ServerChangeLog record = flywayRecords.get(i);
      assertEquals(version, record.getVersion(), "Version should match between methods");
    }
  }

  @Test
  public void testFlywayMigrationFilePathFormat() {
    List<MigrationDAO.ServerChangeLog> flywayRecords = migrationDAO.getFlywayMigrationRecords();

    for (MigrationDAO.ServerChangeLog record : flywayRecords) {
      String filePath = record.getMigrationFileName();

      assertFalse(
          filePath.endsWith("org.postgresql.Driver")
              || filePath.endsWith("com.mysql.cj.jdbc.Driver"),
          String.format("File path should not end with driver name: %s", filePath));

      // Should contain proper Flyway path structure
      assertTrue(
          filePath.contains("flyway") || filePath.startsWith("v0"),
          String.format("File path should contain 'flyway' or be a versioned file: %s", filePath));
    }
  }

  @Test
  public void testMigrationUtilFlywayDataCheck() {
    try (Handle handle = jdbi.open()) {
      boolean flywayTableExists =
          migrationUtil.checkTableExists(handle, MigrationUtil.FLYWAY_TABLE_NAME);
      assertFalse(flywayTableExists, "Flyway schema history table should not exist for new runs");

      boolean serverChangeLogExists = migrationUtil.checkTableExists(handle, "SERVER_CHANGE_LOG");
      assertTrue(serverChangeLogExists, "SERVER_CHANGE_LOG table should exist after migrations");
    }
  }

  @Test
  public void testVersionFormatValidation() {
    List<String> flywayVersions = migrationDAO.getFlywayMigrationVersions();

    for (String version : flywayVersions) {
      assertTrue(
          version.matches("^\\d+\\.\\d+\\.\\d+.*$"),
          String.format("Version should follow semantic versioning format: %s", version));

      if (version.startsWith("0.0.")) {
        String[] parts = version.split("\\.");
        assertTrue(
            parts.length >= 3,
            String.format("0.0.X version should have at least 3 parts: %s", version));

        try {
          Integer.parseInt(parts[2]);
        } catch (NumberFormatException e) {
          assertTrue(
              parts[2].matches("\\d+.*"),
              String.format("Third version part should start with a number: %s", version));
        }
      }
    }
  }
}
