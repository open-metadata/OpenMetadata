package org.openmetadata.catalog.resources.dqtests;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.client.WebTarget;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateTable;
import org.openmetadata.catalog.api.tests.CreateTestCase;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.databases.TableResourceTest;
import org.openmetadata.catalog.test.TestCaseParameterValue;
import org.openmetadata.catalog.tests.TestCase;
import org.openmetadata.catalog.tests.type.TestCaseResult;
import org.openmetadata.catalog.tests.type.TestCaseStatus;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.ColumnDataType;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Slf4j
public class TestCaseResourceTest extends EntityResourceTest<TestCase, CreateTestCase> {
  public static String TABLE_LINK;
  public static String TABLE_COLUMN_LINK;
  public static String INVALID_LINK1;
  public static String INVALID_LINK2;

  public TestCaseResourceTest() {
    super(
        Entity.TEST_CASE,
        org.openmetadata.catalog.tests.TestCase.class,
        TestCaseResource.TestCaseList.class,
        "testCase",
        TestCaseResource.FIELDS);
    supportsEmptyDescription = false;
    supportsFollowers = false;
    supportsAuthorizedMetadataOperations = false;
    supportsOwner = false;
  }

  public void setupTestCase(TestInfo test) throws IOException {
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable tableReq =
        tableResourceTest
            .createRequest(test)
            .withName("testCaseTable")
            .withDatabaseSchema(DATABASE_SCHEMA_REFERENCE)
            .withColumns(
                List.of(
                    new Column()
                        .withName("c1")
                        .withDisplayName("c1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10)))
            .withOwner(USER_OWNER1);
    TEST_TABLE1 = tableResourceTest.createAndCheckEntity(tableReq, ADMIN_AUTH_HEADERS);
    TABLE_LINK = String.format("<#E::table::%s>", TEST_TABLE1.getFullyQualifiedName());
    TABLE_COLUMN_LINK = String.format("<#E::table::%s::columns::c1>", TEST_TABLE1.getFullyQualifiedName());
    INVALID_LINK1 = String.format("<#E::dashboard::%s", "temp");
    INVALID_LINK2 = String.format("<#E::table::%s>", "non-existent");
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
  void post_testWithInvalidEntityTestSuite_4xx(TestInfo test) {
    CreateTestCase create = createRequest(test);

    create.withEntityLink(INVALID_LINK1).withTestSuite(TEST_TABLE1.getEntityReference());
    assertResponseContains(
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[entityLink must match \"^<#E::\\S+::\\S+>$\"]");

    create.withEntityLink(INVALID_LINK2).withTestSuite(TEST_TABLE1.getEntityReference());
    assertResponseContains(
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS), NOT_FOUND, "table instance for non-existent not found");

    CreateTestCase create1 = createRequest(test);
    create1.withTestSuite(TEST_DEFINITION1_REFERENCE);
    assertResponseContains(
        () -> createAndCheckEntity(create1, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        "testSuite instance for " + TEST_DEFINITION1_REFERENCE.getId() + " not found");

    CreateTestCase create2 = createRequest(test);
    create2.withEntityLink(TABLE_LINK).withTestSuite(TEST_SUITE1_REFERENCE).withTestDefinition(TEST_SUITE1_REFERENCE);
    assertResponseContains(
        () -> createAndCheckEntity(create2, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        "testDefinition instance for " + TEST_SUITE1_REFERENCE.getId() + " not found");
  }

  @Test
  void post_testWithInvalidParamValues_4xx(TestInfo test) {
    CreateTestCase create = createRequest(test);
    create
        .withEntityLink(TABLE_LINK)
        .withTestSuite(TEST_SUITE1_REFERENCE)
        .withTestDefinition(TEST_DEFINITION2_REFERENCE)
        .withParameterValues(List.of(new TestCaseParameterValue().withName("col").withValue("x")));
    assertResponseContains(
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Parameter Values doesn't match Test Definition Parameters");

    CreateTestCase create1 = createRequest(test);
    create1
        .withEntityLink(TABLE_LINK)
        .withTestSuite(TEST_SUITE1_REFERENCE)
        .withTestDefinition(TEST_DEFINITION3_REFERENCE);
    assertResponseContains(
        () -> createAndCheckEntity(create1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Required parameter missingCountValue is not passed in parameterValues");
  }

  @Test
  void createUpdateDelete_tests_200(TestInfo test) throws IOException {
    CreateTestCase create = createRequest(test);
    create
        .withEntityLink(TABLE_LINK)
        .withTestSuite(TEST_SUITE1_REFERENCE)
        .withTestDefinition(TEST_DEFINITION3_REFERENCE)
        .withParameterValues(List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    testCase = getEntity(testCase.getId(), "entityLink,testSuite,testDefinition,owner", ADMIN_AUTH_HEADERS);
    validateCreatedEntity(testCase, create, ADMIN_AUTH_HEADERS);
    create.withTestDefinition(TEST_DEFINITION2_REFERENCE).withParameterValues(new ArrayList<>());
    List<FieldChange> addedFields = new ArrayList<>();
    addedFields.add(new FieldChange().withName("testDefinition").withNewValue(TEST_DEFINITION2_REFERENCE));
    List<FieldChange> deletedFields = new ArrayList<>();
    deletedFields.add(new FieldChange().withName("testDefinition").withOldValue(TEST_DEFINITION3_REFERENCE));
    List<FieldChange> updatedFields = new ArrayList<>();
    updatedFields.add(
        new FieldChange()
            .withName("parameterValues")
            .withOldValue(testCase.getParameterValues())
            .withNewValue(new ArrayList<>()));
    ChangeDescription change =
        getChangeDescription(testCase.getVersion())
            .withFieldsAdded(addedFields)
            .withFieldsDeleted(deletedFields)
            .withFieldsUpdated(updatedFields);
    testCase = updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, TestUtils.UpdateType.MINOR_UPDATE, change);
    testCase = getEntity(testCase.getId(), "entityLink,testSuite,testDefinition,owner", ADMIN_AUTH_HEADERS);
    validateCreatedEntity(testCase, create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_testCaseResults_200(TestInfo test) throws IOException, ParseException {
    CreateTestCase create = createRequest(test);
    create
        .withEntityLink(TABLE_LINK)
        .withTestSuite(TEST_SUITE1_REFERENCE)
        .withTestDefinition(TEST_DEFINITION3_REFERENCE)
        .withParameterValues(List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    TestCaseResult testCaseResult =
        new TestCaseResult()
            .withResult("tested")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-09"));
    TestCase putResponse = putTestCaseResult(testCase.getId(), testCaseResult, ADMIN_AUTH_HEADERS);
    verifyTestCaseResult(putResponse.getTestCaseResult(), testCaseResult);

    ResultList<TestCaseResult> testCaseResults = getTestCaseResults(testCase.getId(), null, ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, List.of(testCaseResult), 1);

    // Add new date for TableCaseResult
    TestCaseResult newTestCaseResult =
        new TestCaseResult()
            .withResult("tested")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-10"));
    putResponse = putTestCaseResult(testCase.getId(), newTestCaseResult, ADMIN_AUTH_HEADERS);
    verifyTestCaseResult(putResponse.getTestCaseResult(), newTestCaseResult);

    testCaseResults = getTestCaseResults(testCase.getId(), null, ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, List.of(newTestCaseResult, testCaseResult), 2);

    // Replace table profile for a date
    TestCaseResult newTestCaseResult1 =
        new TestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-10"));
    putResponse = putTestCaseResult(testCase.getId(), newTestCaseResult1, ADMIN_AUTH_HEADERS);
    assertEquals(newTestCaseResult1.getTimestamp(), putResponse.getTestCaseResult().getTimestamp());
    verifyTestCaseResult(putResponse.getTestCaseResult(), newTestCaseResult1);

    testCase = getEntity(testCase.getId(), "testCaseResult", ADMIN_AUTH_HEADERS);
    // first result should be the latest date
    testCaseResults = getTestCaseResults(testCase.getId(), null, ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, List.of(newTestCaseResult1, testCaseResult), 2);

    String dateStr = "2021-09-";
    List<TestCaseResult> testCaseResultList = new ArrayList<>();
    testCaseResultList.add(testCaseResult);
    testCaseResultList.add(newTestCaseResult1);
    for (int i = 11; i <= 20; i++) {
      testCaseResult =
          new TestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Success)
              .withTimestamp(TestUtils.dateToTimestamp(dateStr + i));
      putTestCaseResult(testCase.getId(), testCaseResult, ADMIN_AUTH_HEADERS);
      testCaseResultList.add(testCaseResult);
    }
    testCaseResults = getTestCaseResults(testCase.getId(), testCaseResultList.size(), ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, testCaseResultList, 12);

    // create another table and add profiles
    TestCase testCase1 =
        createAndCheckEntity(
            createRequest(test).withName(test.getDisplayName() + UUID.randomUUID()), ADMIN_AUTH_HEADERS);
    List<TestCaseResult> testCase1ResultList = new ArrayList<>();
    dateStr = "2021-10-";
    for (int i = 11; i <= 15; i++) {
      testCaseResult =
          new TestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Failed)
              .withTimestamp(TestUtils.dateToTimestamp(dateStr + i));
      putTestCaseResult(testCase1.getId(), testCaseResult, ADMIN_AUTH_HEADERS);
      testCase1ResultList.add(testCaseResult);
    }
    testCaseResults = getTestCaseResults(testCase1.getId(), null, ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, testCase1ResultList, 5);
    deleteTestCaseResult(testCase1.getId(), TestUtils.dateToTimestamp("2021-10-11"), ADMIN_AUTH_HEADERS);
    testCase1ResultList.remove(0);
    testCaseResults = getTestCaseResults(testCase1.getId(), null, ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, testCase1ResultList, 4);
  }

  @Test
  @Order(1)
  void put_testCase_list_200(TestInfo test) throws IOException {
    List<CreateTestCase> expectedTestCaseList = new ArrayList<>();
    List<CreateTestCase> expectedColTestCaseList = new ArrayList<>();

    CreateTestCase create = createRequest(test);
    create
        .withName(test.getDisplayName())
        .withEntityLink(TABLE_LINK)
        .withTestSuite(TEST_SUITE1_REFERENCE)
        .withTestDefinition(TEST_DEFINITION3_REFERENCE)
        .withParameterValues(List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    expectedTestCaseList.add(create);
    CreateTestCase create1 = createRequest(test);
    create1
        .withName(test.getDisplayName() + UUID.randomUUID())
        .withEntityLink(TABLE_LINK)
        .withTestSuite(TEST_SUITE1_REFERENCE)
        .withTestDefinition(TEST_DEFINITION3_REFERENCE)
        .withParameterValues(List.of(new TestCaseParameterValue().withValue("20").withName("missingCountValue")));
    createAndCheckEntity(create1, ADMIN_AUTH_HEADERS);
    expectedTestCaseList.add(create1);
    ResultList<TestCase> testCaseList = getTestCases(10, "*", null, false, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedTestCaseList, 2);
    testCaseList = getTestCases(10, "*", TABLE_LINK, false, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedTestCaseList, 2);

    CreateTestCase create3 = createRequest(test);
    create3
        .withName(test.getDisplayName() + UUID.randomUUID())
        .withEntityLink(TABLE_COLUMN_LINK)
        .withTestSuite(TEST_SUITE1_REFERENCE)
        .withTestDefinition(TEST_DEFINITION3_REFERENCE)
        .withParameterValues(List.of(new TestCaseParameterValue().withValue("20").withName("missingCountValue")));
    createAndCheckEntity(create3, ADMIN_AUTH_HEADERS);
    expectedColTestCaseList.add(create3);

    testCaseList = getTestCases(10, "*", TABLE_LINK, false, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedTestCaseList, 2);

    testCaseList = getTestCases(10, "*", TABLE_COLUMN_LINK, false, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedColTestCaseList, 1);

    for (int i = 1; i < 10; i++) {
      CreateTestCase create4 = createRequest(test);
      create4
          .withName(test.getDisplayName() + UUID.randomUUID())
          .withEntityLink(TABLE_COLUMN_LINK)
          .withTestSuite(TEST_SUITE1_REFERENCE)
          .withTestDefinition(TEST_DEFINITION3_REFERENCE)
          .withParameterValues(List.of(new TestCaseParameterValue().withValue("20").withName("missingCountValue")));
      createAndCheckEntity(create4, ADMIN_AUTH_HEADERS);
      expectedColTestCaseList.add(create4);
    }
    testCaseList = getTestCases(10, "*", TABLE_COLUMN_LINK, false, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedColTestCaseList, 10);

    testCaseList = getTestCases(12, "*", TABLE_LINK, true, ADMIN_AUTH_HEADERS);
    expectedTestCaseList.addAll(expectedColTestCaseList);
    verifyTestCases(testCaseList, expectedTestCaseList, 12);
  }

  public static TestCase putTestCaseResult(UUID testCaseId, TestCaseResult data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("testCase/" + testCaseId + "/testCaseResult");
    return TestUtils.put(target, data, TestCase.class, OK, authHeaders);
  }

  public static TestCase deleteTestCaseResult(UUID testCaseId, Long timestamp, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("testCase/" + testCaseId + "/testCaseResult/" + timestamp);
    return TestUtils.delete(target, TestCase.class, authHeaders);
  }

  public static ResultList<TestCaseResult> getTestCaseResults(
      UUID testCaseId, Integer limit, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("testCase/" + testCaseId + "/testCaseResult");
    target = limit != null ? target.queryParam("limit", limit) : target;
    return TestUtils.get(target, TestCaseResource.TestCaseResultList.class, authHeaders);
  }

  public static ResultList<TestCase> getTestCases(
      Integer limit, String fields, String link, Boolean includeAll, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("testCase");
    target = limit != null ? target.queryParam("limit", limit) : target;
    target = target.queryParam("fields", fields);
    if (link != null) {
      target = target.queryParam("entityLink", link);
    }
    if (includeAll) {
      target = target.queryParam("includeAllTests", true);
    }
    return TestUtils.get(target, TestCaseResource.TestCaseList.class, authHeaders);
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
      ResultList<TestCase> actualTestCases, List<CreateTestCase> expectedTestCases, int expectedCount)
      throws HttpResponseException {
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
        .withTestSuite(TEST_SUITE1_REFERENCE)
        .withTestDefinition(TEST_DEFINITION1_REFERENCE);
  }

  @Override
  public void validateCreatedEntity(TestCase createdEntity, CreateTestCase request, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(createdEntity, request, authHeaders);
    assertEquals(request.getEntityLink(), createdEntity.getEntityLink());
    assertEquals(request.getTestSuite(), createdEntity.getTestSuite());
    assertEquals(request.getTestDefinition(), createdEntity.getTestDefinition());
    assertEquals(request.getTestSuite(), createdEntity.getTestSuite());
    assertEquals(request.getParameterValues(), createdEntity.getParameterValues());
  }

  @Override
  public void compareEntities(TestCase expected, TestCase updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(expected, updated, authHeaders);
    assertEquals(expected.getEntityLink(), updated.getEntityLink());
    assertEquals(expected.getTestSuite(), updated.getTestSuite());
    assertEquals(expected.getTestDefinition(), updated.getTestDefinition());
    assertEquals(expected.getTestSuite(), updated.getTestSuite());
    assertEquals(expected.getParameterValues(), updated.getParameterValues());
  }

  @Override
  public TestCase validateGetWithDifferentFields(TestCase entity, boolean byName) throws HttpResponseException {
    // TODO fix this
    return null;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    // TODO fix this
  }
}
