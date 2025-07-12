package org.openmetadata.service.resources.dqtests;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.GROUP;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.LONG_ENTITY_NAME;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import es.org.elasticsearch.client.Request;
import es.org.elasticsearch.client.RestClient;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.http.client.HttpResponseException;
import org.apache.http.util.EntityUtils;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.tests.CreateLogicalTestCases;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResourceTest;
import org.openmetadata.service.resources.teams.TeamResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;
import org.testcontainers.shaded.org.apache.commons.lang3.RandomStringUtils;

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
    supportsSearchIndex = true;
  }

  public void setupTestSuites(TestInfo test) throws IOException {
    LONG_ENTITY_NAME = "a".repeat(256 + 1);
    // Create our table entity that will be used for the executable test suites
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable tableReq =
        tableResourceTest
            .createRequest(test)
            .withName(TEST_SUITE_TABLE_NAME1)
            .withOwners(List.of(USER1_REF))
            .withColumns(
                List.of(
                    new Column()
                        .withName(C1)
                        .withDisplayName("c1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10)))
            .withOwners(List.of(USER1_REF));
    TEST_SUITE_TABLE1 = tableResourceTest.createAndCheckEntity(tableReq, ADMIN_AUTH_HEADERS);
    tableReq =
        tableResourceTest
            .createRequest(test)
            .withName(TEST_SUITE_TABLE_NAME2)
            .withDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName())
            .withOwners(List.of(USER1_REF))
            .withColumns(
                List.of(
                    new Column()
                        .withName(C1)
                        .withDisplayName("c1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10)))
            .withOwners(List.of(USER1_REF));
    TEST_SUITE_TABLE2 = tableResourceTest.createAndCheckEntity(tableReq, ADMIN_AUTH_HEADERS);
    CREATE_TEST_SUITE1 =
        createRequest(DATABASE_SCHEMA.getFullyQualifiedName() + "." + TEST_SUITE_TABLE_NAME1);
    TEST_SUITE1 = createBasicTestSuite(CREATE_TEST_SUITE1, ADMIN_AUTH_HEADERS);
    CREATE_TEST_SUITE2 =
        createRequest(DATABASE_SCHEMA.getFullyQualifiedName() + "." + TEST_SUITE_TABLE_NAME2);
    TEST_SUITE2 = createBasicTestSuite(CREATE_TEST_SUITE2, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_testDefinitionWithoutRequiredFields_4xx(TestInfo test) {
    // name is required field
    assertResponse(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param name must not be null]");
  }

  @Test
  void put_testCaseResults_200() throws IOException, ParseException {
    TestCaseResourceTest testCaseResourceTest = new TestCaseResourceTest();
    List<EntityReference> testCases1 = new ArrayList<>();
    CreateTestCaseResult createTestCaseResult =
        new CreateTestCaseResult()
            .withResult("tested")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-09"));

    for (int i = 0; i < 5; i++) {
      CreateTestCase createTestCase = testCaseResourceTest.createRequest("test_testSuite_" + i);
      TestCase testCase =
          testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);
      testCases1.add(testCase.getEntityReference());
      testCaseResourceTest.postTestCaseResult(
          testCase.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS);
    }

    for (int i = 5; i < 10; i++) {
      CreateTestCase create = testCaseResourceTest.createRequest("test_testSuite_2_" + i);
      TestCase testCase = testCaseResourceTest.createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
      testCaseResourceTest.postTestCaseResult(
          testCase.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS);
    }

    ResultList<TestSuite> actualTestSuites =
        getTestSuites(10, "*", null, null, null, ADMIN_AUTH_HEADERS);
    verifyTestSuites(actualTestSuites, List.of(CREATE_TEST_SUITE1, CREATE_TEST_SUITE2));

    for (TestSuite testSuite : actualTestSuites.getData()) {
      if (testSuite.getName().equals(CREATE_TEST_SUITE1.getName())) {
        verifyTestCases(testSuite.getTests(), testCases1);
      }
    }
    deleteBasicTestSuite(TEST_SUITE1.getId(), true, false, ADMIN_AUTH_HEADERS);
    assertResponse(
        () -> getEntity(TEST_SUITE1.getId(), ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        "testSuite instance for " + TEST_SUITE1.getId() + " not found");
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("include", Include.ALL.value());
    TestSuite deletedTestSuite =
        getEntity(TEST_SUITE1.getId(), queryParams, null, ADMIN_AUTH_HEADERS);
    assertEquals(TEST_SUITE1.getId(), deletedTestSuite.getId());
    assertEquals(true, deletedTestSuite.getDeleted());
  }

  @Test
  void create_basicTestSuiteWithoutRef(TestInfo test) {
    CreateTestSuite createTestSuite = createRequest(test);
    assertResponse(
        () -> createBasicEmptySuite(createTestSuite, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Cannot create a basic test suite without the BasicEntityReference field informed.");
  }

  @Test
  void list_testSuitesIncludeEmpty_200(TestInfo test) throws IOException {
    List<CreateTestSuite> testSuites = new ArrayList<>();
    TestCaseResourceTest testCaseResourceTest = new TestCaseResourceTest();
    TableResourceTest tableResourceTest = new TableResourceTest();
    for (int i = 0; i < 19; i++) {
      CreateTable tableReq =
          tableResourceTest
              .createRequest(test.getDisplayName() + RandomStringUtils.randomAlphanumeric(10))
              .withColumns(
                  List.of(
                      new Column()
                          .withName(C1)
                          .withDisplayName("c1")
                          .withDataType(ColumnDataType.VARCHAR)
                          .withDataLength(10)));
      Table table = tableResourceTest.createEntity(tableReq, ADMIN_AUTH_HEADERS);
      CreateTestSuite createTestSuite = createRequest(table.getFullyQualifiedName());
      TestSuite testSuite = createBasicTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);
      for (int j = 0; j < 3; j++) {
        CreateTestCase createTestCase =
            testCaseResourceTest.createRequest("test_" + RandomStringUtils.randomAlphabetic(10));
        testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);
      }
      testSuites.add(createTestSuite);
    }

    // create Empty test suite
    CreateTable tableReq =
        tableResourceTest
            .createRequest(test.getDisplayName() + RandomStringUtils.randomAlphanumeric(10))
            .withColumns(
                List.of(
                    new Column()
                        .withName(C1)
                        .withDisplayName("c1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10)));
    Table table = tableResourceTest.createEntity(tableReq, ADMIN_AUTH_HEADERS);
    CreateTestSuite createTestSuite = createRequest(table.getFullyQualifiedName());
    createBasicTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);
    testSuites.add(createTestSuite);

    ResultList<TestSuite> actualTestSuites =
        getTestSuites(20, "*", null, null, null, ADMIN_AUTH_HEADERS);
    verifyTestSuites(actualTestSuites, testSuites);
    // returns only 19 results
    ResultList<TestSuite> nonEmptyTestSuites =
        getTestSuites(20, "*", "false", null, null, ADMIN_AUTH_HEADERS);
    verifyTestSuites(nonEmptyTestSuites, testSuites.subList(0, 18));

    // delete test cases for a test suite to make it empty
    TestSuite deleteTestCases = nonEmptyTestSuites.getData().get(19);
    for (EntityReference ref : deleteTestCases.getTests()) {
      testCaseResourceTest.deleteEntity(ref.getId(), true, true, ADMIN_AUTH_HEADERS);
    }
    TestSuite checkTestSuite = getEntity(deleteTestCases.getId(), "*", ADMIN_AUTH_HEADERS);
    assertEquals(checkTestSuite.getTests().size(), 0);
    nonEmptyTestSuites = getTestSuites(20, "*", "false", null, null, ADMIN_AUTH_HEADERS);
    verifyTestSuites(nonEmptyTestSuites, testSuites.subList(0, 17));

    // test pagination
    nonEmptyTestSuites = getTestSuites(10, "*", "false", null, null, ADMIN_AUTH_HEADERS);
    verifyTestSuites(nonEmptyTestSuites, testSuites.subList(0, 9));
    nonEmptyTestSuites =
        getTestSuites(
            10, "*", "false", null, nonEmptyTestSuites.getPaging().getAfter(), ADMIN_AUTH_HEADERS);
    verifyTestSuites(nonEmptyTestSuites, testSuites.subList(10, 17));
    nonEmptyTestSuites =
        getTestSuites(
            10, "*", "false", nonEmptyTestSuites.getPaging().getBefore(), null, ADMIN_AUTH_HEADERS);
    verifyTestSuites(nonEmptyTestSuites, testSuites.subList(0, 9));
  }

  @Test
  void test_inheritOwnerFromTable(TestInfo test) throws IOException {
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
                        .withDataLength(10)))
            .withOwners(List.of(USER1_REF));
    Table table = tableResourceTest.createEntity(tableReq, ADMIN_AUTH_HEADERS);
    table = tableResourceTest.getEntity(table.getId(), "*", ADMIN_AUTH_HEADERS);
    CreateTestSuite createExecutableTestSuite = createRequest(table.getFullyQualifiedName());
    TestSuite executableTestSuite =
        createBasicTestSuite(createExecutableTestSuite, ADMIN_AUTH_HEADERS);
    TestSuite testSuite = getEntity(executableTestSuite.getId(), "*", ADMIN_AUTH_HEADERS);
    assertReferenceList(testSuite.getOwners(), table.getOwners());
    Table updateTableOwner = table;
    updateTableOwner.setOwners(List.of(TEAM11_REF));
    tableResourceTest.patchEntity(
        table.getId(), JsonUtils.pojoToJson(table), updateTableOwner, ADMIN_AUTH_HEADERS);
    table = tableResourceTest.getEntity(table.getId(), "*", ADMIN_AUTH_HEADERS);
    testSuite = getEntity(executableTestSuite.getId(), "*", ADMIN_AUTH_HEADERS);
    assertReferenceList(table.getOwners(), testSuite.getOwners());
  }

  @Test
  void test_inheritDomainFromTable(TestInfo test) throws IOException {
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
                        .withDataLength(10)))
            .withDomains(List.of(DOMAIN1.getFullyQualifiedName()));
    Table table = tableResourceTest.createEntity(tableReq, ADMIN_AUTH_HEADERS);
    table = tableResourceTest.getEntity(table.getId(), "*", ADMIN_AUTH_HEADERS);
    CreateTestSuite createExecutableTestSuite = createRequest(table.getFullyQualifiedName());
    TestSuite executableTestSuite =
        createBasicTestSuite(createExecutableTestSuite, ADMIN_AUTH_HEADERS);
    TestSuite testSuite = getEntity(executableTestSuite.getId(), "domains", ADMIN_AUTH_HEADERS);
    assertEquals(DOMAIN1.getId(), testSuite.getDomains().get(0).getId());
    ResultList<TestSuite> testSuites =
        listEntitiesFromSearch(
            Map.of("domain", DOMAIN1.getFullyQualifiedName(), "fields", "domains"),
            100,
            0,
            ADMIN_AUTH_HEADERS);
    assertTrue(
        testSuites.getData().stream()
            .allMatch(ts -> ts.getDomains().get(0).getId().equals(DOMAIN1.getId())));
  }

  @Test
  void post_createLogicalTestSuiteAndAddTests_200(TestInfo test) throws IOException {

    UserResourceTest userResourceTest = new UserResourceTest();
    CreateUser createUser1 =
        userResourceTest.createRequest(test).withRoles(List.of(DATA_CONSUMER_ROLE.getId()));
    User user1 = userResourceTest.createEntity(createUser1, ADMIN_AUTH_HEADERS);
    EntityReference user1Ref = user1.getEntityReference();
    TeamResourceTest teamResourceTest = new TeamResourceTest();
    CreateTeam createTeam = teamResourceTest.createRequest(test, 1).withTeamType(GROUP);
    Team team = teamResourceTest.createEntity(createTeam, ADMIN_AUTH_HEADERS);
    EntityReference teamRef = team.getEntityReference();

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
    createExecutableTestSuite.withOwners(List.of(user1Ref));
    TestSuite executableTestSuite =
        createBasicTestSuite(createExecutableTestSuite, ADMIN_AUTH_HEADERS);
    List<EntityReference> testCases1 = new ArrayList<>();

    // We'll create tests cases for testSuite1
    for (int i = 0; i < 5; i++) {
      CreateTestCase createTestCase =
          testCaseResourceTest.createRequest(
              String.format("test_testSuite_2_%s_", test.getDisplayName()) + i,
              new MessageParser.EntityLink(Entity.TABLE, table.getFullyQualifiedName()));
      TestCase testCase =
          testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);
      testCases1.add(testCase.getEntityReference());
    }

    // We'll create a logical test suite and associate the test cases to it
    CreateTestSuite createTestSuite = createRequest(test);
    createTestSuite.withOwners(List.of(teamRef));
    TestSuite testSuite = createEntity(createTestSuite, ADMIN_AUTH_HEADERS);
    addTestCasesToLogicalTestSuite(
        testSuite, testCases1.stream().map(EntityReference::getId).collect(Collectors.toList()));

    TestSuite logicalTestSuite = getEntity(testSuite.getId(), "*", ADMIN_AUTH_HEADERS);
    executableTestSuite =
        getEntityByName(executableTestSuite.getFullyQualifiedName(), "*", ADMIN_AUTH_HEADERS);
    // Check that the logical test suite has the test cases
    verifyTestCases(executableTestSuite.getTests(), logicalTestSuite.getTests());

    /* We'll then list the test suite from search
    List from search test path:
      1. List all test suites w/o filters
      2. List only executable test suites
      3. List only logical test suites
      4. List non-empty test suites
      5. List test suites with a query
      6. List test suites with a nested sort
      7. List test suites with fqn
      8. List test suites with owner
     */
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("fields", "tests");
    // 1. List all test suites w/o filters
    ResultList<TestSuite> allEntities =
        listEntitiesFromSearch(queryParams, 100, 0, ADMIN_AUTH_HEADERS);
    Assertions.assertTrue(
        allEntities.getData().stream().anyMatch(ts -> ts.getId().equals(logicalTestSuite.getId())));
    TestSuite finalExecutableTestSuite = executableTestSuite;
    Assertions.assertTrue(
        allEntities.getData().stream()
            .anyMatch(ts -> ts.getId().equals(finalExecutableTestSuite.getId())));
    // 2. List only executable test suites
    queryParams.put("testSuiteType", "basic");
    queryParams.put("fields", "tests");
    ResultList<TestSuite> executableTestSuites =
        listEntitiesFromSearch(queryParams, 100, 0, ADMIN_AUTH_HEADERS);
    Assertions.assertTrue(
        executableTestSuites.getData().stream()
            .anyMatch(ts -> ts.getId().equals(finalExecutableTestSuite.getId())));
    // 3. List only logical test suites
    queryParams.put("testSuiteType", "logical");
    queryParams.put("fields", "tests");
    ResultList<TestSuite> logicalTestSuites =
        listEntitiesFromSearch(queryParams, 100, 0, ADMIN_AUTH_HEADERS);
    Assertions.assertTrue(
        logicalTestSuites.getData().stream()
            .anyMatch(ts -> ts.getId().equals(logicalTestSuite.getId())));
    // 4. List non-empty test suites
    queryParams.clear();
    queryParams.put("includeEmptyTestSuites", "false");
    queryParams.put("fields", "tests");
    ResultList<TestSuite> nonEmptyTestSuites =
        listEntitiesFromSearch(queryParams, 100, 0, ADMIN_AUTH_HEADERS);
    Assertions.assertTrue(
        nonEmptyTestSuites.getData().stream().anyMatch(ts -> !ts.getTests().isEmpty()));
    // 5. List test suite with a query
    queryParams.clear();
    queryParams.put(
        "queryString",
        "%7B%22query%22%3A%20%7B%22term%22%3A%20%7B%22id%22%3A%20%22"
            + logicalTestSuite.getId()
            + "%22%7D%7D%7D");
    ResultList<TestSuite> queryTestSuites =
        listEntitiesFromSearch(queryParams, 100, 0, ADMIN_AUTH_HEADERS);
    Assertions.assertTrue(
        queryTestSuites.getData().stream()
            .allMatch(
                ts -> ts.getFullyQualifiedName().equals(logicalTestSuite.getFullyQualifiedName())));

    queryParams.clear();
    queryParams.put("q", logicalTestSuite.getFullyQualifiedName());
    queryTestSuites = listEntitiesFromSearch(queryParams, 100, 0, ADMIN_AUTH_HEADERS);
    Assertions.assertTrue(
        queryTestSuites.getData().stream()
            .allMatch(
                ts -> ts.getFullyQualifiedName().equals(logicalTestSuite.getFullyQualifiedName())));

    // 6. List test suites with a nested sort
    queryParams.clear();
    queryParams.put("fields", "tests");
    queryParams.put("sortField", "testCaseResultSummary.timestamp");
    queryParams.put("sortOrder", "asc");
    queryParams.put("sortNestedPath", "testCaseResultSummary");
    queryParams.put("sortNestedMode", "max");
    ResultList<TestSuite> sortedTestSuites =
        listEntitiesFromSearch(queryParams, 100, 0, ADMIN_AUTH_HEADERS);
    assertNotNull(sortedTestSuites.getData());

    // 7. List test suites with fqn
    queryParams.clear();
    queryParams.put("fullyQualifiedName", logicalTestSuite.getFullyQualifiedName());
    ResultList<TestSuite> fqnTestSuites =
        listEntitiesFromSearch(queryParams, 100, 0, ADMIN_AUTH_HEADERS);
    Assertions.assertTrue(
        fqnTestSuites.getData().stream()
            .allMatch(ts -> ts.getId().equals(logicalTestSuite.getId())));

    // 8. List test suites with owner
    // 8.1 Team owner
    queryParams.clear();
    queryParams.put("owner", teamRef.getFullyQualifiedName());
    queryParams.put("fields", "owners");
    ResultList<TestSuite> teamOwnerTestSuites =
        listEntitiesFromSearch(queryParams, 100, 0, ADMIN_AUTH_HEADERS);
    Assertions.assertTrue(
        teamOwnerTestSuites.getData().stream()
            .allMatch(ts -> ts.getOwners().get(0).getId().equals(teamRef.getId())));

    // 8.2 User owner
    queryParams.clear();
    queryParams.put("owner", user1Ref.getFullyQualifiedName());
    queryParams.put("fields", "owners");
    ResultList<TestSuite> userOwnerTestSuites =
        listEntitiesFromSearch(queryParams, 100, 0, ADMIN_AUTH_HEADERS);
    Assertions.assertTrue(
        userOwnerTestSuites.getData().stream()
            .allMatch(ts -> ts.getOwners().get(0).getId().equals(user1Ref.getId())));
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
    TestSuite testSuite = createBasicTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);
    List<EntityReference> testCases1 = new ArrayList<>();

    // We'll create tests cases for testSuite1
    for (int i = 0; i < 5; i++) {
      CreateTestCase createTestCase =
          testCaseResourceTest.createRequest(
              String.format("test_testSuite_2_%s_", test.getDisplayName()) + i);
      TestCase testCase =
          testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);
      testCases1.add(testCase.getEntityReference());
    }

    TestSuite executableTestSuite =
        getEntityByName(testSuite.getFullyQualifiedName(), "*", ADMIN_AUTH_HEADERS);
    assertResponse(
        () ->
            addTestCasesToLogicalTestSuite(
                executableTestSuite,
                testCases1.stream().map(EntityReference::getId).collect(Collectors.toList())),
        BAD_REQUEST,
        "You are trying to add test cases to a basic test suite.");
  }

  @Test
  void post_createExecTestSuiteNonExistingEntity_400(TestInfo test) {
    CreateTestSuite createTestSuite = createRequest(test);
    assertResponse(
        () -> createBasicTestSuite(createTestSuite, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        String.format("table instance for %s not found", createTestSuite.getName()));
  }

  @Test
  void get_execTestSuiteFromTable_200(TestInfo test) throws IOException {
    TableResourceTest tableResourceTest = new TableResourceTest();
    TestCaseResourceTest testCaseResourceTest = new TestCaseResourceTest();
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
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
    TestSuite testSuite = createBasicTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);

    // We'll create tests cases for testSuite
    for (int i = 0; i < 5; i++) {
      CreateTestCase createTestCase =
          testCaseResourceTest.createRequest(
              String.format("test_testSuite_2_%s_", test.getDisplayName()) + i,
              new MessageParser.EntityLink(Entity.TABLE, table.getFullyQualifiedName()));
      testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);
    }

    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("include", Include.ALL.value());

    Table actualTable = tableResourceTest.getEntity(table.getId(), "testSuite", ADMIN_AUTH_HEADERS);
    EntityReference tableTestSuiteRef = actualTable.getTestSuite();
    assertEquals(testSuite.getId(), tableTestSuiteRef.getId());
    TestSuite tableTestSuite =
        testSuiteResourceTest.getEntity(
            tableTestSuiteRef.getId(), queryParams, "tests", ADMIN_AUTH_HEADERS);
    assertEquals(5, tableTestSuite.getTests().size());

    // Soft delete entity
    deleteBasicTestSuite(tableTestSuite.getId(), true, false, ADMIN_AUTH_HEADERS);
    actualTable =
        tableResourceTest.getEntity(
            actualTable.getId(), queryParams, "testSuite", ADMIN_AUTH_HEADERS);
    tableTestSuiteRef = actualTable.getTestSuite();
    tableTestSuite =
        testSuiteResourceTest.getEntity(
            tableTestSuiteRef.getId(), queryParams, "tests", ADMIN_AUTH_HEADERS);
    assertEquals(true, tableTestSuite.getDeleted());

    // Hard delete entity
    deleteBasicTestSuite(tableTestSuite.getId(), true, true, ADMIN_AUTH_HEADERS);
    actualTable = tableResourceTest.getEntity(table.getId(), "testSuite", ADMIN_AUTH_HEADERS);
    assertNull(actualTable.getTestSuite());
  }

  @Test
  void get_execTestSuiteDeletedOnTableDeletion(TestInfo test) throws IOException {
    TableResourceTest tableResourceTest = new TableResourceTest();
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();

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
    TestSuite testSuite = createBasicTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);

    HashMap<String, String> queryParams = new HashMap<>();
    queryParams.put("include", Include.ALL.value());

    Table actualTable = tableResourceTest.getEntity(table.getId(), "testSuite", ADMIN_AUTH_HEADERS);
    EntityReference actualTestSuiteRef = actualTable.getTestSuite();
    TestSuite actualTestSuite =
        testSuiteResourceTest.getEntity(
            actualTestSuiteRef.getId(), queryParams, "tests", ADMIN_AUTH_HEADERS);
    assertEquals(actualTestSuite.getId(), testSuite.getId());

    tableResourceTest.deleteEntity(actualTable.getId(), true, false, ADMIN_AUTH_HEADERS);

    actualTestSuite =
        getEntityByName(testSuite.getFullyQualifiedName(), queryParams, "*", ADMIN_AUTH_HEADERS);
    assertEquals(true, actualTestSuite.getDeleted());

    // Hard delete entity
    tableResourceTest.deleteEntity(table.getId(), true, true, ADMIN_AUTH_HEADERS);
    assertResponse(
        () ->
            getEntityByName(
                testSuite.getFullyQualifiedName(), queryParams, "*", ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        String.format("testSuite instance for %s not found", testSuite.getFullyQualifiedName()));
  }

  @Test
  void get_filterTestSuiteType_200(TestInfo test) throws IOException {
    // Create a logical test suite
    CreateTestSuite createTestSuite = createRequest(test);
    createEntity(createTestSuite, ADMIN_AUTH_HEADERS);

    Map<String, String> queryParams = new HashMap<>();

    ResultList<TestSuite> testSuiteResultList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(10, testSuiteResultList.getData().size());

    queryParams.put("testSuiteType", "basic");
    testSuiteResultList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    testSuiteResultList.getData().forEach(ts -> assertEquals(true, ts.getBasic()));

    queryParams.put("testSuiteType", "logical");
    testSuiteResultList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    testSuiteResultList.getData().forEach(ts -> assertEquals(false, ts.getBasic()));

    queryParams.put("includeEmptyTestSuites", "false");
    testSuiteResultList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(0, testSuiteResultList.getData().size());
  }

  @Test
  @Override
  protected void post_entityCreateWithInvalidName_400() {
    // Create an entity with mandatory name field null
    final CreateTestSuite createTestSuite = createRequest(null, "description", "displayName", null);
    assertResponseContains(
        () -> createEntity(createTestSuite, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param name must not be null]");

    // Create an entity with mandatory name field empty
    final CreateTestSuite createTestSuite1 = createRequest("", "description", "displayName", null);
    assertResponseContains(
        () -> createEntity(createTestSuite1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        TestUtils.getEntityNameLengthError(entityClass));

    // Create an entity with mandatory name field too long
    final CreateTestSuite createTestSuite12 =
        createRequest(LONG_ENTITY_NAME, "description", "displayName", null);
    assertResponse(
        () -> createEntity(createTestSuite12, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        TestUtils.getEntityNameLengthError(entityClass));
  }

  @Test
  void delete_LogicalTestSuite_200(TestInfo test) throws IOException {
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
    TestSuite executableTestSuite =
        createBasicTestSuite(createExecutableTestSuite, ADMIN_AUTH_HEADERS);
    List<EntityReference> testCases = new ArrayList<>();

    // We'll create tests cases for testSuite1
    for (int i = 0; i < 5; i++) {
      CreateTestCase createTestCase =
          testCaseResourceTest.createRequest(
              String.format("test_testSuite_2_%s_", test.getDisplayName()) + i,
              new MessageParser.EntityLink(Entity.TABLE, table.getFullyQualifiedName()));
      TestCase testCase =
          testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);
      testCases.add(testCase.getEntityReference());
    }

    // We'll create a logical test suite and associate the test cases to it
    CreateTestSuite createTestSuite = createRequest(test);
    TestSuite testSuite = createEntity(createTestSuite, ADMIN_AUTH_HEADERS);
    addTestCasesToLogicalTestSuite(
        testSuite, testCases.stream().map(EntityReference::getId).collect(Collectors.toList()));

    // We'll delete the logical test suite
    deleteEntity(testSuite.getId(), true, true, ADMIN_AUTH_HEADERS);

    // We'll check that the test cases are still present in the executable test suite
    TestSuite actualExecutableTestSuite =
        getEntity(executableTestSuite.getId(), "*", ADMIN_AUTH_HEADERS);
    assertEquals(5, actualExecutableTestSuite.getTests().size());
  }

  @Test
  void delete_logicalSuiteWithPipeline(TestInfo test) throws IOException {
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
    TestSuite executableTestSuite =
        createBasicTestSuite(createExecutableTestSuite, ADMIN_AUTH_HEADERS);
    List<EntityReference> testCases1 = new ArrayList<>();

    // We'll create tests cases for testSuite1
    for (int i = 0; i < 5; i++) {
      CreateTestCase createTestCase =
          testCaseResourceTest.createRequest(
              String.format("test_testSuite_2_%s_", test.getDisplayName()) + i);
      TestCase testCase =
          testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);
      testCases1.add(testCase.getEntityReference());
    }

    // We'll create a logical test suite and associate the test cases to it
    CreateTestSuite createTestSuite = createRequest(test);
    TestSuite testSuite = createEntity(createTestSuite, ADMIN_AUTH_HEADERS);
    addTestCasesToLogicalTestSuite(
        testSuite, testCases1.stream().map(EntityReference::getId).collect(Collectors.toList()));
    TestSuite logicalTestSuite = getEntity(testSuite.getId(), "*", ADMIN_AUTH_HEADERS);

    // Add ingestion pipeline to the database service
    IngestionPipelineResourceTest ingestionPipelineResourceTest =
        new IngestionPipelineResourceTest();
    CreateIngestionPipeline createIngestionPipeline =
        ingestionPipelineResourceTest
            .createRequest(test)
            .withService(logicalTestSuite.getEntityReference());

    TestSuitePipeline testSuitePipeline = new TestSuitePipeline();

    SourceConfig sourceConfig = new SourceConfig().withConfig(testSuitePipeline);
    createIngestionPipeline.withSourceConfig(sourceConfig);
    IngestionPipeline ingestionPipeline =
        ingestionPipelineResourceTest.createEntity(createIngestionPipeline, ADMIN_AUTH_HEADERS);

    // We can GET the Ingestion Pipeline now
    IngestionPipeline actualIngestionPipeline =
        ingestionPipelineResourceTest.getEntity(ingestionPipeline.getId(), ADMIN_AUTH_HEADERS);
    assertNotNull(actualIngestionPipeline);

    // After deleting the test suite, we can't GET the Ingestion Pipeline
    deleteEntity(logicalTestSuite.getId(), true, true, ADMIN_AUTH_HEADERS);

    assertResponse(
        () ->
            ingestionPipelineResourceTest.getEntity(ingestionPipeline.getId(), ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        String.format(
            "ingestionPipeline instance for %s not found", actualIngestionPipeline.getId()));

    // Test Cases are still there
    TestCase testCaseInLogical =
        testCaseResourceTest.getEntity(testCases1.get(0).getId(), "*", ADMIN_AUTH_HEADERS);
    assertNotNull(testCaseInLogical);
  }

  @Test
  void get_listTestSuiteFromSearchWithPagination(TestInfo testInfo) throws IOException {
    if (supportsSearchIndex) {
      Random rand = new Random();
      int tablesNum = rand.nextInt(3) + 3;

      TableResourceTest tableResourceTest = new TableResourceTest();
      TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();

      List<Table> tables = new ArrayList<>();
      Map<String, TestSuite> testSuites = new HashMap<>();

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
                .withOwners(List.of(USER1_REF));
        Table table = tableResourceTest.createEntity(tableReq, ADMIN_AUTH_HEADERS);
        tables.add(table);
        CreateTestSuite createTestSuite =
            testSuiteResourceTest.createRequest(table.getFullyQualifiedName());
        TestSuite testSuite =
            testSuiteResourceTest.createBasicTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);
        testSuites.put(table.getFullyQualifiedName(), testSuite);
      }
      validateEntityListFromSearchWithPagination(new HashMap<>(), testSuites.size());
    }
  }

  @Test
  void create_executableTestSuiteAndCheckSearchClient(TestInfo test) throws IOException {
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
    TestSuite testSuite = createBasicTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);
    RestClient searchClient = getSearchClient();
    IndexMapping index = Entity.getSearchRepository().getIndexMapping(Entity.TABLE);
    es.org.elasticsearch.client.Response response;
    Request request =
        new Request(
            "GET",
            String.format(
                "%s/_search", index.getIndexName(Entity.getSearchRepository().getClusterAlias())));
    String query =
        String.format(
            "{\"size\": 10,\"query\":{\"bool\":{\"must\":[{\"term\":{\"_id\":\"%s\"}}]}}}",
            table.getId().toString());
    request.setJsonEntity(query);
    try {
      response = searchClient.performRequest(request);
    } finally {
      searchClient.close();
    }
    String jsonString = EntityUtils.toString(response.getEntity());
    HashMap<String, Object> map =
        (HashMap<String, Object>) JsonUtils.readOrConvertValue(jsonString, HashMap.class);
    LinkedHashMap<String, Object> hits = (LinkedHashMap<String, Object>) map.get("hits");
    ArrayList<LinkedHashMap<String, Object>> hitsList =
        (ArrayList<LinkedHashMap<String, Object>>) hits.get("hits");
    assertNotEquals(0, hitsList.size());
    assertTrue(
        hitsList.stream()
            .allMatch(
                hit ->
                    ((LinkedHashMap<String, Object>) hit.get("_source"))
                        .get("id")
                        .equals(table.getId().toString())));
  }

  public ResultList<TestSuite> getTestSuites(
      Integer limit,
      String fields,
      String includeEmptyTestSuites,
      String before,
      String after,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("dataQuality/testSuites");
    target = limit != null ? target.queryParam("limit", limit) : target;
    target =
        includeEmptyTestSuites != null
            ? target.queryParam("includeEmptyTests", includeEmptyTestSuites)
            : target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    target = target.queryParam("fields", fields);
    return TestUtils.get(target, TestSuiteResource.TestSuiteList.class, authHeaders);
  }

  public TestSuite createBasicTestSuite(
      CreateTestSuite createTestSuite, Map<String, String> authHeaders) throws IOException {
    WebTarget target = getResource("dataQuality/testSuites/basic");
    createTestSuite.setBasicEntityReference(createTestSuite.getName());
    return TestUtils.post(target, createTestSuite, TestSuite.class, authHeaders);
  }

  public TestSuite createBasicEmptySuite(
      CreateTestSuite createTestSuite, Map<String, String> authHeaders) throws IOException {
    WebTarget target = getResource("dataQuality/testSuites/basic");
    return TestUtils.post(target, createTestSuite, TestSuite.class, authHeaders);
  }

  public void addTestCasesToLogicalTestSuite(TestSuite testSuite, List<UUID> testCaseIds)
      throws IOException {
    WebTarget target = getResource("dataQuality/testCases/logicalTestCases");
    CreateLogicalTestCases createLogicalTestCases =
        new CreateLogicalTestCases()
            .withTestSuiteId(testSuite.getId())
            .withTestCaseIds(testCaseIds);
    TestUtils.put(target, createLogicalTestCases, Response.Status.OK, ADMIN_AUTH_HEADERS);
  }

  public void deleteBasicTestSuite(
      UUID id, boolean recursive, boolean hardDelete, Map<String, String> authHeaders)
      throws IOException {
    WebTarget target = getResource(String.format("dataQuality/testSuites/basic/%s", id.toString()));
    target = recursive ? target.queryParam("recursive", true) : target;
    target = hardDelete ? target.queryParam("hardDelete", true) : target;
    TestUtils.delete(target, TestSuite.class, authHeaders);
  }

  public TestSummary getTestSummary(Map<String, String> authHeaders, String testSuiteId)
      throws IOException {
    WebTarget target = getCollection().path("/executionSummary");
    if (testSuiteId != null) {
      target = target.queryParam("testSuiteId", testSuiteId);
    }
    return TestUtils.get(target, TestSummary.class, authHeaders);
  }

  private void verifyTestSuites(
      ResultList<TestSuite> actualTestSuites, List<CreateTestSuite> expectedTestSuites) {
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

  private void verifyTestCases(
      List<EntityReference> actualTestCases, List<EntityReference> expectedTestCases) {
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
  public void validateCreatedEntity(
      TestSuite createdEntity, CreateTestSuite request, Map<String, String> authHeaders) {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getDescription(), createdEntity.getDescription());
  }

  @Override
  public void compareEntities(
      TestSuite expected, TestSuite updated, Map<String, String> authHeaders) {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getDescription(), updated.getDescription());
  }

  @Override
  public TestSuite validateGetWithDifferentFields(TestSuite entity, boolean byName)
      throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwners(), entity.getTests());
    fields = "owners,tests,tags";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(entity.getOwners(), entity.getTests());
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
