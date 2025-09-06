package org.openmetadata.service.migration.utils.v1100;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

@Slf4j
public class MigrationUtil {
  private static final int BATCH_SIZE = 500;
  private final ConnectionType connectionType;
  private boolean isPostgres = false;
  public static final String FLYWAY_TABLE_NAME = "DATABASE_CHANGE_LOG";

  public MigrationUtil(ConnectionType connectionType) {
    this.connectionType = connectionType;
  }

  public void migrateEntityStatusForExistingEntities(Handle handle) {
    try {
      Connection connection = handle.getConnection();
      DatabaseMetaData metaData = connection.getMetaData();
      String dbType = metaData.getDatabaseProductName().toLowerCase();
      isPostgres = dbType.contains("postgres") || dbType.contains("postgresql");

      LOG.info(
          "Starting entityStatus migration for v1.10.0 on {} database",
          isPostgres ? "PostgreSQL" : "MySQL");
    } catch (SQLException e) {
      LOG.error("Failed to determine database type, assuming MySQL: {}", e.getMessage());
      isPostgres = false;
    }

    // All entity tables that need entityStatus field
    String[] entityTables = {
      "table_entity",
      "dashboard_entity",
      "pipeline_entity",
      "topic_entity",
      "ml_model_entity",
      "storage_container_entity",
      "search_index_entity",
      "stored_procedure_entity",
      "dashboard_data_model_entity",
      "database_entity",
      "database_schema_entity",
      "metric_entity",
      "chart_entity",
      "report_entity",
      "data_product_entity",
      "tag",
      "classification",
      "glossary_term_entity",
      "data_contract_entity"
    };

    int totalEntitiesMigrated = 0;

    for (String tableName : entityTables) {
      int migrated = 0;

      if (tableName.equals("glossary_term_entity")) {
        migrated = migrateGlossaryTermStatus(handle);
      } else if (tableName.equals("data_contract_entity")) {
        migrated = migrateDataContractStatus(handle);
      } else {
        migrated = migrateEntityStatusForTable(handle, tableName);
      }

      totalEntitiesMigrated += migrated;
    }

    LOG.info("===== MIGRATION SUMMARY =====");
    LOG.info("Total entities migrated with entityStatus field: {}", totalEntitiesMigrated);
    LOG.info("===== MIGRATION COMPLETE =====");
  }

  private int migrateEntityStatusForTable(Handle handle, String tableName) {
    LOG.info("Processing table: {}", tableName);
    int totalMigrated = 0;
    int batchNumber = 0;

    try {
      // First, get the total count of entities that need migration
      String countSql = buildCountQuery(tableName);
      int totalToMigrate = handle.createQuery(countSql).mapTo(Integer.class).one();

      if (totalToMigrate == 0) {
        LOG.info(
            "✓ Completed {}: No records needed migration (already have entityStatus)", tableName);
        return 0;
      }

      LOG.info("  Found {} records to migrate in {}", totalToMigrate, tableName);

      if (isPostgres) {
        // PostgreSQL: Use CTE with LIMIT for batch processing
        totalMigrated = migratePostgresBatch(handle, tableName, totalToMigrate);
      } else {
        // MySQL: Need to use ORDER BY with LIMIT for deterministic batches
        totalMigrated = migrateMySQLBatch(handle, tableName, totalToMigrate);
      }

      if (totalMigrated > 0) {
        LOG.info("✓ Completed {}: {} total records migrated", tableName, totalMigrated);
      }

    } catch (Exception e) {
      LOG.error("✗ FAILED migrating entityStatus for table {}: {}", tableName, e.getMessage(), e);
    }

    return totalMigrated;
  }

  private int migratePostgresBatch(Handle handle, String tableName, int totalToMigrate)
      throws InterruptedException {
    int totalMigrated = 0;
    int batchNumber = 0;

    while (totalMigrated < totalToMigrate) {
      batchNumber++;

      String updateSql =
          String.format(
              "WITH batch AS ( "
                  + "  SELECT id "
                  + "  FROM %1$s "
                  + "  WHERE NOT ((json)::jsonb ?? 'entityStatus') "
                  + "  ORDER BY id "
                  + "  LIMIT %2$d "
                  + ") "
                  + "UPDATE %1$s t "
                  + "SET json = jsonb_set((t.json)::jsonb, '{entityStatus}', '\"Approved\"'::jsonb)::json "
                  + "FROM batch "
                  + "WHERE t.id = batch.id "
                  + "  AND NOT ((t.json)::jsonb ?? 'entityStatus')",
              tableName, BATCH_SIZE);

      long startTime = System.currentTimeMillis();
      int batchCount = handle.createUpdate(updateSql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (batchCount > 0) {
        totalMigrated += batchCount;
        LOG.info(
            "  Batch {}: Migrated {} records in {}ms (Total for {}: {}/{})",
            batchNumber,
            batchCount,
            executionTime,
            tableName,
            totalMigrated,
            totalToMigrate);
        Thread.sleep(100);
      } else {
        break;
      }
    }

    return totalMigrated;
  }

  private int migrateMySQLBatch(Handle handle, String tableName, int totalToMigrate)
      throws InterruptedException {
    int totalMigrated = 0;
    int batchNumber = 0;

    while (totalMigrated < totalToMigrate) {
      batchNumber++;

      String updateSql =
          String.format(
              "UPDATE %1$s t "
                  + "JOIN ( "
                  + "  SELECT id "
                  + "  FROM %1$s "
                  + "  WHERE JSON_EXTRACT(json, '$.entityStatus') IS NULL "
                  + "  ORDER BY id "
                  + "  LIMIT %2$d "
                  + ") s ON t.id = s.id "
                  + "SET t.json = JSON_SET(t.json, '$.entityStatus', 'Approved') "
                  + "WHERE JSON_EXTRACT(t.json, '$.entityStatus') IS NULL",
              tableName, BATCH_SIZE);

      long startTime = System.currentTimeMillis();
      int batchCount = handle.createUpdate(updateSql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (batchCount > 0) {
        totalMigrated += batchCount;
        LOG.info(
            "  Batch {}: Migrated {} records in {}ms (Total for {}: {}/{})",
            batchNumber,
            batchCount,
            executionTime,
            tableName,
            totalMigrated,
            totalToMigrate);
        Thread.sleep(100);
      } else {
        break;
      }
    }

    return totalMigrated;
  }

  private int migrateGlossaryTermStatus(Handle handle) {
    LOG.info("Processing glossary_term_entity: migrating 'status' to 'entityStatus'");
    int totalMigrated = 0;

    try {
      String sql;
      if (isPostgres) {
        sql =
            "UPDATE glossary_term_entity "
                + "SET json = jsonb_set(json - 'status', '{entityStatus}', "
                + "COALESCE(json->'status', '\"Approved\"'::jsonb)) "
                + "WHERE json ?? 'status' "
                + "AND NOT json ?? 'entityStatus'";
      } else {
        sql =
            "UPDATE glossary_term_entity "
                + "SET json = JSON_SET(JSON_REMOVE(json, '$.status'), '$.entityStatus', "
                + "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(json, '$.status')), 'Approved')) "
                + "WHERE JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
                + "AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0";
      }

      long startTime = System.currentTimeMillis();
      totalMigrated = handle.createUpdate(sql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (totalMigrated > 0) {
        LOG.info(
            "✓ Completed glossary_term_entity: {} records migrated from 'status' to 'entityStatus' in {}ms",
            totalMigrated,
            executionTime);
      } else {
        LOG.info("✓ Completed glossary_term_entity: No records needed migration");
      }

    } catch (Exception e) {
      LOG.error("✗ FAILED migrating glossary_term_entity status: {}", e.getMessage(), e);
    }

    return totalMigrated;
  }

  private int migrateDataContractStatus(Handle handle) {
    LOG.info(
        "Processing data_contract_entity: migrating 'status' to 'entityStatus' and 'Active' to 'Approved'");
    int totalMigrated = 0;

    try {
      String sql;
      if (isPostgres) {
        // PostgreSQL: Rename status to entityStatus and convert Active to Approved
        sql =
            "UPDATE data_contract_entity "
                + "SET json = jsonb_set(json - 'status', '{entityStatus}', "
                + "CASE "
                + "  WHEN json->>'status' = 'Active' THEN '\"Approved\"'::jsonb "
                + "  ELSE COALESCE(json->'status', '\"Approved\"'::jsonb) "
                + "END) "
                + "WHERE json ?? 'status' "
                + "AND NOT json ?? 'entityStatus'";
      } else {
        // MySQL: Rename status to entityStatus and convert Active to Approved
        sql =
            "UPDATE data_contract_entity "
                + "SET json = JSON_SET(JSON_REMOVE(json, '$.status'), '$.entityStatus', "
                + "CASE "
                + "  WHEN JSON_UNQUOTE(JSON_EXTRACT(json, '$.status')) = 'Active' THEN 'Approved' "
                + "  ELSE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(json, '$.status')), 'Approved') "
                + "END) "
                + "WHERE JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
                + "AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0";
      }

      long startTime = System.currentTimeMillis();
      totalMigrated = handle.createUpdate(sql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (totalMigrated > 0) {
        LOG.info(
            "✓ Completed data_contract_entity: {} records migrated from 'status' to 'entityStatus' in {}ms",
            totalMigrated,
            executionTime);
      } else {
        LOG.info("✓ Completed data_contract_entity: No records needed migration");
      }

    } catch (Exception e) {
      LOG.error("✗ FAILED migrating data_contract_entity status: {}", e.getMessage(), e);
    }

    return totalMigrated;
  }

  private String buildCountQuery(String tableName) {
    if (isPostgres) {
      return String.format(
          "SELECT COUNT(*) FROM %s " + "WHERE NOT (json ?? 'entityStatus')", tableName);

    } else {
      return String.format(
          "SELECT COUNT(*) FROM %s " + "WHERE JSON_EXTRACT(json, '$.entityStatus') IS NULL",
          tableName);
    }
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
