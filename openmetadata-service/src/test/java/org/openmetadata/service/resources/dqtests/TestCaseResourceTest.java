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
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseFailureReason;
import org.openmetadata.schema.tests.type.TestCaseFailureStatus;
import org.openmetadata.schema.tests.type.TestCaseFailureStatusType;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;
import org.openmetadata.service.util.TestUtils.UpdateType;

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
    TABLE_COLUMN_LINK = String.format("<#E::table::%s::columns::%s>", TEST_TABLE1.getFullyQualifiedName(), C1);
    TABLE_COLUMN_LINK_2 = String.format("<#E::table::%s::columns::%s>", TEST_TABLE2.getFullyQualifiedName(), C1);
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
    TestCase entity = createEntity(createRequest(getEntityName(test), "description", null, null), ADMIN_AUTH_HEADERS);

    // Admin can edit tests
    entity = patchEntityAndCheckAuthorization(entity, ADMIN_USER_NAME, false);

    // Other roles and non-owner can't edit tests
    entity = patchEntityAndCheckAuthorization(entity, USER_WITH_DATA_STEWARD_ROLE.getName(), EDIT_TESTS, true);
    entity = patchEntityAndCheckAuthorization(entity, USER_WITH_DATA_CONSUMER_ROLE.getName(), EDIT_TESTS, true);
    patchEntityAndCheckAuthorization(entity, USER2.getName(), EDIT_TESTS, true);
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
    TestSuite testSuite = testSuiteResourceTest.createExecutableTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);

    create.withEntityLink(INVALID_LINK1).withTestSuite(testSuite.getFullyQualifiedName());
    assertResponseContains(
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, ENTITY_LINK_MATCH_ERROR);

    create.withEntityLink(INVALID_LINK2).withTestSuite(testSuite.getFullyQualifiedName());
    assertResponseContains(
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS), NOT_FOUND, "table instance for non-existent not found");

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
        .withParameterValues(List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Change the test with PUT request
    create.withTestDefinition(TEST_DEFINITION2.getFullyQualifiedName()).withParameterValues(new ArrayList<>());
    ChangeDescription change = getChangeDescription(testCase.getVersion());
    fieldUpdated(
        change, "testDefinition", TEST_DEFINITION3.getEntityReference(), TEST_DEFINITION2.getEntityReference());
    fieldUpdated(change, "parameterValues", testCase.getParameterValues(), new ArrayList<>());
    updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, TestUtils.UpdateType.MINOR_UPDATE, change);
  }

  @Test
  void put_testCaseResults_200(TestInfo test) throws IOException, ParseException {
    CreateTestCase create = createRequest(test);
    create
        .withEntityLink(TABLE_LINK)
        .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
        .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
        .withParameterValues(List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
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

    // create another table and add profiles
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
        testCase1.getFullyQualifiedName(), TestUtils.dateToTimestamp("2021-10-11"), ADMIN_AUTH_HEADERS);
    testCase1ResultList.remove(0);
    testCaseResults =
        getTestCaseResults(
            testCase1.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-10-11"),
            TestUtils.dateToTimestamp("2021-10-15"),
            ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, testCase1ResultList, 4);

    TestSummary testSummary = getTestSummary(ADMIN_AUTH_HEADERS, null);
    assertNotEquals(0, testSummary.getFailed());
    assertNotEquals(0, testSummary.getSuccess());
    assertNotEquals(0, testSummary.getTotal());
    assertEquals(0, testSummary.getAborted());

    String randomUUID = UUID.randomUUID().toString();
    assertResponseContains(
        () -> getTestSummary(ADMIN_AUTH_HEADERS, randomUUID),
        NOT_FOUND,
        "testSuite instance for " + randomUUID + " not found");

    // Test that we can get the test summary for a logical test suite and that
    // adding a logical test suite does not change the total number of tests
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    CreateTestSuite createLogicalTestSuite = testSuiteResourceTest.createRequest(test);
    TestSuite logicalTestSuite = testSuiteResourceTest.createEntity(createLogicalTestSuite, ADMIN_AUTH_HEADERS);
    List<UUID> testCaseIds = new ArrayList<>();
    testCaseIds.add(testCase1.getId());
    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, testCaseIds);

    testSummary = getTestSummary(ADMIN_AUTH_HEADERS, logicalTestSuite.getId().toString());
    assertEquals(1, testSummary.getTotal());
    assertEquals(1, testSummary.getFailed());

    // add a new test case to the logical test suite to validate if the
    // summary is updated correctly
    testCaseIds.removeAll(testCaseIds);
    testCaseIds.add(testCase.getId());
    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, testCaseIds);

    testSummary = getTestSummary(ADMIN_AUTH_HEADERS, logicalTestSuite.getId().toString());
    assertEquals(2, testSummary.getTotal());

    // remove test case from logical test suite and validate
    // the summary is updated as expected
    deleteLogicalTestCase(logicalTestSuite, testCase.getId());

    testSummary = getTestSummary(ADMIN_AUTH_HEADERS, logicalTestSuite.getId().toString());
    assertEquals(1, testSummary.getTotal());
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
        .withParameterValues(List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
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
            .withParameterValues(List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    expectedTestCaseList.add(create);
    CreateTestCase create1 =
        createRequest(test, 1)
            .withEntityLink(TABLE_LINK_2)
            .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
            .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
            .withParameterValues(List.of(new TestCaseParameterValue().withValue("20").withName("missingCountValue")));
    createAndCheckEntity(create1, ADMIN_AUTH_HEADERS);
    expectedTestCaseList.add(create1);
    ResultList<TestCase> testCaseList = getTestCases(10, "*", TABLE_LINK_2, false, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedTestCaseList, 2);

    CreateTestCase create3 =
        createRequest(test, 2)
            .withEntityLink(TABLE_COLUMN_LINK_2)
            .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
            .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
            .withParameterValues(List.of(new TestCaseParameterValue().withValue("20").withName("missingCountValue")));
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
              .withParameterValues(List.of(new TestCaseParameterValue().withValue("20").withName("missingCountValue")));
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
    ChangeDescription change = getChangeDescription(testCase.getVersion());
    fieldUpdated(change, "description", oldDescription, newDescription);
    testCase =
        updateAndCheckEntity(
            createRequest(test).withDescription(newDescription).withName(testCase.getName()),
            OK,
            ownerAuthHeaders,
            UpdateType.MINOR_UPDATE,
            change);

    // Update description with PATCH
    oldDescription = testCase.getDescription();
    newDescription = "description2";
    change = getChangeDescription(testCase.getVersion());
    fieldUpdated(change, "description", oldDescription, newDescription);
    String json = JsonUtils.pojoToJson(testCase);
    testCase.setDescription(newDescription);
    testCase = patchEntityAndCheck(testCase, json, ownerAuthHeaders, UpdateType.MINOR_UPDATE, change);

    // Delete the testcase
    deleteAndCheckEntity(testCase, ownerAuthHeaders);
  }

  @Test
  void patch_testCaseResultsFailureStatus_change(TestInfo test) throws IOException, ParseException {
    CreateTestCase create =
        createRequest(test)
            .withEntityLink(TABLE_LINK_2)
            .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
            .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
            .withParameterValues(List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    TestCaseResult testCaseResult =
        new TestCaseResult()
            .withResult("tested")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-09"));
    TestCaseFailureStatus testCaseFailureStatus =
        new TestCaseFailureStatus().withTestCaseFailureStatusType(TestCaseFailureStatusType.New);
    testCaseResult.setTestCaseFailureStatus(testCaseFailureStatus);
    putTestCaseResult(testCase.getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);

    ResultList<TestCaseResult> testCaseResultResultList =
        getTestCaseResults(
            testCase.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-09"),
            ADMIN_AUTH_HEADERS);

    assertEquals(
        TestCaseFailureStatusType.New,
        testCaseResultResultList.getData().get(0).getTestCaseFailureStatus().getTestCaseFailureStatusType());

    String original = JsonUtils.pojoToJson(testCaseResult);
    testCaseResult
        .getTestCaseFailureStatus()
        .withTestCaseFailureStatusType(TestCaseFailureStatusType.Resolved)
        .withTestCaseFailureReason(TestCaseFailureReason.FalsePositive)
        .withTestCaseFailureComment("Test failure was a false positive");

    JsonPatch patch = JsonUtils.getJsonPatch(original, JsonUtils.pojoToJson(testCaseResult));

    patchTestCaseResult(testCase.getFullyQualifiedName(), dateToTimestamp("2021-09-09"), patch, ADMIN_AUTH_HEADERS);

    ResultList<TestCaseResult> testCaseResultResultListUpdated =
        getTestCaseResults(
            testCase.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-09"),
            ADMIN_AUTH_HEADERS);

    assertEquals(
        TestCaseFailureStatusType.Resolved,
        testCaseResultResultListUpdated.getData().get(0).getTestCaseFailureStatus().getTestCaseFailureStatusType());
    assertEquals(
        TestCaseFailureReason.FalsePositive,
        testCaseResultResultListUpdated.getData().get(0).getTestCaseFailureStatus().getTestCaseFailureReason());
  }

  @Test
  void patch_testCaseResults_noChange(TestInfo test) throws IOException, ParseException {
    CreateTestCase create =
        createRequest(test)
            .withEntityLink(TABLE_LINK_2)
            .withTestSuite(TEST_SUITE1.getFullyQualifiedName())
            .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
            .withParameterValues(List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
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

    patchTestCaseResult(testCase.getFullyQualifiedName(), dateToTimestamp("2021-09-09"), patch, ADMIN_AUTH_HEADERS);

    ResultList<TestCaseResult> testCaseResultResultListUpdated =
        getTestCaseResults(
            testCase.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-09"),
            ADMIN_AUTH_HEADERS);

    // patching anything else than the test case failure status should not change anything
    assertEquals(TestCaseStatus.Success, testCaseResultResultListUpdated.getData().get(0).getTestCaseStatus());
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
    TestSuite logicalTestSuite = testSuiteResourceTest.createEntity(createLogicalTestSuite, ADMIN_AUTH_HEADERS);

    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, new ArrayList<>());
  }

  @Test
  public void delete_testCaseFromLogicalTestSuite(TestInfo test) throws IOException {
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    // Create a logical Test Suite
    CreateTestSuite createLogicalTestSuite = testSuiteResourceTest.createRequest(test);
    TestSuite logicalTestSuite = testSuiteResourceTest.createEntity(createLogicalTestSuite, ADMIN_AUTH_HEADERS);
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
    CreateTestSuite createExecutableTestSuite = testSuiteResourceTest.createRequest(table.getFullyQualifiedName());
    TestSuite executableTestSuite =
        testSuiteResourceTest.createExecutableTestSuite(createExecutableTestSuite, ADMIN_AUTH_HEADERS);

    List<TestCase> testCases = new ArrayList<>();

    // Create the test cases (need to be created against an executable test suite)
    for (int i = 0; i < 5; i++) {
      CreateTestCase create =
          createRequest("test_testSuite__" + i).withTestSuite(executableTestSuite.getFullyQualifiedName());
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

    // Delete a logical test case and check that it is deleted from the logical test suite but not from the executable
    // test suite
    UUID logicalTestCaseIdToDelete = testCases.get(0).getId();
    deleteLogicalTestCase(logicalTestSuite, logicalTestCaseIdToDelete);
    logicalTestSuiteTestCases = getTestCases(100, "*", logicalTestSuite, false, ADMIN_AUTH_HEADERS);
    assertTrue(assertTestCaseIdNotInList(logicalTestSuiteTestCases, logicalTestCaseIdToDelete));
    ResultList<TestCase> executableTestSuiteTestCases =
        getTestCases(100, "*", executableTestSuite, false, ADMIN_AUTH_HEADERS);
    assertEquals(testCases.size(), executableTestSuiteTestCases.getData().size());

    // Soft Delete a test case from the executable test suite and check that it is deleted from the executable test
    // suite and from the logical test suite
    UUID executableTestCaseIdToDelete = testCases.get(1).getId();
    deleteEntity(executableTestCaseIdToDelete, false, false, ADMIN_AUTH_HEADERS);
    logicalTestSuiteTestCases = getTestCases(100, "*", logicalTestSuite, false, ADMIN_AUTH_HEADERS);
    assertEquals(3, logicalTestSuiteTestCases.getData().size());
    assertTrue(assertTestCaseIdNotInList(logicalTestSuiteTestCases, executableTestCaseIdToDelete));
    logicalTestSuiteTestCases = getTestCases(100, "*", logicalTestSuite, true, ADMIN_AUTH_HEADERS);
    assertEquals(4, logicalTestSuiteTestCases.getData().size());

    executableTestSuiteTestCases = getTestCases(100, "*", executableTestSuite, false, ADMIN_AUTH_HEADERS);
    assertEquals(4, executableTestSuiteTestCases.getData().size());
    assertTrue(assertTestCaseIdNotInList(executableTestSuiteTestCases, executableTestCaseIdToDelete));
    executableTestSuiteTestCases = getTestCases(100, "*", executableTestSuite, true, ADMIN_AUTH_HEADERS);
    assertEquals(5, executableTestSuiteTestCases.getData().size());

    // Hard Delete a test case from the executable test suite and check that it is deleted from the executable test
    // suite and from the logical test suite
    deleteEntity(executableTestCaseIdToDelete, false, true, ADMIN_AUTH_HEADERS);
    logicalTestSuiteTestCases = getTestCases(100, "*", logicalTestSuite, true, ADMIN_AUTH_HEADERS);
    assertEquals(3, logicalTestSuiteTestCases.getData().size());
    assertTrue(assertTestCaseIdNotInList(logicalTestSuiteTestCases, executableTestCaseIdToDelete));

    executableTestSuiteTestCases = getTestCases(100, "*", executableTestSuite, true, ADMIN_AUTH_HEADERS);
    assertEquals(4, executableTestSuiteTestCases.getData().size());
    assertTrue(assertTestCaseIdNotInList(executableTestSuiteTestCases, executableTestCaseIdToDelete));
  }

  @Test
  public void list_allTestSuitesFromTestCase_200(TestInfo test) throws IOException {
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    // Create a logical Test Suite
    CreateTestSuite createLogicalTestSuite = testSuiteResourceTest.createRequest(test);
    TestSuite logicalTestSuite = testSuiteResourceTest.createEntity(createLogicalTestSuite, ADMIN_AUTH_HEADERS);
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

    TestCase testCaseWithSuites = getEntityByName(testCase.getFullyQualifiedName(), "*", ADMIN_AUTH_HEADERS);
    assertEquals(
        executableTestSuite.getFullyQualifiedName(), testCaseWithSuites.getTestSuite().getFullyQualifiedName());
    assertEquals(2, testCaseWithSuites.getTestSuites().size());

    // Verify both our testSuites are in the list of TestSuite Entities
    Map<String, TestSuite> testSuiteFQNs = new HashMap<>();
    testSuiteFQNs.put(logicalTestSuite.getFullyQualifiedName(), logicalTestSuite);
    testSuiteFQNs.put(executableTestSuite.getFullyQualifiedName(), executableTestSuite);

    for (TestSuite testSuite : testCaseWithSuites.getTestSuites()) {
      assertNotNull(testSuiteFQNs.get(testSuite.getFullyQualifiedName()));
    }
  }

  public void deleteTestCaseResult(String fqn, Long timestamp, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/" + fqn + "/testCaseResult/" + timestamp);
    TestUtils.delete(target, authHeaders);
  }

  private void deleteLogicalTestCase(TestSuite testSuite, UUID testCaseId) throws IOException {
    WebTarget target =
        getCollection().path("/logicalTestCases/" + testSuite.getId().toString() + "/" + testCaseId.toString());
    TestUtils.delete(target, ADMIN_AUTH_HEADERS);
  }

  private boolean assertTestCaseIdNotInList(ResultList<TestCase> testCaseResultList, UUID testCaseId) {
    return testCaseResultList.getData().stream().noneMatch(testCase -> testCase.getId().equals(testCaseId));
  }

  public ResultList<TestCaseResult> getTestCaseResults(
      String fqn, Long start, Long end, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getCollection().path("/" + fqn + "/testCaseResult");
    target = target.queryParam("startTs", start);
    target = target.queryParam("endTs", end);
    return TestUtils.get(target, TestCaseResource.TestCaseResultList.class, authHeaders);
  }

  private TestSummary getTestSummary(Map<String, String> authHeaders, String testSuiteId) throws IOException {
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    return testSuiteResourceTest.getTestSummary(authHeaders, testSuiteId);
  }

  public ResultList<TestCase> getTestCases(
      Integer limit, String fields, String link, Boolean includeAll, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection();
    target = limit != null ? target.queryParam("limit", limit) : target;
    target = target.queryParam("fields", fields);
    if (link != null) {
      target = target.queryParam("entityLink", link);
    }
    if (includeAll) {
      target = target.queryParam("includeAllTests", true);
      target = target.queryParam("include", "all");
    }
    return TestUtils.get(target, TestCaseResource.TestCaseList.class, authHeaders);
  }

  public ResultList<TestCase> getTestCases(
      Integer limit, String fields, TestSuite testSuite, Boolean includeAll, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection();
    target = limit != null ? target.queryParam("limit", limit) : target;
    target = target.queryParam("fields", fields);
    target = target.queryParam("testSuiteId", testSuite.getId());
    if (includeAll) {
      target = target.queryParam("includeAllTests", true);
      target = target.queryParam("include", "all");
    }
    return TestUtils.get(target, TestCaseResource.TestCaseList.class, authHeaders);
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
      testCaseResultMap.put(result.getTimestamp(), result);
    }
    for (TestCaseResult result : expectedTestCaseResults) {
      TestCaseResult storedTestCaseResult = testCaseResultMap.get(result.getTimestamp());
      verifyTestCaseResult(storedTestCaseResult, result);
    }
  }

  private void verifyTestCases(
      ResultList<TestCase> actualTestCases, List<CreateTestCase> expectedTestCases, int expectedCount) {
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
  public void validateCreatedEntity(TestCase createdEntity, CreateTestCase request, Map<String, String> authHeaders) {
    validateCommonEntityFields(createdEntity, request, getPrincipalName(authHeaders));
    assertEquals(request.getEntityLink(), createdEntity.getEntityLink());
    assertReference(request.getTestSuite(), createdEntity.getTestSuite());
    assertReference(request.getTestDefinition(), createdEntity.getTestDefinition());
    assertReference(request.getTestSuite(), createdEntity.getTestSuite());
    assertEquals(request.getParameterValues(), createdEntity.getParameterValues());
  }

  @Override
  public void compareEntities(TestCase expected, TestCase updated, Map<String, String> authHeaders) {
    validateCommonEntityFields(expected, updated, getPrincipalName(authHeaders));
    assertEquals(expected.getEntityLink(), updated.getEntityLink());
    assertEquals(expected.getTestSuite(), updated.getTestSuite());
    assertEquals(expected.getTestDefinition(), updated.getTestDefinition());
    assertEquals(expected.getTestSuite(), updated.getTestSuite());
    assertEquals(expected.getParameterValues(), updated.getParameterValues());
  }

  @Override
  public TestCase validateGetWithDifferentFields(TestCase entity, boolean byName) throws HttpResponseException {
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
    if (expected == actual) {}
    // TODO fix this
  }
}
