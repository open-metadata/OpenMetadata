package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class IncidentPaginationIT {

  private static final int TEST_DATA_SIZE = 11;
  private static final int PAGE_SIZE = 5;
  private OpenMetadataClient client;
  private List<TestCase> testCases;
  private String databaseSchemaFqn;

  @BeforeAll
  public void setup() throws Exception {
    client = SdkClients.adminClient();
    testCases = new ArrayList<>();

    long ts = System.currentTimeMillis();
    Database database =
        client
            .databases()
            .create(
                new CreateDatabase()
                    .withName("pagination_test_db_" + ts)
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    databaseSchemaFqn =
        client
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName("pagination_test_schema_" + ts)
                    .withDatabase(database.getFullyQualifiedName()))
            .getFullyQualifiedName();

    Table table = createTestTable();
    String testDefFqn =
        client
            .testDefinitions()
            .list(new ListParams().withLimit(1))
            .getData()
            .get(0)
            .getFullyQualifiedName();

    for (int i = 0; i < TEST_DATA_SIZE; i++) {
      TestCase testCase = createTestCase(table, i, testDefFqn);
      testCases.add(testCase);
      createIncidentStatus(testCase);
    }

    await()
        .atMost(Duration.ofMinutes(3))
        .pollInterval(Duration.ofSeconds(5))
        .until(
            () -> {
              try {
                ListParams params =
                    new ListParams().withLimit(TEST_DATA_SIZE + 10).withLatest(true);
                ListResponse<TestCaseResolutionStatus> response =
                    client.testCaseResolutionStatuses().searchList(params);
                return response.getPaging().getTotal() >= TEST_DATA_SIZE;
              } catch (Exception e) {
                return false;
              }
            });
  }

  @Test
  public void testPaginationFirstPage() throws Exception {
    ListParams params = new ListParams().withLimit(PAGE_SIZE).withOffset(0).withLatest(true);

    ListResponse<TestCaseResolutionStatus> response =
        client.testCaseResolutionStatuses().searchList(params);

    assertNotNull(response);
    assertEquals(
        PAGE_SIZE, response.getData().size(), "First page should return " + PAGE_SIZE + " results");
    assertTrue(
        response.getPaging().getTotal() >= TEST_DATA_SIZE,
        "Total should be at least " + TEST_DATA_SIZE);
  }

  @Test
  public void testPaginationSecondPage() throws Exception {
    ListParams firstPageParams =
        new ListParams().withLimit(PAGE_SIZE).withOffset(0).withLatest(true);
    ListResponse<TestCaseResolutionStatus> firstPage =
        client.testCaseResolutionStatuses().searchList(firstPageParams);

    ListParams secondPageParams =
        new ListParams().withLimit(PAGE_SIZE).withOffset(PAGE_SIZE).withLatest(true);
    ListResponse<TestCaseResolutionStatus> secondPage =
        client.testCaseResolutionStatuses().searchList(secondPageParams);

    assertNotNull(secondPage);
    assertEquals(
        PAGE_SIZE,
        secondPage.getData().size(),
        "Second page should return " + PAGE_SIZE + " results");
    assertEquals(
        firstPage.getPaging().getTotal(),
        secondPage.getPaging().getTotal(),
        "Total count should be consistent across pages");

    if (!firstPage.getData().isEmpty() && !secondPage.getData().isEmpty()) {
      Object firstItem = firstPage.getData().get(0);
      Object secondItem = secondPage.getData().get(0);
      assertTrue(!firstItem.equals(secondItem), "Pages should contain different data");
    }
  }

  @Test
  public void testPaginationLastPage() throws Exception {
    ListParams params = new ListParams().withLimit(PAGE_SIZE).withOffset(0).withLatest(true);
    ListResponse<TestCaseResolutionStatus> firstPage =
        client.testCaseResolutionStatuses().searchList(params);
    int total = firstPage.getPaging().getTotal();
    int lastPageOffset = ((total - 1) / PAGE_SIZE) * PAGE_SIZE;

    ListParams lastPageParams =
        new ListParams().withLimit(PAGE_SIZE).withOffset(lastPageOffset).withLatest(true);
    ListResponse<TestCaseResolutionStatus> lastPage =
        client.testCaseResolutionStatuses().searchList(lastPageParams);

    assertNotNull(lastPage);
    assertTrue(
        lastPage.getData().size() > 0 && lastPage.getData().size() <= PAGE_SIZE,
        "Last page should have between 1 and " + PAGE_SIZE + " results");
  }

  @Test
  public void testBackwardsCompatibilityNoParams() throws Exception {
    ListParams params = new ListParams().withLatest(true);

    ListResponse<TestCaseResolutionStatus> response =
        client.testCaseResolutionStatuses().searchList(params);

    assertNotNull(response);
    assertTrue(
        response.getPaging().getTotal() >= TEST_DATA_SIZE,
        "Total should be at least " + TEST_DATA_SIZE + " even without explicit pagination params");
  }

  @Test
  public void testOffsetBeyondResults() throws Exception {
    ListParams params = new ListParams().withLimit(PAGE_SIZE).withOffset(10000).withLatest(true);

    ListResponse<TestCaseResolutionStatus> response =
        client.testCaseResolutionStatuses().searchList(params);

    assertNotNull(response);
    assertEquals(0, response.getData().size(), "Offset beyond results should return empty list");
    assertTrue(response.getPaging().getTotal() > 0, "Total should still be accurate");
  }

  @Test
  public void testFilteredTotalCountIsExact() throws Exception {
    String targetFqn = testCases.get(0).getFullyQualifiedName();
    ListParams params =
        new ListParams()
            .withLimit(PAGE_SIZE)
            .withOffset(0)
            .withLatest(true)
            .addFilter("testCaseFQN", targetFqn);

    ListResponse<TestCaseResolutionStatus> response =
        client.testCaseResolutionStatuses().searchList(params);

    assertNotNull(response);
    assertEquals(1, response.getData().size(), "Filter should return exactly 1 incident");
    assertEquals(
        1,
        response.getPaging().getTotal(),
        "Total count must reflect only the filtered group, not all groups");
  }

  private Table createTestTable() throws Exception {
    CreateTable createTable =
        new CreateTable()
            .withName("pagination_test_table_" + System.currentTimeMillis())
            .withDatabaseSchema(databaseSchemaFqn)
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));

    return client.tables().create(createTable);
  }

  private TestCase createTestCase(Table table, int index, String testDefFqn) throws Exception {
    CreateTestCase createTestCase =
        new CreateTestCase()
            .withName("pagination_test_case_" + index)
            .withEntityLink("<#E::table::" + table.getFullyQualifiedName() + "::columns::id>")
            .withTestDefinition(testDefFqn);

    return client.testCases().create(createTestCase);
  }

  private void createIncidentStatus(TestCase testCase) throws Exception {
    CreateTestCaseResolutionStatus createStatus =
        new CreateTestCaseResolutionStatus()
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.New)
            .withTestCaseReference(testCase.getFullyQualifiedName())
            .withSeverity(Severity.Severity2);

    client.testCaseResolutionStatuses().create(createStatus);
  }
}
