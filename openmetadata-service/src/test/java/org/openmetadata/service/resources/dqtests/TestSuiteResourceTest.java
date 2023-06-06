package org.openmetadata.service.resources.dqtests;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.LONG_ENTITY_NAME;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.tests.CreateLogicalTestCases;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

public class TestSuiteResourceTest extends EntityResourceTest<TestSuite, CreateTestSuite> {

  public static final String TEST_SUITE_TABLE_NAME1 = "tableForExecutableTestSuite";
  public static final String TEST_SUITE_TABLE_NAME2 = "tableForExecutableTestSuiteTwo";

  public TestSuiteResourceTest() {
    super(
        Entity.TEST_SUITE,
        TestSuite.class,
        TestSuiteResource.TestSuiteList.class,
        "dataQuality/testSuites",
        TestSuiteResource.FIELDS);
  }

  public void setupTestSuites(TestInfo test) throws IOException {
    LONG_ENTITY_NAME = "a".repeat(256 + 1);
    // Create our table entity that will be used for the executable test suites
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable tableReq =
        tableResourceTest
            .createRequest(test)
            .withName(TEST_SUITE_TABLE_NAME1)
            .withOwner(USER1_REF)
            .withColumns(
                List.of(
                    new Column()
                        .withName(C1)
                        .withDisplayName("c1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10)))
            .withOwner(USER1_REF);
    TEST_SUITE_TABLE1 = tableResourceTest.createAndCheckEntity(tableReq, ADMIN_AUTH_HEADERS);
    tableReq =
        tableResourceTest
            .createRequest(test)
            .withName(TEST_SUITE_TABLE_NAME2)
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
    TEST_SUITE_TABLE2 = tableResourceTest.createAndCheckEntity(tableReq, ADMIN_AUTH_HEADERS);
    CREATE_TEST_SUITE1 = createRequest(DATABASE_SCHEMA.getFullyQualifiedName() + "." + TEST_SUITE_TABLE_NAME1);
    TEST_SUITE1 = createExecutableTestSuite(CREATE_TEST_SUITE1, ADMIN_AUTH_HEADERS);
    CREATE_TEST_SUITE2 = createRequest(DATABASE_SCHEMA.getFullyQualifiedName() + "." + TEST_SUITE_TABLE_NAME2);
    TEST_SUITE2 = createExecutableTestSuite(CREATE_TEST_SUITE2, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_testDefinitionWithoutRequiredFields_4xx(TestInfo test) {
    // name is required field
    assertResponse(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[name must not be null]");
  }

  @Test
  void put_testCaseResults_200() throws IOException {
    TestCaseResourceTest testCaseResourceTest = new TestCaseResourceTest();
    List<EntityReference> testCases1 = new ArrayList<>();
    List<EntityReference> testCases2 = new ArrayList<>();

    for (int i = 0; i < 5; i++) {
      CreateTestCase createTestCase =
          testCaseResourceTest.createRequest("test_testSuite_" + i).withTestSuite(TEST_SUITE1.getFullyQualifiedName());
      TestCase testCase = testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);
      testCases1.add(testCase.getEntityReference());
    }

    for (int i = 5; i < 10; i++) {
      CreateTestCase create =
          testCaseResourceTest
              .createRequest("test_testSuite_2_" + i)
              .withTestSuite(TEST_SUITE2.getFullyQualifiedName());
      TestCase testCase = testCaseResourceTest.createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
      testCases2.add(testCase.getEntityReference());
    }

    ResultList<TestSuite> actualTestSuites = getTestSuites(10, "*", ADMIN_AUTH_HEADERS);
    verifyTestSuites(actualTestSuites, List.of(CREATE_TEST_SUITE1, CREATE_TEST_SUITE2));

    for (TestSuite testSuite : actualTestSuites.getData()) {
      if (testSuite.getName().equals(CREATE_TEST_SUITE1.getName())) {
        verifyTestCases(testSuite.getTests(), testCases1);
      }
    }
    deleteEntity(TEST_SUITE1.getId(), true, false, ADMIN_AUTH_HEADERS);
    assertResponse(
        () -> getEntity(TEST_SUITE1.getId(), ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        "testSuite instance for " + TEST_SUITE1.getId() + " not found");
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("include", Include.ALL.value());
    TestSuite deletedTestSuite = getEntity(TEST_SUITE1.getId(), queryParams, null, ADMIN_AUTH_HEADERS);
    assertEquals(TEST_SUITE1.getId(), deletedTestSuite.getId());
    assertEquals(deletedTestSuite.getDeleted(), true);
  }

  @Test
  void post_createLogicalTestSuiteAndAddTests_200(TestInfo test) throws IOException {
    TestCaseResourceTest testCaseResourceTest = new TestCaseResourceTest();
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable tableReq =
        tableResourceTest
            .createRequest(test)
            .withColumns(
                List.of(
                    new Column()
                        .withName(C1)
                        .withDisplayName("c1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10)));
    Table table = tableResourceTest.createEntity(tableReq, ADMIN_AUTH_HEADERS);
    CreateTestSuite createExecutableTestSuite = createRequest(table.getFullyQualifiedName());
    TestSuite executableTestSuite = createExecutableTestSuite(createExecutableTestSuite, ADMIN_AUTH_HEADERS);
    List<EntityReference> testCases1 = new ArrayList<>();

    // We'll create tests cases for testSuite1
    for (int i = 0; i < 5; i++) {
      CreateTestCase createTestCase =
          testCaseResourceTest
              .createRequest(String.format("test_testSuite_2_%s_", test.getDisplayName()) + i)
              .withTestSuite(executableTestSuite.getFullyQualifiedName());
      TestCase testCase = testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);
      testCases1.add(testCase.getEntityReference());
    }

    // We'll create a logical test suite and associate the test cases to it
    CreateTestSuite createTestSuite = createRequest(test);
    TestSuite testSuite = createEntity(createTestSuite, ADMIN_AUTH_HEADERS);
    addTestCasesToLogicalTestSuite(
        testSuite, testCases1.stream().map(testCaseId -> testCaseId.getId()).collect(Collectors.toList()));

    TestSuite logicalTestSuite = getEntity(testSuite.getId(), "*", ADMIN_AUTH_HEADERS);
    executableTestSuite = getEntityByName(executableTestSuite.getFullyQualifiedName(), "*", ADMIN_AUTH_HEADERS);
    // Check that the logical test suite has the test cases
    verifyTestCases(executableTestSuite.getTests(), logicalTestSuite.getTests());
  }

  @Test
  void addTestCaseWithLogicalEndPoint(TestInfo test) throws IOException {
    TestCaseResourceTest testCaseResourceTest = new TestCaseResourceTest();
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable tableReq =
        tableResourceTest
            .createRequest(test)
            .withColumns(
                List.of(
                    new Column()
                        .withName(C1)
                        .withDisplayName("c1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10)));
    Table table = tableResourceTest.createEntity(tableReq, ADMIN_AUTH_HEADERS);
    CreateTestSuite createTestSuite = createRequest(table.getFullyQualifiedName());
    TestSuite testSuite = createExecutableTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);
    List<EntityReference> testCases1 = new ArrayList<>();

    // We'll create tests cases for testSuite1
    for (int i = 0; i < 5; i++) {
      CreateTestCase createTestCase =
          testCaseResourceTest
              .createRequest(String.format("test_testSuite_2_%s_", test.getDisplayName()) + i)
              .withTestSuite(testSuite.getFullyQualifiedName());
      TestCase testCase = testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);
      testCases1.add(testCase.getEntityReference());
    }

    TestSuite executableTestSuite = getEntityByName(testSuite.getFullyQualifiedName(), "*", ADMIN_AUTH_HEADERS);
    assertResponse(
        () ->
            addTestCasesToLogicalTestSuite(
                executableTestSuite,
                testCases1.stream().map(testCaseId -> testCaseId.getId()).collect(Collectors.toList())),
        CONFLICT,
        "Entity already exists");
  }

  @Test
  void post_createExecTestSuiteNonExistingEntity_400(TestInfo test) throws IOException {
    CreateTestSuite createTestSuite = createRequest(test);
    assertResponse(
        () -> createExecutableTestSuite(createTestSuite, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        String.format("table instance for %s not found", createTestSuite.getName()));
  }

  @Test
  void get_execTestSuiteFromTable_200(TestInfo test) throws IOException {
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable tableReq =
        tableResourceTest
            .createRequest(test)
            .withColumns(
                List.of(
                    new Column()
                        .withName(C1)
                        .withDisplayName("c1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10)));
    Table table = tableResourceTest.createEntity(tableReq, ADMIN_AUTH_HEADERS);
    CreateTestSuite createTestSuite = createRequest(table.getFullyQualifiedName());
    TestSuite testSuite = createExecutableTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);

    Table actualTable = tableResourceTest.getEntity(table.getId(), "testSuite", ADMIN_AUTH_HEADERS);
    TestSuite tableTestSuite = actualTable.getTestSuite();
    assertEquals(testSuite.getId(), tableTestSuite.getId());

    // Soft delete entity
    deleteEntity(tableTestSuite.getId(), ADMIN_AUTH_HEADERS);
    actualTable = tableResourceTest.getEntity(actualTable.getId(), "testSuite", ADMIN_AUTH_HEADERS);
    tableTestSuite = actualTable.getTestSuite();
    assertEquals(tableTestSuite.getDeleted(), true);

    // Hard delete entity
    deleteEntity(tableTestSuite.getId(), true, true, ADMIN_AUTH_HEADERS);
    actualTable = tableResourceTest.getEntity(table.getId(), "testSuite", ADMIN_AUTH_HEADERS);
    assertNull(actualTable.getTestSuite());
  }

  @Test
  void get_execTestSuiteDeletedOnTableDeletion(TestInfo test) throws IOException {
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable tableReq =
        tableResourceTest
            .createRequest(test)
            .withColumns(
                List.of(
                    new Column()
                        .withName(C1)
                        .withDisplayName("c1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10)));
    Table table = tableResourceTest.createEntity(tableReq, ADMIN_AUTH_HEADERS);
    CreateTestSuite createTestSuite = createRequest(table.getFullyQualifiedName());
    TestSuite testSuite = createExecutableTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);

    Table actualTable = tableResourceTest.getEntity(table.getId(), "testSuite", ADMIN_AUTH_HEADERS);
    TestSuite actualTestSuite = actualTable.getTestSuite();
    assertEquals(actualTestSuite.getId(), testSuite.getId());

    tableResourceTest.deleteEntity(actualTable.getId(), true, false, ADMIN_AUTH_HEADERS);
    HashMap<String, String> queryParams = new HashMap<>();
    queryParams.put("include", Include.ALL.value());
    actualTestSuite = getEntityByName(testSuite.getFullyQualifiedName(), queryParams, "*", ADMIN_AUTH_HEADERS);
    assertEquals(actualTestSuite.getDeleted(), true);

    // Hard delete entity
    tableResourceTest.deleteEntity(table.getId(), true, true, ADMIN_AUTH_HEADERS);
    assertResponse(
        () -> getEntityByName(testSuite.getFullyQualifiedName(), queryParams, "*", ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        String.format("testSuite instance for %s not found", testSuite.getFullyQualifiedName()));
  }

  public ResultList<TestSuite> getTestSuites(Integer limit, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("dataQuality/testSuites");
    target = limit != null ? target.queryParam("limit", limit) : target;
    target = target.queryParam("fields", fields);
    return TestUtils.get(target, TestSuiteResource.TestSuiteList.class, authHeaders);
  }

  @Test
  @Override
  protected void post_entityCreateWithInvalidName_400() {
    // Create an entity with mandatory name field null
    final CreateTestSuite createTestSuite = createRequest(null, "description", "displayName", null);
    assertResponseContains(
        () -> createEntity(createTestSuite, ADMIN_AUTH_HEADERS), BAD_REQUEST, "[name must not be null]");

    // Create an entity with mandatory name field empty
    final CreateTestSuite createTestSuite1 = createRequest("", "description", "displayName", null);
    assertResponseContains(
        () -> createEntity(createTestSuite1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        TestUtils.getEntityNameLengthError(entityClass));

    // Create an entity with mandatory name field too long
    final CreateTestSuite createTestSuite12 = createRequest(LONG_ENTITY_NAME, "description", "displayName", null);
    assertResponse(
        () -> createEntity(createTestSuite12, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        TestUtils.getEntityNameLengthError(entityClass));
  }

  public TestSuite createExecutableTestSuite(CreateTestSuite createTestSuite, Map<String, String> authHeaders)
      throws IOException {
    WebTarget target = getResource("dataQuality/testSuites/executable");
    return TestUtils.post(target, createTestSuite, TestSuite.class, authHeaders);
  }

  public void addTestCasesToLogicalTestSuite(TestSuite testSuite, List<UUID> testCaseIds) throws IOException {
    WebTarget target = getResource("dataQuality/testCases/logicalTestCases");
    CreateLogicalTestCases createLogicalTestCases =
        new CreateLogicalTestCases().withTestSuiteId(testSuite.getId()).withTestCaseIds(testCaseIds);
    TestUtils.put(target, createLogicalTestCases, Response.Status.OK, ADMIN_AUTH_HEADERS);
  }

  private void verifyTestSuites(ResultList<TestSuite> actualTestSuites, List<CreateTestSuite> expectedTestSuites) {
    Map<String, TestSuite> testSuiteMap = new HashMap<>();
    for (TestSuite result : actualTestSuites.getData()) {
      testSuiteMap.put(result.getName(), result);
    }
    for (CreateTestSuite result : expectedTestSuites) {
      TestSuite storedTestSuite = testSuiteMap.get(result.getName());
      if (storedTestSuite == null) continue;
      validateCreatedEntity(storedTestSuite, result, ADMIN_AUTH_HEADERS);
    }
  }

  private void verifyTestCases(List<EntityReference> actualTestCases, List<EntityReference> expectedTestCases) {
    assertEquals(expectedTestCases.size(), actualTestCases.size());
    Map<UUID, EntityReference> testCaseMap = new HashMap<>();
    for (EntityReference result : actualTestCases) {
      testCaseMap.put(result.getId(), result);
    }
    for (EntityReference result : expectedTestCases) {
      EntityReference storedTestCase = testCaseMap.get(result.getId());
      assertEquals(result.getId(), storedTestCase.getId());
      assertEquals(result.getName(), storedTestCase.getName());
      assertEquals(result.getDescription(), storedTestCase.getDescription());
    }
  }

  @Override
  public CreateTestSuite createRequest(String name) {
    return new CreateTestSuite().withName(name).withDescription(name);
  }

  @Override
  public void validateCreatedEntity(TestSuite createdEntity, CreateTestSuite request, Map<String, String> authHeaders) {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getDescription(), createdEntity.getDescription());
  }

  @Override
  public void compareEntities(TestSuite expected, TestSuite updated, Map<String, String> authHeaders) {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getDescription(), updated.getDescription());
  }

  @Override
  public TestSuite validateGetWithDifferentFields(TestSuite entity, boolean byName) throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwner(), entity.getTests());
    fields = "owner,tests";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(entity.getOwner(), entity.getTests());
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
