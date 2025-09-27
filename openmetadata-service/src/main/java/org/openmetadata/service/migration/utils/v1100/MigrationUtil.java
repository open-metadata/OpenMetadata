package org.openmetadata.service.migration.utils.v1100;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

@Slf4j
public class MigrationUtil {
  private static final int BATCH_SIZE = 500;
  private final Handle handle;
  private final ConnectionType connectionType;
  private final CollectionDAO collectionDAO;

  public MigrationUtil(CollectionDAO collectionDAO, Handle handle, ConnectionType connectionType) {
    this.handle = handle;
    this.connectionType = connectionType;
    this.collectionDAO = collectionDAO;
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

  public void migrateTestCaseDataContractReferences() {
    LOG.info("===== STARTING TEST CASE DATA CONTRACT MIGRATION =====");

    int totalTestCasesMigrated = 0;
    int dataContractsProcessed = 0;
    int pageSize = 1000;
    int offset = 0;

    try {
      // Step 1: Paginate through all data contracts using DAO
      while (true) {
        List<String> dataContractJsons =
            collectionDAO.dataContractDAO().listAfterWithOffset(pageSize, offset);
        if (dataContractJsons.isEmpty()) {
          break;
        }
        offset += pageSize;

        LOG.info(
            "Processing {} data contracts in batch (offset: {})",
            dataContractJsons.size(),
            offset - pageSize);

        for (String dataContractJson : dataContractJsons) {
          try {
            DataContract dataContract = JsonUtils.readValue(dataContractJson, DataContract.class);

            // Step 2: Filter - only process contracts with quality expectations
            if (nullOrEmpty(dataContract.getQualityExpectations())) {
              LOG.debug(
                  "Data contract {} has no quality expectations, skipping",
                  dataContract.getFullyQualifiedName());
              continue;
            }

            LOG.debug(
                "Processing data contract: {} (ID: {}) with {} quality expectations",
                dataContract.getFullyQualifiedName(),
                dataContract.getId(),
                dataContract.getQualityExpectations().size());
            dataContractsProcessed++;

            // Step 3: Process each test case in quality expectations
            int testCasesUpdated = 0;
            for (EntityReference testCaseRef : dataContract.getQualityExpectations()) {
              try {
                // Get test case using DAO
                TestCase testCase = collectionDAO.testCaseDAO().findEntityById(testCaseRef.getId());
                if (testCase == null) {
                  LOG.debug("Test case not found: {}", testCaseRef.getId());
                  continue;
                }

                // Check if test case already has dataContract reference
                if (testCase.getDataContract() != null) {
                  LOG.debug(
                      "Test case {} already has dataContract reference",
                      testCase.getFullyQualifiedName());
                  continue;
                }

                // Step 4: Update test case with dataContract reference using DAO
                testCase.setDataContract(
                    new EntityReference()
                        .withId(dataContract.getId())
                        .withType(Entity.DATA_CONTRACT)
                        .withFullyQualifiedName(dataContract.getFullyQualifiedName()));

                // Update the test case using DAO
                collectionDAO.testCaseDAO().update(testCase);
                testCasesUpdated++;

                LOG.debug(
                    "Updated test case {} with dataContract reference to {}",
                    testCase.getFullyQualifiedName(),
                    dataContract.getFullyQualifiedName());

              } catch (Exception e) {
                LOG.warn("Failed to update test case {}: {}", testCaseRef.getId(), e.getMessage());
              }
            }

            totalTestCasesMigrated += testCasesUpdated;

            if (testCasesUpdated > 0) {
              LOG.info(
                  "Updated {} test cases for data contract: {}",
                  testCasesUpdated,
                  dataContract.getFullyQualifiedName());
            }

          } catch (Exception e) {
            LOG.error("Failed to process data contract: {}", e.getMessage(), e);
          }
        }
      }

    } catch (Exception e) {
      LOG.error("Error during test case dataContract migration: {}", e.getMessage(), e);
      throw new RuntimeException("Migration failed", e);
    }

    LOG.info("===== TEST CASE DATA CONTRACT MIGRATION SUMMARY =====");
    LOG.info("Data contracts processed: {}", dataContractsProcessed);
    LOG.info("Total test cases updated with dataContract reference: {}", totalTestCasesMigrated);
    LOG.info("===== MIGRATION COMPLETE =====");
  }
}
