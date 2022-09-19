package org.openmetadata.service.resources.dqtests;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.security.SecurityUtil.getPrincipalName;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_USER_NAME;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

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
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
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
            .withOwner(USER1_REF)
            .withColumns(
                List.of(
                    new Column()
                        .withName("c1")
                        .withDisplayName("c1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10)))
            .withOwner(USER1_REF);
    TEST_TABLE1 = tableResourceTest.createAndCheckEntity(tableReq, ADMIN_AUTH_HEADERS);
    tableReq =
        tableResourceTest
            .createRequest(test)
            .withName("testCaseTable" + UUID.randomUUID())
            .withDatabaseSchema(DATABASE_SCHEMA_REFERENCE)
            .withColumns(
                List.of(
                    new Column()
                        .withName("c1")
                        .withDisplayName("c1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10)))
            .withOwner(USER1_REF);
    TEST_TABLE2 = tableResourceTest.createAndCheckEntity(tableReq, ADMIN_AUTH_HEADERS);
    TABLE_LINK = String.format("<#E::table::%s>", TEST_TABLE1.getFullyQualifiedName());
    TABLE_LINK_2 = String.format("<#E::table::%s>", TEST_TABLE2.getFullyQualifiedName());
    TABLE_COLUMN_LINK = String.format("<#E::table::%s::columns::c1>", TEST_TABLE1.getFullyQualifiedName());
    TABLE_COLUMN_LINK_2 = String.format("<#E::table::%s::columns::c1>", TEST_TABLE2.getFullyQualifiedName());
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
    ChangeDescription change = getChangeDescription(testCase.getVersion());
    fieldAdded(change, "testDefinition", TEST_DEFINITION2_REFERENCE);
    fieldDeleted(change, "testDefinition", TEST_DEFINITION3_REFERENCE);
    fieldUpdated(change, "parameterValues", testCase.getParameterValues(), new ArrayList<>());

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
    putTestCaseResult(testCase.getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);

    ResultList<TestCaseResult> testCaseResults =
        getTestCaseResults(testCase.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, List.of(testCaseResult), 1);

    // Add new date for TableCaseResult
    TestCaseResult newTestCaseResult =
        new TestCaseResult()
            .withResult("tested")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-10"));
    putTestCaseResult(testCase.getFullyQualifiedName(), newTestCaseResult, ADMIN_AUTH_HEADERS);

    testCaseResults = getTestCaseResults(testCase.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, List.of(newTestCaseResult, testCaseResult), 2);

    // Replace table profile for a date
    TestCaseResult newTestCaseResult1 =
        new TestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-10"));
    putTestCaseResult(testCase.getFullyQualifiedName(), newTestCaseResult1, ADMIN_AUTH_HEADERS);

    testCase = getEntity(testCase.getId(), "testCaseResult", ADMIN_AUTH_HEADERS);
    // first result should be the latest date
    testCaseResults = getTestCaseResults(testCase.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS);
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
      putTestCaseResult(testCase.getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);
      testCaseResultList.add(testCaseResult);
    }
    testCaseResults =
        getTestCaseResults(testCase.getFullyQualifiedName(), testCaseResultList.size(), ADMIN_AUTH_HEADERS);
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
      putTestCaseResult(testCase1.getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);
      testCase1ResultList.add(testCaseResult);
    }
    testCaseResults = getTestCaseResults(testCase1.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, testCase1ResultList, 5);
    deleteTestCaseResult(
        testCase1.getFullyQualifiedName(), TestUtils.dateToTimestamp("2021-10-11"), ADMIN_AUTH_HEADERS);
    testCase1ResultList.remove(0);
    testCaseResults = getTestCaseResults(testCase1.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS);
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
        .withEntityLink(TABLE_LINK_2)
        .withTestSuite(TEST_SUITE1_REFERENCE)
        .withTestDefinition(TEST_DEFINITION3_REFERENCE)
        .withParameterValues(List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    expectedTestCaseList.add(create);
    CreateTestCase create1 = createRequest(test);
    create1
        .withName(test.getDisplayName() + UUID.randomUUID())
        .withEntityLink(TABLE_LINK_2)
        .withTestSuite(TEST_SUITE1_REFERENCE)
        .withTestDefinition(TEST_DEFINITION3_REFERENCE)
        .withParameterValues(List.of(new TestCaseParameterValue().withValue("20").withName("missingCountValue")));
    createAndCheckEntity(create1, ADMIN_AUTH_HEADERS);
    expectedTestCaseList.add(create1);
    ResultList<TestCase> testCaseList = getTestCases(10, "*", TABLE_LINK_2, false, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedTestCaseList, 2);

    CreateTestCase create3 = createRequest(test);
    create3
        .withName(test.getDisplayName() + UUID.randomUUID())
        .withEntityLink(TABLE_COLUMN_LINK_2)
        .withTestSuite(TEST_SUITE1_REFERENCE)
        .withTestDefinition(TEST_DEFINITION3_REFERENCE)
        .withParameterValues(List.of(new TestCaseParameterValue().withValue("20").withName("missingCountValue")));
    createAndCheckEntity(create3, ADMIN_AUTH_HEADERS);
    expectedColTestCaseList.add(create3);

    testCaseList = getTestCases(10, "*", TABLE_LINK_2, false, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedTestCaseList, 2);

    testCaseList = getTestCases(10, "*", TABLE_COLUMN_LINK_2, false, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedColTestCaseList, 1);

    for (int i = 1; i < 10; i++) {
      CreateTestCase create4 = createRequest(test);
      create4
          .withName(test.getDisplayName() + UUID.randomUUID())
          .withEntityLink(TABLE_COLUMN_LINK_2)
          .withTestSuite(TEST_SUITE1_REFERENCE)
          .withTestDefinition(TEST_DEFINITION3_REFERENCE)
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

  public static void putTestCaseResult(String fqn, TestCaseResult data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = OpenMetadataApplicationTest.getResource("testCase/" + fqn + "/testCaseResult");
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
        permissionNotAllowed(TEST_USER_NAME, List.of(MetadataOperation.EDIT_TESTS)));
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
            createRequest(test).withDescription(newDescription), OK, ownerAuthHeaders, UpdateType.MINOR_UPDATE, change);

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
  @Override
  public void delete_entity_as_non_admin_401(TestInfo test) throws HttpResponseException {
    // Override the default behavior where entities are deleted vs. for test case
    // the operation is the entity to which tests are attached is edited
    CreateTestCase request = createRequest(getEntityName(test), "", "", null);
    TestCase entity = createEntity(request, ADMIN_AUTH_HEADERS);
    assertResponse(
        () -> deleteAndCheckEntity(entity, TEST_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(TEST_USER_NAME, List.of(MetadataOperation.EDIT_TESTS)));
  }

  public static void deleteTestCaseResult(String fqn, Long timestamp, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = OpenMetadataApplicationTest.getResource("testCase/" + fqn + "/testCaseResult/" + timestamp);
    TestUtils.delete(target, authHeaders);
  }

  public static ResultList<TestCaseResult> getTestCaseResults(
      String fqn, Integer limit, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = OpenMetadataApplicationTest.getResource("testCase/" + fqn + "/testCaseResult");
    target = limit != null ? target.queryParam("limit", limit) : target;
    return TestUtils.get(target, TestCaseResource.TestCaseResultList.class, authHeaders);
  }

  public static ResultList<TestCase> getTestCases(
      Integer limit, String fields, String link, Boolean includeAll, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = OpenMetadataApplicationTest.getResource("testCase");
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

  public static ResultList<TestCase> getTestCases(
      Integer limit, String fields, TestSuite testSuite, Boolean includeAll, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = OpenMetadataApplicationTest.getResource("testCase");
    target = limit != null ? target.queryParam("limit", limit) : target;
    target = target.queryParam("fields", fields);
    target = target.queryParam("testSuiteId", testSuite.getId());
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
    validateCommonEntityFields(createdEntity, request, getPrincipalName(authHeaders));
    assertEquals(request.getEntityLink(), createdEntity.getEntityLink());
    assertEquals(request.getTestSuite(), createdEntity.getTestSuite());
    assertEquals(request.getTestDefinition(), createdEntity.getTestDefinition());
    assertEquals(request.getTestSuite(), createdEntity.getTestSuite());
    assertEquals(request.getParameterValues(), createdEntity.getParameterValues());
  }

  @Override
  public void compareEntities(TestCase expected, TestCase updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(expected, updated, getPrincipalName(authHeaders));
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
