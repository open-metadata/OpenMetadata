package org.openmetadata.service.migration.utils.v150;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.type.TestDefinitionDimension;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class MigrationUtil {
  public static void migrateTestCaseDimension(Handle handle, CollectionDAO collectionDAO) {
    String MYSQL_TEST_CASE_DIMENSION_QUERY =
        "SELECT json FROM test_definition WHERE JSON_CONTAINS(json -> '$.testPlatforms', '\"OpenMetadata\"')";
    String POSTGRES_TEST_CASE_DIMENSION_QUERY =
        "SELECT json FROM test_definition WHERE json -> 'testPlatforms' @> '\"OpenMetadata\"'";
    Map<String, TestDefinitionDimension> fqnToDimension =
        Map.ofEntries(
            Map.entry("columnValueMaxToBeBetween", TestDefinitionDimension.ACCURACY),
            Map.entry("columnValueMeanToBeBetween", TestDefinitionDimension.ACCURACY),
            Map.entry("columnValueMedianToBeBetween", TestDefinitionDimension.ACCURACY),
            Map.entry("columnValueMinToBeBetween", TestDefinitionDimension.ACCURACY),
            Map.entry("columnValueLengthsToBeBetween", TestDefinitionDimension.ACCURACY),
            Map.entry("columnValuesSumToBeBetween", TestDefinitionDimension.ACCURACY),
            Map.entry("columnValueStdDevToBeBetween", TestDefinitionDimension.ACCURACY),
            Map.entry("columnValuesToBeBetween", TestDefinitionDimension.ACCURACY),
            Map.entry("columnValuesToBeInSet", TestDefinitionDimension.VALIDITY),
            Map.entry("columnValuesToBeNotInSet", TestDefinitionDimension.VALIDITY),
            Map.entry("columnValuesToMatchRegex", TestDefinitionDimension.VALIDITY),
            Map.entry("columnValuesToNotMatchRegex", TestDefinitionDimension.VALIDITY),
            Map.entry("tableColumnCountToBeBetween", TestDefinitionDimension.INTEGRITY),
            Map.entry("tableColumnCountToEqual", TestDefinitionDimension.INTEGRITY),
            Map.entry("tableColumnNameToExist", TestDefinitionDimension.INTEGRITY),
            Map.entry("tableColumnToMatchSet", TestDefinitionDimension.INTEGRITY),
            Map.entry("tableRowCountToBeBetween", TestDefinitionDimension.INTEGRITY),
            Map.entry("tableRowCountToEqual", TestDefinitionDimension.INTEGRITY),
            Map.entry("tableRowInsertedCountToBeBetween", TestDefinitionDimension.INTEGRITY),
            Map.entry("columnValuesToBeUnique", TestDefinitionDimension.UNIQUENESS),
            Map.entry("columnValuesMissingCount", TestDefinitionDimension.COMPLETENESS),
            Map.entry("columnValuesToBeNotNull", TestDefinitionDimension.COMPLETENESS),
            Map.entry("tableCustomSQLQuery", TestDefinitionDimension.SQL),
            Map.entry("tableDiff", TestDefinitionDimension.CONSISTENCY));

    try {
      String query = POSTGRES_TEST_CASE_DIMENSION_QUERY;
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        query = MYSQL_TEST_CASE_DIMENSION_QUERY;
      }
      handle
          .createQuery(query)
          .mapToMap()
          .forEach(
              row -> {
                try {
                  TestDefinition testCaseDefinition =
                      JsonUtils.readValue(row.get("json").toString(), TestDefinition.class);
                  TestDefinitionDimension dimension =
                      fqnToDimension.get(testCaseDefinition.getFullyQualifiedName());
                  if (dimension == null) {
                    LOG.warn(
                        "No dimension found for test case {}",
                        testCaseDefinition.getFullyQualifiedName());
                    return;
                  }
                  testCaseDefinition.setDimension(dimension);
                  collectionDAO.testDefinitionDAO().update(testCaseDefinition);
                } catch (Exception e) {
                  LOG.warn("Error migrating test case dimension", e);
                }
              });
    } catch (Exception e) {
      LOG.warn("Error running the test case resolution migration ", e);
    }
  }
}
