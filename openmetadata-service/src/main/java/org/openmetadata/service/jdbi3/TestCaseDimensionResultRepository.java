package org.openmetadata.service.jdbi3;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.tests.type.TestCaseDimensionResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.dqtests.TestCaseDimensionResultResource;

@Slf4j
public class TestCaseDimensionResultRepository
    extends EntityTimeSeriesRepository<TestCaseDimensionResult> {
  public static final String TEST_CASE_DIMENSION_RESULT_EXTENSION = "testCase.dimensionResult";
  private static final String TEST_CASE_DIMENSION_RESULT_FIELD = "dimensionResult";

  private final CollectionDAO.TestCaseDimensionResultTimeSeriesDAO dimensionResultDao;

  public TestCaseDimensionResultRepository() {
    super(
        TestCaseDimensionResultResource.COLLECTION_PATH,
        Entity.getCollectionDAO().testCaseDimensionResultTimeSeriesDao(),
        TestCaseDimensionResult.class,
        Entity.TEST_CASE_DIMENSION_RESULT);
    this.dimensionResultDao = Entity.getCollectionDAO().testCaseDimensionResultTimeSeriesDao();
  }

  /**
   * List dimensional results for a test case within a time range
   * @param testCaseFQN Fully qualified name of the test case
   * @param startTs Start timestamp (optional)
   * @param endTs End timestamp (optional)
   * @param dimensionalityKey Optional filter by specific dimension key
   * @param dimensionName Optional filter by dimension name
   */
  public ResultList<TestCaseDimensionResult> listDimensionResults(
      String testCaseFQN,
      Long startTs,
      Long endTs,
      String dimensionalityKey,
      String dimensionName) {

    startTs = Optional.ofNullable(startTs).orElse(Long.MIN_VALUE);
    endTs = Optional.ofNullable(endTs).orElse(Long.MAX_VALUE);

    List<TestCaseDimensionResult> results;
    if (dimensionalityKey != null && !dimensionalityKey.isEmpty()) {
      // Filter by specific dimension key
      results =
          JsonUtils.readObjects(
              dimensionResultDao.listTestCaseDimensionResultsByKey(
                  testCaseFQN, dimensionalityKey, startTs, endTs),
              TestCaseDimensionResult.class);
    } else if (dimensionName != null && !dimensionName.isEmpty()) {
      // Filter by dimension name
      results =
          JsonUtils.readObjects(
              dimensionResultDao.listTestCaseDimensionResultsByDimensionName(
                  testCaseFQN, dimensionName, startTs, endTs),
              TestCaseDimensionResult.class);
    } else {
      // Get all dimension results
      results =
          JsonUtils.readObjects(
              dimensionResultDao.listTestCaseDimensionResults(testCaseFQN, startTs, endTs),
              TestCaseDimensionResult.class);
    }

    return new ResultList<>(
        results, String.valueOf(startTs), String.valueOf(endTs), results.size());
  }

  /**
   * List available dimensions for a test case within a time range
   * Returns a map of dimension names to their distinct values
   * @param testCaseFQN Fully qualified name of the test case
   */
  public Map<String, List<String>> listAvailableDimensions(
      String testCaseFQN, Long startTs, Long endTs) {
    startTs = Optional.ofNullable(startTs).orElse(Long.MIN_VALUE);
    endTs = Optional.ofNullable(endTs).orElse(Long.MAX_VALUE);

    List<String> dimensionKeys =
        dimensionResultDao.listAvailableDimensionKeys(testCaseFQN, startTs, endTs);

    // Parse dimension keys to extract dimension names and values
    Map<String, List<String>> dimensionMap = new HashMap<>();
    for (String key : dimensionKeys) {
      // Dimension key format: "column=value"
      String[] parts = key.split("=", 2);
      if (parts.length == 2) {
        String dimensionName = parts[0];
        String dimensionValue = parts[1];
        dimensionMap.computeIfAbsent(dimensionName, k -> new ArrayList<>()).add(dimensionValue);
      }
    }

    // Remove duplicates
    dimensionMap.replaceAll((k, v) -> v.stream().distinct().collect(Collectors.toList()));

    return dimensionMap;
  }

  /**
   * Store dimension result internally - called from TestCaseResultRepository
   * This is used when processing dimensional results from a test case result
   */
  public void storeDimensionResult(String testCaseFQN, TestCaseDimensionResult dimensionResult) {
    // Store the dimensional result using FQN as the entity hash
    ((CollectionDAO.TestCaseDimensionResultTimeSeriesDAO) timeSeriesDao)
        .insert(
            testCaseFQN, // Use FQN as the entity hash
            TEST_CASE_DIMENSION_RESULT_EXTENSION,
            TEST_CASE_DIMENSION_RESULT_FIELD,
            JsonUtils.pojoToJson(dimensionResult));
  }

  /**
   * Delete dimensional results for a specific test case and timestamp
   */
  public void deleteByTestCaseAndTimestamp(String testCaseFQN, Long timestamp) {
    // Delete all dimensional results at this timestamp
    timeSeriesDao.deleteAtTimestamp(testCaseFQN, TEST_CASE_DIMENSION_RESULT_EXTENSION, timestamp);
  }

  /**
   * Delete all dimensional results for a test case
   */
  public void deleteAllByTestCase(String testCaseFQN) {
    // Delete all dimensional results for this test case
    ((CollectionDAO.TestCaseDimensionResultTimeSeriesDAO) timeSeriesDao).deleteAll(testCaseFQN);
  }
}
