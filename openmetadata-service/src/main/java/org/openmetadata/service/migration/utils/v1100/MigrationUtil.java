package org.openmetadata.service.migration.utils.v1100;

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

  public void migrateEntityStatusForExistingEntities() {
    int totalEntitiesMigrated = 0;
    // Only migrate glossary terms and data contracts that have existing status fields
    totalEntitiesMigrated += migrateGlossaryTermStatus();
    totalEntitiesMigrated += migrateDataContractStatus();

    LOG.info("===== MIGRATION SUMMARY =====");
    LOG.info("Total entities migrated with status field changes: {}", totalEntitiesMigrated);
    LOG.info("===== MIGRATION COMPLETE =====");
  }

  private int migrateGlossaryTermStatus() {
    LOG.info("Processing glossary_term_entity: migrating 'status' to 'entityStatus'");
    int totalMigrated = 0;

    try {
      // First, get the total count of entities that need migration
      String countSql = buildGlossaryTermCountQuery();
      int totalToMigrate = handle.createQuery(countSql).mapTo(Integer.class).one();

      if (totalToMigrate == 0) {
        LOG.info("✓ Completed glossary_term_entity: No records needed migration");
        return 0;
      }

      LOG.info("  Found {} glossary terms to migrate", totalToMigrate);

      if (connectionType == ConnectionType.POSTGRES) {
        totalMigrated = migrateGlossaryTermPostgresBatch(totalToMigrate);
      } else {
        totalMigrated = migrateGlossaryTermMySQLBatch(totalToMigrate);
      }

      if (totalMigrated > 0) {
        LOG.info("✓ Completed glossary_term_entity: {} total records migrated", totalMigrated);
      }

    } catch (Exception e) {
      LOG.error("✗ FAILED migrating glossary_term_entity status: {}", e.getMessage(), e);
    }

    return totalMigrated;
  }

  private int migrateDataContractStatus() {
    LOG.info(
        "Processing data_contract_entity: migrating 'status' to 'entityStatus' and 'Active' to 'Approved'");
    int totalMigrated = 0;

    try {
      // First, get the total count of entities that need migration
      String countSql = buildDataContractCountQuery();
      int totalToMigrate = handle.createQuery(countSql).mapTo(Integer.class).one();

      if (totalToMigrate == 0) {
        LOG.info("✓ Completed data_contract_entity: No records needed migration");
        return 0;
      }

      LOG.info("  Found {} data contracts to migrate", totalToMigrate);

      if (connectionType == ConnectionType.POSTGRES) {
        totalMigrated = migrateDataContractPostgresBatch(totalToMigrate);
      } else {
        totalMigrated = migrateDataContractMySQLBatch(totalToMigrate);
      }

      if (totalMigrated > 0) {
        LOG.info("✓ Completed data_contract_entity: {} total records migrated", totalMigrated);
      }

    } catch (Exception e) {
      LOG.error("✗ FAILED migrating data_contract_entity status: {}", e.getMessage(), e);
    }

    return totalMigrated;
  }

  private String buildGlossaryTermCountQuery() {
    if (connectionType == ConnectionType.POSTGRES) {
      return "SELECT COUNT(*) FROM glossary_term_entity "
          + "WHERE json ?? 'status' AND NOT json ?? 'entityStatus'";
    } else {
      return "SELECT COUNT(*) FROM glossary_term_entity "
          + "WHERE JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
          + "AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0";
    }
  }

  private String buildDataContractCountQuery() {
    if (connectionType == ConnectionType.POSTGRES) {
      return "SELECT COUNT(*) FROM data_contract_entity "
          + "WHERE json ?? 'status' AND NOT json ?? 'entityStatus'";
    } else {
      return "SELECT COUNT(*) FROM data_contract_entity "
          + "WHERE JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
          + "AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0";
    }
  }

  private int migrateGlossaryTermPostgresBatch(int totalToMigrate) throws InterruptedException {
    int totalMigrated = 0;
    int batchNumber = 0;

    while (totalMigrated < totalToMigrate) {
      batchNumber++;

      String updateSql =
          String.format(
              "WITH batch AS ( "
                  + "  SELECT id "
                  + "  FROM glossary_term_entity "
                  + "  WHERE json ?? 'status' AND NOT json ?? 'entityStatus' "
                  + "  ORDER BY id "
                  + "  LIMIT %d "
                  + ") "
                  + "UPDATE glossary_term_entity t "
                  + "SET json = jsonb_set(t.json - 'status', '{entityStatus}', "
                  + "COALESCE(t.json->'status', '\"Approved\"'::jsonb)) "
                  + "FROM batch "
                  + "WHERE t.id = batch.id "
                  + "  AND t.json ?? 'status' AND NOT t.json ?? 'entityStatus'",
              BATCH_SIZE);

      long startTime = System.currentTimeMillis();
      int batchCount = handle.createUpdate(updateSql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (batchCount > 0) {
        totalMigrated += batchCount;
        LOG.info(
            "  Batch {}: Migrated {} glossary terms in {}ms (Total: {}/{})",
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

  private int migrateGlossaryTermMySQLBatch(int totalToMigrate) throws InterruptedException {
    int totalMigrated = 0;
    int batchNumber = 0;

    while (totalMigrated < totalToMigrate) {
      batchNumber++;

      String updateSql =
          String.format(
              "UPDATE glossary_term_entity t "
                  + "JOIN ( "
                  + "  SELECT id "
                  + "  FROM glossary_term_entity "
                  + "  WHERE JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
                  + "    AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0 "
                  + "  ORDER BY id "
                  + "  LIMIT %d "
                  + ") s ON t.id = s.id "
                  + "SET t.json = JSON_SET(JSON_REMOVE(t.json, '$.status'), '$.entityStatus', "
                  + "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.status')), 'Approved')) "
                  + "WHERE JSON_CONTAINS_PATH(t.json, 'one', '$.status') = 1 "
                  + "  AND JSON_CONTAINS_PATH(t.json, 'one', '$.entityStatus') = 0",
              BATCH_SIZE);

      long startTime = System.currentTimeMillis();
      int batchCount = handle.createUpdate(updateSql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (batchCount > 0) {
        totalMigrated += batchCount;
        LOG.info(
            "  Batch {}: Migrated {} glossary terms in {}ms (Total: {}/{})",
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

  private int migrateDataContractPostgresBatch(int totalToMigrate) throws InterruptedException {
    int totalMigrated = 0;
    int batchNumber = 0;

    while (totalMigrated < totalToMigrate) {
      batchNumber++;

      String updateSql =
          String.format(
              "WITH batch AS ( "
                  + "  SELECT id "
                  + "  FROM data_contract_entity "
                  + "  WHERE json ?? 'status' AND NOT json ?? 'entityStatus' "
                  + "  ORDER BY id "
                  + "  LIMIT %d "
                  + ") "
                  + "UPDATE data_contract_entity t "
                  + "SET json = jsonb_set(t.json - 'status', '{entityStatus}', "
                  + "CASE "
                  + "  WHEN t.json->>'status' = 'Active' THEN '\"Approved\"'::jsonb "
                  + "  ELSE COALESCE(t.json->'status', '\"Approved\"'::jsonb) "
                  + "END) "
                  + "FROM batch "
                  + "WHERE t.id = batch.id "
                  + "  AND t.json ?? 'status' AND NOT t.json ?? 'entityStatus'",
              BATCH_SIZE);

      long startTime = System.currentTimeMillis();
      int batchCount = handle.createUpdate(updateSql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (batchCount > 0) {
        totalMigrated += batchCount;
        LOG.info(
            "  Batch {}: Migrated {} data contracts in {}ms (Total: {}/{})",
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

  private int migrateDataContractMySQLBatch(int totalToMigrate) throws InterruptedException {
    int totalMigrated = 0;
    int batchNumber = 0;

    while (totalMigrated < totalToMigrate) {
      batchNumber++;

      String updateSql =
          String.format(
              "UPDATE data_contract_entity t "
                  + "JOIN ( "
                  + "  SELECT id "
                  + "  FROM data_contract_entity "
                  + "  WHERE JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
                  + "    AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0 "
                  + "  ORDER BY id "
                  + "  LIMIT %d "
                  + ") s ON t.id = s.id "
                  + "SET t.json = JSON_SET(JSON_REMOVE(t.json, '$.status'), '$.entityStatus', "
                  + "CASE "
                  + "  WHEN JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.status')) = 'Active' THEN 'Approved' "
                  + "  ELSE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.status')), 'Approved') "
                  + "END) "
                  + "WHERE JSON_CONTAINS_PATH(t.json, 'one', '$.status') = 1 "
                  + "  AND JSON_CONTAINS_PATH(t.json, 'one', '$.entityStatus') = 0",
              BATCH_SIZE);

      long startTime = System.currentTimeMillis();
      int batchCount = handle.createUpdate(updateSql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (batchCount > 0) {
        totalMigrated += batchCount;
        LOG.info(
            "  Batch {}: Migrated {} data contracts in {}ms (Total: {}/{})",
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
