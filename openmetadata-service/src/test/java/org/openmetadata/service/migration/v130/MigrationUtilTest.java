package org.openmetadata.service.migration.v130;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import org.apache.http.client.HttpResponseException;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.migration.utils.v130.MigrationUtil;
import org.openmetadata.service.resources.dqtests.TestCaseResourceTest;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.ResultList;
import org.testcontainers.shaded.com.fasterxml.jackson.core.JsonProcessingException;
import org.testcontainers.shaded.com.fasterxml.jackson.databind.ObjectMapper;

public class MigrationUtilTest extends OpenMetadataApplicationTest {
  private static Handle handle;
  private static List<UUID> testCaseIds = new ArrayList<>();

  @BeforeAll
  public static void setup() {
    handle = jdbi.open();
  }

  @Test
  void test_testCaseResolutionMigration(TestInfo testInfo) throws JsonProcessingException, HttpResponseException {
    List<HashMap<String, Object>> testCases = new ArrayList<>();
    List<String> resolutionTypes = List.of("New", "Ack", "Resolved");
    Random rdn = new Random();
    ObjectMapper mapper = new ObjectMapper();

    Long startTs = System.currentTimeMillis();

    for (int i = 0; i < 10; i++) {
      // Insert legacy test cases
      String resolutionType = resolutionTypes.get(rdn.nextInt(resolutionTypes.size()));
      UUID testCaseId = UUID.randomUUID();
      testCaseIds.add(testCaseId);

      HashMap<String, Object> testCase = new HashMap<>();
      testCase.put("id", testCaseId);
      testCase.put("name", "test_case_" + i);
      testCase.put("fullyQualifiedName", "test_case_" + i);
      testCase.put("entityFQN", "test_case_" + i);
      testCase.put("updatedAt", System.currentTimeMillis());
      testCase.put("updatedBy", "admin");
      HashMap<String, Object> testCaseResult = new HashMap<>();
      HashMap<String, Object> testCaseFailureStatus = new HashMap<>();
      testCaseFailureStatus.put("updatedBy", "admin");
      testCaseFailureStatus.put("testCaseFailureStatusType", resolutionType);
      if (resolutionType.equals("Resolved")) {
        testCaseFailureStatus.put("testCaseFailureReason", "FalsePositive");
        testCaseFailureStatus.put("testCaseFailureComment", "FooBar");
      }
      testCaseFailureStatus.put("updatedAt", System.currentTimeMillis());
      testCaseResult.put("testCaseFailureStatus", testCaseFailureStatus);
      testCase.put("testCaseResult", testCaseResult);

      testCases.add(testCase);

      handle.execute(
          String.format(
              "INSERT INTO test_case (json, fqnHash) VALUES ('%s', '%s')",
              mapper.writeValueAsString(testCase),
              FullyQualifiedName.buildHash((String) testCase.get("fullyQualifiedName"))));
    }

    MigrationUtil.migrateTestCaseIncidentStatus(handle, handle.attach(CollectionDAO.class), 3);
    Long endTs = System.currentTimeMillis();

    TestCaseResourceTest testCaseResourceTest = new TestCaseResourceTest();
    ResultList<TestCaseResolutionStatus> testCaseResolutionStatuses =
        testCaseResourceTest.getTestCaseFailureStatus(startTs, endTs, null, null);
    Assertions.assertEquals(testCaseIds.size(), testCaseResolutionStatuses.getData().size());
    validateTestCaseResolutionStatusMigration(testCases, testCaseResolutionStatuses.getData());
  }

  private void validateTestCaseResolutionStatusMigration(
      List<HashMap<String, Object>> testCases, List<TestCaseResolutionStatus> testCaseResolutionStatuses) {
    // Validate the resolution statuses have been created
    HashMap<String, Object> testCasesMap = new HashMap<>();
    for (HashMap<String, Object> testCase : testCases) {
      testCasesMap.put((String) testCase.get("fullyQualifiedName"), testCase);
    }

    for (TestCaseResolutionStatus testCaseResolutionStatus : testCaseResolutionStatuses) {
      HashMap<String, Object> testCase =
          (HashMap<String, Object>)
              testCasesMap.get(testCaseResolutionStatus.getTestCaseReference().getFullyQualifiedName());
      Assertions.assertNotNull(testCase);

      HashMap<String, Object> testCaseResult = ((HashMap<String, Object>) testCase.get("testCaseResult"));

      Assertions.assertEquals(
          testCaseResolutionStatus.getTestCaseResolutionStatusType().toString(),
          ((HashMap<String, Object>) testCaseResult.get("testCaseFailureStatus")).get("testCaseFailureStatusType"));
    }
  }

  @AfterAll
  public static void tearDown() {
    handle.close();
  }
}
