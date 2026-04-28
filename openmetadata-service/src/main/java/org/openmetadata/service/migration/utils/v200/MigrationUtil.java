package org.openmetadata.service.migration.utils.v200;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

/**
 * Migration utility for v2.0.0 that adds tableColumn (column) search settings configuration.
 *
 * <p>This migration adds the tableColumn asset type configuration to existing search settings,
 * enabling columns to be searchable as first-class entities in the Explore page and global search.
 */
@Slf4j
public class MigrationUtil {

  private static final String TABLE_COLUMN_ASSET_TYPE = "tableColumn";

  /**
   * Adds tableColumn (column) search settings configuration if it doesn't already exist.
   *
   * <p>This enables columns to appear in:
   *
   * <ul>
   *   <li>Data Assets dropdown aggregations in Explore page
   *   <li>Global search results
   *   <li>Tag/Glossary Term Assets tabs
   *   <li>Search Settings UI for configuration
   * </ul>
   */
  public static void addTableColumnSearchSettings() {
    try {
      LOG.info("Adding tableColumn search settings configuration for column search support");

      Settings searchSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();

      if (searchSettings == null) {
        LOG.warn(
            "Search settings not found in database. "
                + "Default settings will be loaded on next startup which includes tableColumn.");
        return;
      }

      SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(searchSettings);
      SearchSettings defaultSettings = SearchSettingsMergeUtil.loadSearchSettingsFromFile();

      if (defaultSettings == null) {
        LOG.error("Failed to load default search settings from file, skipping migration");
        return;
      }

      boolean assetTypeAdded =
          SearchSettingsMergeUtil.addMissingAssetTypeConfiguration(
              currentSettings, defaultSettings, TABLE_COLUMN_ASSET_TYPE);

      boolean allowedFieldsAdded =
          SearchSettingsMergeUtil.addMissingAllowedFields(
              currentSettings, defaultSettings, TABLE_COLUMN_ASSET_TYPE);

      if (assetTypeAdded || allowedFieldsAdded) {
        SearchSettingsMergeUtil.saveSearchSettings(searchSettings, currentSettings);
        LOG.info(
            "Successfully added tableColumn search settings: "
                + "assetTypeConfiguration={}, allowedFields={}",
            assetTypeAdded,
            allowedFieldsAdded);
      } else {
        LOG.info("tableColumn search settings already exist, no updates needed");
      }

    } catch (Exception e) {
      LOG.error("Error adding tableColumn search settings", e);
      throw new RuntimeException("Failed to add tableColumn search settings", e);
    }
  }

  public static void migrateTestCaseDataContractReferences(CollectionDAO collectionDAO) {
    LOG.info("Starting test case data contract migration");

    int totalTestCasesMigrated = 0;
    int dataContractsProcessed = 0;
    int pageSize = 1000;
    int offset = 0;

    while (true) {
      List<String> dataContractJsons =
          collectionDAO.dataContractDAO().listAfterWithOffset(pageSize, offset);
      if (dataContractJsons.isEmpty()) {
        break;
      }
      offset += pageSize;

      for (String dataContractJson : dataContractJsons) {
        try {
          DataContract dataContract = JsonUtils.readValue(dataContractJson, DataContract.class);

          if (nullOrEmpty(dataContract.getQualityExpectations())) {
            continue;
          }

          dataContractsProcessed++;
          int testCasesUpdated = 0;

          for (EntityReference testCaseRef : dataContract.getQualityExpectations()) {
            try {
              TestCase testCase = collectionDAO.testCaseDAO().findEntityById(testCaseRef.getId());
              if (testCase == null || testCase.getDataContract() != null) {
                continue;
              }

              testCase.setDataContract(
                  new EntityReference()
                      .withId(dataContract.getId())
                      .withType(Entity.DATA_CONTRACT)
                      .withFullyQualifiedName(dataContract.getFullyQualifiedName()));

              collectionDAO.testCaseDAO().update(testCase);
              testCasesUpdated++;
            } catch (Exception e) {
              LOG.warn("Failed to update test case {}: {}", testCaseRef.getId(), e.getMessage());
            }
          }

          totalTestCasesMigrated += testCasesUpdated;
        } catch (Exception e) {
          LOG.error("Failed to process data contract: {}", e.getMessage(), e);
        }
      }
    }

    LOG.info(
        "Test case data contract migration complete: {} contracts processed, {} test cases updated",
        dataContractsProcessed,
        totalTestCasesMigrated);
  }
}
