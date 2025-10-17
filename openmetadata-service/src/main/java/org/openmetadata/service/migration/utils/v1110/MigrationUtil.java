package org.openmetadata.service.migration.utils.v1110;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Slf4j
public class MigrationUtil {

  public static void migrateTestCaseDataContractReferences(CollectionDAO collectionDAO) {
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
