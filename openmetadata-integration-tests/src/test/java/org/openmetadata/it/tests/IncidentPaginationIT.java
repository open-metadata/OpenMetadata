package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class IncidentPaginationIT {

  private static final int TEST_DATA_SIZE = 50;
  private OpenMetadataClient client;
  private List<TestCase> testCases;

  @BeforeAll
  public void setup() throws Exception {
    client = SdkClients.adminClient();
    testCases = new ArrayList<>();

    Table table = createTestTable();

    for (int i = 0; i < TEST_DATA_SIZE; i++) {
      TestCase testCase = createTestCase(table, i);
      testCases.add(testCase);

      createIncidentStatus(testCase);
    }

    Thread.sleep(2000);
  }

  @Test
  public void testPaginationFirstPage() throws Exception {
    ListParams params = new ListParams().withLimit(15).withOffset(0).withLatest(true);

    ListResponse<TestCaseResolutionStatus> response =
        client.testCaseResolutionStatuses().list(params);

    assertNotNull(response);
    assertEquals(15, response.getData().size(), "First page should return 15 results");
    assertTrue(
        response.getPaging().getTotal() >= TEST_DATA_SIZE,
        "Total should be at least " + TEST_DATA_SIZE);
  }

  @Test
  public void testPaginationSecondPage() throws Exception {
    ListParams firstPageParams = new ListParams().withLimit(15).withOffset(0).withLatest(true);
    ListResponse<TestCaseResolutionStatus> firstPage =
        client.testCaseResolutionStatuses().list(firstPageParams);

    ListParams secondPageParams = new ListParams().withLimit(15).withOffset(15).withLatest(true);
    ListResponse<TestCaseResolutionStatus> secondPage =
        client.testCaseResolutionStatuses().list(secondPageParams);

    assertNotNull(secondPage);
    assertEquals(15, secondPage.getData().size(), "Second page should return 15 results");
    assertEquals(
        firstPage.getPaging().getTotal(),
        secondPage.getPaging().getTotal(),
        "Total count should be consistent across pages");

    if (!firstPage.getData().isEmpty() && !secondPage.getData().isEmpty()) {
      String firstPageFirstId = firstPage.getData().get(0).getId().toString();
      String secondPageFirstId = secondPage.getData().get(0).getId().toString();
      assertTrue(
          !firstPageFirstId.equals(secondPageFirstId), "Pages should contain different data");
    }
  }

  @Test
  public void testPaginationLastPage() throws Exception {
    ListParams params = new ListParams().withLimit(15).withOffset(0).withLatest(true);
    ListResponse<TestCaseResolutionStatus> firstPage =
        client.testCaseResolutionStatuses().list(params);
    int total = firstPage.getPaging().getTotal();
    int lastPageOffset = (total / 15) * 15;

    ListParams lastPageParams =
        new ListParams().withLimit(15).withOffset(lastPageOffset).withLatest(true);
    ListResponse<TestCaseResolutionStatus> lastPage =
        client.testCaseResolutionStatuses().list(lastPageParams);

    assertNotNull(lastPage);
    assertTrue(
        lastPage.getData().size() > 0 && lastPage.getData().size() <= 15,
        "Last page should have between 1 and 15 results");
  }

  @Test
  public void testBackwardsCompatibilityNoParams() throws Exception {
    ListParams params = new ListParams().withLatest(true);

    ListResponse<TestCaseResolutionStatus> response =
        client.testCaseResolutionStatuses().list(params);

    assertNotNull(response);
    assertTrue(
        response.getData().size() >= TEST_DATA_SIZE,
        "Without pagination params should return all results");
  }

  @Test
  public void testOffsetBeyondResults() throws Exception {
    ListParams params = new ListParams().withLimit(15).withOffset(10000).withLatest(true);

    ListResponse<TestCaseResolutionStatus> response =
        client.testCaseResolutionStatuses().list(params);

    assertNotNull(response);
    assertEquals(0, response.getData().size(), "Offset beyond results should return empty list");
    assertTrue(response.getPaging().getTotal() > 0, "Total should still be accurate");
  }

  private Table createTestTable() throws Exception {
    CreateTable createTable =
        new CreateTable()
            .withName("pagination_test_table_" + System.currentTimeMillis())
            .withDatabaseSchema(SharedEntities.getDatabaseSchemaReferences().get(0).getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("id")
                        .withDataType(ColumnDataType.BIGINT)
                        .withDescription("Test column")));

    return client.tables().create(createTable);
  }

  private TestCase createTestCase(Table table, int index) throws Exception {
    String testDefFqn =
        client.testDefinitions().list(new ListParams().withLimit(1)).getData().get(0).getFullyQualifiedName();

    CreateTestCase createTestCase =
        new CreateTestCase()
            .withName("pagination_test_case_" + index)
            .withEntityLink(
                "<#E::table::"
                    + table.getFullyQualifiedName()
                    + "::columns::id>")
            .withTestDefinition(testDefFqn);

    return client.testCases().create(createTestCase);
  }

  private void createIncidentStatus(TestCase testCase) throws Exception {
    CreateTestCaseResolutionStatus createStatus =
        new CreateTestCaseResolutionStatus()
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.NEW)
            .withTestCaseReference(testCase.getFullyQualifiedName())
            .withSeverity(Severity.SEVERITY_2)
            .withTestCaseResolutionStatusDetails(
                new org.openmetadata.schema.tests.type.TestCaseResolutionStatusDetails()
                    .withTestCaseFailureComment("Test incident for pagination testing"));

    client.testCaseResolutionStatuses().create(createStatus);
  }
}
