package org.openmetadata.service.migration.utils.v1100;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

@Slf4j
public class MigrationUtil {
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
      String sql;
      if (connectionType == ConnectionType.POSTGRES) {
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

  private int migrateDataContractStatus() {
    LOG.info(
        "Processing data_contract_entity: migrating 'status' to 'entityStatus' and 'Active' to 'Approved'");
    int totalMigrated = 0;

    try {
      String sql;
      if (connectionType == ConnectionType.POSTGRES) {
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
}
