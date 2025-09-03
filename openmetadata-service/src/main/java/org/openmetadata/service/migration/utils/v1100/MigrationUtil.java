package org.openmetadata.service.migration.utils.v1100;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

@Slf4j
public class MigrationUtil {

  public static final String FLYWAY_TABLE_NAME = "DATABASE_CHANGE_LOG";

  private final ConnectionType connectionType;

  public MigrationUtil(ConnectionType connectionType) {
    this.connectionType = connectionType;
  }

  /**
   * Migrate data from old Flyway schema history table to SERVER_CHANGE_LOG if it exists.
   * This consolidates migration tracking into a single table.
   */
  public void migrateFlywayHistory(Handle handle) {
    try {
      LOG.info("Starting v1100 migration of Flyway history to SERVER_CHANGE_LOG");

      // Check if DATABASE_CHANGE_LOG table exists
      boolean tableExists = checkTableExists(handle, "DATABASE_CHANGE_LOG");

      if (!tableExists) {
        LOG.info("Flyway DATABASE_CHANGE_LOG table does not exist, skipping migration");
        return;
      }

      // Check if Flyway records have already been migrated
      if (hasFlywayDataAlreadyMigrated(handle)) {
        LOG.info(
            "Flyway records have already been migrated to SERVER_CHANGE_LOG, skipping migration");
        return;
      }

      // Insert missing v000 baseline record if not present
      insertV000RecordIfMissing(handle);

      // Migrate Flyway migration records to SERVER_CHANGE_LOG
      int migratedCount = migrateFlywayHistoryRecords(handle);

      if (migratedCount > 0) {
        LOG.info(
            "Successfully migrated {} Flyway migration records to SERVER_CHANGE_LOG",
            migratedCount);
      } else {
        LOG.info("No new Flyway migration records to migrate");
      }

    } catch (Exception e) {
      LOG.error("Error during Flyway history migration", e);
    }
  }

  public boolean checkTableExists(Handle handle, String tableName) {
    String query =
        switch (connectionType) {
          case MYSQL -> "SELECT COUNT(*) FROM information_schema.tables "
              + "WHERE table_schema = DATABASE() AND table_name = ?";
          case POSTGRES -> "SELECT COUNT(*) FROM information_schema.tables "
              + "WHERE table_schema = current_schema() AND table_name = ?";
        };

    Integer count = handle.createQuery(query).bind(0, tableName).mapTo(Integer.class).one();

    return count > 0;
  }

  public boolean hasFlywayDataAlreadyMigrated(Handle handle) {
    String countQuery =
        switch (connectionType) {
          case MYSQL -> """
          SELECT COUNT(*) FROM SERVER_CHANGE_LOG scl
          INNER JOIN DATABASE_CHANGE_LOG dcl ON CONCAT('0.0.', CAST(dcl.version AS UNSIGNED)) = scl.version
          WHERE scl.migrationfilename LIKE '%flyway%'
          """;
          case POSTGRES -> """
          SELECT COUNT(*) FROM SERVER_CHANGE_LOG scl
          INNER JOIN "DATABASE_CHANGE_LOG" dcl ON '0.0.' || CAST(dcl.version AS INTEGER) = scl.version
          WHERE scl.migrationfilename LIKE '%flyway%'
          """;
        };

    Integer count = handle.createQuery(countQuery).mapTo(Integer.class).one();

    return count > 0;
  }

  private void insertV000RecordIfMissing(Handle handle) {
    String insertQuery =
        switch (connectionType) {
          case MYSQL -> """
          INSERT IGNORE INTO SERVER_CHANGE_LOG (version, migrationfilename, checksum, installed_on, metrics)
          VALUES ('0.0.0', 'bootstrap/sql/migrations/flyway/mysql/v000__create_db_connection_info.sql', '0', NOW(), NULL)
          """;
          case POSTGRES -> """
          INSERT INTO SERVER_CHANGE_LOG (version, migrationfilename, checksum, installed_on, metrics)
          VALUES ('0.0.0', 'bootstrap/sql/migrations/flyway/postgres/v000__create_db_connection_info.sql', '0', current_timestamp, NULL)
          ON CONFLICT (version) DO NOTHING
          """;
        };

    int inserted = handle.createUpdate(insertQuery).execute();
    if (inserted > 0) {
      LOG.info("Inserted missing v0.0.0 baseline record");
    }
  }

  private int migrateFlywayHistoryRecords(Handle handle) {
    String insertQuery =
        switch (connectionType) {
          case MYSQL -> """
          INSERT INTO SERVER_CHANGE_LOG (version, migrationfilename, checksum, installed_on, metrics)
          SELECT CONCAT('0.0.', CAST(version AS UNSIGNED)) as version,
                 CASE
                   WHEN script LIKE 'v%__.sql' THEN CONCAT('bootstrap/sql/migrations/flyway/mysql/', script)
                   ELSE CONCAT('bootstrap/sql/migrations/flyway/mysql/v', version, '__', REPLACE(LOWER(description), ' ', '_'), '.sql')
                 END as migrationfilename,
                 CAST(checksum as CHAR(256)) as checksum,
                 installed_on,
                 NULL as metrics
          FROM DATABASE_CHANGE_LOG
          WHERE CONCAT('0.0.', CAST(version AS UNSIGNED)) NOT IN (SELECT version FROM SERVER_CHANGE_LOG)
          AND success = true
          """;
          case POSTGRES -> """
          INSERT INTO SERVER_CHANGE_LOG (version, migrationfilename, checksum, installed_on, metrics)
          SELECT '0.0.' || CAST(version AS INTEGER) as version,
                 CASE
                   WHEN script LIKE 'v%__.sql' THEN 'bootstrap/sql/migrations/flyway/postgres/' || script
                   ELSE 'bootstrap/sql/migrations/flyway/postgres/v' || version || '__' || REPLACE(LOWER(description), ' ', '_') || '.sql'
                 END as migrationfilename,
                 checksum::VARCHAR(256) as checksum,
                 installed_on,
                 NULL as metrics
          FROM "DATABASE_CHANGE_LOG"
          WHERE '0.0.' || CAST(version AS INTEGER) NOT IN (SELECT version FROM SERVER_CHANGE_LOG)
          AND success = true
          """;
        };

    return handle.createUpdate(insertQuery).execute();
  }
}
