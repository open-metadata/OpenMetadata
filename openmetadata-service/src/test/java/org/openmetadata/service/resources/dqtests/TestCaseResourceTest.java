package org.openmetadata.service.resources.dqtests;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_TESTS;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.security.SecurityUtil.getPrincipalName;
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
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
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
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.Assigned;
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
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.feeds.FeedResourceTest;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;
import org.openmetadata.service.util.incidentSeverityClassifier.IncidentSeverityClassifierInterface;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Slf4j
public class TestCaseResourceTest extends EntityResourceTest<TestCase, CreateTestCase> {
  public static String TABLE_LINK;
  public static String TABLE_COLUMN_LINK;
  public static String TABLE_LINK_2;
  public static String TABLE_COLUMN_LINK_2;
  public static String INVALID_LINK1;
  public static String INVALID_LINK2;

  public TestCaseResourceTest() {
    super(
        Entity.TEST_CASE,
        org.openmetadata.schema.tests.TestCase.class,
        TestCaseResource.TestCaseList.class,
        "dataQuality/testCases",
        TestCaseResource.FIELDS);
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
                    new Column()
                        .withName(C1)
                        .withDisplayName("c1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10)))
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
    ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
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
  void put_testCaseResults_200(TestInfo test) throws IOException, ParseException {
    CreateTestCase create = createRequest(test);
    create
        .withEntityLink(TABLE_LINK)
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

    TestSummary testSummary;
    if (supportsSearchIndex && RUN_ELASTIC_SEARCH_TESTCASES) {
      testSummary = getTestSummary(ADMIN_AUTH_HEADERS, null);
      assertNotEquals(0, testSummary.getFailed());
      assertNotEquals(0, testSummary.getSuccess());
      assertNotEquals(0, testSummary.getTotal());
      assertEquals(0, testSummary.getAborted());
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

    if (supportsSearchIndex && RUN_ELASTIC_SEARCH_TESTCASES) {
      testSummary = getTestSummary(ADMIN_AUTH_HEADERS, logicalTestSuite.getId().toString());
      assertEquals(1, testSummary.getTotal());
      assertEquals(1, testSummary.getFailed());
    }

    // add a new test case to the logical test suite to validate if the
    // summary is updated correctly
    testCaseIds.clear();
    testCaseIds.add(testCase.getId());
    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, testCaseIds);
    if (supportsSearchIndex && RUN_ELASTIC_SEARCH_TESTCASES) {
      testSummary = getTestSummary(ADMIN_AUTH_HEADERS, logicalTestSuite.getId().toString());
      assertEquals(2, testSummary.getTotal());
    }

    // remove test case from logical test suite and validate
    // the summary is updated as expected
    deleteLogicalTestCase(logicalTestSuite, testCase.getId());

    if (supportsSearchIndex && RUN_ELASTIC_SEARCH_TESTCASES) {
      testSummary = getTestSummary(ADMIN_AUTH_HEADERS, logicalTestSuite.getId().toString());
      assertEquals(1, testSummary.getTotal());
    }
  }

  @Test
  void test_resultSummaryCascadeToAllSuites(TestInfo test) throws IOException, ParseException {
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
    if (supportsSearchIndex && RUN_ELASTIC_SEARCH_TESTCASES) {
      // test we get the right summary for the executable test suite
      TestSummary executableTestSummary =
          getTestSummary(ADMIN_AUTH_HEADERS, testCase.getTestSuite().getId().toString());
      assertEquals(testSuite.getTests().size(), executableTestSummary.getTotal());
    }

    // test we get the right summary for the logical test suite

    if (supportsSearchIndex && RUN_ELASTIC_SEARCH_TESTCASES) {
      TestSummary logicalTestSummary =
          getTestSummary(ADMIN_AUTH_HEADERS, logicalTestSuite.getId().toString());
      assertEquals(1, logicalTestSummary.getTotal());
    }
    testCaseIds.clear();
    testCaseIds.add(testCase.getId());
    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, testCaseIds);
    if (supportsSearchIndex && RUN_ELASTIC_SEARCH_TESTCASES) {
      TestSummary logicalTestSummary =
          getTestSummary(ADMIN_AUTH_HEADERS, logicalTestSuite.getId().toString());
      assertEquals(2, logicalTestSummary.getTotal());
    }
    deleteEntity(testCase1.getId(), ADMIN_AUTH_HEADERS);
    testSuite =
        testSuiteResourceTest.getEntity(testCase.getTestSuite().getId(), "*", ADMIN_AUTH_HEADERS);

    if (supportsSearchIndex && RUN_ELASTIC_SEARCH_TESTCASES) {
      TestSummary executableTestSummary =
          getTestSummary(ADMIN_AUTH_HEADERS, testCase.getTestSuite().getId().toString());
      assertEquals(testSuite.getTests().size(), executableTestSummary.getTotal());
      TestSummary logicalTestSummary =
          getTestSummary(ADMIN_AUTH_HEADERS, logicalTestSuite.getId().toString());
      assertEquals(2, logicalTestSummary.getTotal());
    }
    // check the deletion of the test case from the executable test suite
    // cascaded to the logical test suite
    deleteLogicalTestCase(logicalTestSuite, testCase.getId());

    if (supportsSearchIndex && RUN_ELASTIC_SEARCH_TESTCASES) {
      TestSummary logicalTestSummary =
          getTestSummary(ADMIN_AUTH_HEADERS, logicalTestSuite.getId().toString());
      // check the deletion of the test case from the logical test suite is reflected in the summary
      assertEquals(1, logicalTestSummary.getTotal());
    }
  }

  @Test
  void test_sensitivePIITestCase(TestInfo test) throws IOException {
    // First, create a table with PII Sensitive tag in a column
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable tableReq =
        tableResourceTest
            .createRequest(test)
            .withName("sensitiveTableTest")
            .withDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName())
            .withOwner(USER1_REF)
            .withColumns(
                List.of(
                    new Column()
                        .withName(C1)
                        .withDisplayName("c1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10)
                        .withTags(List.of(PII_SENSITIVE_TAG_LABEL))))
            .withOwner(USER1_REF);
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
    ResultList<TestCase> testCases =
        getTestCases(10, "*", sensitiveColumnLink, false, authHeaders(USER1_REF.getName()));
    assertNotNull(testCases.getData().get(0).getDescription());
    assertListNotEmpty(testCases.getData().get(0).getParameterValues());

    // Owner can see the results
    ResultList<TestCase> maskedTestCases =
        getTestCases(10, "*", sensitiveColumnLink, false, authHeaders(USER2_REF.getName()));
    assertNull(maskedTestCases.getData().get(0).getDescription());
    assertEquals(0, maskedTestCases.getData().get(0).getParameterValues().size());
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
    ResultList<TestCase> testCaseList =
        getTestCases(10, "*", TABLE_LINK_2, false, ADMIN_AUTH_HEADERS);
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

    testCaseList = getTestCases(10, "*", TABLE_LINK_2, false, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedTestCaseList, 2);

    testCaseList = getTestCases(10, "*", TABLE_COLUMN_LINK_2, false, ADMIN_AUTH_HEADERS);
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
    testCaseList = getTestCases(10, "*", TABLE_COLUMN_LINK_2, false, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedColTestCaseList, 10);

    testCaseList = getTestCases(12, "*", TABLE_LINK_2, true, ADMIN_AUTH_HEADERS);
    expectedTestCaseList.addAll(expectedColTestCaseList);
    verifyTestCases(testCaseList, expectedTestCaseList, 12);

    testCaseList = getTestCases(12, "*", TEST_SUITE1, false, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedTestCaseList, 12);
  }

  public void putTestCaseResult(String fqn, TestCaseResult data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/" + fqn + "/testCaseResult");
    TestUtils.put(target, data, CREATED, authHeaders);
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

    patchTestCaseResult(
        testCase.getFullyQualifiedName(), dateToTimestamp("2021-09-09"), patch, ADMIN_AUTH_HEADERS);

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
  public void add_EmptyTestCaseToLogicalTestSuite_200(TestInfo test) throws IOException {
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    // Create a logical Test Suite
    CreateTestSuite createLogicalTestSuite = testSuiteResourceTest.createRequest(test);
    TestSuite logicalTestSuite =
        testSuiteResourceTest.createEntity(createLogicalTestSuite, ADMIN_AUTH_HEADERS);

    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, new ArrayList<>());
  }

  @Test
  public void delete_testCaseFromLogicalTestSuite(TestInfo test) throws IOException {
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    // Create a logical Test Suite
    CreateTestSuite createLogicalTestSuite = testSuiteResourceTest.createRequest(test);
    TestSuite logicalTestSuite =
        testSuiteResourceTest.createEntity(createLogicalTestSuite, ADMIN_AUTH_HEADERS);
    // Create an executable test suite
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
    ResultList<TestCase> logicalTestSuiteTestCases =
        getTestCases(100, "*", logicalTestSuite, false, ADMIN_AUTH_HEADERS);
    assertEquals(testCases.size(), logicalTestSuiteTestCases.getData().size());

    // Delete a logical test case and check that it is deleted from the logical test suite but not
    // from the executable test suite
    UUID logicalTestCaseIdToDelete = testCases.get(0).getId();
    deleteLogicalTestCase(logicalTestSuite, logicalTestCaseIdToDelete);
    logicalTestSuiteTestCases = getTestCases(100, "*", logicalTestSuite, false, ADMIN_AUTH_HEADERS);
    assertTrue(assertTestCaseIdNotInList(logicalTestSuiteTestCases, logicalTestCaseIdToDelete));
    ResultList<TestCase> executableTestSuiteTestCases =
        getTestCases(100, "*", executableTestSuite, false, ADMIN_AUTH_HEADERS);
    assertEquals(testCases.size(), executableTestSuiteTestCases.getData().size());

    // Soft Delete a test case from the executable test suite and check that it is deleted from the
    // executable test suite and from the logical test suite
    UUID executableTestCaseIdToDelete = testCases.get(1).getId();
    deleteEntity(executableTestCaseIdToDelete, false, false, ADMIN_AUTH_HEADERS);
    logicalTestSuiteTestCases = getTestCases(100, "*", logicalTestSuite, false, ADMIN_AUTH_HEADERS);
    assertEquals(3, logicalTestSuiteTestCases.getData().size());
    assertTrue(assertTestCaseIdNotInList(logicalTestSuiteTestCases, executableTestCaseIdToDelete));
    logicalTestSuiteTestCases = getTestCases(100, "*", logicalTestSuite, true, ADMIN_AUTH_HEADERS);
    assertEquals(4, logicalTestSuiteTestCases.getData().size());

    executableTestSuiteTestCases =
        getTestCases(100, "*", executableTestSuite, false, ADMIN_AUTH_HEADERS);
    assertEquals(4, executableTestSuiteTestCases.getData().size());
    assertTrue(
        assertTestCaseIdNotInList(executableTestSuiteTestCases, executableTestCaseIdToDelete));
    executableTestSuiteTestCases =
        getTestCases(100, "*", executableTestSuite, true, ADMIN_AUTH_HEADERS);
    assertEquals(5, executableTestSuiteTestCases.getData().size());

    // Hard Delete a test case from the executable test suite and check that it is deleted from the
    // executable test suite and from the logical test suite
    deleteEntity(executableTestCaseIdToDelete, false, true, ADMIN_AUTH_HEADERS);
    logicalTestSuiteTestCases = getTestCases(100, "*", logicalTestSuite, true, ADMIN_AUTH_HEADERS);
    assertEquals(3, logicalTestSuiteTestCases.getData().size());
    assertTrue(assertTestCaseIdNotInList(logicalTestSuiteTestCases, executableTestCaseIdToDelete));

    executableTestSuiteTestCases =
        getTestCases(100, "*", executableTestSuite, true, ADMIN_AUTH_HEADERS);
    assertEquals(4, executableTestSuiteTestCases.getData().size());
    assertTrue(
        assertTestCaseIdNotInList(executableTestSuiteTestCases, executableTestCaseIdToDelete));
  }

  @Test
  public void list_allTestSuitesFromTestCase_200(TestInfo test) throws IOException {
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
  public void test_testCaseResultState(TestInfo test) throws IOException, ParseException {
    // Create table for our test
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
    Table testTable = tableResourceTest.createAndCheckEntity(tableReq, ADMIN_AUTH_HEADERS);
    // create testSuite
    CreateTestSuite createExecutableTestSuite =
        testSuiteResourceTest.createRequest(testTable.getFullyQualifiedName());
    TestSuite testSuite =
        testSuiteResourceTest.createExecutableTestSuite(
            createExecutableTestSuite, ADMIN_AUTH_HEADERS);

    // create testCase
    CreateTestCase createTestCase =
        new CreateTestCase()
            .withName(test.getDisplayName())
            .withDescription(test.getDisplayName())
            .withEntityLink(String.format("<#E::table::%s>", testTable.getFullyQualifiedName()))
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
    patchTestCaseResult(
        testCase.getFullyQualifiedName(), dateToTimestamp("2023-08-14"), patch, ADMIN_AUTH_HEADERS);

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
  public void test_listTestCaseByExecutionTime(TestInfo test) throws IOException, ParseException {
    // if we have no test cases create some
    for (int i = 0; i < 10; i++) {
      createAndCheckEntity(createRequest(test, i), ADMIN_AUTH_HEADERS);
    }
    ResultList<TestCase> nonExecutionSortedTestCases =
        getTestCases(10, null, null, "*", false, ADMIN_AUTH_HEADERS);

    TestCase lastTestCaseInList =
        nonExecutionSortedTestCases
            .getData()
            .get(
                nonExecutionSortedTestCases.getData().size()
                    - 1); // we'll take the latest one in the list
    TestCase firstTestCaseInList =
        nonExecutionSortedTestCases.getData().get(0); // we'll take the first one in the list

    DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    LocalDate today = LocalDate.now();
    String todayString = today.format(formatter);
    for (int i = 11; i <= 15; i++) {
      TestCaseResult testCaseResult =
          new TestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Failed)
              .withTimestamp(TestUtils.dateToTimestamp("2023-01-" + i));
      putTestCaseResult(
          firstTestCaseInList.getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);
    }
    putTestCaseResult(
        lastTestCaseInList.getFullyQualifiedName(),
        new TestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp(todayString)),
        ADMIN_AUTH_HEADERS);

    ResultList<TestCase> executionSortedTestCases =
        getTestCases(10, null, null, "*", true, ADMIN_AUTH_HEADERS);
    assertEquals(lastTestCaseInList.getId(), executionSortedTestCases.getData().get(0).getId());
    assertEquals(
        lastTestCaseInList.getId(),
        nonExecutionSortedTestCases
            .getData()
            .get(nonExecutionSortedTestCases.getData().size() - 1)
            .getId());
  }

  @Test
  void test_listTestCaseByExecutionTimePagination_200(TestInfo test)
      throws IOException, ParseException {
    // Create a number of entities between 5 and 20 inclusive
    Random rand = new Random();
    int maxEntities = rand.nextInt(16) + 5;

    List<TestCase> createdTestCase = new ArrayList<>();
    for (int i = 0; i < maxEntities; i++) {
      createdTestCase.add(createEntity(createRequest(test, i + 1), ADMIN_AUTH_HEADERS));
    }

    TestCase firstTestCase = createdTestCase.get(0);
    TestCase lastTestCase = createdTestCase.get(maxEntities - 1);

    DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    LocalDate today = LocalDate.now();
    putTestCaseResult(
        lastTestCase.getFullyQualifiedName(),
        new TestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp(today.format(formatter))),
        ADMIN_AUTH_HEADERS);
    putTestCaseResult(
        firstTestCase.getFullyQualifiedName(),
        new TestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp(today.minusYears(10).format(formatter))),
        ADMIN_AUTH_HEADERS);

    // List all entities and use it for checking pagination
    ResultList<TestCase> allEntities =
        getTestCases(1000000, null, null, "*", true, ADMIN_AUTH_HEADERS);

    paginate(maxEntities, allEntities, null);

    // Validate Pagination when filtering by testSuiteId
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    CreateTestSuite createLogicalTestSuite = testSuiteResourceTest.createRequest(test);
    TestSuite logicalTestSuite =
        testSuiteResourceTest.createEntity(createLogicalTestSuite, ADMIN_AUTH_HEADERS);
    List<UUID> testCaseIds =
        createdTestCase.stream().map(TestCase::getId).collect(Collectors.toList());
    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, testCaseIds);
    allEntities =
        getTestCases(
            1000000, null, null, "*", null, logicalTestSuite, false, true, ADMIN_AUTH_HEADERS);
    paginate(maxEntities, allEntities, logicalTestSuite);
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

    paginateTestCaseFailureStatus(maxEntities, allEntities, null, startTs, endTs);
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
        patchTestCaseResultFailureStatus(testCaseFailureStatus.getId(), patch, ADMIN_AUTH_HEADERS);
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
        () ->
            patchTestCaseResultFailureStatus(
                testCaseFailureStatus.getId(), patch, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Field testCaseResolutionStatusType is not allowed to be updated");
  }

  @Test
  public void test_testCaseResolutionTaskResolveWorkflowThruFeed(TestInfo test)
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
  public void test_testCaseResolutionTaskCloseWorkflowThruFeed(TestInfo test)
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
  public void test_testCaseResolutionTaskWorkflowThruAPI(TestInfo test)
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
  public void unauthorizedTestCaseResolutionFlow(TestInfo test)
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
  public void testInferSeverity(TestInfo test) {
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

  public void deleteTestCaseResult(String fqn, Long timestamp, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/" + fqn + "/testCaseResult/" + timestamp);
    TestUtils.delete(target, authHeaders);
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
    target = target.queryParam("fields", "incidentId");
    return TestUtils.get(target, TestCase.class, authHeaders);
  }

  private TestSummary getTestSummary(Map<String, String> authHeaders, String testSuiteId)
      throws IOException {
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    return testSuiteResourceTest.getTestSummary(authHeaders, testSuiteId);
  }

  public ResultList<TestCase> getTestCases(
      Integer limit,
      String before,
      String after,
      String fields,
      String link,
      TestSuite testSuite,
      Boolean includeAll,
      Boolean orderByLastExecutionDate,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection();
    target = target.queryParam("fields", fields);
    target = limit != null ? target.queryParam("limit", limit) : target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    target = link != null ? target.queryParam("entityLink", link) : target;
    target = testSuite != null ? target.queryParam("testSuiteId", testSuite.getId()) : target;
    target =
        orderByLastExecutionDate ? target.queryParam("orderByLastExecutionDate", true) : target;
    if (includeAll) {
      target = target.queryParam("includeAllTests", true);
      target = target.queryParam("include", "all");
    }
    return TestUtils.get(target, TestCaseResource.TestCaseList.class, authHeaders);
  }

  public ResultList<TestCase> getTestCases(
      Integer limit,
      String fields,
      String link,
      Boolean includeAll,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    return getTestCases(limit, null, null, fields, link, null, includeAll, false, authHeaders);
  }

  public ResultList<TestCase> getTestCases(
      Integer limit,
      String fields,
      TestSuite testSuite,
      Boolean includeAll,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    return getTestCases(limit, null, null, fields, null, testSuite, includeAll, false, authHeaders);
  }

  public ResultList<TestCase> getTestCases(
      Integer limit,
      String before,
      String after,
      String fields,
      Boolean orderByLastExecutionDate,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    return getTestCases(
        limit, before, after, fields, null, null, false, orderByLastExecutionDate, authHeaders);
  }

  private TestCaseResult patchTestCaseResult(
      String testCaseFqn, Long timestamp, JsonPatch patch, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/" + testCaseFqn + "/testCaseResult/" + timestamp);
    return TestUtils.patch(target, patch, TestCaseResult.class, authHeaders);
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

  private void paginate(Integer maxEntities, ResultList<TestCase> allEntities, TestSuite testSuite)
      throws HttpResponseException {
    Random random = new Random();
    int totalRecords = allEntities.getData().size();

    for (int limit = 1; limit < maxEntities; limit += random.nextInt(5) + 1) {
      String after = null;
      String before;
      int pageCount = 0;
      int indexInAllTables = 0;
      ResultList<TestCase> forwardPage;
      ResultList<TestCase> backwardPage;
      do { // For each limit (or page size) - forward scroll till the end
        forwardPage =
            getTestCases(limit, null, after, "*", null, testSuite, false, true, ADMIN_AUTH_HEADERS);
        after = forwardPage.getPaging().getAfter();
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allEntities.getData(), forwardPage, limit, indexInAllTables);

        if (pageCount == 0) { // CASE 0 - First page is being returned. There is no before-cursor
          assertNull(before);
        } else {
          // Make sure scrolling back based on before cursor returns the correct result
          backwardPage =
              getTestCases(
                  limit, before, null, "*", null, testSuite, false, true, ADMIN_AUTH_HEADERS);
          getTestCases(limit, before, null, "*", true, ADMIN_AUTH_HEADERS);
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
        forwardPage =
            getTestCases(
                limit, before, null, "*", null, testSuite, false, true, ADMIN_AUTH_HEADERS);
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allEntities.getData(), forwardPage, limit, indexInAllTables);
        pageCount++;
        indexInAllTables -= forwardPage.getData().size();
      } while (before != null);
    }
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

  private void createTestCaseResolutionStatus(
      List<CreateTestCaseResolutionStatus> createTestCaseFailureStatus)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/testCaseIncidentStatus");

    for (CreateTestCaseResolutionStatus testCaseFailureStatus : createTestCaseFailureStatus) {
      TestUtils.post(
          target, testCaseFailureStatus, TestCaseResolutionStatus.class, 200, ADMIN_AUTH_HEADERS);
    }
  }

  private TestCaseResolutionStatus patchTestCaseResultFailureStatus(
      UUID testCaseFailureStatusId, JsonPatch patch, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/testCaseIncidentStatus/" + testCaseFailureStatusId);
    return TestUtils.patch(target, patch, TestCaseResolutionStatus.class, authHeaders);
  }

  private TestCaseResolutionStatus getTestCaseFailureStatus(UUID testCaseFailureStatusId)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/testCaseIncidentStatus/" + testCaseFailureStatusId);
    return TestUtils.get(target, TestCaseResolutionStatus.class, ADMIN_AUTH_HEADERS);
  }

  private void paginateTestCaseFailureStatus(
      Integer maxEntities,
      ResultList<TestCaseResolutionStatus> allEntities,
      Boolean latest,
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
        forwardPage = getTestCaseFailureStatus(limit, after, latest, startTs, endTs, null);
        after = forwardPage.getPaging().getAfter();
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allEntities.getData(), forwardPage, limit, indexInAllTables);

        if (pageCount == 0) { // CASE 0 - First page is being returned. There is no before-cursor
          assertNull(before);
        } else {
          // Make sure scrolling back based on before cursor returns the correct result
          backwardPage = getTestCaseFailureStatus(limit, before, latest, startTs, endTs, null);
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
        forwardPage = getTestCaseFailureStatus(limit, before, latest, startTs, endTs, null);
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allEntities.getData(), forwardPage, limit, indexInAllTables);
        pageCount++;
        indexInAllTables -= forwardPage.getData().size();
      } while (before != null);
    }
  }
}
