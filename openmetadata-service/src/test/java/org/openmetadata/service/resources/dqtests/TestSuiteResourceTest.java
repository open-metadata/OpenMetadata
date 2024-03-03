package org.openmetadata.service.resources.dqtests;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.LONG_ENTITY_NAME;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import es.org.elasticsearch.search.aggregations.AggregationBuilder;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import java.io.IOException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.json.JsonObject;
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
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.util.JsonUtils;
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
    CREATE_TEST_SUITE1 =
        createRequest(DATABASE_SCHEMA.getFullyQualifiedName() + "." + TEST_SUITE_TABLE_NAME1);
    TEST_SUITE1 = createExecutableTestSuite(CREATE_TEST_SUITE1, ADMIN_AUTH_HEADERS);
    CREATE_TEST_SUITE2 =
        createRequest(DATABASE_SCHEMA.getFullyQualifiedName() + "." + TEST_SUITE_TABLE_NAME2);
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
  void put_testCaseResults_200() throws IOException, ParseException {
    TestCaseResourceTest testCaseResourceTest = new TestCaseResourceTest();
    List<EntityReference> testCases1 = new ArrayList<>();
    TestCaseResult testCaseResult =
        new TestCaseResult()
            .withResult("tested")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-09"));

    for (int i = 0; i < 5; i++) {
      CreateTestCase createTestCase =
          testCaseResourceTest
              .createRequest("test_testSuite_" + i)
              .withTestSuite(TEST_SUITE1.getFullyQualifiedName());
      TestCase testCase =
          testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);
      testCases1.add(testCase.getEntityReference());
      testCaseResourceTest.putTestCaseResult(
          testCase.getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);
    }

    for (int i = 5; i < 10; i++) {
      CreateTestCase create =
          testCaseResourceTest
              .createRequest("test_testSuite_2_" + i)
              .withTestSuite(TEST_SUITE2.getFullyQualifiedName());
      TestCase testCase = testCaseResourceTest.createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
      testCaseResourceTest.putTestCaseResult(
          testCase.getFullyQualifiedName(), testCaseResult, ADMIN_AUTH_HEADERS);
    }

    ResultList<TestSuite> actualTestSuites =
        getTestSuites(10, "*", null, null, null, ADMIN_AUTH_HEADERS);
    verifyTestSuites(actualTestSuites, List.of(CREATE_TEST_SUITE1, CREATE_TEST_SUITE2));

    for (TestSuite testSuite : actualTestSuites.getData()) {
      if (testSuite.getName().equals(CREATE_TEST_SUITE1.getName())) {
        verifyTestCases(testSuite.getTests(), testCases1);
      }
    }
    deleteExecutableTestSuite(TEST_SUITE1.getId(), true, false, ADMIN_AUTH_HEADERS);
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
  void list_testSuitesIncludeEmpty_200(TestInfo test) throws IOException, ParseException {
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
      TestSuite testSuite = createExecutableTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);
      for (int j = 0; j < 3; j++) {
        CreateTestCase createTestCase =
            testCaseResourceTest
                .createRequest("test_" + RandomStringUtils.randomAlphabetic(10))
                .withTestSuite(testSuite.getFullyQualifiedName());
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
    createExecutableTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);
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
            .withOwner(USER1_REF);
    Table table = tableResourceTest.createEntity(tableReq, ADMIN_AUTH_HEADERS);
    table = tableResourceTest.getEntity(table.getId(), "*", ADMIN_AUTH_HEADERS);
    CreateTestSuite createExecutableTestSuite = createRequest(table.getFullyQualifiedName());
    TestSuite executableTestSuite =
        createExecutableTestSuite(createExecutableTestSuite, ADMIN_AUTH_HEADERS);
    TestSuite testSuite = getEntity(executableTestSuite.getId(), "*", ADMIN_AUTH_HEADERS);
    assertEquals(testSuite.getOwner().getId(), table.getOwner().getId());
    Table updateTableOwner = table;
    updateTableOwner.setOwner(TEAM11_REF);
    tableResourceTest.patchEntity(
        table.getId(), JsonUtils.pojoToJson(table), updateTableOwner, ADMIN_AUTH_HEADERS);
    table = tableResourceTest.getEntity(table.getId(), "*", ADMIN_AUTH_HEADERS);
    testSuite = getEntity(executableTestSuite.getId(), "*", ADMIN_AUTH_HEADERS);
    assertEquals(table.getOwner().getId(), testSuite.getOwner().getId());
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
    TestSuite executableTestSuite =
        createExecutableTestSuite(createExecutableTestSuite, ADMIN_AUTH_HEADERS);
    List<EntityReference> testCases1 = new ArrayList<>();

    // We'll create tests cases for testSuite1
    for (int i = 0; i < 5; i++) {
      CreateTestCase createTestCase =
          testCaseResourceTest
              .createRequest(String.format("test_testSuite_2_%s_", test.getDisplayName()) + i)
              .withTestSuite(executableTestSuite.getFullyQualifiedName());
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
    executableTestSuite =
        getEntityByName(executableTestSuite.getFullyQualifiedName(), "*", ADMIN_AUTH_HEADERS);
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
        "You are trying to add test cases to an executable test suite.");
  }

  @Test
  void post_createExecTestSuiteNonExistingEntity_400(TestInfo test) {
    CreateTestSuite createTestSuite = createRequest(test);
    assertResponse(
        () -> createExecutableTestSuite(createTestSuite, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        String.format("table instance for %s not found", createTestSuite.getName()));
  }

  @Test
  void get_execTestSuiteFromTable_200(TestInfo test) throws IOException {
    TableResourceTest tableResourceTest = new TableResourceTest();
    TestCaseResourceTest testCaseResourceTest = new TestCaseResourceTest();
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

    // We'll create tests cases for testSuite
    for (int i = 0; i < 5; i++) {
      CreateTestCase createTestCase =
          testCaseResourceTest
              .createRequest(String.format("test_testSuite_2_%s_", test.getDisplayName()) + i)
              .withTestSuite(testSuite.getFullyQualifiedName());
      testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);
    }

    Table actualTable = tableResourceTest.getEntity(table.getId(), "testSuite", ADMIN_AUTH_HEADERS);
    TestSuite tableTestSuite = actualTable.getTestSuite();
    assertEquals(testSuite.getId(), tableTestSuite.getId());
    assertEquals(5, tableTestSuite.getTests().size());

    // Soft delete entity
    deleteExecutableTestSuite(tableTestSuite.getId(), true, false, ADMIN_AUTH_HEADERS);
    actualTable = tableResourceTest.getEntity(actualTable.getId(), "testSuite", ADMIN_AUTH_HEADERS);
    tableTestSuite = actualTable.getTestSuite();
    assertEquals(true, tableTestSuite.getDeleted());

    // Hard delete entity
    deleteExecutableTestSuite(tableTestSuite.getId(), true, true, ADMIN_AUTH_HEADERS);
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

    queryParams.put("testSuiteType", "executable");
    testSuiteResultList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    testSuiteResultList.getData().forEach(ts -> assertEquals(true, ts.getExecutable()));

    queryParams.put("testSuiteType", "logical");
    testSuiteResultList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    testSuiteResultList.getData().forEach(ts -> assertEquals(false, ts.getExecutable()));

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
        "[name must not be null]");

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
  void buildElasticsearchAggregationFromJson(TestInfo test) {
    JsonObject aggregationJson;
    List<AggregationBuilder> actual;
    List<AggregationBuilder> expected = new ArrayList<>();
    String aggregationQuery;

    // Test aggregation with nested aggregation
    aggregationQuery =
        """
            {
              "aggregations": {
                "test_case_results": {
                  "nested": {
                    "path": "testCaseResultSummary"
                  },
                  "aggs": {
                    "status_counts": {
                      "terms": {
                        "field": "testCaseResultSummary.status"
                      }
                    }
                  }
                }
              }
            }
            """;

    expected.add(
        AggregationBuilders.nested("testCaseResultSummary", "testCaseResultSummary")
            .subAggregation(
                AggregationBuilders.terms("status_counts").field("testCaseResultSummary.status")));

    aggregationJson = JsonUtils.readJson(aggregationQuery).asJsonObject();
    actual = ElasticSearchClient.buildAggregation(aggregationJson.getJsonObject("aggregations"));
    assertThat(actual).hasSameElementsAs(expected);

    // Test aggregation with multiple aggregations
    aggregationQuery =
        """
            {
              "aggregations": {
                "my-first-agg-name": {
                  "terms": {
                    "field": "my-field"
                  }
                },
                "my-second-agg-name": {
                  "terms": {
                    "field": "my-other-field"
                  }
                }
              }
            }
            """;
    aggregationJson = JsonUtils.readJson(aggregationQuery).asJsonObject();

    expected.clear();
    expected.addAll(
        List.of(
            AggregationBuilders.terms("my-second-agg-name").field("my-other-field"),
            AggregationBuilders.terms("my-first-agg-name").field("my-field")));

    actual = ElasticSearchClient.buildAggregation(aggregationJson.getJsonObject("aggregations"));
    assertThat(actual).hasSameElementsAs(expected);

    // Test aggregation with multiple aggregations including a nested one which has itself multiple
    // aggregations
    aggregationQuery =
        """
            {
              "aggregations": {
                "my-first-agg-name": {
                  "terms": {
                    "field": "my-field"
                  }
                },
                "test_case_results": {
                  "nested": {
                    "path": "testCaseResultSummary"
                  },
                  "aggs": {
                    "status_counts": {
                      "terms": {
                        "field": "testCaseResultSummary.status"
                      }
                    },
                    "other_status_counts": {
                      "terms": {
                        "field": "testCaseResultSummary.status"
                      }
                    }
                  }
                }
              }
            }
            """;
    aggregationJson = JsonUtils.readJson(aggregationQuery).asJsonObject();

    expected.clear();
    expected.addAll(
        List.of(
            AggregationBuilders.nested("testCaseResultSummary", "testCaseResultSummary")
                .subAggregation(
                    AggregationBuilders.terms("status_counts")
                        .field("testCaseResultSummary.status"))
                .subAggregation(
                    AggregationBuilders.terms("other_status_counts")
                        .field("testCaseResultSummary.status")),
            AggregationBuilders.terms("my-first-agg-name").field("my-field")));

    actual = ElasticSearchClient.buildAggregation(aggregationJson.getJsonObject("aggregations"));
    assertThat(actual).hasSameElementsAs(expected);
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
        createExecutableTestSuite(createExecutableTestSuite, ADMIN_AUTH_HEADERS);
    List<EntityReference> testCases = new ArrayList<>();

    // We'll create tests cases for testSuite1
    for (int i = 0; i < 5; i++) {
      CreateTestCase createTestCase =
          testCaseResourceTest
              .createRequest(String.format("test_testSuite_2_%s_", test.getDisplayName()) + i)
              .withTestSuite(executableTestSuite.getFullyQualifiedName());
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

  public TestSuite createExecutableTestSuite(
      CreateTestSuite createTestSuite, Map<String, String> authHeaders) throws IOException {
    WebTarget target = getResource("dataQuality/testSuites/executable");
    createTestSuite.setExecutableEntityReference(createTestSuite.getName());
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

  public void deleteExecutableTestSuite(
      UUID id, boolean recursive, boolean hardDelete, Map<String, String> authHeaders)
      throws IOException {
    WebTarget target =
        getResource(String.format("dataQuality/testSuites/executable/%s", id.toString()));
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
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
