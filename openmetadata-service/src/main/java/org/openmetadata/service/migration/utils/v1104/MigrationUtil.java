package org.openmetadata.service.migration.utils.v1104;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

@Slf4j
public class MigrationUtil {
  private static final int BATCH_SIZE = 500;
  private final Handle handle;
  private final ConnectionType connectionType;

  public MigrationUtil(Handle handle, ConnectionType connectionType) {
    this.handle = handle;
    this.connectionType = connectionType;
  }

  public void migrateEntityExtensionStatus() {
    LOG.info("Processing entity_extension: migrating 'status' to 'entityStatus'");
    int totalMigrated = 0;

    try {
      totalMigrated += migrateGlossaryTermEntityExtensionStatus();
      totalMigrated += migrateDataContractEntityExtensionStatus();
    } catch (Exception e) {
      LOG.error("✗ FAILED migrating entity_extension status: {}", e.getMessage(), e);
    }

    LOG.info("===== MIGRATION SUMMARY =====");
    LOG.info("Total entity extensions migrated with status field changes: {}", totalMigrated);
    LOG.info("===== MIGRATION COMPLETE =====");
  }

  private int migrateGlossaryTermEntityExtensionStatus() {
    LOG.info("Processing entity_extension for glossaryTerm: migrating 'status' to 'entityStatus'");
    int totalMigrated = 0;

    try {
      // First, get the total count of entities that need migration
      String countSql = buildGlossaryTermEntityExtensionCountQuery();
      int totalToMigrate = handle.createQuery(countSql).mapTo(Integer.class).one();

      if (totalToMigrate == 0) {
        LOG.info("✓ Completed entity_extension for glossaryTerm: No records needed migration");
        return 0;
      }

      LOG.info("  Found {} glossary term versions to migrate", totalToMigrate);

      if (connectionType == ConnectionType.POSTGRES) {
        totalMigrated = migrateGlossaryTermEntityExtensionPostgresBatch(totalToMigrate);
      } else {
        totalMigrated = migrateGlossaryTermEntityExtensionMySQLBatch(totalToMigrate);
      }

      if (totalMigrated > 0) {
        LOG.info(
            "✓ Completed entity_extension for glossaryTerm: {} total records migrated",
            totalMigrated);
      }

    } catch (Exception e) {
      LOG.error(
          "✗ FAILED migrating entity_extension for glossaryTerm status: {}", e.getMessage(), e);
    }

    return totalMigrated;
  }

  private int migrateDataContractEntityExtensionStatus() {
    LOG.info("Processing entity_extension for dataContract: migrating 'status' to 'entityStatus'");
    int totalMigrated = 0;

    try {
      // First, get the total count of entities that need migration
      String countSql = buildDataContractEntityExtensionCountQuery();
      int totalToMigrate = handle.createQuery(countSql).mapTo(Integer.class).one();

      if (totalToMigrate == 0) {
        LOG.info("✓ Completed entity_extension for dataContract: No records needed migration");
        return 0;
      }

      LOG.info("  Found {} data contract versions to migrate", totalToMigrate);

      if (connectionType == ConnectionType.POSTGRES) {
        totalMigrated = migrateDataContractEntityExtensionPostgresBatch(totalToMigrate);
      } else {
        totalMigrated = migrateDataContractEntityExtensionMySQLBatch(totalToMigrate);
      }

      if (totalMigrated > 0) {
        LOG.info(
            "✓ Completed entity_extension for dataContract: {} total records migrated",
            totalMigrated);
      }

    } catch (Exception e) {
      LOG.error(
          "✗ FAILED migrating entity_extension for dataContract status: {}", e.getMessage(), e);
    }

    return totalMigrated;
  }

  private String buildGlossaryTermEntityExtensionCountQuery() {
    if (connectionType == ConnectionType.POSTGRES) {
      return "SELECT COUNT(*) FROM entity_extension "
          + "WHERE jsonSchema = 'glossaryTerm' AND json ?? 'status' AND NOT json ?? 'entityStatus'";
    } else {
      return "SELECT COUNT(*) FROM entity_extension "
          + "WHERE jsonSchema = 'glossaryTerm' AND JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
          + "AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0";
    }
  }

  private String buildDataContractEntityExtensionCountQuery() {
    if (connectionType == ConnectionType.POSTGRES) {
      return "SELECT COUNT(*) FROM entity_extension "
          + "WHERE jsonSchema = 'dataContract' AND json ?? 'status' AND NOT json ?? 'entityStatus'";
    } else {
      return "SELECT COUNT(*) FROM entity_extension "
          + "WHERE jsonSchema = 'dataContract' AND JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
          + "AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0";
    }
  }

  private int migrateGlossaryTermEntityExtensionPostgresBatch(int totalToMigrate)
      throws InterruptedException {
    int totalMigrated = 0;
    int batchNumber = 0;

    while (totalMigrated < totalToMigrate) {
      batchNumber++;

      String updateSql =
          String.format(
              "WITH batch AS ( "
                  + "  SELECT id, extension "
                  + "  FROM entity_extension "
                  + "  WHERE jsonSchema = 'glossaryTerm' AND json ?? 'status' AND NOT json ?? 'entityStatus' "
                  + "  ORDER BY id, extension "
                  + "  LIMIT %d "
                  + ") "
                  + "UPDATE entity_extension t "
                  + "SET json = jsonb_set(t.json - 'status', '{entityStatus}', "
                  + "COALESCE(t.json->'status', '\"Approved\"'::jsonb)) "
                  + "FROM batch "
                  + "WHERE t.id = batch.id AND t.extension = batch.extension"
                  + "  AND t.jsonSchema = 'glossaryTerm' AND t.json ?? 'status' AND NOT t.json ?? 'entityStatus'",
              BATCH_SIZE);

      long startTime = System.currentTimeMillis();
      int batchCount = handle.createUpdate(updateSql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (batchCount > 0) {
        totalMigrated += batchCount;
        LOG.info(
            "  Batch {}: Migrated {} glossary term versions in {}ms (Total: {}/{})",
            batchNumber,
            batchCount,
            executionTime,
            totalMigrated,
            totalToMigrate);
        Thread.sleep(100);
      } else {
        break;
      }
    }

    return totalMigrated;
  }

  private int migrateGlossaryTermEntityExtensionMySQLBatch(int totalToMigrate)
      throws InterruptedException {
    int totalMigrated = 0;
    int batchNumber = 0;

    while (totalMigrated < totalToMigrate) {
      batchNumber++;

      String updateSql =
          String.format(
              "UPDATE entity_extension t "
                  + "JOIN ( "
                  + "  SELECT id, extension "
                  + "  FROM entity_extension "
                  + "  WHERE jsonSchema = 'glossaryTerm' AND JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
                  + "    AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0 "
                  + "  ORDER BY id, extension "
                  + "  LIMIT %d "
                  + ") s ON t.id = s.id AND t.extension = s.extension "
                  + "SET t.json = JSON_SET(JSON_REMOVE(t.json, '$.status'), '$.entityStatus', "
                  + "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.status')), 'Approved')) "
                  + "WHERE t.jsonSchema = 'glossaryTerm' AND JSON_CONTAINS_PATH(t.json, 'one', '$.status') = 1 "
                  + "  AND JSON_CONTAINS_PATH(t.json, 'one', '$.entityStatus') = 0",
              BATCH_SIZE);

      long startTime = System.currentTimeMillis();
      int batchCount = handle.createUpdate(updateSql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (batchCount > 0) {
        totalMigrated += batchCount;
        LOG.info(
            "  Batch {}: Migrated {} glossary term versions in {}ms (Total: {}/{})",
            batchNumber,
            batchCount,
            executionTime,
            totalMigrated,
            totalToMigrate);
        Thread.sleep(100);
      } else {
        break;
      }
    }

    return totalMigrated;
  }

  private int migrateDataContractEntityExtensionPostgresBatch(int totalToMigrate)
      throws InterruptedException {
    int totalMigrated = 0;
    int batchNumber = 0;

    while (totalMigrated < totalToMigrate) {
      batchNumber++;

      String updateSql =
          String.format(
              "WITH batch AS ( "
                  + "  SELECT id, extension "
                  + "  FROM entity_extension "
                  + "  WHERE jsonSchema = 'dataContract' AND json ?? 'status' AND NOT json ?? 'entityStatus' "
                  + "  ORDER BY id, extension "
                  + "  LIMIT %d "
                  + ") "
                  + "UPDATE entity_extension t "
                  + "SET json = jsonb_set(t.json - 'status', '{entityStatus}', "
                  + "CASE "
                  + "  WHEN t.json->>'status' = 'Active' THEN '\"Approved\"'::jsonb "
                  + "  ELSE COALESCE(t.json->'status', '\"Approved\"'::jsonb) "
                  + "END) "
                  + "FROM batch "
                  + "WHERE t.id = batch.id AND t.extension = batch.extension "
                  + "  AND t.jsonSchema = 'dataContract' AND t.json ?? 'status' AND NOT t.json ?? 'entityStatus'",
              BATCH_SIZE);

      long startTime = System.currentTimeMillis();
      int batchCount = handle.createUpdate(updateSql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (batchCount > 0) {
        totalMigrated += batchCount;
        LOG.info(
            "  Batch {}: Migrated {} data contract versions in {}ms (Total: {}/{})",
            batchNumber,
            batchCount,
            executionTime,
            totalMigrated,
            totalToMigrate);
        Thread.sleep(100);
      } else {
        break;
      }
    }

    return totalMigrated;
  }

  private int migrateDataContractEntityExtensionMySQLBatch(int totalToMigrate)
      throws InterruptedException {
    int totalMigrated = 0;
    int batchNumber = 0;

    while (totalMigrated < totalToMigrate) {
      batchNumber++;

      String updateSql =
          String.format(
              "UPDATE entity_extension t "
                  + "JOIN ( "
                  + "  SELECT id, extension "
                  + "  FROM entity_extension "
                  + "  WHERE jsonSchema = 'dataContract' AND JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
                  + "    AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0 "
                  + "  ORDER BY id, extension "
                  + "  LIMIT %d "
                  + ") s ON t.id = s.id AND t.extension = s.extension "
                  + "SET t.json = JSON_SET(JSON_REMOVE(t.json, '$.status'), '$.entityStatus', "
                  + "CASE "
                  + "  WHEN JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.status')) = 'Active' THEN 'Approved' "
                  + "  ELSE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.status')), 'Approved') "
                  + "END) "
                  + "WHERE t.jsonSchema = 'dataContract' AND JSON_CONTAINS_PATH(t.json, 'one', '$.status') = 1 "
                  + "  AND JSON_CONTAINS_PATH(t.json, 'one', '$.entityStatus') = 0",
              BATCH_SIZE);

      long startTime = System.currentTimeMillis();
      int batchCount = handle.createUpdate(updateSql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (batchCount > 0) {
        totalMigrated += batchCount;
        LOG.info(
            "  Batch {}: Migrated {} data contract versions in {}ms (Total: {}/{})",
            batchNumber,
            batchCount,
            executionTime,
            totalMigrated,
            totalToMigrate);
        Thread.sleep(100);
      } else {
        break;
      }
    }

    return totalMigrated;
  }
}
