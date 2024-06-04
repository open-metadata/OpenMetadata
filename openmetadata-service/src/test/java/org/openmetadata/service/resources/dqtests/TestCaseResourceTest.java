package org.openmetadata.service.resources.dqtests;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.schema.type.ColumnDataType.BIGINT;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_TESTS;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.jdbi3.TestCaseRepository.FAILED_ROWS_SAMPLE_EXTENSION;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.security.SecurityUtil.getPrincipalName;
import static org.openmetadata.service.security.mask.PIIMasker.MASKED_VALUE;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_USER_NAME;
import static org.openmetadata.service.util.TestUtils.UpdateType.CHANGE_CONSOLIDATED;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertEntityPagination;
import static org.openmetadata.service.util.TestUtils.assertListNotEmpty;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;
import static org.openmetadata.service.util.TestUtils.dateToTimestamp;

import java.io.IOException;
import java.text.ParseException;
import java.util.*;
import java.util.stream.Collectors;
import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.Assigned;
import org.openmetadata.schema.tests.type.ColumnTestSummaryDefinition;
import org.openmetadata.schema.tests.type.Resolved;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseFailureReasonType;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.feeds.FeedResourceTest;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;
import org.openmetadata.service.util.incidentSeverityClassifier.IncidentSeverityClassifierInterface;
import org.testcontainers.shaded.com.google.common.collect.ImmutableMap;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Slf4j
public class TestCaseResourceTest extends EntityResourceTest<TestCase, CreateTestCase> {
  public static String TABLE_LINK;
  public static String TABLE_COLUMN_LINK;
  public static String TABLE_LINK_2;
  public static String TABLE_COLUMN_LINK_2;
  public static String INVALID_LINK1;
  public static String INVALID_LINK2;
  protected boolean supportsSearchIndex = true;

  public TestCaseResourceTest() {
    super(
        Entity.TEST_CASE,
        org.openmetadata.schema.tests.TestCase.class,
        TestCaseResource.TestCaseList.class,
        "dataQuality/testCases",
        TestCaseResource.FIELDS);
    supportsTags = false; // Test cases do not support setting tags directly (inherits from Entity)
  }

  public void setupTestCase(TestInfo test) throws IOException {
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable tableReq =
        tableResourceTest
            .createRequest(test)
            .withName("testCase'_ Table")
            .withDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName())
            .withOwner(USER1_REF)
            .withColumns(
                List.of(
                    new Column().withName(C1).withDisplayName("c1").withDataType(BIGINT),
                    new Column()
                        .withName(C2)
                        .withDisplayName("c2")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10),
                    new Column().withName(C3).withDisplayName("c3").withDataType(BIGINT)))
            .withOwner(USER1_REF);
    TEST_TABLE1 = tableResourceTest.createAndCheckEntity(tableReq, ADMIN_AUTH_HEADERS);
    tableReq =
        tableResourceTest
            .createRequest(test)
            .withName("testCaseTable" + UUID.randomUUID())
            .withDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName(C1)
                        .withDisplayName("c1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10)))
            .withOwner(USER1_REF);
    TEST_TABLE2 = tableResourceTest.createAndCheckEntity(tableReq, ADMIN_AUTH_HEADERS);
    TABLE_LINK = String.format("<#E::table::%s>", TEST_TABLE1.getFullyQualifiedName());
    TABLE_LINK_2 = String.format("<#E::table::%s>", TEST_TABLE2.getFullyQualifiedName());
    TABLE_COLUMN_LINK =
        String.format("<#E::table::%s::columns::%s>", TEST_TABLE1.getFullyQualifiedName(), C1);
    TABLE_COLUMN_LINK_2 =
        String.format("<#E::table::%s::columns::%s>", TEST_TABLE2.getFullyQualifiedName(), C1);
    INVALID_LINK1 = String.format("<#E::dashboard::%s", "temp");
    INVALID_LINK2 = String.format("<#E::table::%s>", "non-existent");
  }

  @Test
  void test_getEntityName(TestInfo test) {
    assertTrue(getEntityName(test).contains(supportedNameCharacters));
  }

  @Override
  @Test
  public void patch_entityDescriptionAndTestAuthorizer(TestInfo test) throws IOException {
    // TestCase is treated as an operation on an entity being tested, such as table
    TestCase entity =
        createEntity(
            createRequest(getEntityName(test), "description", null, null), ADMIN_AUTH_HEADERS);

    // Admin can edit tests
    entity = patchEntityAndCheckAuthorization(entity, ADMIN_USER_NAME, false);

    // Other roles and non-owner can't edit tests
    entity = patchEntityAndCheckAuthorization(entity, DATA_STEWARD.getName(), EDIT_TESTS, true);
    entity = patchEntityAndCheckAuthorization(entity, DATA_CONSUMER.getName(), EDIT_TESTS, true);
    patchEntityAndCheckAuthorization(entity, USER2.getName(), EDIT_TESTS, true);
  }

  @Test
  void patch_entityComputePassedFailedRowCount(TestInfo test) throws IOException {
    TestCase entity =
        createEntity(
            createRequest(getEntityName(test), "description", null, null), ADMIN_AUTH_HEADERS);
    String json = JsonUtils.pojoToJson(entity);
    entity.setComputePassedFailedRowCount(true);

    patchEntity(entity.getId(), json, entity, ADMIN_AUTH_HEADERS);

    entity = getEntity(entity.getId(), ADMIN_AUTH_HEADERS);

    assertTrue(entity.getComputePassedFailedRowCount());
  }

  @Test
  void post_testWithoutRequiredFields_4xx(TestInfo test) {
    // name is required field
    assertResponse(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[name must not be null]");
  }

  @Test
  void post_testWithInvalidEntityTestSuite_4xx(TestInfo test) throws IOException {
    CreateTestCase create = createRequest(test);
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    CreateTestSuite createTestSuite =
        testSuiteResourceTest.createRequest(test).withName(TEST_TABLE1.getFullyQualifiedName());
    TestSuite testSuite =
        testSuiteResourceTest.createExecutableTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);

    create.withEntityLink(INVALID_LINK1).withTestSuite(testSuite.getFullyQualifiedName());
    assertResponseContains(
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        ENTITY_LINK_MATCH_ERROR);

    create.withEntityLink(INVALID_LINK2).withTestSuite(testSuite.getFullyQualifiedName());
    assertResponseContains(
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        "table instance for non-existent not found");

    CreateTestCase create1 = createRequest(test);
    create1.withTestSuite(TEST_DEFINITION1.getFullyQualifiedName());
    assertResponseContains(
        () -> createAndCheckEntity(create1, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        "testSuite instance for " + TEST_DEFINITION1.getFullyQualifiedName() + " not found");

    CreateTestCase create2 = createRequest(test);
    create2
        .withEntityLink(TABLE_LINK)
        .withTestSuite(testSuite.getFullyQualifiedName())
        .withTestDefinition(TEST_SUITE1.getFullyQualifiedName());
    assertResponseContains(
        () -> createAndCheckEntity(create2, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        "testDefinition instance for " + TEST_SUITE1.getFullyQualifiedName() + " not found");
  }

  @Test
  void post_testWithInvalidParamValues_4xx(TestInfo test) {
    CreateTestCase create = createRequest(test);
    create
        .withEntityLink(TABLE_LINK)
        .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
        .withTestDefinition(TEST_DEFINITION2.getFullyQualifiedName())
        .withParameterValues(List.of(new TestCaseParameterValue().withName("col").withValue("x")));
    assertResponseContains(
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Parameter Values doesn't match Test Definition Parameters");

    CreateTestCase create1 = createRequest(test);
    create1
        .withEntityLink(TABLE_LINK)
        .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
        .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName());
    assertResponseContains(
        () -> createAndCheckEntity(create1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Required parameter missingCountValue is not passed in parameterValues");
  }

  @Test
  void createUpdateDelete_tests_200(TestInfo test) throws IOException {
    // Create a test case
    CreateTestCase create = createRequest(test);
    create
        .withEntityLink(TABLE_LINK)
        .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
        .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
        .withParameterValues(
            List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Change the test with PUT request
    create
        .withTestDefinition(TEST_DEFINITION2.getFullyQualifiedName())
        .withParameterValues(new ArrayList<>());
    ChangeDescription change = getChangeDescription(testCase, MINOR_UPDATE);
    fieldUpdated(
        change,
        "testDefinition",
        TEST_DEFINITION3.getEntityReference(),
        TEST_DEFINITION2.getEntityReference());
    fieldUpdated(change, "parameterValues", testCase.getParameterValues(), new ArrayList<>());
    updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_testCaseResults_200(TestInfo test)
      throws IOException, ParseException, InterruptedException {
    CreateTestCase create = createRequest(test);
    create
        .withEntityLink(TABLE_COLUMN_LINK)
        .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
        .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
        .withParameterValues(
            List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    TestCaseResult testCaseResult =
        new TestCaseResult()
            .withResult("tested")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-09"));
    putTestCaseResult(testCase.getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);

    ResultList<TestCaseResult> testCaseResults =
        getTestCaseResults(
            testCase.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-10"),
            ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, List.of(testCaseResult), 1);

    // Add new data for TableCaseResult
    TestCaseResult newTestCaseResult =
        new TestCaseResult()
            .withResult("tested")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-10"));
    putTestCaseResult(testCase.getFullyQualifiedName(), newTestCaseResult, ADMIN_AUTH_HEADERS);

    testCaseResults =
        getTestCaseResults(
            testCase.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-10"),
            ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, List.of(newTestCaseResult, testCaseResult), 2);

    testCase = getEntity(testCase.getId(), "testCaseResult", ADMIN_AUTH_HEADERS);
    // first result should be the latest date
    testCaseResults =
        getTestCaseResults(
            testCase.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-10"),
            ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, List.of(newTestCaseResult, testCaseResult), 2);

    String dateStr = "2021-09-";
    List<TestCaseResult> testCaseResultList = new ArrayList<>();
    testCaseResultList.add(testCaseResult);
    testCaseResultList.add(newTestCaseResult);
    for (int i = 11; i <= 20; i++) {
      testCaseResult =
          new TestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Success)
              .withTimestamp(TestUtils.dateToTimestamp(dateStr + i));
      putTestCaseResult(testCase.getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);
      testCaseResultList.add(testCaseResult);
    }
    testCaseResults =
        getTestCaseResults(
            testCase.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-20"),
            ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, testCaseResultList, 12);

    // create another table and add test results
    TestCase testCase1 = createAndCheckEntity(createRequest(test, 1), ADMIN_AUTH_HEADERS);
    List<TestCaseResult> testCase1ResultList = new ArrayList<>();
    dateStr = "2021-10-";
    for (int i = 11; i <= 15; i++) {
      testCaseResult =
          new TestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Failed)
              .withTimestamp(TestUtils.dateToTimestamp(dateStr + i));
      putTestCaseResult(testCase1.getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);
      testCase1ResultList.add(testCaseResult);
    }
    testCaseResults =
        getTestCaseResults(
            testCase1.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-10-11"),
            TestUtils.dateToTimestamp("2021-10-15"),
            ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, testCase1ResultList, 5);
    deleteTestCaseResult(
        testCase1.getFullyQualifiedName(),
        TestUtils.dateToTimestamp("2021-10-11"),
        ADMIN_AUTH_HEADERS);
    testCase1ResultList.remove(0);
    testCaseResults =
        getTestCaseResults(
            testCase1.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-10-11"),
            TestUtils.dateToTimestamp("2021-10-15"),
            ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, testCase1ResultList, 4);

    if (supportsSearchIndex) {
      getAndValidateTestSummary(null);
    }

    // Test that we can get the test summary for a logical test suite and that
    // adding a logical test suite does not change the total number of tests
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    CreateTestSuite createLogicalTestSuite = testSuiteResourceTest.createRequest(test);
    TestSuite logicalTestSuite =
        testSuiteResourceTest.createEntity(createLogicalTestSuite, ADMIN_AUTH_HEADERS);
    List<UUID> testCaseIds = new ArrayList<>();
    testCaseIds.add(testCase1.getId());
    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, testCaseIds);

    if (supportsSearchIndex) {
      getAndValidateTestSummary(logicalTestSuite.getId().toString());
      getAndValidateTestSummary(null);
    }

    // add a new test case to the logical test suite to validate if the
    // summary is updated correctly
    testCaseIds.clear();
    testCaseIds.add(testCase.getId());
    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, testCaseIds);
    if (supportsSearchIndex) {
      getAndValidateTestSummary(logicalTestSuite.getId().toString());
      getAndValidateTestSummary(null);
    }

    // remove test case from logical test suite and validate
    // the summary is updated as expected
    deleteLogicalTestCase(logicalTestSuite, testCase.getId());

    if (supportsSearchIndex) {
      getAndValidateTestSummary(logicalTestSuite.getId().toString());
      getAndValidateTestSummary(null);
    }
  }

  @Test
  void test_resultSummaryCascadeToAllSuites(TestInfo test)
      throws IOException, ParseException, InterruptedException {
    TestCase testCase = createAndCheckEntity(createRequest(test, 1), ADMIN_AUTH_HEADERS);
    TestCase testCase1 = createAndCheckEntity(createRequest(test, 2), ADMIN_AUTH_HEADERS);

    TestCaseResult testCaseResult;

    String dateStr = "2021-10-";
    for (int i = 11; i <= 15; i++) {
      testCaseResult =
          new TestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Failed)
              .withTimestamp(TestUtils.dateToTimestamp(dateStr + i));
      putTestCaseResult(testCase.getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);
    }

    for (int i = 11; i <= 20; i++) {
      testCaseResult =
          new TestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Success)
              .withTimestamp(TestUtils.dateToTimestamp(dateStr + i));
      putTestCaseResult(testCase1.getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);
    }

    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    CreateTestSuite createLogicalTestSuite = testSuiteResourceTest.createRequest(test);
    TestSuite logicalTestSuite =
        testSuiteResourceTest.createEntity(createLogicalTestSuite, ADMIN_AUTH_HEADERS);
    List<UUID> testCaseIds = new ArrayList<>();
    testCaseIds.add(testCase1.getId());
    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, testCaseIds);

    TestSuite testSuite =
        testSuiteResourceTest.getEntity(testCase.getTestSuite().getId(), "*", ADMIN_AUTH_HEADERS);
    if (supportsSearchIndex) {
      // test we get the right summary for the executable test suite
      getAndValidateTestSummary(testCase.getTestSuite().getId().toString());
    }

    // test we get the right summary for the logical test suite

    if (supportsSearchIndex) {
      getAndValidateTestSummary(logicalTestSuite.getId().toString());
    }
    testCaseIds.clear();
    testCaseIds.add(testCase.getId());
    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, testCaseIds);
    if (supportsSearchIndex) {
      getAndValidateTestSummary(logicalTestSuite.getId().toString());
    }
    deleteEntity(testCase1.getId(), ADMIN_AUTH_HEADERS);

    if (supportsSearchIndex) {
      getAndValidateTestSummary(testCase.getTestSuite().getId().toString());
      getAndValidateTestSummary(logicalTestSuite.getId().toString());
    }
    // check the deletion of the test case from the executable test suite
    // cascaded to the logical test suite
    deleteLogicalTestCase(logicalTestSuite, testCase.getId());

    if (supportsSearchIndex) {
      getAndValidateTestSummary(logicalTestSuite.getId().toString());
    }
  }

  @Test
  void test_sensitivePIITestCase(TestInfo test) throws IOException {
    // First, create a table with PII Sensitive tag in a column
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable tableReq = getSensitiveTableReq(test, tableResourceTest);
    Table sensitiveTable = tableResourceTest.createAndCheckEntity(tableReq, ADMIN_AUTH_HEADERS);
    String sensitiveColumnLink =
        String.format("<#E::table::%s::columns::%s>", sensitiveTable.getFullyQualifiedName(), C1);

    CreateTestCase create = createRequest(test);
    create
        .withEntityLink(sensitiveColumnLink)
        .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
        .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
        .withParameterValues(
            List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Owner can see the results
    Map<String, Object> queryParamsOne =
        ImmutableMap.of("limit", 10, "entityLink", sensitiveColumnLink, "fields", "*");
    ResultList<TestCase> testCases = getTestCases(queryParamsOne, authHeaders(USER1_REF.getName()));
    assertNotNull(testCases.getData().get(0).getDescription());
    assertListNotEmpty(testCases.getData().get(0).getParameterValues());

    // Owner can see the results
    Map<String, Object> queryParamsTwo =
        ImmutableMap.of("limit", 10, "entityLink", sensitiveColumnLink, "fields", "*");
    ResultList<TestCase> maskedTestCases =
        getTestCases(queryParamsTwo, authHeaders(USER2_REF.getName()));
    assertNull(maskedTestCases.getData().get(0).getDescription());
    assertEquals(0, maskedTestCases.getData().get(0).getParameterValues().size());
  }

  private CreateTable getSensitiveTableReq(TestInfo test, TableResourceTest tableResourceTest) {
    return tableResourceTest
        .createRequest(test)
        .withName(test.getDisplayName() + "_sensitiveTableTest")
        .withDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName())
        .withOwner(USER1_REF)
        .withColumns(
            List.of(
                new Column()
                    .withName(C1)
                    .withDisplayName("c1")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(10)
                    .withTags(List.of(PII_SENSITIVE_TAG_LABEL))));
  }

  @Test
  @Order(1)
  void put_testCase_list_200(TestInfo test) throws IOException {
    List<CreateTestCase> expectedTestCaseList = new ArrayList<>();
    List<CreateTestCase> expectedColTestCaseList = new ArrayList<>();

    CreateTestCase create =
        createRequest(test)
            .withEntityLink(TABLE_LINK_2)
            .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
            .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
            .withParameterValues(
                List.of(
                    new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    expectedTestCaseList.add(create);
    CreateTestCase create1 =
        createRequest(test, 1)
            .withEntityLink(TABLE_LINK_2)
            .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
            .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
            .withParameterValues(
                List.of(
                    new TestCaseParameterValue().withValue("20").withName("missingCountValue")));
    createAndCheckEntity(create1, ADMIN_AUTH_HEADERS);
    expectedTestCaseList.add(create1);
    Map<String, Object> queryParams = new HashMap<>();
    queryParams.put("limit", 10);
    queryParams.put("entityLink", TABLE_LINK_2);
    queryParams.put("fields", "*");
    ResultList<TestCase> testCaseList = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedTestCaseList, 2);

    CreateTestCase create3 =
        createRequest(test, 2)
            .withEntityLink(TABLE_COLUMN_LINK_2)
            .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
            .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
            .withParameterValues(
                List.of(
                    new TestCaseParameterValue().withValue("20").withName("missingCountValue")));
    createAndCheckEntity(create3, ADMIN_AUTH_HEADERS);
    expectedColTestCaseList.add(create3);

    testCaseList = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedTestCaseList, 2);

    queryParams.put("entityLink", TABLE_COLUMN_LINK_2);
    testCaseList = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedColTestCaseList, 1);

    for (int i = 3; i < 12; i++) {
      CreateTestCase create4 =
          createRequest(test, i)
              .withEntityLink(TABLE_COLUMN_LINK_2)
              .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
              .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
              .withParameterValues(
                  List.of(
                      new TestCaseParameterValue().withValue("20").withName("missingCountValue")));
      createAndCheckEntity(create4, ADMIN_AUTH_HEADERS);
      expectedColTestCaseList.add(create4);
    }

    queryParams.put("entityLink", TABLE_COLUMN_LINK_2);
    testCaseList = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedColTestCaseList, 10);

    queryParams.put("entityLink", TABLE_LINK_2);
    queryParams.put("limit", 12);
    queryParams.put("includeAllTests", true);
    queryParams.put("include", "all");
    testCaseList = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    expectedTestCaseList.addAll(expectedColTestCaseList);
    verifyTestCases(testCaseList, expectedTestCaseList, 12);

    queryParams.remove("includeAllTests");
    queryParams.remove("include");
    queryParams.remove("entityLink");
    queryParams.put("testSuiteId", TEST_SUITE1.getId().toString());
    testCaseList = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedTestCaseList, 12);
  }

  @Test
  void get_listTestCasesFromSearchWithPagination(TestInfo testInfo)
      throws IOException, ParseException, InterruptedException {
    if (supportsSearchIndex) {
      Random rand = new Random();
      int tablesNum = rand.nextInt(3) + 3;
      int testCasesNum = rand.nextInt(7) + 3;

      TableResourceTest tableResourceTest = new TableResourceTest();
      TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();

      List<Table> tables = new ArrayList<>();
      Map<String, TestSuite> testSuites = new HashMap<>();
      List<TestCase> testCases = new ArrayList<>();

      for (int i = 0; i < tablesNum; i++) {
        CreateTable tableReq =
            tableResourceTest
                .createRequest(testInfo, i)
                .withDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName())
                .withColumns(
                    List.of(
                        new Column()
                            .withName(C1)
                            .withDisplayName("c1")
                            .withDataType(ColumnDataType.VARCHAR)
                            .withDataLength(10)))
                .withOwner(USER1_REF);
        Table table = tableResourceTest.createEntity(tableReq, ADMIN_AUTH_HEADERS);
        tables.add(table);
        CreateTestSuite createTestSuite =
            testSuiteResourceTest.createRequest(table.getFullyQualifiedName());
        TestSuite testSuite =
            testSuiteResourceTest.createExecutableTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);
        testSuites.put(table.getFullyQualifiedName(), testSuite);
      }

      for (int i = 0; i < testCasesNum; i++) {
        String tableFQN = tables.get(rand.nextInt(tables.size())).getFullyQualifiedName();
        String testSuiteFQN = testSuites.get(tableFQN).getFullyQualifiedName();
        CreateTestCase create =
            createRequest(testInfo, i)
                .withEntityLink(String.format("<#E::table::%s>", tableFQN))
                .withTestSuite(testSuiteFQN)
                .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
                .withParameterValues(
                    List.of(
                        new TestCaseParameterValue()
                            .withValue("20")
                            .withName("missingCountValue")));
        TestCase testCase = createEntity(create, ADMIN_AUTH_HEADERS);
        testCases.add(testCase);
        TestCaseResult testCaseResult =
            new TestCaseResult()
                .withResult("tested")
                .withTestCaseStatus(TestCaseStatus.Success)
                .withTimestamp(TestUtils.dateToTimestamp(String.format("2021-09-%02d", i)));
        putTestCaseResult(testCase.getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);
      }
      validateEntityListFromSearchWithPagination(new HashMap<>(), testCases.size());
    }
  }

  @Test
  void test_getSimplelistFromSearch(TestInfo testInfo) throws IOException, ParseException {
    Random rand = new Random();
    int tablesNum = 5;
    int testCasesNum = 5;
    TableResourceTest tableResourceTest = new TableResourceTest();
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();

    List<Table> tables = new ArrayList<>();
    Map<String, TestSuite> testSuites = new HashMap<>();
    List<TestCase> testCases = new ArrayList<>();

    for (int i = 0; i < tablesNum; i++) {
      CreateTable tableReq;
      // Add entity FQN with same prefix to validate listing
      // with AllTest=true returns all columns and table test for the
      // specific entityFQN (and does not include tests from the other entityFQN
      // witgh the same prefix
      if (i == 0) {
        tableReq = tableResourceTest.createRequest("test_getSimplelistFromSearch");
        tableReq.setTags(List.of(PERSONAL_DATA_TAG_LABEL));
      } else if (i == 1) {
        tableReq = tableResourceTest.createRequest("test_getSimplelistFromSearch_a");
        tableReq.setTags(List.of(PII_SENSITIVE_TAG_LABEL, TIER1_TAG_LABEL));
      } else {
        tableReq = tableResourceTest.createRequest(testInfo, i);
      }
      tableReq
          .withDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName())
          .withColumns(
              List.of(
                  new Column()
                      .withName(C1)
                      .withDisplayName("c1")
                      .withDataType(ColumnDataType.VARCHAR)
                      .withDataLength(10)))
          .withOwner(USER1_REF);
      Table table = tableResourceTest.createEntity(tableReq, ADMIN_AUTH_HEADERS);
      tables.add(table);
      CreateTestSuite createTestSuite =
          testSuiteResourceTest.createRequest(table.getFullyQualifiedName());
      TestSuite testSuite =
          testSuiteResourceTest.createExecutableTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);
      testSuites.put(table.getFullyQualifiedName(), testSuite);
    }

    for (int i = 0; i < testCasesNum; i++) {
      String tableFQN = tables.get(i).getFullyQualifiedName();
      String testSuiteFQN = testSuites.get(tableFQN).getFullyQualifiedName();
      CreateTestCase create =
          createRequest(testInfo, i)
              .withEntityLink(String.format("<#E::table::%s>", tableFQN))
              .withTestSuite(testSuiteFQN)
              .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
              .withParameterValues(
                  List.of(
                      new TestCaseParameterValue().withValue("20").withName("missingCountValue")));
      if (i == 2) {
        // create 1 test cases with USER21_TEAM as owner
        create.withOwner(TEAM21.getEntityReference());
      } else if (i % 2 == 0) {
        // create 2 test cases with USER1_REF as owner
        create.withOwner(USER2_REF);
      }
      TestCase testCase = createEntity(create, ADMIN_AUTH_HEADERS);
      testCases.add(testCase);
      TestCaseResult testCaseResult =
          new TestCaseResult()
              .withResult("tested")
              .withTestCaseStatus(TestCaseStatus.Success)
              .withTimestamp(TestUtils.dateToTimestamp(String.format("2021-09-%02d", i)));
      putTestCaseResult(testCase.getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);
    }
    TestCase testCaseForEL = testCases.get(0);

    HashMap queryParams = new HashMap<>();
    ResultList<TestCase> allEntities =
        listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    assertEquals(testCasesNum, allEntities.getData().size());
    queryParams.put("q", "test_getSimplelistFromSearchc");
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    assertEquals(1, allEntities.getData().size());
    org.assertj.core.api.Assertions.assertThat(allEntities.getData().get(0).getName())
        .contains("test_getSimplelistFromSearchc");

    queryParams.clear();
    queryParams.put("entityLink", testCaseForEL.getEntityLink());
    queryParams.put("includeAllTests", true);
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    assertEquals(1, allEntities.getData().size());
    org.assertj.core.api.Assertions.assertThat(allEntities.getData().get(0).getEntityLink())
        .contains(testCaseForEL.getEntityLink());

    queryParams.clear();
    queryParams.put("testPlatforms", TestPlatform.DEEQU);
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    assertEquals(
        0, allEntities.getData().size()); // we don't have any test cases with DEEQU platform

    queryParams.clear();
    queryParams.put("testPlatforms", TestPlatform.OPEN_METADATA);
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    assertEquals(
        testCasesNum,
        allEntities.getData().size()); // we have all test cases with OPEN_METADATA platform

    queryParams.clear();
    queryParams.put(
        "testPlatforms", String.format("%s,%s", TestPlatform.OPEN_METADATA, TestPlatform.DEEQU));
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    assertEquals(
        testCasesNum, allEntities.getData().size()); // Should return either values matching

    queryParams.clear();
    queryParams.put("owner", USER2_REF.getName());
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    assertEquals(2, allEntities.getData().size()); // we have 2 test cases with USER2_REF as owner

    queryParams.put("owner", USER_TEAM21.getName());
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    assertEquals(
        1,
        allEntities
            .getData()
            .size()); // we have 1 test cases with TEAM21 as owner which USER_21 is part of

    queryParams.clear();
    queryParams.put("fields", "tags");
    queryParams.put(
        "tags",
        String.format(
            "%s,%s", PII_SENSITIVE_TAG_LABEL.getTagFQN(), PERSONAL_DATA_TAG_LABEL.getTagFQN()));
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    // check we don't have any list of tags that doesn't have PII_SENSITIVE_TAG_LABEL or
    // PERSONAL_DATA_TAG_LABEL for all test cases
    allEntities
        .getData()
        .forEach(
            tc ->
                assertFalse(
                    tc.getTags().stream()
                        .noneMatch(
                            t ->
                                t.getTagFQN()
                                    .matches(
                                        String.format(
                                            "(%s|%s)",
                                            PII_SENSITIVE_TAG_LABEL.getTagFQN(),
                                            PERSONAL_DATA_TAG_LABEL.getTagFQN())))));

    queryParams.put("tags", PERSONAL_DATA_TAG_LABEL.getTagFQN());
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    // check we have all test cases with PERSONAL_DATA_TAG_LABEL
    allEntities
        .getData()
        .forEach(
            tc ->
                assertTrue(
                    tc.getTags().stream()
                        .anyMatch(
                            t -> t.getTagFQN().contains(PERSONAL_DATA_TAG_LABEL.getTagFQN()))));

    queryParams.clear();
    queryParams.put("tier", TIER1_TAG_LABEL.getTagFQN());
    queryParams.put("fields", "tags");
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    // check we have all test cases with TIER1_TAG_LABEL
    allEntities
        .getData()
        .forEach(
            tc ->
                assertTrue(
                    tc.getTags().stream()
                        .anyMatch(t -> t.getTagFQN().contains(TIER1_TAG_LABEL.getTagFQN()))));

    queryParams.clear();
    String serviceName = tables.get(0).getService().getName();
    queryParams.put("serviceName", serviceName);
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    assertTrue(
        allEntities.getData().stream().allMatch(tc -> tc.getEntityLink().contains(serviceName)));

    // Test return only requested fields
    queryParams.put("includeFields", "id,name,entityLink");
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    TestCase testCase = allEntities.getData().get(0);
    assertNull(testCase.getDescription());
    assertNull(testCase.getTestSuite());
    assertNotNull(testCase.getEntityLink());
    assertNotNull(testCase.getName());
    assertNotNull(testCase.getId());
  }

  @Test
  void test_testCaseInheritedFields(TestInfo testInfo) throws HttpResponseException, IOException {
    // Set up the test case
    TableResourceTest tableResourceTest = new TableResourceTest();
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    CreateTable createTable = tableResourceTest.createRequest(testInfo);
    createTable
        .withDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName())
        .withColumns(
            List.of(
                new Column()
                    .withName(C1)
                    .withDisplayName("c1")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(10)
                    .withTags(List.of(PII_SENSITIVE_TAG_LABEL))))
        .withOwner(USER1_REF)
        .withDomain(DOMAIN1.getFullyQualifiedName())
        .withTags(List.of(PERSONAL_DATA_TAG_LABEL, TIER1_TAG_LABEL));
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    CreateTestSuite createTestSuite =
        testSuiteResourceTest.createRequest(table.getFullyQualifiedName());
    TestSuite testSuite =
        testSuiteResourceTest.createExecutableTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);

    CreateTestCase create =
        createRequest(testInfo)
            .withEntityLink(String.format("<#E::table::%s>", table.getFullyQualifiedName()))
            .withTestSuite(testSuite.getFullyQualifiedName())
            .withTestDefinition(TEST_DEFINITION2.getFullyQualifiedName());
    createEntity(create, ADMIN_AUTH_HEADERS);
    create =
        createRequest(testInfo)
            .withEntityLink(
                String.format("<#E::table::%s::columns::%s>", table.getFullyQualifiedName(), C1))
            .withTestSuite(testSuite.getFullyQualifiedName())
            .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
            .withParameterValues(
                List.of(
                    new TestCaseParameterValue().withValue("20").withName("missingCountValue")));
    createEntity(create, ADMIN_AUTH_HEADERS);

    // Run the tests assertions
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("entityLink", String.format("<#E::table::%s>", table.getFullyQualifiedName()));
    queryParams.put("includeAllTests", "true");
    queryParams.put("fields", "domain,owner,tags");
    ResultList<TestCase> testCases = listEntitiesFromSearch(queryParams, 10, 0, ADMIN_AUTH_HEADERS);
    assertEquals(2, testCases.getData().size());
    for (TestCase testCase : testCases.getData()) {
      assertEquals(table.getOwner().getId(), testCase.getOwner().getId());
      assertEquals(table.getDomain().getId(), testCase.getDomain().getId());
      List<TagLabel> tags = testCase.getTags();
      HashSet<String> actualTags =
          tags.stream().map(TagLabel::getName).collect(Collectors.toCollection(HashSet::new));
      HashSet<String> expectedTags;
      if (testCase.getEntityLink().contains(C1)) {
        expectedTags =
            new HashSet<>(
                List.of(
                    PERSONAL_DATA_TAG_LABEL.getName(),
                    TIER1_TAG_LABEL.getName(),
                    PII_SENSITIVE_TAG_LABEL.getName()));
      } else {
        expectedTags =
            new HashSet<>(List.of(PERSONAL_DATA_TAG_LABEL.getName(), TIER1_TAG_LABEL.getName()));
      }
      assertEquals(expectedTags, actualTags);
    }

    createTable.setOwner(USER2_REF);
    createTable.setDomain(DOMAIN.getFullyQualifiedName());
    createTable.setTags(List.of(USER_ADDRESS_TAG_LABEL));
    createTable.withColumns(
        List.of(
            new Column()
                .withName(C1)
                .withDisplayName("c1")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(10)
                .withTags(List.of(PERSONAL_DATA_TAG_LABEL))));
    table = tableResourceTest.updateEntity(createTable, OK, ADMIN_AUTH_HEADERS);
    testCases = listEntitiesFromSearch(queryParams, 10, 0, ADMIN_AUTH_HEADERS);

    for (TestCase testCase : testCases.getData()) {
      assertEquals(table.getOwner().getId(), testCase.getOwner().getId());
      assertEquals(table.getDomain().getId(), testCase.getDomain().getId());
      List<TagLabel> tags = testCase.getTags();
      HashSet<String> actualTags =
          tags.stream().map(TagLabel::getName).collect(Collectors.toCollection(HashSet::new));
      HashSet<String> expectedTags;
      List<TagLabel> expectedTagsList = table.getTags();
      if (testCase.getEntityLink().contains(C1)) {
        expectedTagsList.addAll(table.getColumns().get(0).getTags());
      }
      expectedTags = new HashSet<>(expectedTagsList.stream().map(TagLabel::getName).toList());
      assertEquals(expectedTags, actualTags);
    }
  }

  public void putTestCaseResult(String fqn, TestCaseResult data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/" + fqn + "/testCaseResult");
    TestUtils.put(target, data, CREATED, authHeaders);
  }

  public void deleteTestCaseResult(String fqn, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/" + fqn + "/testCaseResult");
    TestUtils.delete(target, authHeaders);
  }

  @Test
  @Override
  public void post_entity_as_non_admin_401(TestInfo test) {
    // Override the default behavior where entities are created vs. for test case
    // the operation is the entity to which tests are attached is edited
    assertResponse(
        () -> createEntity(createRequest(test), TEST_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(TEST_USER_NAME, List.of(EDIT_TESTS)));
  }

  @Test
  void post_put_patch_delete_testCase_table_owner(TestInfo test) throws IOException {
    // Table owner should be able to create, update, and delete tests
    Map<String, String> ownerAuthHeaders = authHeaders(USER1_REF.getName());
    TestCase testCase = createAndCheckEntity(createRequest(test), ownerAuthHeaders);

    // Update description with PUT
    String oldDescription = testCase.getDescription();
    String newDescription = "description1";
    ChangeDescription change = getChangeDescription(testCase, MINOR_UPDATE);
    fieldUpdated(change, "description", oldDescription, newDescription);
    testCase =
        updateAndCheckEntity(
            createRequest(test).withDescription(newDescription).withName(testCase.getName()),
            OK,
            ownerAuthHeaders,
            MINOR_UPDATE,
            change);

    // Update description with PATCH
    // Changes from this PATCH is consolidated with the previous changes
    newDescription = "description2";
    change = getChangeDescription(testCase, CHANGE_CONSOLIDATED);
    fieldUpdated(change, "description", oldDescription, newDescription);
    String json = JsonUtils.pojoToJson(testCase);
    testCase.setDescription(newDescription);
    testCase = patchEntityAndCheck(testCase, json, ownerAuthHeaders, CHANGE_CONSOLIDATED, change);

    // Delete the testcase
    deleteAndCheckEntity(testCase, ownerAuthHeaders);
  }

  @Test
  void patch_testCaseResults_noChange(TestInfo test) throws IOException, ParseException {
    CreateTestCase create =
        createRequest(test)
            .withEntityLink(TABLE_LINK_2)
            .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
            .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
            .withParameterValues(
                List.of(
                    new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    TestCaseResult testCaseResult =
        new TestCaseResult()
            .withResult("tested")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-09"));
    putTestCaseResult(testCase.getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);

    String original = JsonUtils.pojoToJson(testCaseResult);
    testCaseResult.setTestCaseStatus(TestCaseStatus.Failed);
    JsonPatch patch = JsonUtils.getJsonPatch(original, JsonUtils.pojoToJson(testCaseResult));

    patchTestCaseResult(testCase.getFullyQualifiedName(), dateToTimestamp("2021-09-09"), patch);

    ResultList<TestCaseResult> testCaseResultResultListUpdated =
        getTestCaseResults(
            testCase.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-09"),
            ADMIN_AUTH_HEADERS);

    // patching anything else than the test case failure status should not change anything
    assertEquals(
        TestCaseStatus.Success,
        testCaseResultResultListUpdated.getData().get(0).getTestCaseStatus());
  }

  @Test
  @Override
  public void delete_entity_as_non_admin_401(TestInfo test) throws HttpResponseException {
    // Override the default behavior where entities are deleted vs. for test case
    // the operation is the entity to which tests are attached is edited
    CreateTestCase request = createRequest(getEntityName(test), "", "", null);
    TestCase entity = createEntity(request, ADMIN_AUTH_HEADERS);
    assertResponse(
        () -> deleteAndCheckEntity(entity, TEST_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(TEST_USER_NAME, List.of(EDIT_TESTS)));
  }

  @Test
  void add_EmptyTestCaseToLogicalTestSuite_200(TestInfo test) throws IOException {
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    // Create a logical Test Suite
    CreateTestSuite createLogicalTestSuite = testSuiteResourceTest.createRequest(test);
    TestSuite logicalTestSuite =
        testSuiteResourceTest.createEntity(createLogicalTestSuite, ADMIN_AUTH_HEADERS);

    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, new ArrayList<>());
  }

  @Test
  void delete_testCaseFromLogicalTestSuite(TestInfo test) throws IOException {
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    // Create a logical Test Suite
    CreateTestSuite createLogicalTestSuite = testSuiteResourceTest.createRequest(test);
    TestSuite logicalTestSuite =
        testSuiteResourceTest.createEntity(createLogicalTestSuite, ADMIN_AUTH_HEADERS);
    // Create an executable test suite
    TestSuite executableTestSuite = createExecutableTestSuite(test);

    List<TestCase> testCases = new ArrayList<>();

    // Create the test cases (need to be created against an executable test suite)
    for (int i = 0; i < 5; i++) {
      CreateTestCase create =
          createRequest("test_testSuite__" + i)
              .withTestSuite(executableTestSuite.getFullyQualifiedName());
      TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
      testCases.add(testCase);
    }

    // Add the test cases to the logical test suite
    testSuiteResourceTest.addTestCasesToLogicalTestSuite(
        logicalTestSuite, testCases.stream().map(TestCase::getId).collect(Collectors.toList()));

    // Verify that the test cases are in the logical test suite
    Map<String, Object> queryParams = new HashMap<>();
    queryParams.put("limit", 100);
    queryParams.put("fields", "*");
    queryParams.put("testSuiteId", logicalTestSuite.getId().toString());
    ResultList<TestCase> logicalTestSuiteTestCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(testCases.size(), logicalTestSuiteTestCases.getData().size());

    // Delete a logical test case and check that it is deleted from the logical test suite but not
    // from the executable test suite
    UUID logicalTestCaseIdToDelete = testCases.get(0).getId();
    deleteLogicalTestCase(logicalTestSuite, logicalTestCaseIdToDelete);
    logicalTestSuiteTestCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertTrue(assertTestCaseIdNotInList(logicalTestSuiteTestCases, logicalTestCaseIdToDelete));

    queryParams.put("testSuiteId", executableTestSuite.getId().toString());
    ResultList<TestCase> executableTestSuiteTestCases =
        getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(testCases.size(), executableTestSuiteTestCases.getData().size());

    // Soft Delete a test case from the executable test suite and check that it is deleted from the
    // executable test suite and from the logical test suite
    UUID executableTestCaseIdToDelete = testCases.get(1).getId();
    deleteEntity(executableTestCaseIdToDelete, false, false, ADMIN_AUTH_HEADERS);
    queryParams.put("testSuiteId", logicalTestSuite.getId().toString());
    logicalTestSuiteTestCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, logicalTestSuiteTestCases.getData().size());
    assertTrue(assertTestCaseIdNotInList(logicalTestSuiteTestCases, executableTestCaseIdToDelete));

    queryParams.put("includeAllTests", true);
    queryParams.put("include", "all");
    logicalTestSuiteTestCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(4, logicalTestSuiteTestCases.getData().size());

    queryParams.put("testSuiteId", executableTestSuite.getId().toString());
    queryParams.remove("includeAllTests");
    queryParams.remove("include");
    executableTestSuiteTestCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(4, executableTestSuiteTestCases.getData().size());
    assertTrue(
        assertTestCaseIdNotInList(executableTestSuiteTestCases, executableTestCaseIdToDelete));

    queryParams.put("includeAllTests", true);
    queryParams.put("include", "all");
    executableTestSuiteTestCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(5, executableTestSuiteTestCases.getData().size());

    // Hard Delete a test case from the executable test suite and check that it is deleted from the
    // executable test suite and from the logical test suite
    deleteEntity(executableTestCaseIdToDelete, false, true, ADMIN_AUTH_HEADERS);

    queryParams.put("testSuiteId", logicalTestSuite.getId().toString());
    logicalTestSuiteTestCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, logicalTestSuiteTestCases.getData().size());
    assertTrue(assertTestCaseIdNotInList(logicalTestSuiteTestCases, executableTestCaseIdToDelete));

    queryParams.put("testSuiteId", executableTestSuite.getId().toString());
    executableTestSuiteTestCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(4, executableTestSuiteTestCases.getData().size());
    assertTrue(
        assertTestCaseIdNotInList(executableTestSuiteTestCases, executableTestCaseIdToDelete));
  }

  @Test
  void list_allTestSuitesFromTestCase_200(TestInfo test) throws IOException {
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    // Create a logical Test Suite
    CreateTestSuite createLogicalTestSuite = testSuiteResourceTest.createRequest(test);
    TestSuite logicalTestSuite =
        testSuiteResourceTest.createEntity(createLogicalTestSuite, ADMIN_AUTH_HEADERS);
    // Create an executable test suite
    CreateTestSuite createTestSuite =
        testSuiteResourceTest.createRequest(test).withName(TEST_TABLE2.getFullyQualifiedName());
    TestSuite executableTestSuite =
        testSuiteResourceTest.createExecutableTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);

    // Create the test cases (need to be created against an executable test suite)
    CreateTestCase create =
        createRequest("test_testSuite__" + test.getDisplayName())
            .withTestSuite(executableTestSuite.getFullyQualifiedName());
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    List<UUID> testCaseIds = listOf(testCase.getId());

    // Add the test cases to the logical test suite
    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, testCaseIds);

    TestCase testCaseWithSuites =
        getEntityByName(testCase.getFullyQualifiedName(), "*", ADMIN_AUTH_HEADERS);
    assertEquals(
        executableTestSuite.getFullyQualifiedName(),
        testCaseWithSuites.getTestSuite().getFullyQualifiedName());
    assertEquals(2, testCaseWithSuites.getTestSuites().size());

    // Verify both our testSuites are in the list of TestSuite Entities
    Map<String, TestSuite> testSuiteFQNs = new HashMap<>();
    testSuiteFQNs.put(logicalTestSuite.getFullyQualifiedName(), logicalTestSuite);
    testSuiteFQNs.put(executableTestSuite.getFullyQualifiedName(), executableTestSuite);

    for (TestSuite testSuite : testCaseWithSuites.getTestSuites()) {
      assertNotNull(testSuiteFQNs.get(testSuite.getFullyQualifiedName()));
    }
  }

  @Test
  void test_testCaseResultState(TestInfo test) throws IOException, ParseException {
    // Create table for our test
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    TestSuite testSuite = createExecutableTestSuite(test);

    // create testCase
    CreateTestCase createTestCase =
        new CreateTestCase()
            .withName(test.getDisplayName())
            .withDescription(test.getDisplayName())
            .withEntityLink(
                String.format(
                    "<#E::table::%s>",
                    testSuite.getExecutableEntityReference().getFullyQualifiedName()))
            .withTestSuite(testSuite.getFullyQualifiedName())
            .withTestDefinition(TEST_DEFINITION1.getFullyQualifiedName());
    TestCase testCase = createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);
    UUID testSuiteId = testCase.getTestSuite().getId();

    String dateStr = "2023-08-";
    List<TestCaseResult> testCaseResults = new ArrayList<>();
    for (int i = 11; i <= 15; i++) {
      TestCaseResult testCaseResult =
          new TestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Failed)
              .withTimestamp(TestUtils.dateToTimestamp(dateStr + i));
      putTestCaseResult(testCase.getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);
      testCaseResults.add(testCaseResult);
    }

    // check that result state is the latest
    TestCase storedTestCase = getEntity(testCase.getId(), "testCaseResult", ADMIN_AUTH_HEADERS);
    TestSuite storedTestSuite =
        testSuiteResourceTest.getEntity(testSuiteId, "*", ADMIN_AUTH_HEADERS);
    ResultSummary testSuiteResultSummary =
        storedTestSuite.getTestCaseResultSummary().stream()
            .filter(t -> t.getTestCaseName().equals(testCase.getFullyQualifiedName()))
            .findFirst()
            .orElse(null);
    assertEquals(
        TestUtils.dateToTimestamp("2023-08-15"), storedTestCase.getTestCaseResult().getTimestamp());
    assertEquals(1, storedTestSuite.getSummary().getTotal());
    assertEquals(TestUtils.dateToTimestamp("2023-08-15"), testSuiteResultSummary.getTimestamp());

    // delete latest and check that result is the  new latest (i.e. the 14th)
    deleteTestCaseResult(
        testCase.getFullyQualifiedName(),
        TestUtils.dateToTimestamp("2023-08-15"),
        ADMIN_AUTH_HEADERS);
    storedTestCase = getEntity(testCase.getId(), "testCaseResult", ADMIN_AUTH_HEADERS);
    storedTestSuite = testSuiteResourceTest.getEntity(testSuiteId, "*", ADMIN_AUTH_HEADERS);
    testSuiteResultSummary =
        storedTestSuite.getTestCaseResultSummary().stream()
            .filter(t -> t.getTestCaseName().equals(testCase.getFullyQualifiedName()))
            .findFirst()
            .orElse(null);
    assertEquals(
        TestUtils.dateToTimestamp("2023-08-14"), storedTestCase.getTestCaseResult().getTimestamp());
    assertEquals(1, storedTestSuite.getSummary().getTotal());
    assertEquals(TestUtils.dateToTimestamp("2023-08-14"), testSuiteResultSummary.getTimestamp());

    // delete the 13h and check that result is still the 14th
    deleteTestCaseResult(
        testCase.getFullyQualifiedName(),
        TestUtils.dateToTimestamp("2023-08-13"),
        ADMIN_AUTH_HEADERS);
    storedTestSuite = testSuiteResourceTest.getEntity(testSuiteId, "*", ADMIN_AUTH_HEADERS);
    testSuiteResultSummary =
        storedTestSuite.getTestCaseResultSummary().stream()
            .filter(t -> t.getTestCaseName().equals(testCase.getFullyQualifiedName()))
            .findFirst()
            .orElse(null);
    storedTestCase = getEntity(testCase.getId(), "testCaseResult", ADMIN_AUTH_HEADERS);
    assertEquals(
        TestUtils.dateToTimestamp("2023-08-14"), storedTestCase.getTestCaseResult().getTimestamp());
    assertEquals(1, storedTestSuite.getSummary().getTotal());
    assertEquals(TestUtils.dateToTimestamp("2023-08-14"), testSuiteResultSummary.getTimestamp());

    // Patch the test case result adding the resolved status
    TestCaseResult testCaseResult = storedTestCase.getTestCaseResult();
    String original = JsonUtils.pojoToJson(testCaseResult);
    JsonPatch patch = JsonUtils.getJsonPatch(original, JsonUtils.pojoToJson(testCaseResult));
    patchTestCaseResult(testCase.getFullyQualifiedName(), dateToTimestamp("2023-08-14"), patch);

    // add a new test case result for the 16th and check the state is correctly updated
    testCaseResult =
        new TestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp(dateStr + 16));
    putTestCaseResult(testCase.getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);
    storedTestCase = getEntity(testCase.getId(), "testCaseResult", ADMIN_AUTH_HEADERS);
    storedTestSuite = testSuiteResourceTest.getEntity(testSuiteId, "*", ADMIN_AUTH_HEADERS);
    testSuiteResultSummary =
        storedTestSuite.getTestCaseResultSummary().stream()
            .filter(t -> t.getTestCaseName().equals(testCase.getFullyQualifiedName()))
            .findFirst()
            .orElse(null);
    assertEquals(
        TestUtils.dateToTimestamp("2023-08-16"), storedTestCase.getTestCaseResult().getTimestamp());
    assertEquals(1, storedTestSuite.getSummary().getTotal());
    assertEquals(TestUtils.dateToTimestamp("2023-08-16"), testSuiteResultSummary.getTimestamp());

    // Add a new test case
    CreateTestCase create = createRequest(test, 3);
    create
        .withEntityLink(testCase.getEntityLink())
        .withTestSuite(testCase.getTestSuite().getFullyQualifiedName());
    TestCase testCase1 = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    for (int i = 19; i <= 20; i++) {
      putTestCaseResult(
          testCase1.getFullyQualifiedName(),
          new TestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Failed)
              .withTimestamp(TestUtils.dateToTimestamp(dateStr + i)),
          ADMIN_AUTH_HEADERS);
    }

    storedTestSuite = testSuiteResourceTest.getEntity(testSuiteId, "*", ADMIN_AUTH_HEADERS);
    assertEquals(2, storedTestSuite.getTestCaseResultSummary().size());

    deleteEntity(testCase1.getId(), true, true, ADMIN_AUTH_HEADERS);
    storedTestSuite = testSuiteResourceTest.getEntity(testSuiteId, "*", ADMIN_AUTH_HEADERS);
    assertEquals(1, storedTestSuite.getTestCaseResultSummary().size());
  }

  @Test
  void get_testCaseResultWithIncidentId(TestInfo test)
      throws HttpResponseException, ParseException {

    // We create a test case with a failure
    TestCase testCaseEntity = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);
    putTestCaseResult(
        testCaseEntity.getFullyQualifiedName(),
        new TestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
        ADMIN_AUTH_HEADERS);

    // We can get it via API with a list of ongoing incidents
    TestCase result = getTestCase(testCaseEntity.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    UUID incidentId = result.getIncidentId();
    assertNotNull(result.getIncidentId());

    // Resolving the status
    CreateTestCaseResolutionStatus createResolvedStatus =
        new CreateTestCaseResolutionStatus()
            .withTestCaseReference(testCaseEntity.getFullyQualifiedName())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Resolved)
            .withTestCaseResolutionStatusDetails(
                new Resolved()
                    .withTestCaseFailureComment("resolved")
                    .withTestCaseFailureReason(TestCaseFailureReasonType.MissingData)
                    .withResolvedBy(USER1_REF));
    createTestCaseFailureStatus(createResolvedStatus);

    result = getTestCase(testCaseEntity.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    assertNotNull(result.getIncidentId());
    assertEquals(incidentId, result.getIncidentId());

    // Add a new failed result, which will create a NEW incident and start a new stateId
    putTestCaseResult(
        testCaseEntity.getFullyQualifiedName(),
        new TestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-02")),
        ADMIN_AUTH_HEADERS);

    result = getTestCase(testCaseEntity.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    UUID newIncidentId = result.getIncidentId();

    assertNotNull(result.getIncidentId());
    assertNotEquals(incidentId, result.getIncidentId());

    // Add a new testCase Result with status Success. This should clear the incidentId
    // from the testCase and the testCaseResult should not have an incidentId.
    putTestCaseResult(
        testCaseEntity.getFullyQualifiedName(),
        new TestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-03")),
        ADMIN_AUTH_HEADERS);

    result = getTestCase(testCaseEntity.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    List<TestCaseResult> testCaseResults =
        getTestCaseResults(
                testCaseEntity.getFullyQualifiedName(),
                TestUtils.dateToTimestamp("2024-01-03"),
                TestUtils.dateToTimestamp("2024-01-03"),
                ADMIN_AUTH_HEADERS)
            .getData();
    assertNull(testCaseResults.get(0).getIncidentId());
    assertNull(result.getIncidentId());

    // Add a new testCase Result with status Failure at an older date.
    // The incidentId should be the one from "2024-01-02" but the testCase incidentId should be null
    // as it should reflect the latest testCaseResult
    putTestCaseResult(
        testCaseEntity.getFullyQualifiedName(),
        new TestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2023-12-31")),
        ADMIN_AUTH_HEADERS);
    result = getTestCase(testCaseEntity.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    testCaseResults =
        getTestCaseResults(
                testCaseEntity.getFullyQualifiedName(),
                TestUtils.dateToTimestamp("2023-12-31"),
                TestUtils.dateToTimestamp("2023-12-31"),
                ADMIN_AUTH_HEADERS)
            .getData();
    assertEquals(newIncidentId, testCaseResults.get(0).getIncidentId());
    assertNull(result.getIncidentId());
  }

  @Test
  void post_createTestCaseResultFailure(TestInfo test)
      throws HttpResponseException, ParseException {
    // We're going to check how each test only has a single open stateID
    // and 2 tests have their own flow
    Long startTs = System.currentTimeMillis();
    TestCase testCaseEntity1 = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);
    TestCase testCaseEntity2 =
        createEntity(createRequest(getEntityName(test) + "2"), ADMIN_AUTH_HEADERS);

    // Add a failed result, which will create a NEW incident and add a new status
    for (TestCase testCase : List.of(testCaseEntity1, testCaseEntity2)) {
      putTestCaseResult(
          testCase.getFullyQualifiedName(),
          new TestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Failed)
              .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
          ADMIN_AUTH_HEADERS);

      CreateTestCaseResolutionStatus createAckIncident =
          new CreateTestCaseResolutionStatus()
              .withTestCaseReference(testCase.getFullyQualifiedName())
              .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Ack)
              .withTestCaseResolutionStatusDetails(null);
      createTestCaseFailureStatus(createAckIncident);
    }
    Long endTs = System.currentTimeMillis();

    // Get the test case failure statuses
    ResultList<TestCaseResolutionStatus> testCaseFailureStatusResultList =
        getTestCaseFailureStatus(startTs, endTs, null, null);
    assertEquals(4, testCaseFailureStatusResultList.getData().size());

    // check we have only 2 distinct sequence IDs, one for each test case
    List<UUID> stateIds =
        testCaseFailureStatusResultList.getData().stream()
            .map(TestCaseResolutionStatus::getStateId)
            .toList();
    Set<UUID> stateIdSet = new HashSet<>(stateIds);
    assertEquals(2, stateIdSet.size());

    TestCaseResolutionStatus testCaseResolutionStatus =
        testCaseFailureStatusResultList.getData().get(0);
    UUID stateId = stateIds.get(0);

    // Get the test case failure statuses by ID
    TestCaseResolutionStatus storedTestCaseResolution =
        getTestCaseFailureStatusById(testCaseResolutionStatus.getId());
    assertEquals(storedTestCaseResolution.getId(), testCaseResolutionStatus.getId());

    // Get the test case failure statuses by sequence ID
    ResultList<TestCaseResolutionStatus> storedTestCaseResolutions =
        getTestCaseFailureStatusByStateId(stateId);
    assertEquals(2, storedTestCaseResolutions.getData().size());
    assertEquals(stateId, storedTestCaseResolutions.getData().get(0).getStateId());

    // Get the test case resolution statuses by status type
    storedTestCaseResolutions =
        getTestCaseFailureStatus(startTs, endTs, null, TestCaseResolutionStatusTypes.Ack);
    assertEquals(2, storedTestCaseResolutions.getData().size());
    assertEquals(
        TestCaseResolutionStatusTypes.Ack,
        storedTestCaseResolutions.getData().get(0).getTestCaseResolutionStatusType());

    // Delete test case recursively and check that the test case resolution status is also deleted
    // 1. soft delete - should not delete the test case resolution status
    // 2. hard delete - should delete the test case resolution status
    deleteEntity(testCaseEntity1.getId(), true, false, ADMIN_AUTH_HEADERS);
    storedTestCaseResolutions =
        getTestCaseFailureStatus(startTs, endTs, null, TestCaseResolutionStatusTypes.Ack);
    assertEquals(2, storedTestCaseResolutions.getData().size());
    assertTrue(
        storedTestCaseResolutions.getData().stream()
            .anyMatch(t -> t.getTestCaseReference().getId().equals(testCaseEntity1.getId())));

    deleteEntity(testCaseEntity1.getId(), true, true, ADMIN_AUTH_HEADERS);
    storedTestCaseResolutions =
        getTestCaseFailureStatus(startTs, endTs, null, TestCaseResolutionStatusTypes.Ack);
    assertEquals(1, storedTestCaseResolutions.getData().size());
    assertTrue(
        storedTestCaseResolutions.getData().stream()
            .noneMatch(t -> t.getTestCaseReference().getId().equals(testCaseEntity1.getId())));
  }

  @Test
  void test_listTestCaseFailureStatusPagination(TestInfo test) throws IOException, ParseException {
    // Create a number of entities between 5 and 20 inclusive
    Random rand = new Random();
    int maxEntities = rand.nextInt(16) + 5;

    Long startTs = System.currentTimeMillis() - 1000;
    for (int i = 0; i < maxEntities; i++) {
      // We'll create random test cases
      TestCase testCaseEntity =
          createEntity(createRequest(getEntityName(test) + i), ADMIN_AUTH_HEADERS);
      // Adding failed test case, which will create a NEW incident
      putTestCaseResult(
          testCaseEntity.getFullyQualifiedName(),
          new TestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Failed)
              .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
          ADMIN_AUTH_HEADERS);
    }
    Long endTs = System.currentTimeMillis() + 1000;

    // List all entities and use it for checking pagination
    ResultList<TestCaseResolutionStatus> allEntities =
        getTestCaseFailureStatus(1000000, null, false, startTs, endTs, null);

    paginateTestCaseFailureStatus(maxEntities, allEntities, startTs, endTs);
  }

  @Test
  void patch_TestCaseResultFailure(TestInfo test) throws HttpResponseException {
    TestCase testCaseEntity = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);
    CreateTestCaseResolutionStatus createTestCaseFailureStatus =
        new CreateTestCaseResolutionStatus()
            .withTestCaseReference(testCaseEntity.getFullyQualifiedName())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Ack)
            .withSeverity(Severity.Severity2)
            .withTestCaseResolutionStatusDetails(null);
    TestCaseResolutionStatus testCaseFailureStatus =
        createTestCaseFailureStatus(createTestCaseFailureStatus);
    String original = JsonUtils.pojoToJson(testCaseFailureStatus);
    String updated =
        JsonUtils.pojoToJson(
            testCaseFailureStatus
                .withUpdatedAt(System.currentTimeMillis())
                .withUpdatedBy(USER1_REF)
                .withSeverity(Severity.Severity1));
    JsonPatch patch = JsonUtils.getJsonPatch(original, updated);
    TestCaseResolutionStatus patched =
        patchTestCaseResultFailureStatus(testCaseFailureStatus.getId(), patch);
    TestCaseResolutionStatus stored = getTestCaseFailureStatus(testCaseFailureStatus.getId());

    // check our patch fields have been updated
    assertEquals(patched.getUpdatedAt(), stored.getUpdatedAt());
    assertEquals(patched.getUpdatedBy(), stored.getUpdatedBy());
    assertEquals(patched.getSeverity(), stored.getSeverity());
  }

  @Test
  void patch_TestCaseResultFailureUnauthorizedFields(TestInfo test) throws HttpResponseException {
    TestCase testCaseEntity = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);
    CreateTestCaseResolutionStatus createTestCaseFailureStatus =
        new CreateTestCaseResolutionStatus()
            .withTestCaseReference(testCaseEntity.getFullyQualifiedName())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Ack)
            .withTestCaseResolutionStatusDetails(null);
    TestCaseResolutionStatus testCaseFailureStatus =
        createTestCaseFailureStatus(createTestCaseFailureStatus);
    String original = JsonUtils.pojoToJson(testCaseFailureStatus);
    String updated =
        JsonUtils.pojoToJson(
            testCaseFailureStatus
                .withUpdatedAt(System.currentTimeMillis())
                .withUpdatedBy(USER1_REF)
                .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Assigned));
    JsonPatch patch = JsonUtils.getJsonPatch(original, updated);

    assertResponse(
        () -> patchTestCaseResultFailureStatus(testCaseFailureStatus.getId(), patch),
        BAD_REQUEST,
        "Field testCaseResolutionStatusType is not allowed to be updated");
  }

  @Test
  void test_testCaseResolutionTaskResolveWorkflowThruFeed(TestInfo test)
      throws HttpResponseException, ParseException {
    Long startTs = System.currentTimeMillis();
    FeedResourceTest feedResourceTest = new FeedResourceTest();

    TestCase testCaseEntity = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);

    // Add failed test case, which will create a NEW incident
    putTestCaseResult(
        testCaseEntity.getFullyQualifiedName(),
        new TestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
        ADMIN_AUTH_HEADERS);

    // Now, we should be good to create an ASSIGNED status
    CreateTestCaseResolutionStatus createAssignedIncident =
        new CreateTestCaseResolutionStatus()
            .withTestCaseReference(testCaseEntity.getFullyQualifiedName())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Assigned)
            .withTestCaseResolutionStatusDetails(new Assigned().withAssignee(USER1_REF));
    TestCaseResolutionStatus assignedIncident = createTestCaseFailureStatus(createAssignedIncident);
    String jsonThread =
        Entity.getCollectionDAO()
            .feedDAO()
            .fetchThreadByTestCaseResolutionStatusId(assignedIncident.getStateId());
    Thread thread = JsonUtils.readValue(jsonThread, Thread.class);
    assertEquals(assignedIncident.getStateId(), thread.getTask().getTestCaseResolutionStatusId());
    assertEquals(TaskStatus.Open, thread.getTask().getStatus());

    // resolve the task. The old task should be closed and the latest test case resolution status
    // should be updated (resolved) with the same state ID

    ResolveTask resolveTask =
        new ResolveTask()
            .withTestCaseFQN(testCaseEntity.getFullyQualifiedName())
            .withTestCaseFailureReason(TestCaseFailureReasonType.FalsePositive)
            .withNewValue("False positive, test case was valid");
    feedResourceTest.resolveTask(thread.getTask().getId(), resolveTask, ADMIN_AUTH_HEADERS);
    jsonThread =
        Entity.getCollectionDAO()
            .feedDAO()
            .fetchThreadByTestCaseResolutionStatusId(assignedIncident.getStateId());
    thread = JsonUtils.readValue(jsonThread, Thread.class);
    // Confirm that the task is closed
    assertEquals(TaskStatus.Closed, thread.getTask().getStatus());

    // We'll confirm that we have created a new test case resolution status with the same state ID
    // and type Resolved
    ResultList<TestCaseResolutionStatus> mostRecentTestCaseResolutionStatus =
        getTestCaseFailureStatus(
            10,
            null,
            true,
            startTs,
            System.currentTimeMillis(),
            testCaseEntity.getFullyQualifiedName());
    assertEquals(1, mostRecentTestCaseResolutionStatus.getData().size());
    TestCaseResolutionStatus mostRecentTestCaseResolutionStatusData =
        mostRecentTestCaseResolutionStatus.getData().get(0);
    assertEquals(
        TestCaseResolutionStatusTypes.Resolved,
        mostRecentTestCaseResolutionStatusData.getTestCaseResolutionStatusType());
    assertEquals(
        assignedIncident.getStateId(), mostRecentTestCaseResolutionStatusData.getStateId());
    Resolved resolved =
        JsonUtils.convertValue(
            mostRecentTestCaseResolutionStatusData.getTestCaseResolutionStatusDetails(),
            Resolved.class);
    assertEquals(TestCaseFailureReasonType.FalsePositive, resolved.getTestCaseFailureReason());
    assertEquals("False positive, test case was valid", resolved.getTestCaseFailureComment());
  }

  @Test
  void test_testCaseResolutionTaskCloseWorkflowThruFeed(TestInfo test)
      throws HttpResponseException, ParseException {
    Long startTs = System.currentTimeMillis();
    FeedResourceTest feedResourceTest = new FeedResourceTest();

    TestCase testCaseEntity = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);

    // Add failed test case, which will create a NEW incident
    putTestCaseResult(
        testCaseEntity.getFullyQualifiedName(),
        new TestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
        ADMIN_AUTH_HEADERS);

    // Now, we should be good to create an ASSIGNED status
    CreateTestCaseResolutionStatus createAssignedIncident =
        new CreateTestCaseResolutionStatus()
            .withTestCaseReference(testCaseEntity.getFullyQualifiedName())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Assigned)
            .withTestCaseResolutionStatusDetails(new Assigned().withAssignee(USER1_REF));
    TestCaseResolutionStatus assignedIncident = createTestCaseFailureStatus(createAssignedIncident);

    // Assert that the task is open
    String jsonThread =
        Entity.getCollectionDAO()
            .feedDAO()
            .fetchThreadByTestCaseResolutionStatusId(assignedIncident.getStateId());
    Thread thread = JsonUtils.readValue(jsonThread, Thread.class);
    assertEquals(assignedIncident.getStateId(), thread.getTask().getTestCaseResolutionStatusId());
    assertEquals(TaskStatus.Open, thread.getTask().getStatus());

    // close the task. The old task should be closed and the latest test case resolution status
    // should be updated (resolved) with the same state ID.
    CloseTask closeTask =
        new CloseTask()
            .withComment(USER1.getFullyQualifiedName())
            .withTestCaseFQN(testCaseEntity.getFullyQualifiedName());
    feedResourceTest.closeTask(thread.getTask().getId(), closeTask, ADMIN_AUTH_HEADERS);
    jsonThread =
        Entity.getCollectionDAO()
            .feedDAO()
            .fetchThreadByTestCaseResolutionStatusId(assignedIncident.getStateId());
    thread = JsonUtils.readValue(jsonThread, Thread.class);
    assertEquals(TaskStatus.Closed, thread.getTask().getStatus());

    // We'll confirm that we have created a new test case resolution status with the same state ID
    // and type Assigned
    ResultList<TestCaseResolutionStatus> mostRecentTestCaseResolutionStatus =
        getTestCaseFailureStatus(
            10,
            null,
            true,
            startTs,
            System.currentTimeMillis(),
            testCaseEntity.getFullyQualifiedName());
    assertEquals(1, mostRecentTestCaseResolutionStatus.getData().size());
    TestCaseResolutionStatus mostRecentTestCaseResolutionStatusData =
        mostRecentTestCaseResolutionStatus.getData().get(0);
    assertEquals(
        TestCaseResolutionStatusTypes.Resolved,
        mostRecentTestCaseResolutionStatusData.getTestCaseResolutionStatusType());
    assertEquals(
        assignedIncident.getStateId(), mostRecentTestCaseResolutionStatusData.getStateId());
  }

  @Test
  void test_testCaseResolutionTaskWorkflowThruAPI(TestInfo test)
      throws HttpResponseException, ParseException {
    TestCase testCaseEntity = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);

    // Add failed test case, which will create a NEW incident
    putTestCaseResult(
        testCaseEntity.getFullyQualifiedName(),
        new TestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
        ADMIN_AUTH_HEADERS);

    // Now, we should be good to create an ASSIGNED status
    CreateTestCaseResolutionStatus createAssignedIncident =
        new CreateTestCaseResolutionStatus()
            .withTestCaseReference(testCaseEntity.getFullyQualifiedName())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Assigned)
            .withTestCaseResolutionStatusDetails(new Assigned().withAssignee(USER1_REF));

    TestCaseResolutionStatus assignedIncident = createTestCaseFailureStatus(createAssignedIncident);

    // Confirm that the task is open
    String jsonThread =
        Entity.getCollectionDAO()
            .feedDAO()
            .fetchThreadByTestCaseResolutionStatusId(assignedIncident.getStateId());
    Thread thread = JsonUtils.readValue(jsonThread, Thread.class);
    assertEquals(TaskStatus.Open, thread.getTask().getStatus());
    assertEquals(assignedIncident.getStateId(), thread.getTask().getTestCaseResolutionStatusId());

    // Create a new test case resolution status with type Resolved
    // and confirm the task is closed
    CreateTestCaseResolutionStatus createTestCaseFailureStatusResolved =
        createAssignedIncident
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Resolved)
            .withTestCaseResolutionStatusDetails(
                new Resolved()
                    .withTestCaseFailureComment("resolved")
                    .withTestCaseFailureReason(TestCaseFailureReasonType.MissingData)
                    .withResolvedBy(USER1_REF));
    createTestCaseFailureStatus(createTestCaseFailureStatusResolved);

    jsonThread = Entity.getCollectionDAO().feedDAO().findById(thread.getId());
    thread = JsonUtils.readValue(jsonThread, Thread.class);
    assertEquals(TaskStatus.Closed, thread.getTask().getStatus());
  }

  @Test
  void unauthorizedTestCaseResolutionFlow(TestInfo test)
      throws HttpResponseException, ParseException {
    TestCase testCaseEntity = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);
    // Add failed test case, which will create a NEW incident
    putTestCaseResult(
        testCaseEntity.getFullyQualifiedName(),
        new TestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
        ADMIN_AUTH_HEADERS);

    // Now, we should be good to create an ASSIGNED status
    CreateTestCaseResolutionStatus createAssignedIncident =
        new CreateTestCaseResolutionStatus()
            .withTestCaseReference(testCaseEntity.getFullyQualifiedName())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Assigned)
            .withTestCaseResolutionStatusDetails(new Assigned().withAssignee(USER1_REF));
    createTestCaseFailureStatus(createAssignedIncident);

    assertResponseContains(
        () ->
            createTestCaseFailureStatus(
                createAssignedIncident.withTestCaseResolutionStatusType(
                    TestCaseResolutionStatusTypes.Ack)),
        BAD_REQUEST,
        "Incident with status [Assigned] cannot be moved to [Ack]");
  }

  @Test
  void testInferSeverity() {
    IncidentSeverityClassifierInterface severityClassifier =
        IncidentSeverityClassifierInterface.getInstance();
    // TEST_TABLE1 has no tier information, hence severity should be null as the classifier won't be
    // able to infer
    Severity severity = severityClassifier.classifyIncidentSeverity(TEST_TABLE1);
    assertNull(severity);

    List<TagLabel> tags = new ArrayList<>();
    tags.add(new TagLabel().withTagFQN("Tier.Tier1").withName("Tier1"));
    TEST_TABLE1.setTags(tags);

    // With tier set to Tier1, the severity should be inferred
    severity = severityClassifier.classifyIncidentSeverity(TEST_TABLE1);
    assertNotNull(severity);
  }

  @Test
  void get_listTestCaseWithStatusAndType(TestInfo test)
      throws HttpResponseException, ParseException, IOException {
    TestSuite testSuite = createExecutableTestSuite(test);

    int testCaseEntries = 15;

    List<TestCase> createdTestCase = new ArrayList<>();
    for (int i = 0; i < testCaseEntries; i++) {
      if (i % 2 == 0) {
        // Create column level test case
        createdTestCase.add(
            createEntity(
                createRequest(test, i + 1)
                    .withEntityLink(TABLE_COLUMN_LINK)
                    .withTestSuite(testSuite.getFullyQualifiedName()),
                ADMIN_AUTH_HEADERS));
        continue;
      }
      createdTestCase.add(
          createEntity(
              createRequest(test, i + 1).withTestSuite(testSuite.getFullyQualifiedName()),
              ADMIN_AUTH_HEADERS));
    }

    for (int i = 0; i < testCaseEntries; i++) {
      // Even number = Failed (8), Odd number = Success (7), 9 = Aborted (1)
      TestCaseStatus result = null;
      if (i % 2 == 0) {
        result = TestCaseStatus.Failed;
      } else if (i == 9) {
        result = TestCaseStatus.Aborted;
      } else {
        result = TestCaseStatus.Success;
      }
      TestCaseResult testCaseResult =
          new TestCaseResult()
              .withResult("result")
              .withTestCaseStatus(result)
              .withTimestamp(TestUtils.dateToTimestamp("2024-01-01"));
      putTestCaseResult(
          createdTestCase.get(i).getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);
    }

    Map<String, Object> queryParams = new HashMap<>();
    queryParams.put("limit", 100);
    queryParams.put("testSuiteId", testSuite.getId().toString());
    // Assert we get all 15 test cases
    ResultList<TestCase> testCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(testCaseEntries, testCases.getData().size());

    // Assert we get 8 failed test cases
    queryParams.put("testCaseStatus", TestCaseStatus.Failed);
    testCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(8, testCases.getData().size());

    // Assert we get 7 success test cases
    queryParams.put("testCaseStatus", TestCaseStatus.Success);
    testCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(6, testCases.getData().size());

    // Assert we get 1 aborted test cases
    queryParams.put("testCaseStatus", TestCaseStatus.Aborted);
    testCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(1, testCases.getData().size());

    queryParams.remove("testCaseStatus");

    // Assert we get 7 column level test cases
    queryParams.put("testCaseType", "column");
    testCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(8, testCases.getData().size());

    // Assert we get 8 table level test cases
    queryParams.put("testCaseType", "table");
    testCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(7, testCases.getData().size());
  }

  @Test
  void wrongMinMaxTestParameter(TestInfo test) throws HttpResponseException {
    CreateTestCase validTestCase = createRequest(test);
    validTestCase
        .withTestDefinition(TEST_DEFINITION1.getFullyQualifiedName())
        .withParameterValues(
            List.of(new TestCaseParameterValue().withName("minLength").withValue("10")));
    createEntity(validTestCase, ADMIN_AUTH_HEADERS);

    validTestCase = createRequest(test, 1);
    validTestCase
        .withTestDefinition(TEST_DEFINITION1.getFullyQualifiedName())
        .withParameterValues(
            List.of(new TestCaseParameterValue().withName("maxLength").withValue("10")));
    createEntity(validTestCase, ADMIN_AUTH_HEADERS);

    CreateTestCase invalidTestCase = createRequest(test, 2);
    invalidTestCase
        .withTestDefinition(TEST_DEFINITION1.getFullyQualifiedName())
        .withParameterValues(
            List.of(
                new TestCaseParameterValue().withName("minLength").withValue("10"),
                new TestCaseParameterValue().withName("maxLength").withValue("5")));

    assertResponseContains(
        () -> createEntity(invalidTestCase, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Value");

    CreateTestCase invalidTestCaseMixedTypes = createRequest(test, 3);
    invalidTestCaseMixedTypes
        .withTestDefinition(TEST_DEFINITION1.getFullyQualifiedName())
        .withParameterValues(
            List.of(
                new TestCaseParameterValue().withName("minLength").withValue("10.6"),
                new TestCaseParameterValue().withName("maxLength").withValue("5")));

    assertResponseContains(
        () -> createEntity(invalidTestCaseMixedTypes, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Value");
  }

  public void deleteTestCaseResult(String fqn, Long timestamp, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/" + fqn + "/testCaseResult/" + timestamp);
    TestUtils.delete(target, authHeaders);
  }

  private TestSuite createExecutableTestSuite(TestInfo test) throws IOException {
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable tableReq =
        tableResourceTest
            .createRequest(test)
            .withName(test.getDisplayName())
            .withDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName())
            .withOwner(USER1_REF)
            .withColumns(
                List.of(
                    new Column()
                        .withName(C1)
                        .withDisplayName("c1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10)))
            .withOwner(USER1_REF);
    Table table = tableResourceTest.createAndCheckEntity(tableReq, ADMIN_AUTH_HEADERS);
    CreateTestSuite createExecutableTestSuite =
        testSuiteResourceTest.createRequest(table.getFullyQualifiedName());
    TestSuite executableTestSuite =
        testSuiteResourceTest.createExecutableTestSuite(
            createExecutableTestSuite, ADMIN_AUTH_HEADERS);
    return executableTestSuite;
  }

  private void deleteLogicalTestCase(TestSuite testSuite, UUID testCaseId) throws IOException {
    WebTarget target =
        getCollection()
            .path(
                "/logicalTestCases/" + testSuite.getId().toString() + "/" + testCaseId.toString());
    TestUtils.delete(target, ADMIN_AUTH_HEADERS);
  }

  private boolean assertTestCaseIdNotInList(
      ResultList<TestCase> testCaseResultList, UUID testCaseId) {
    return testCaseResultList.getData().stream()
        .noneMatch(testCase -> testCase.getId().equals(testCaseId));
  }

  public ResultList<TestCaseResult> getTestCaseResults(
      String fqn, Long start, Long end, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/" + fqn + "/testCaseResult");
    target = target.queryParam("startTs", start);
    target = target.queryParam("endTs", end);
    return TestUtils.get(target, TestCaseResource.TestCaseResultList.class, authHeaders);
  }

  public TestCase getTestCase(String fqn, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/name/" + fqn);
    target = target.queryParam("fields", "incidentId,inspectionQuery");
    return TestUtils.get(target, TestCase.class, authHeaders);
  }

  private TestSummary getTestSummary(String testSuiteId) throws IOException, InterruptedException {
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    return testSuiteResourceTest.getTestSummary(ADMIN_AUTH_HEADERS, testSuiteId);
  }

  private void getAndValidateTestSummary(String testSuiteId)
      throws IOException, InterruptedException {
    // Retry logic to handle ES async operations
    int maxRetries = 5;
    int retries = 0;

    while (true) {
      try {
        TestSummary testSummary = getTestSummary(testSuiteId);
        validateTestSummary(testSummary, testSuiteId);
        break;
      } catch (Exception e) {
        if (retries++ >= maxRetries) {
          throw e;
        }
      }
    }
  }

  private void validateTestSummary(TestSummary testSummary, String testSuiteId)
      throws HttpResponseException {
    HashMap<String, Integer> testSummaryMap = JsonUtils.convertValue(testSummary, HashMap.class);
    List<TestCase> testCases;

    HashMap<String, HashMap<String, Integer>> columnsMap = new HashMap<>();
    HashMap<String, Integer> map = new HashMap<>(5);
    map.put("success", 0);
    map.put("failed", 0);
    map.put("aborted", 0);
    map.put("queued", 0);
    map.put("total", 0);
    HashMap<String, String> params = new HashMap<>();

    if (testSuiteId != null) {
      params.put("testSuiteId", testSuiteId);
    }
    params.put("fields", "testCaseResult");
    params.put("limit", "10000");
    params.put("include", "all");

    ResultList<TestCase> testCaseResultList = listEntities(params, ADMIN_AUTH_HEADERS);
    testCases = testCaseResultList.getData();
    for (TestCase testCase : testCases) {
      TestCaseResult testCaseResult = testCase.getTestCaseResult();
      if (testCaseResult == null) {
        continue;
      }

      MessageParser.EntityLink entityLink =
          testCase.getEntityLink() != null
              ? MessageParser.EntityLink.parse(testCase.getEntityLink())
              : null;
      if (entityLink != null
          && entityLink.getFieldName() != null
          && entityLink.getFieldName().equals("columns")
          && testSuiteId != null) {
        HashMap<String, Integer> columnMap =
            columnsMap.get(entityLink.getFullyQualifiedFieldValue());
        if (columnMap == null) {
          columnMap = new HashMap<>(5);
          columnMap.put("success", 0);
          columnMap.put("failed", 0);
          columnMap.put("aborted", 0);
          columnMap.put("queued", 0);
          columnMap.put("total", 0);
          columnsMap.put(entityLink.getLinkString(), columnMap);
        }
        columnMap.merge(
            testCaseResult.getTestCaseStatus().toString().toLowerCase(), 1, Integer::sum);
        columnMap.merge("total", 1, Integer::sum);
      }
      map.merge(testCaseResult.getTestCaseStatus().toString().toLowerCase(), 1, Integer::sum);
      map.merge("total", 1, Integer::sum);
    }

    for (Map.Entry<String, Integer> entry : map.entrySet()) {
      assertEquals(entry.getValue(), testSummaryMap.get(entry.getKey()));
    }

    if (testSuiteId != null) {
      // we validate column summary is set properly when requesting summary at the column level
      List<ColumnTestSummaryDefinition> columnTestSummary = testSummary.getColumnTestSummary();
      assertEquals(columnsMap.size(), columnTestSummary.size());
      for (ColumnTestSummaryDefinition columnTestSummaryDefinition : columnTestSummary) {
        HashMap<String, Integer> columnSummary =
            JsonUtils.convertValue(columnTestSummaryDefinition, HashMap.class);
        HashMap<String, Integer> columnMap =
            columnsMap.get(columnTestSummaryDefinition.getEntityLink());
        for (Map.Entry<String, Integer> entry : columnMap.entrySet()) {
          assertEquals(entry.getValue(), columnSummary.get(entry.getKey()));
        }
      }
    }
  }

  public ResultList<TestCase> getTestCases(
      Map<String, Object> queryParams, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection();
    for (Map.Entry<String, Object> entry : queryParams.entrySet()) {
      if (entry.getValue() == null || entry.getValue().toString().isEmpty()) {
        continue;
      }
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    return TestUtils.get(target, TestCaseResource.TestCaseList.class, authHeaders);
  }

  private TestCaseResult patchTestCaseResult(String testCaseFqn, Long timestamp, JsonPatch patch)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/" + testCaseFqn + "/testCaseResult/" + timestamp);
    return TestUtils.patch(target, patch, TestCaseResult.class, ADMIN_AUTH_HEADERS);
  }

  private void verifyTestCaseResults(
      ResultList<TestCaseResult> actualTestCaseResults,
      List<TestCaseResult> expectedTestCaseResults,
      int expectedCount) {
    assertEquals(expectedCount, actualTestCaseResults.getPaging().getTotal());
    assertEquals(expectedTestCaseResults.size(), actualTestCaseResults.getData().size());
    Map<Long, TestCaseResult> testCaseResultMap = new HashMap<>();
    for (TestCaseResult result : actualTestCaseResults.getData()) {
      result.setIncidentId(null);
      testCaseResultMap.put(result.getTimestamp(), result);
    }
    for (TestCaseResult result : expectedTestCaseResults) {
      TestCaseResult storedTestCaseResult = testCaseResultMap.get(result.getTimestamp());
      verifyTestCaseResult(storedTestCaseResult, result);
    }
  }

  private void verifyTestCases(
      ResultList<TestCase> actualTestCases,
      List<CreateTestCase> expectedTestCases,
      int expectedCount) {
    assertEquals(expectedCount, actualTestCases.getPaging().getTotal());
    assertEquals(expectedTestCases.size(), actualTestCases.getData().size());
    Map<String, TestCase> testCaseMap = new HashMap<>();
    for (TestCase result : actualTestCases.getData()) {
      testCaseMap.put(result.getName(), result);
    }
    for (CreateTestCase result : expectedTestCases) {
      TestCase storedTestCase = testCaseMap.get(result.getName());
      validateCreatedEntity(storedTestCase, result, ADMIN_AUTH_HEADERS);
    }
  }

  private void verifyTestCaseResult(TestCaseResult expected, TestCaseResult actual) {
    assertEquals(expected, actual);
  }

  @Override
  public CreateTestCase createRequest(String name) {
    return new CreateTestCase()
        .withName(name)
        .withDescription(name)
        .withEntityLink(TABLE_LINK)
        .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
        .withTestDefinition(TEST_DEFINITION1.getFullyQualifiedName());
  }

  @Override
  public void validateCreatedEntity(
      TestCase createdEntity, CreateTestCase request, Map<String, String> authHeaders) {
    validateCommonEntityFields(createdEntity, request, getPrincipalName(authHeaders));
    assertEquals(request.getEntityLink(), createdEntity.getEntityLink());
    assertReference(request.getTestSuite(), createdEntity.getTestSuite());
    assertReference(request.getTestDefinition(), createdEntity.getTestDefinition());
    assertReference(request.getTestSuite(), createdEntity.getTestSuite());
    assertEquals(request.getParameterValues(), createdEntity.getParameterValues());
  }

  @Override
  public void compareEntities(
      TestCase expected, TestCase updated, Map<String, String> authHeaders) {
    validateCommonEntityFields(expected, updated, getPrincipalName(authHeaders));
    assertEquals(expected.getEntityLink(), updated.getEntityLink());
    assertEquals(expected.getTestSuite(), updated.getTestSuite());
    assertEquals(expected.getTestDefinition(), updated.getTestDefinition());
    assertEquals(expected.getTestSuite(), updated.getTestSuite());
    assertEquals(expected.getParameterValues(), updated.getParameterValues());
  }

  @Override
  public TestCase validateGetWithDifferentFields(TestCase entity, boolean byName)
      throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwner(), entity.getTestSuite(), entity.getTestDefinition());

    fields = "owner,testSuite,testDefinition";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(entity.getOwner(), entity.getTestSuite(), entity.getTestDefinition());
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("parameterValues")) {
      assertEquals(JsonUtils.pojoToJson(expected), JsonUtils.pojoToJson(actual));
    } else if (fieldName.equals("testDefinition")) {
      assertEntityReferenceFieldChange(expected, actual);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  public ResultList<TestCaseResolutionStatus> getTestCaseFailureStatus(
      Long startTs,
      Long endTs,
      String assignee,
      TestCaseResolutionStatusTypes testCaseResolutionStatusType)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/testCaseIncidentStatus");
    target = target.queryParam("startTs", startTs);
    target = target.queryParam("endTs", endTs);
    target = assignee != null ? target.queryParam("assignee", assignee) : target;
    target =
        testCaseResolutionStatusType != null
            ? target.queryParam("testCaseResolutionStatusType", testCaseResolutionStatusType)
            : target;
    return TestUtils.get(
        target,
        TestCaseResolutionStatusResource.TestCaseResolutionStatusResultList.class,
        ADMIN_AUTH_HEADERS);
  }

  private TestCaseResolutionStatus getTestCaseFailureStatusById(UUID id)
      throws HttpResponseException {
    String pathUrl = "/testCaseIncidentStatus/" + id;
    WebTarget target = getCollection().path(pathUrl);
    return TestUtils.get(target, TestCaseResolutionStatus.class, ADMIN_AUTH_HEADERS);
  }

  private ResultList<TestCaseResolutionStatus> getTestCaseFailureStatusByStateId(UUID id)
      throws HttpResponseException {
    String pathUrl = "/testCaseIncidentStatus/stateId/" + id;
    WebTarget target = getCollection().path(pathUrl);
    return TestUtils.get(
        target,
        TestCaseResolutionStatusResource.TestCaseResolutionStatusResultList.class,
        ADMIN_AUTH_HEADERS);
  }

  private ResultList<TestCaseResolutionStatus> getTestCaseFailureStatus(
      int limit, String offset, Boolean latest, Long startTs, Long endTs, String testCaseFqn)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/testCaseIncidentStatus");
    target = target.queryParam("limit", limit);
    target = offset != null ? target.queryParam("offset", offset) : target;
    target =
        latest != null ? target.queryParam("latest", latest) : target.queryParam("latest", false);
    target = testCaseFqn != null ? target.queryParam("entityFQNHash", testCaseFqn) : target;

    target =
        startTs != null
            ? target.queryParam("startTs", startTs)
            : target.queryParam("startTs", System.currentTimeMillis() - 100000);
    target =
        endTs != null
            ? target.queryParam("endTs", endTs)
            : target.queryParam("endTs", System.currentTimeMillis() + 100000);

    return TestUtils.get(
        target,
        TestCaseResolutionStatusResource.TestCaseResolutionStatusResultList.class,
        ADMIN_AUTH_HEADERS);
  }

  private TestCaseResolutionStatus createTestCaseFailureStatus(
      CreateTestCaseResolutionStatus createTestCaseFailureStatus) throws HttpResponseException {
    WebTarget target = getCollection().path("/testCaseIncidentStatus");
    return TestUtils.post(
        target,
        createTestCaseFailureStatus,
        TestCaseResolutionStatus.class,
        200,
        ADMIN_AUTH_HEADERS);
  }

  private TestCaseResolutionStatus patchTestCaseResultFailureStatus(
      UUID testCaseFailureStatusId, JsonPatch patch) throws HttpResponseException {
    WebTarget target = getCollection().path("/testCaseIncidentStatus/" + testCaseFailureStatusId);
    return TestUtils.patch(target, patch, TestCaseResolutionStatus.class, ADMIN_AUTH_HEADERS);
  }

  private TestCaseResolutionStatus getTestCaseFailureStatus(UUID testCaseFailureStatusId)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/testCaseIncidentStatus/" + testCaseFailureStatusId);
    return TestUtils.get(target, TestCaseResolutionStatus.class, ADMIN_AUTH_HEADERS);
  }

  private void paginateTestCaseFailureStatus(
      Integer maxEntities,
      ResultList<TestCaseResolutionStatus> allEntities,
      Long startTs,
      Long endTs)
      throws HttpResponseException {
    Random random = new Random();
    int totalRecords = allEntities.getData().size();

    for (int limit = 1; limit < maxEntities; limit += random.nextInt(5) + 1) {
      String after = null;
      String before;
      int pageCount = 0;
      int indexInAllTables = 0;
      ResultList<TestCaseResolutionStatus> forwardPage;
      ResultList<TestCaseResolutionStatus> backwardPage;
      do { // For each limit (or page size) - forward scroll till the end
        forwardPage = getTestCaseFailureStatus(limit, after, null, startTs, endTs, null);
        after = forwardPage.getPaging().getAfter();
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allEntities.getData(), forwardPage, limit, indexInAllTables);

        if (pageCount == 0) { // CASE 0 - First page is being returned. There is no before-cursor
          assertNull(before);
        } else {
          // Make sure scrolling back based on before cursor returns the correct result
          backwardPage = getTestCaseFailureStatus(limit, before, null, startTs, endTs, null);
          assertEntityPagination(
              allEntities.getData(), backwardPage, limit, (indexInAllTables - limit));
        }

        indexInAllTables += forwardPage.getData().size();
        pageCount++;
      } while (after != null);

      // We have now reached the last page - test backward scroll till the beginning
      pageCount = 0;
      indexInAllTables = totalRecords - limit - forwardPage.getData().size();
      do {
        forwardPage = getTestCaseFailureStatus(limit, before, null, startTs, endTs, null);
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allEntities.getData(), forwardPage, limit, indexInAllTables);
        pageCount++;
        indexInAllTables -= forwardPage.getData().size();
      } while (before != null);
    }
  }

  @Test
  void put_and_delete_failedRowSample_200(TestInfo test) throws IOException, ParseException {
    CreateTestCase create =
        createRequest(test)
            .withEntityLink(TABLE_LINK)
            .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
            .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
            .withParameterValues(
                List.of(
                    new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    List<String> columns = Arrays.asList(C1, C2, C3);

    // Add 3 rows of sample data for 3 columns
    List<List<Object>> rows =
        Arrays.asList(
            Arrays.asList("c1Value1", 1, true),
            Arrays.asList("c1Value2", null, false),
            Arrays.asList("c1Value3", 3, true));

    // Cannot set failed sample for a non-failing test case
    assertResponse(
        () -> putFailedRowsSample(testCase, columns, rows, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Failed rows can only be added to a failed test case.");

    // Add failed test case, which will create a NEW incident
    putTestCaseResult(
        testCase.getFullyQualifiedName(),
        new TestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
        ADMIN_AUTH_HEADERS);
    // Sample data can be put as an ADMIN
    putFailedRowsSample(testCase, columns, rows, ADMIN_AUTH_HEADERS);

    // Sample data can be put as owner
    rows.get(0).set(1, 2); // Change value 1 to 2
    putFailedRowsSample(testCase, columns, rows, authHeaders(USER1.getName()));

    // Sample data can't be put as non-owner, non-admin
    assertResponse(
        () -> putFailedRowsSample(testCase, columns, rows, authHeaders(USER2.getName())),
        FORBIDDEN,
        permissionNotAllowed(USER2.getName(), List.of(EDIT_TESTS)));

    deleteFailedRowsSample(testCase, ADMIN_AUTH_HEADERS);

    assertResponse(
        () -> getSampleData(testCase.getId(), ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        FAILED_ROWS_SAMPLE_EXTENSION + " instance for " + testCase.getId() + " not found");
  }

  @Test
  void resolved_test_case_deletes_sample_data(TestInfo test) throws IOException, ParseException {
    CreateTestCase create =
        createRequest(test)
            .withEntityLink(TABLE_LINK)
            .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
            .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
            .withParameterValues(
                List.of(
                    new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    List<String> columns = Arrays.asList(C1, C2, C3);

    // Add 3 rows of sample data for 3 columns
    List<List<Object>> rows =
        Arrays.asList(
            Arrays.asList("c1Value1", 1, true),
            Arrays.asList("c1Value2", null, false),
            Arrays.asList("c1Value3", 3, true));

    putTestCaseResult(
        testCase.getFullyQualifiedName(),
        new TestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
        ADMIN_AUTH_HEADERS);

    putFailedRowsSample(testCase, columns, rows, ADMIN_AUTH_HEADERS);

    // resolving test case deletes the sample data
    TestCaseResult testCaseResult =
        new TestCaseResult()
            .withResult("tested")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-09"));
    putTestCaseResult(testCase.getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);
    assertResponse(
        () -> getSampleData(testCase.getId(), ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        FAILED_ROWS_SAMPLE_EXTENSION + " instance for " + testCase.getId() + " not found");
  }

  @Test
  void test_sensitivePIISampleData(TestInfo test) throws IOException, ParseException {
    // Create table with owner and a column tagged with PII.Sensitive
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable tableReq = getSensitiveTableReq(test, tableResourceTest);
    Table sensitiveTable = tableResourceTest.createAndCheckEntity(tableReq, ADMIN_AUTH_HEADERS);
    String sensitiveColumnLink =
        String.format("<#E::table::%s::columns::%s>", sensitiveTable.getFullyQualifiedName(), C1);
    CreateTestCase create =
        createRequest(test)
            .withEntityLink(sensitiveColumnLink)
            .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
            .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
            .withParameterValues(
                List.of(
                    new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    putTestCaseResult(
        testCase.getFullyQualifiedName(),
        new TestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
        ADMIN_AUTH_HEADERS);
    List<String> columns = List.of(C1);
    // Add 3 rows of sample data
    List<List<Object>> rows =
        Arrays.asList(List.of("c1Value1"), List.of("c1Value2"), List.of("c1Value3"));
    // add sample data
    putFailedRowsSample(testCase, columns, rows, ADMIN_AUTH_HEADERS);
    // assert values are not masked for the table owner
    TableData data = getSampleData(testCase.getId(), authHeaders(USER1.getName()));
    assertFalse(
        data.getRows().stream()
            .flatMap(List::stream)
            .map(r -> r == null ? "" : r)
            .map(Object::toString)
            .anyMatch(MASKED_VALUE::equals));
    // assert values are masked when is not the table owner
    data = getSampleData(testCase.getId(), authHeaders(USER2.getName()));
    assertEquals(
        3,
        data.getRows().stream()
            .flatMap(List::stream)
            .map(r -> r == null ? "" : r)
            .map(Object::toString)
            .filter(MASKED_VALUE::equals)
            .count());
  }

  @Test
  void test_addInspectionQuery(TestInfo test) throws IOException {
    CreateTestCase create =
        createRequest(test)
            .withEntityLink(TABLE_LINK)
            .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
            .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
            .withParameterValues(
                List.of(
                    new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    String inspectionQuery = "SELECT * FROM test_table WHERE column1 = 'value1'";
    putInspectionQuery(testCase, inspectionQuery, ADMIN_AUTH_HEADERS);
    TestCase updated = getTestCase(testCase.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    assertEquals(updated.getInspectionQuery(), inspectionQuery);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  protected void post_entityCreateWithInvalidName_400() {
    // Create an entity with mandatory name field null
    final CreateTestCase request = createRequest(null, "description", "displayName", null);
    assertResponseContains(
        () -> createEntity(request, ADMIN_AUTH_HEADERS), BAD_REQUEST, "[name must not be null]");

    // Create an entity with mandatory name field empty
    final CreateTestCase request1 = createRequest("", "description", "displayName", null);
    assertResponseContains(
        () -> createEntity(request1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        TestUtils.getEntityNameLengthError(entityClass));

    // Any entity name that has EntityLink separator must fail
    final CreateTestCase request3 =
        createRequest("invalid::Name", "description", "displayName", null);
    assertResponseContains(
        () -> createEntity(request3, ADMIN_AUTH_HEADERS), BAD_REQUEST, "name must match");
  }

  private void putInspectionQuery(TestCase testCase, String sql, Map<String, String> authHeaders)
      throws IOException {
    TestCase putResponse = putInspectionQuery(testCase.getId(), sql, authHeaders);
    assertEquals(sql, putResponse.getInspectionQuery());
  }

  private void putFailedRowsSample(
      TestCase testCase,
      List<String> columns,
      List<List<Object>> rows,
      Map<String, String> authHeaders)
      throws IOException {
    TableData tableData = new TableData().withColumns(columns).withRows(rows);
    TestCase putResponse = putFailedRowsSample(testCase.getId(), tableData, authHeaders);
    assertEquals(tableData, putResponse.getFailedRowsSample());

    TableData data = getSampleData(testCase.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(tableData, data);
  }

  private TestCase deleteFailedRowsSample(TestCase testCase, Map<String, String> authHeaders)
      throws IOException {
    WebTarget target = getResource(testCase.getId()).path("/failedRowsSample");
    return TestUtils.delete(target, TestCase.class, authHeaders);
  }

  public TestCase putFailedRowsSample(
      UUID testCaseId, TableData data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(testCaseId).path("/failedRowsSample");
    return TestUtils.put(target, data, TestCase.class, OK, authHeaders);
  }

  public TestCase putInspectionQuery(UUID testCaseId, String sql, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(testCaseId).path("/inspectionQuery");
    return TestUtils.put(target, sql, TestCase.class, OK, authHeaders);
  }

  public TableData getSampleData(UUID testCaseId, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(testCaseId).path("/failedRowsSample");
    return TestUtils.get(target, TableData.class, authHeaders);
  }
}
