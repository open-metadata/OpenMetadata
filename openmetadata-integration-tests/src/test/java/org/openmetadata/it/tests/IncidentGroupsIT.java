package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.dropwizard.db.DataSourceFactory;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.api.tests.CreateTestDefinition;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.tests.type.Assigned;
import org.openmetadata.schema.tests.type.IncidentGroupBy;
import org.openmetadata.schema.tests.type.IncidentTrendDirection;
import org.openmetadata.schema.tests.type.Resolved;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseFailureReasonType;
import org.openmetadata.schema.tests.type.TestCaseIncidentGroup;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Integration tests for GET /v1/dataQuality/testCases/testCaseIncidentStatus/incidentGroups.
 *
 * <p>Fixture layout (all names are timestamp-unique so concurrent suites cannot interfere):
 *
 * <ul>
 *   <li>testCase1 — tableA, tableDefinition, owner userA, in domain; open incident (New)
 *   <li>testCase2 — tableA (column-level), columnDefinition, owners userA + userB; open incident
 *       with a New → Assigned(userA) chain
 *   <li>testCase3 — tableB, tableDefinition, owner userB; open incident (New)
 *   <li>testCase4 — tableB, tableDefinition, no owner; resolved incident (New → Resolved)
 *   <li>5 pager tables — each with one test case (pagerDefinition) whose incident is New →
 *       Assigned(pagerUser); {@code assignee=pagerUser} scopes the groups listing to exactly these
 *       5 single-incident groups, giving the pagination tests a deterministic population
 * </ul>
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class IncidentGroupsIT {

  private static final String GROUP_BY_TABLE = "table";
  private static final String GROUP_BY_TEST_DEFINITION = "testDefinition";
  private static final String GROUP_BY_OWNER = "owner";
  private static final String MAX_LIMIT = "1000";

  private OpenMetadataClient client;
  private Table tableA;
  private Table tableB;
  private User userA;
  private User userB;
  private TestDefinition tableDefinition;
  private TestDefinition columnDefinition;
  private Domain domain;
  private TestCase testCase1;
  private TestCase testCase2;
  private TestCase testCase3;
  private TestCase testCase4;
  private User pagerUser;
  private List<String> pagerTableFqns;
  private String schemaFqn;

  @BeforeAll
  void setup() throws Exception {
    client = SdkClients.adminClient();
    long ts = System.currentTimeMillis();
    schemaFqn = createSchema(ts);
    tableA = createTable(schemaFqn, "incident_groups_table_a_" + ts);
    tableB = createTable(schemaFqn, "incident_groups_table_b_" + ts);
    userA = createUser("incident_groups_user_a_" + ts);
    userB = createUser("incident_groups_user_b_" + ts);
    tableDefinition =
        createTestDefinition("incident_groups_table_def_" + ts, TestDefinitionEntityType.TABLE);
    columnDefinition =
        createTestDefinition("incident_groups_column_def_" + ts, TestDefinitionEntityType.COLUMN);
    domain = createDomain("incident_groups_domain_" + ts);

    testCase1 =
        createTestCase(
            "incident_groups_case_1",
            tableLink(tableA),
            tableDefinition,
            List.of(userA.getEntityReference()));
    testCase2 =
        createTestCase(
            "incident_groups_case_2",
            columnLink(tableA),
            columnDefinition,
            List.of(userA.getEntityReference(), userB.getEntityReference()));
    testCase3 =
        createTestCase(
            "incident_groups_case_3",
            tableLink(tableB),
            tableDefinition,
            List.of(userB.getEntityReference()));
    testCase4 =
        createTestCase("incident_groups_case_4", tableLink(tableB), tableDefinition, List.of());
    assignDomain(testCase1, domain);

    createStatus(testCase1, TestCaseResolutionStatusTypes.New, null);
    createStatus(testCase2, TestCaseResolutionStatusTypes.New, null);
    createStatus(
        testCase2,
        TestCaseResolutionStatusTypes.Assigned,
        new Assigned().withAssignee(userA.getEntityReference()));
    createStatus(testCase3, TestCaseResolutionStatusTypes.New, null, Severity.Severity2);
    createStatus(testCase4, TestCaseResolutionStatusTypes.New, null);
    createStatus(
        testCase4,
        TestCaseResolutionStatusTypes.Resolved,
        new Resolved()
            .withTestCaseFailureReason(TestCaseFailureReasonType.FalsePositive)
            .withTestCaseFailureComment("resolved by incident groups IT"));

    createPagerFixture(ts, schemaFqn);
  }

  private void createPagerFixture(long ts, String schemaFqn) throws Exception {
    pagerUser = createUser("incident_groups_pager_" + ts);
    TestDefinition pagerDefinition =
        createTestDefinition("incident_groups_pager_def_" + ts, TestDefinitionEntityType.TABLE);
    pagerTableFqns = new ArrayList<>();
    for (int i = 0; i < 5; i++) {
      Table pagerTable = createTable(schemaFqn, "incident_groups_page_" + i + "_" + ts);
      TestCase pagerCase =
          createTestCase(
              "incident_groups_page_case_" + i, tableLink(pagerTable), pagerDefinition, List.of());
      createStatus(pagerCase, TestCaseResolutionStatusTypes.New, null);
      createStatus(
          pagerCase,
          TestCaseResolutionStatusTypes.Assigned,
          new Assigned().withAssignee(pagerUser.getEntityReference()));
      pagerTableFqns.add(pagerTable.getFullyQualifiedName());
    }
    pagerTableFqns = pagerTableFqns.stream().sorted().toList();
  }

  @Test
  void testGroupByTableCountsAndResolvedExclusion() throws Exception {
    List<TestCaseIncidentGroup> groups = fetchGroups(groupParams(GROUP_BY_TABLE));

    TestCaseIncidentGroup groupA = findGroup(groups, tableA.getFullyQualifiedName());
    assertEquals(2, groupA.getIncidentCount(), "table and column level incidents on table A");
    assertEquals(IncidentGroupBy.Table, groupA.getGroupBy());
    assertEquals(tableA.getId(), groupA.getId());
    assertEquals(tableA.getName(), groupA.getName());

    TestCaseIncidentGroup groupB = findGroup(groups, tableB.getFullyQualifiedName());
    assertEquals(1, groupB.getIncidentCount(), "resolved incident on table B must be excluded");
  }

  @Test
  void testGroupByTestDefinitionCounts() throws Exception {
    List<TestCaseIncidentGroup> groups = fetchGroups(groupParams(GROUP_BY_TEST_DEFINITION));

    TestCaseIncidentGroup tableDefGroup =
        findGroup(groups, tableDefinition.getFullyQualifiedName());
    assertEquals(
        2,
        tableDefGroup.getIncidentCount(),
        "open incidents on case 1 and 3; resolved case 4 excluded");
    assertEquals(IncidentGroupBy.TestDefinition, tableDefGroup.getGroupBy());
    assertEquals(tableDefinition.getId(), tableDefGroup.getId());

    TestCaseIncidentGroup columnDefGroup =
        findGroup(groups, columnDefinition.getFullyQualifiedName());
    assertEquals(1, columnDefGroup.getIncidentCount());
  }

  @Test
  void testGroupByOwnerDoesNotDoubleCount() throws Exception {
    List<TestCaseIncidentGroup> groups = fetchGroups(groupParams(GROUP_BY_OWNER));

    TestCaseIncidentGroup groupUserA = findGroup(groups, userA.getFullyQualifiedName());
    assertEquals(
        2,
        groupUserA.getIncidentCount(),
        "case 2's two status records and two owners must count as a single incident");
    assertEquals(IncidentGroupBy.Owner, groupUserA.getGroupBy());
    assertEquals(userA.getId(), groupUserA.getId());

    TestCaseIncidentGroup groupUserB = findGroup(groups, userB.getFullyQualifiedName());
    assertEquals(2, groupUserB.getIncidentCount(), "case 2 (co-owned) and case 3 incidents");
  }

  @Test
  void testStatusFilterNarrows() throws Exception {
    Map<String, String> assignedParams = groupParams(GROUP_BY_TABLE);
    assignedParams.put("status", TestCaseResolutionStatusTypes.Assigned.value());
    List<TestCaseIncidentGroup> assignedGroups = fetchGroups(assignedParams);
    assertEquals(1, findGroup(assignedGroups, tableA.getFullyQualifiedName()).getIncidentCount());
    assertGroupAbsent(assignedGroups, tableB.getFullyQualifiedName());

    Map<String, String> newParams = groupParams(GROUP_BY_TABLE);
    newParams.put(
        "status",
        TestCaseResolutionStatusTypes.New.value()
            + ","
            + TestCaseResolutionStatusTypes.Ack.value());
    List<TestCaseIncidentGroup> newGroups = fetchGroups(newParams);
    assertEquals(1, findGroup(newGroups, tableA.getFullyQualifiedName()).getIncidentCount());
    assertEquals(1, findGroup(newGroups, tableB.getFullyQualifiedName()).getIncidentCount());
  }

  @Test
  void testAssigneeFilterMatchesCurrentAssignee() throws Exception {
    Map<String, String> params = groupParams(GROUP_BY_TABLE);
    params.put("assignee", userA.getName());
    List<TestCaseIncidentGroup> groups = fetchGroups(params);

    assertEquals(1, findGroup(groups, tableA.getFullyQualifiedName()).getIncidentCount());
    assertGroupAbsent(groups, tableB.getFullyQualifiedName());
  }

  @Test
  void testTestCaseFqnFilterScopesToOneTestCase() throws Exception {
    Map<String, String> params = groupParams(GROUP_BY_TABLE);
    params.put("testCaseFQN", testCase3.getFullyQualifiedName());
    ListResponse<TestCaseIncidentGroup> response =
        client.testCaseResolutionStatuses().listIncidentGroups(params);

    assertEquals(1, response.getData().size());
    assertEquals(1, response.getPaging().getTotal());
    List<TestCaseIncidentGroup> groups = convertGroups(response);
    assertEquals(1, findGroup(groups, tableB.getFullyQualifiedName()).getIncidentCount());
  }

  @Test
  void testDateFieldRangeFiltersDistinctIncidents() throws Exception {
    List<TestCaseResolutionStatus> records = fetchStatuses(testCase2);
    long createdAt =
        records.stream().mapToLong(TestCaseResolutionStatus::getTimestamp).min().orElseThrow();
    long updatedAt =
        records.stream().mapToLong(TestCaseResolutionStatus::getTimestamp).max().orElseThrow();
    assertTrue(updatedAt > createdAt, "the Assigned record must be later than the New record");

    assertEquals(
        1,
        fetchGroups(dateRangeParams("createdAt", createdAt, createdAt)).size(),
        "incident opened exactly at createdAt must match a createdAt range");
    assertTrue(
        fetchGroups(dateRangeParams("createdAt", updatedAt, null)).isEmpty(),
        "a createdAt range starting after the incident opened must exclude it");
    assertEquals(
        1,
        fetchGroups(dateRangeParams("updatedAt", updatedAt, updatedAt)).size(),
        "the same range must match when applied to updatedAt");
    assertTrue(
        fetchGroups(dateRangeParams("updatedAt", null, createdAt)).isEmpty(),
        "an updatedAt range ending before the last status change must exclude it");
  }

  @Test
  void testDomainFilter() throws Exception {
    Map<String, String> params = groupParams(GROUP_BY_TABLE);
    params.put("domain", domain.getFullyQualifiedName());
    List<TestCaseIncidentGroup> groups = fetchGroups(params);

    assertEquals(
        1,
        findGroup(groups, tableA.getFullyQualifiedName()).getIncidentCount(),
        "only case 1 is in the domain; case 2's incident must not count");
    assertGroupAbsent(groups, tableB.getFullyQualifiedName());
  }

  @Test
  void testSortTypeOrdersByIncidentCount() throws Exception {
    Map<String, String> ascParams = groupParams(GROUP_BY_TABLE);
    ascParams.put("sortType", "asc");
    assertSorted(fetchGroups(ascParams), true);

    Map<String, String> descParams = groupParams(GROUP_BY_TABLE);
    descParams.put("sortType", "desc");
    assertSorted(fetchGroups(descParams), false);
  }

  @Test
  void testPagination() throws Exception {
    Map<String, String> params = groupParams(GROUP_BY_TABLE);
    params.put("limit", "1");
    ListResponse<TestCaseIncidentGroup> response =
        client.testCaseResolutionStatuses().listIncidentGroups(params);

    assertEquals(1, response.getData().size());
    assertTrue(response.getPaging().getTotal() >= 2, "at least our two table groups exist");
  }

  // Walks the assignee-scoped pager population (5 single-incident groups, tied counts, so the
  // ordering falls to the groupKey tiebreak) with limits that split it into uneven pages.
  @Test
  void testPaginationWalkVisitsEveryGroupOnce() throws Exception {
    assertPaginationWalk(2);
    assertPaginationWalk(3);
  }

  @Test
  void testPaginationOffsetBeyondTotalReturnsEmptyPage() throws Exception {
    ListResponse<TestCaseIncidentGroup> response = fetchPagerPage(2, encodeOffset(100));

    assertTrue(convertGroups(response).isEmpty());
    assertNull(response.getPaging().getAfter(), "no next page past the end of the list");
    assertEquals(pagerTableFqns.size(), response.getPaging().getTotal());
  }

  // The `before`/`after` cursors are opaque Base64-encoded offsets; the walk passes them back
  // verbatim as `offset` (the real client contract) and only decodes them to check arithmetic.
  private void assertPaginationWalk(int limit) throws Exception {
    int total = pagerTableFqns.size();
    List<String> visited = new ArrayList<>();
    Set<String> seen = new HashSet<>();
    String offsetCursor = null;
    String lastPageCursor = null;
    int expectedOffset = 0;
    boolean morePages = true;

    while (morePages) {
      ListResponse<TestCaseIncidentGroup> response = fetchPagerPage(limit, offsetCursor);
      List<TestCaseIncidentGroup> groups = convertGroups(response);
      boolean lastPage = expectedOffset + limit >= total;

      assertEquals(total, response.getPaging().getTotal(), "total must be stable on every page");
      assertEquals(
          lastPage ? total - expectedOffset : limit,
          groups.size(),
          "every page but the last must hold exactly 'limit' groups (limit=" + limit + ")");
      if (expectedOffset == 0) {
        assertNull(response.getPaging().getBefore(), "first page has no previous cursor");
      } else {
        assertEquals(
            Math.max(0, expectedOffset - limit), decodeOffset(response.getPaging().getBefore()));
      }
      if (lastPage) {
        assertNull(response.getPaging().getAfter(), "last page has no next cursor");
      } else {
        assertEquals(expectedOffset + limit, decodeOffset(response.getPaging().getAfter()));
      }
      for (TestCaseIncidentGroup group : groups) {
        assertTrue(
            seen.add(group.getFullyQualifiedName()),
            "group repeated across pages: " + group.getFullyQualifiedName());
        visited.add(group.getFullyQualifiedName());
      }

      lastPageCursor = offsetCursor;
      morePages = response.getPaging().getAfter() != null;
      if (morePages) {
        offsetCursor = response.getPaging().getAfter();
        expectedOffset += limit;
      }
    }

    assertEquals(
        pagerTableFqns,
        visited,
        "forward walk must visit every group exactly once, ordered by groupKey (limit="
            + limit
            + ")");
    assertBackwardWalk(limit, lastPageCursor);
  }

  private void assertBackwardWalk(int limit, String lastPageCursor) throws Exception {
    Set<String> seen = new HashSet<>();
    String cursor = lastPageCursor;
    boolean morePages = true;

    while (morePages) {
      ListResponse<TestCaseIncidentGroup> response = fetchPagerPage(limit, cursor);
      for (TestCaseIncidentGroup group : convertGroups(response)) {
        assertTrue(
            seen.add(group.getFullyQualifiedName()),
            "group repeated across backward pages: " + group.getFullyQualifiedName());
      }
      cursor = response.getPaging().getBefore();
      morePages = cursor != null;
    }

    assertEquals(
        new HashSet<>(pagerTableFqns),
        seen,
        "backward walk must visit the same groups as the forward walk (limit=" + limit + ")");
  }

  private ListResponse<TestCaseIncidentGroup> fetchPagerPage(int limit, String offsetCursor)
      throws Exception {
    Map<String, String> params = new LinkedHashMap<>();
    params.put("groupBy", GROUP_BY_TABLE);
    params.put("assignee", pagerUser.getName());
    params.put("limit", String.valueOf(limit));
    if (offsetCursor != null) {
      params.put("offset", offsetCursor);
    }
    return client.testCaseResolutionStatuses().listIncidentGroups(params);
  }

  private static String encodeOffset(int offset) {
    return Base64.getEncoder()
        .encodeToString(String.valueOf(offset).getBytes(StandardCharsets.UTF_8));
  }

  private static int decodeOffset(String cursor) {
    return Integer.parseInt(new String(Base64.getDecoder().decode(cursor), StandardCharsets.UTF_8));
  }

  @Test
  void testDbListStatusInFilter() throws Exception {
    ListParams params =
        new ListParams()
            .withLimit(10)
            .addFilter("testCaseFQN", testCase2.getFullyQualifiedName())
            .addFilter(
                "testCaseResolutionStatusType",
                TestCaseResolutionStatusTypes.New.value()
                    + ","
                    + TestCaseResolutionStatusTypes.Assigned.value());
    ListResponse<TestCaseResolutionStatus> response =
        client.testCaseResolutionStatuses().list(params);
    assertEquals(
        2, response.getData().size(), "both records of the incident chain match the IN filter");
  }

  // The repository only takes the latest-per-test-case branch when a time range is given.
  @Test
  void testDbListLatestWithStatusFilter() throws Exception {
    String endTs = String.valueOf(System.currentTimeMillis() + 60_000);
    ListParams matching =
        new ListParams()
            .withLimit(10)
            .withLatest(true)
            .addFilter("startTs", "0")
            .addFilter("endTs", endTs)
            .addFilter("testCaseFQN", testCase2.getFullyQualifiedName())
            .addFilter(
                "testCaseResolutionStatusType",
                TestCaseResolutionStatusTypes.New.value()
                    + ","
                    + TestCaseResolutionStatusTypes.Assigned.value());
    ListResponse<TestCaseResolutionStatus> response =
        client.testCaseResolutionStatuses().list(matching);
    assertEquals(
        1,
        response.getData().size(),
        "only the latest record of the test case matches the status IN filter");

    ListParams nonMatching =
        new ListParams()
            .withLimit(10)
            .withLatest(true)
            .addFilter("startTs", "0")
            .addFilter("endTs", endTs)
            .addFilter("testCaseFQN", testCase2.getFullyQualifiedName())
            .addFilter("testCaseResolutionStatusType", TestCaseResolutionStatusTypes.New.value());
    assertTrue(
        client.testCaseResolutionStatuses().list(nonMatching).getData().isEmpty(),
        "the latest record is Assigned, so a New filter must exclude the test case");
  }

  @Test
  void testDbListTestDefinitionFilterScopesToDefinition() throws Exception {
    List<TestCaseResolutionStatus> tableDefStatuses =
        listStatuses(
            new ListParams()
                .withLimit(100)
                .addFilter("testDefinition", tableDefinition.getFullyQualifiedName()));
    assertEquals(
        Set.of(
            testCase1.getFullyQualifiedName(),
            testCase3.getFullyQualifiedName(),
            testCase4.getFullyQualifiedName()),
        statusTestCaseFqns(tableDefStatuses),
        "all records of the table definition's test cases and nothing else");

    List<TestCaseResolutionStatus> columnDefStatuses =
        listStatuses(
            new ListParams()
                .withLimit(100)
                .addFilter("testDefinition", columnDefinition.getFullyQualifiedName()));
    assertEquals(
        Set.of(testCase2.getFullyQualifiedName()),
        statusTestCaseFqns(columnDefStatuses),
        "only case 2 uses the column definition");
  }

  // latest=true + open statuses must return exactly the incident population the
  // groupBy=testDefinition endpoint counts for that definition (case 4's latest is Resolved).
  @Test
  void testDbListLatestWithTestDefinitionFilterMatchesGroupCount() throws Exception {
    String endTs = String.valueOf(System.currentTimeMillis() + 60_000);
    ListParams params =
        new ListParams()
            .withLimit(100)
            .withLatest(true)
            .addFilter("startTs", "0")
            .addFilter("endTs", endTs)
            .addFilter("testDefinition", tableDefinition.getFullyQualifiedName())
            .addFilter(
                "testCaseResolutionStatusType",
                TestCaseResolutionStatusTypes.New.value()
                    + ","
                    + TestCaseResolutionStatusTypes.Ack.value()
                    + ","
                    + TestCaseResolutionStatusTypes.Assigned.value());
    List<TestCaseResolutionStatus> statuses = listStatuses(params);

    Set<String> openIncidentCases = statusTestCaseFqns(statuses);
    assertEquals(
        Set.of(testCase1.getFullyQualifiedName(), testCase3.getFullyQualifiedName()),
        openIncidentCases);

    TestCaseIncidentGroup tableDefGroup =
        findGroup(
            fetchGroups(groupParams(GROUP_BY_TEST_DEFINITION)),
            tableDefinition.getFullyQualifiedName());
    assertEquals(tableDefGroup.getIncidentCount(), openIncidentCases.size());
  }

  @Test
  void testDbListUnknownTestDefinitionRejected() {
    ListParams params =
        new ListParams()
            .withLimit(10)
            .addFilter("testDefinition", "incident_groups_unknown_def_" + System.nanoTime());
    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class, () -> client.testCaseResolutionStatuses().list(params));
    assertEquals(404, error.getStatusCode());
  }

  @Test
  void testGroupAggregates() throws Exception {
    List<TestCaseIncidentGroup> groups = fetchGroups(groupParams(GROUP_BY_TABLE));

    TestCaseIncidentGroup groupA = findGroup(groups, tableA.getFullyQualifiedName());
    assertEquals(
        TestCaseResolutionStatusTypes.Assigned,
        groupA.getStatus(),
        "case 2's Assigned outranks case 1's status in the triage order");
    assertEquals(List.of(userA.getName()), groupA.getAssignees());
    assertEquals(1, groupA.getAssigneeCount());
    assertTrue(groupA.getFirstSeen() <= groupA.getLastSeen());
    assertEquals(
        2,
        groupA.getTrend().stream().mapToInt(Integer::intValue).sum(),
        "trend buckets must add up to the incident count");
    assertNotNull(groupA.getTrendDirection());

    TestCaseIncidentGroup groupB = findGroup(groups, tableB.getFullyQualifiedName());
    assertEquals(TestCaseResolutionStatusTypes.New, groupB.getStatus());
    assertEquals(Severity.Severity2, groupB.getSeverity(), "case 3's explicit severity");
    assertEquals(0, groupB.getAssigneeCount());
    assertEquals(
        List.of(1, 0, 0, 0, 0, 0, 0, 0),
        groupB.getTrend(),
        "a single open incident lands in the first bucket");
    assertEquals(IncidentTrendDirection.Steady, groupB.getTrendDirection());
  }

  @Test
  void testDbListOwnerFilterScopesToOwner() throws Exception {
    assertEquals(
        Set.of(testCase1.getFullyQualifiedName(), testCase2.getFullyQualifiedName()),
        statusTestCaseFqns(
            listStatuses(new ListParams().withLimit(100).addFilter("owner", userA.getName()))),
        "user A directly owns cases 1 and 2");
    assertEquals(
        Set.of(testCase2.getFullyQualifiedName(), testCase3.getFullyQualifiedName()),
        statusTestCaseFqns(
            listStatuses(new ListParams().withLimit(100).addFilter("owner", userB.getName()))),
        "user B directly owns cases 2 and 3");
  }

  @Test
  void testDbListUnknownOwnerRejected() {
    ListParams params =
        new ListParams()
            .withLimit(10)
            .addFilter("owner", "incident_groups_unknown_owner_" + System.nanoTime());
    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class, () -> client.testCaseResolutionStatuses().list(params));
    assertEquals(404, error.getStatusCode());
  }

  @Test
  void testBulkCreateStatuses() throws Exception {
    CreateTestCaseResolutionStatus ackCase1 =
        new CreateTestCaseResolutionStatus()
            .withTestCaseReference(testCase1.getFullyQualifiedName())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Ack);
    CreateTestCaseResolutionStatus unknownCase =
        new CreateTestCaseResolutionStatus()
            .withTestCaseReference("incident_groups_missing_case_" + System.nanoTime())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Ack);

    BulkOperationResult result =
        client.testCaseResolutionStatuses().bulkCreate(List.of(ackCase1, unknownCase));

    assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus());
    assertEquals(2, result.getNumberOfRowsProcessed());
    assertEquals(1, result.getNumberOfRowsPassed());
    assertEquals(1, result.getNumberOfRowsFailed());
    assertEquals(
        TestCaseResolutionStatusTypes.Ack,
        fetchStatuses(testCase1).getFirst().getTestCaseResolutionStatusType(),
        "the bulk entry must append an Ack record to case 1's incident chain");
  }

  @Test
  void testFailedResultDenormalizesFailureSummary() throws Exception {
    long ts = System.currentTimeMillis();
    String failureText = "Expected 48210 rows, found 47006";
    Table summaryTable = createTable(schemaFqn, "incident_groups_summary_" + ts);
    TestDefinition summaryDefinition =
        createTestDefinition("incident_groups_summary_def_" + ts, TestDefinitionEntityType.TABLE);
    TestCase summaryCase =
        createTestCase(
            "incident_groups_summary_case_" + ts,
            tableLink(summaryTable),
            summaryDefinition,
            List.of());

    CreateTestCaseResult failedResult =
        new CreateTestCaseResult()
            .withTimestamp(System.currentTimeMillis())
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withResult(failureText);
    client.testCaseResults().create(summaryCase.getFullyQualifiedName(), failedResult);

    await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              List<TestCaseResolutionStatus> statuses = fetchStatuses(summaryCase);
              assertFalse(statuses.isEmpty(), "the failed result must open an incident");
              assertEquals(
                  failureText,
                  statuses.getFirst().getFailureSummary(),
                  "the incident record must carry the denormalized failure text");
            });
  }

  // Without a startTs/endTs range the data query skips the timestamp clause but the count query
  // used to keep it, evaluating BETWEEN NULL AND NULL — total came back 0 and no after-cursor was
  // ever emitted, so unranged listings could not paginate.
  @Test
  void testDbListPagingWithoutTimeRange() throws Exception {
    ListParams firstPage =
        new ListParams().withLimit(1).addFilter("testCaseFQN", testCase2.getFullyQualifiedName());
    ListResponse<TestCaseResolutionStatus> first =
        client.testCaseResolutionStatuses().list(firstPage);

    assertEquals(2, first.getPaging().getTotal(), "case 2 has a two-record chain");
    assertEquals(1, first.getData().size());
    assertNotNull(first.getPaging().getAfter(), "a second page must be reachable");

    ListParams secondPage =
        new ListParams()
            .withLimit(1)
            .addFilter("testCaseFQN", testCase2.getFullyQualifiedName())
            .addFilter("offset", first.getPaging().getAfter());
    ListResponse<TestCaseResolutionStatus> second =
        client.testCaseResolutionStatuses().list(secondPage);

    assertEquals(2, second.getPaging().getTotal());
    assertEquals(1, second.getData().size());
    assertNull(second.getPaging().getAfter(), "two records, so page two is the last page");
    Set<String> ids = new HashSet<>();
    ids.add(
        JsonUtils.convertValue(first.getData().getFirst(), TestCaseResolutionStatus.class)
            .getId()
            .toString());
    ids.add(
        JsonUtils.convertValue(second.getData().getFirst(), TestCaseResolutionStatus.class)
            .getId()
            .toString());
    assertEquals(2, ids.size(), "the two pages must return distinct records");
  }

  // The `assignee` param used to fall through to ListFilter's task-oriented condition, which
  // hashes the name and matches ASSIGNED_TO relationship targets — never a time-series record
  // id — so the DB list silently returned nothing for any assignee.
  @Test
  void testDbListAssigneeFilter() throws Exception {
    List<TestCaseResolutionStatus> records =
        listStatuses(new ListParams().withLimit(100).addFilter("assignee", userA.getName()));
    assertEquals(
        Set.of(testCase2.getFullyQualifiedName()),
        statusTestCaseFqns(records),
        "only case 2 has a record assigned to user A");
    assertEquals(
        TestCaseResolutionStatusTypes.Assigned,
        records.getFirst().getTestCaseResolutionStatusType());

    String endTs = String.valueOf(System.currentTimeMillis() + 60_000);
    List<TestCaseResolutionStatus> latest =
        listStatuses(
            new ListParams()
                .withLimit(100)
                .withLatest(true)
                .addFilter("startTs", "0")
                .addFilter("endTs", endTs)
                .addFilter("assignee", userA.getName()));
    assertEquals(
        Set.of(testCase2.getFullyQualifiedName()),
        statusTestCaseFqns(latest),
        "latest-per-test-case filtering must also honor the assignee");
  }

  // Pins the invariant that a status transition never loses the denormalized failure reason:
  // the latest record after a bulk Ack must still carry the summary captured when the failed
  // result opened the incident (whether stamped from the task payload or inherited from the
  // chain's prior record in storeInternal/syncFromTask).
  @Test
  void testBulkTransitionPreservesFailureSummary() throws Exception {
    long ts = System.currentTimeMillis();
    String failureText = "Bulk chain summary " + ts;
    Table summaryTable = createTable(schemaFqn, "incident_groups_bulk_summary_" + ts);
    TestDefinition summaryDefinition =
        createTestDefinition(
            "incident_groups_bulk_summary_def_" + ts, TestDefinitionEntityType.TABLE);
    TestCase summaryCase =
        createTestCase(
            "incident_groups_bulk_summary_case_" + ts,
            tableLink(summaryTable),
            summaryDefinition,
            List.of());
    client
        .testCaseResults()
        .create(
            summaryCase.getFullyQualifiedName(),
            new CreateTestCaseResult()
                .withTimestamp(System.currentTimeMillis())
                .withTestCaseStatus(TestCaseStatus.Failed)
                .withResult(failureText));
    await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () ->
                assertFalse(
                    fetchStatuses(summaryCase).isEmpty(),
                    "the failed result must open an incident"));

    BulkOperationResult result =
        client
            .testCaseResolutionStatuses()
            .bulkCreate(
                List.of(
                    new CreateTestCaseResolutionStatus()
                        .withTestCaseReference(summaryCase.getFullyQualifiedName())
                        .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Ack)));
    assertEquals(ApiStatus.SUCCESS, result.getStatus());

    await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              TestCaseResolutionStatus latest = fetchStatuses(summaryCase).getFirst();
              assertEquals(
                  TestCaseResolutionStatusTypes.Ack, latest.getTestCaseResolutionStatusType());
              assertEquals(
                  failureText,
                  latest.getFailureSummary(),
                  "the status transition must not lose the denormalized failure reason");
            });
  }

  // The public API cannot produce two records with an identical timestamp (storeInternal forces
  // per-FQN monotonicity), so the tie shape is seeded straight into the suite's database and
  // asserted through the API — pinning the MAX(id) tie-breaker in the incident CTE. Without it,
  // both tied records enter the aggregates: two assignees and a double-counted trend point for a
  // single incident.
  @Test
  void testDuplicateMaxTimestampTieBreak() throws Exception {
    long ts = System.currentTimeMillis();
    Table tieTable = createTable(schemaFqn, "incident_groups_tie_" + ts);
    TestDefinition tieDefinition =
        createTestDefinition("incident_groups_tie_def_" + ts, TestDefinitionEntityType.TABLE);
    TestCase tieCase =
        createTestCase(
            "incident_groups_tie_case_" + ts, tableLink(tieTable), tieDefinition, List.of());

    String stateId = UUID.randomUUID().toString();
    long tieTimestamp = ts - 3_600_000;
    insertStatusRecords(
        tieCase,
        List.of(
            seededRecord(stateId, tieTimestamp - 60_000, TestCaseResolutionStatusTypes.New, null),
            seededRecord(
                stateId,
                tieTimestamp,
                TestCaseResolutionStatusTypes.Assigned,
                "incident_groups_tie_assignee_a_" + ts),
            seededRecord(
                stateId,
                tieTimestamp,
                TestCaseResolutionStatusTypes.Assigned,
                "incident_groups_tie_assignee_b_" + ts)));

    Map<String, String> params = groupParams(GROUP_BY_TABLE);
    params.put("testCaseFQN", tieCase.getFullyQualifiedName());
    TestCaseIncidentGroup group = findGroup(fetchGroups(params), tieTable.getFullyQualifiedName());

    assertEquals(1, group.getIncidentCount());
    assertEquals(
        1, group.getAssigneeCount(), "only the tie-broken latest record's assignee may count");
    assertEquals(1, group.getAssignees().size());
    assertEquals(
        1,
        group.getTrend().stream().mapToInt(Integer::intValue).sum(),
        "the tied incident must enter the trend exactly once");
  }

  // 60 distinct assignee names exceed GROUP_CONCAT's default 1024-char cap; the JSON aggregate
  // must deliver every name complete. Seeded via the database for speed and determinism.
  @Test
  void testAssigneeDenseGroupIsNotTruncated() throws Exception {
    long ts = System.currentTimeMillis();
    Table denseTable = createTable(schemaFqn, "incident_groups_dense_" + ts);
    TestDefinition denseDefinition =
        createTestDefinition("incident_groups_dense_def_" + ts, TestDefinitionEntityType.TABLE);
    TestCase denseCase =
        createTestCase(
            "incident_groups_dense_case_" + ts, tableLink(denseTable), denseDefinition, List.of());

    List<TestCaseResolutionStatus> records = new ArrayList<>();
    for (int i = 0; i < 60; i++) {
      String stateId = UUID.randomUUID().toString();
      long chainStart = ts - (i + 2) * 3_600_000L;
      records.add(seededRecord(stateId, chainStart, TestCaseResolutionStatusTypes.New, null));
      records.add(
          seededRecord(
              stateId,
              chainStart + 60_000,
              TestCaseResolutionStatusTypes.Assigned,
              String.format("incident_groups_dense_assignee_number_%02d_%d", i, ts)));
    }
    insertStatusRecords(denseCase, records);

    Map<String, String> params = groupParams(GROUP_BY_TABLE);
    params.put("testCaseFQN", denseCase.getFullyQualifiedName());
    TestCaseIncidentGroup group =
        findGroup(fetchGroups(params), denseTable.getFullyQualifiedName());

    assertEquals(60, group.getIncidentCount());
    assertEquals(60, group.getAssigneeCount());
    assertEquals(60, group.getAssignees().size(), "no aggregation cap may drop assignees");
    assertTrue(
        group.getAssignees().stream()
            .allMatch(name -> name.matches("incident_groups_dense_assignee_number_\\d{2}_\\d+")),
        "every assignee name must arrive complete, never truncated mid-name");
  }

  private TestCaseResolutionStatus seededRecord(
      String stateId, long timestamp, TestCaseResolutionStatusTypes type, String assigneeName) {
    TestCaseResolutionStatus record =
        new TestCaseResolutionStatus()
            .withId(UUID.randomUUID())
            .withStateId(UUID.fromString(stateId))
            .withTimestamp(timestamp)
            .withUpdatedAt(timestamp)
            .withTestCaseResolutionStatusType(type);
    if (assigneeName != null) {
      record.withTestCaseResolutionStatusDetails(
          new Assigned()
              .withAssignee(
                  new EntityReference()
                      .withId(UUID.randomUUID())
                      .withType("user")
                      .withName(assigneeName)));
    }
    return record;
  }

  private void insertStatusRecords(TestCase testCase, List<TestCaseResolutionStatus> records)
      throws Exception {
    DataSourceFactory dataSource =
        TestSuiteBootstrap.createApplicationConfigCopy().getDataSourceFactory();
    boolean postgres = dataSource.getUrl().contains("postgresql");
    String insert =
        "INSERT INTO test_case_resolution_status_time_series (entityFQNHash, jsonSchema, json) "
            + (postgres ? "VALUES (?, ?, ?::jsonb)" : "VALUES (?, ?, ?)");
    String fqnHash = FullyQualifiedName.buildHash(testCase.getFullyQualifiedName());
    try (Connection connection =
            DriverManager.getConnection(
                dataSource.getUrl(), dataSource.getUser(), dataSource.getPassword());
        PreparedStatement statement = connection.prepareStatement(insert)) {
      for (TestCaseResolutionStatus record : records) {
        statement.setString(1, fqnHash);
        statement.setString(2, "testCaseResolutionStatus");
        statement.setString(3, JsonUtils.pojoToJson(record));
        statement.addBatch();
      }
      statement.executeBatch();
      syncIncidentSummary(connection, postgres, fqnHash);
    }
  }

  // Direct SQL seeding bypasses the repository's write path, so the summary projection the
  // groups endpoint reads must be synced the same way the 2.1.0 backfill migration does —
  // including its MAX(id) tie-break, which testDuplicateMaxTimestampTieBreak pins.
  private void syncIncidentSummary(Connection connection, boolean postgres, String fqnHash)
      throws Exception {
    String severityExpr =
        postgres ? "t.json ->> 'severity'" : "JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.severity'))";
    String upsertTail =
        postgres
            ? "ON CONFLICT (stateId) DO UPDATE SET "
                + "testCaseResolutionStatusType = EXCLUDED.testCaseResolutionStatusType, "
                + "assignee = EXCLUDED.assignee, severity = EXCLUDED.severity, "
                + "createdAt = LEAST(test_case_incident.createdAt, EXCLUDED.createdAt), "
                + "updatedAt = EXCLUDED.updatedAt, latestRecordId = EXCLUDED.latestRecordId"
            : "ON DUPLICATE KEY UPDATE "
                + "testCaseResolutionStatusType = VALUES(testCaseResolutionStatusType), "
                + "assignee = VALUES(assignee), severity = VALUES(severity), "
                + "test_case_incident.createdAt = LEAST(test_case_incident.createdAt, VALUES(createdAt)), "
                + "updatedAt = VALUES(updatedAt), latestRecordId = VALUES(latestRecordId)";
    String backfill =
        "INSERT INTO test_case_incident (stateId, entityFQNHash, testCaseResolutionStatusType, "
            + "assignee, severity, createdAt, updatedAt, latestRecordId) "
            + "WITH chain AS (SELECT stateId, MIN(timestamp) AS createdAt, MAX(timestamp) AS updatedAt "
            + "  FROM test_case_resolution_status_time_series WHERE entityFQNHash = ? GROUP BY stateId), "
            + "latestRecord AS (SELECT c.stateId, c.createdAt, c.updatedAt, MAX(t.id) AS latestId "
            + "  FROM chain c INNER JOIN test_case_resolution_status_time_series t "
            + "  ON t.stateId = c.stateId AND t.timestamp = c.updatedAt "
            + "  GROUP BY c.stateId, c.createdAt, c.updatedAt) "
            + "SELECT t.stateId, t.entityFQNHash, t.testCaseResolutionStatusType, t.assignee, "
            + severityExpr
            + ", l.createdAt, l.updatedAt, t.id "
            + "FROM latestRecord l INNER JOIN test_case_resolution_status_time_series t ON t.id = l.latestId "
            + upsertTail;
    try (PreparedStatement statement = connection.prepareStatement(backfill)) {
      statement.setString(1, fqnHash);
      statement.executeUpdate();
    }
  }

  @Test
  void testResolvedStatusRejected() {
    Map<String, String> params = groupParams(GROUP_BY_TABLE);
    params.put("status", TestCaseResolutionStatusTypes.Resolved.value());
    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class,
            () -> client.testCaseResolutionStatuses().listIncidentGroups(params));
    assertEquals(400, error.getStatusCode());
  }

  @Test
  void testInvalidGroupByRejected() {
    Map<String, String> params = groupParams("invalidDimension");
    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class,
            () -> client.testCaseResolutionStatuses().listIncidentGroups(params));
    assertEquals(400, error.getStatusCode());
  }

  @Test
  void testMissingGroupByRejected() {
    Map<String, String> params = new LinkedHashMap<>();
    params.put("limit", MAX_LIMIT);
    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class,
            () -> client.testCaseResolutionStatuses().listIncidentGroups(params));
    assertEquals(400, error.getStatusCode());
  }

  private String createSchema(long ts) throws Exception {
    Database database =
        client
            .databases()
            .create(
                new CreateDatabase()
                    .withName("incident_groups_db_" + ts)
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    return client
        .databaseSchemas()
        .create(
            new CreateDatabaseSchema()
                .withName("incident_groups_schema_" + ts)
                .withDatabase(database.getFullyQualifiedName()))
        .getFullyQualifiedName();
  }

  private Table createTable(String schemaFqn, String name) throws Exception {
    return client
        .tables()
        .create(
            new CreateTable()
                .withName(name)
                .withDatabaseSchema(schemaFqn)
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));
  }

  private User createUser(String name) throws Exception {
    return client.users().create(new CreateUser().withName(name).withEmail(name + "@example.com"));
  }

  private TestDefinition createTestDefinition(String name, TestDefinitionEntityType entityType)
      throws Exception {
    return client
        .testDefinitions()
        .create(
            new CreateTestDefinition()
                .withName(name)
                .withDescription("Incident groups IT definition")
                .withEntityType(entityType)
                .withTestPlatforms(List.of(TestPlatform.OPEN_METADATA)));
  }

  private Domain createDomain(String name) throws Exception {
    return client
        .domains()
        .create(
            new CreateDomain()
                .withName(name)
                .withDomainType(CreateDomain.DomainType.AGGREGATE)
                .withDescription("Incident groups IT domain"));
  }

  private TestCase createTestCase(
      String name, String entityLink, TestDefinition definition, List<EntityReference> owners)
      throws Exception {
    CreateTestCase request =
        new CreateTestCase()
            .withName(name)
            .withEntityLink(entityLink)
            .withTestDefinition(definition.getFullyQualifiedName());
    if (!owners.isEmpty()) {
      request.withOwners(owners);
    }
    return client.testCases().create(request);
  }

  private void assignDomain(TestCase testCase, Domain assignedDomain) throws Exception {
    TestCase fetched = client.testCases().get(testCase.getId().toString(), "owners,domains");
    fetched.setDomains(List.of(assignedDomain.getEntityReference()));
    client.testCases().update(fetched.getId().toString(), fetched);
  }

  private void createStatus(TestCase testCase, TestCaseResolutionStatusTypes type, Object details)
      throws Exception {
    createStatus(testCase, type, details, null);
  }

  private void createStatus(
      TestCase testCase, TestCaseResolutionStatusTypes type, Object details, Severity severity)
      throws Exception {
    CreateTestCaseResolutionStatus request =
        new CreateTestCaseResolutionStatus()
            .withTestCaseResolutionStatusType(type)
            .withTestCaseReference(testCase.getFullyQualifiedName());
    if (details != null) {
      request.withTestCaseResolutionStatusDetails(details);
    }
    if (severity != null) {
      request.withSeverity(severity);
    }
    client.testCaseResolutionStatuses().create(request);
  }

  private String tableLink(Table table) {
    return "<#E::table::" + table.getFullyQualifiedName() + ">";
  }

  private String columnLink(Table table) {
    return "<#E::table::" + table.getFullyQualifiedName() + "::columns::id>";
  }

  private Map<String, String> groupParams(String groupBy) {
    Map<String, String> params = new LinkedHashMap<>();
    params.put("groupBy", groupBy);
    params.put("limit", MAX_LIMIT);
    return params;
  }

  private Map<String, String> dateRangeParams(String dateField, Long startTs, Long endTs) {
    Map<String, String> params = groupParams(GROUP_BY_TABLE);
    params.put("testCaseFQN", testCase2.getFullyQualifiedName());
    params.put("dateField", dateField);
    if (startTs != null) {
      params.put("startTs", String.valueOf(startTs));
    }
    if (endTs != null) {
      params.put("endTs", String.valueOf(endTs));
    }
    return params;
  }

  private List<TestCaseIncidentGroup> fetchGroups(Map<String, String> params) throws Exception {
    return convertGroups(client.testCaseResolutionStatuses().listIncidentGroups(params));
  }

  private List<TestCaseIncidentGroup> convertGroups(ListResponse<TestCaseIncidentGroup> response) {
    List<TestCaseIncidentGroup> groups = new ArrayList<>();
    for (Object item : response.getData()) {
      groups.add(JsonUtils.convertValue(item, TestCaseIncidentGroup.class));
    }
    return groups;
  }

  private List<TestCaseResolutionStatus> fetchStatuses(TestCase testCase) throws Exception {
    return listStatuses(
        new ListParams().withLimit(100).addFilter("testCaseFQN", testCase.getFullyQualifiedName()));
  }

  private List<TestCaseResolutionStatus> listStatuses(ListParams params) throws Exception {
    ListResponse<TestCaseResolutionStatus> response =
        client.testCaseResolutionStatuses().list(params);
    List<TestCaseResolutionStatus> statuses = new ArrayList<>();
    for (Object item : response.getData()) {
      statuses.add(JsonUtils.convertValue(item, TestCaseResolutionStatus.class));
    }
    return statuses;
  }

  private Set<String> statusTestCaseFqns(List<TestCaseResolutionStatus> statuses) {
    return statuses.stream()
        .map(status -> status.getTestCaseReference().getFullyQualifiedName())
        .collect(Collectors.toSet());
  }

  private TestCaseIncidentGroup findGroup(
      List<TestCaseIncidentGroup> groups, String fullyQualifiedName) {
    Optional<TestCaseIncidentGroup> group =
        groups.stream()
            .filter(candidate -> fullyQualifiedName.equals(candidate.getFullyQualifiedName()))
            .findFirst();
    assertTrue(group.isPresent(), "expected a group for " + fullyQualifiedName);
    return group.orElseThrow();
  }

  private void assertGroupAbsent(List<TestCaseIncidentGroup> groups, String fullyQualifiedName) {
    assertTrue(
        groups.stream()
            .noneMatch(candidate -> fullyQualifiedName.equals(candidate.getFullyQualifiedName())),
        "expected no group for " + fullyQualifiedName);
  }

  private void assertSorted(List<TestCaseIncidentGroup> groups, boolean ascending) {
    for (int i = 1; i < groups.size(); i++) {
      int previous = groups.get(i - 1).getIncidentCount();
      int current = groups.get(i).getIncidentCount();
      assertTrue(
          ascending ? previous <= current : previous >= current,
          "groups must be sorted by incidentCount " + (ascending ? "ascending" : "descending"));
    }
  }
}
