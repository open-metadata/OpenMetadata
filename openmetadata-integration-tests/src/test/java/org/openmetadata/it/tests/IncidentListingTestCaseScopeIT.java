package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.ApiAssertions.assertBadRequest;
import static org.openmetadata.it.util.ApiAssertions.assertForbidden;
import static org.openmetadata.it.util.ApiAssertions.assertNotFound;

import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.DenyPolicyPrincipals;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * The flat incident listing scoped by {@code testCaseId} must list, count, page and authorize
 * exactly like the same listing scoped by {@code testCaseFQN} (#38642). The id used to reach
 * neither the filter nor the test-case half of the authorization, so an owner of one table could
 * read every incident, and a policy gated on test-case ownership refused the real owner.
 *
 * <p>The table-gated principal reproduces the issue's policy matrix: it is denied table ViewAll
 * unless it owns the table, while the seeded OrganizationPolicy still grants it test-case ViewAll.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IncidentListingTestCaseScopeIT {

  private static final String INCIDENT_LISTING_PATH =
      "/v1/dataQuality/testCases/testCaseIncidentStatus";
  private static final TypeReference<ResultList<TestCaseResolutionStatus>> INCIDENT_PAGE =
      new TypeReference<>() {};
  private static final String TEST_CASE_ID = "testCaseId";
  private static final String TEST_CASE_FQN = "testCaseFQN";
  private static final String ORIGIN_ENTITY_FQN = "originEntityFQN";
  private static final String INCLUDE = "include";
  private static final String LIMIT = "limit";
  private static final String TABLE_ROW_COUNT_TO_EQUAL = "tableRowCountToEqual";
  private static final String COLUMN_VALUES_TO_BE_NOT_NULL = "columnValuesToBeNotNull";
  private static final String ID_COLUMN = "id";
  private static final String OWNER_CONDITION = "!isOwner()";
  private static final long RANGE_END_SLACK_MS = 60_000;

  private record Fixture(
      Table ownedTable,
      Table otherTable,
      TestCase ownedCase,
      TestCase ownedColumnCase,
      TestCase otherCase) {}

  @Test
  void tableGatedOwner_testCaseIdListsOnlyThatTestCase(TestNamespace ns) {
    User owner = tableGatedUser(ns);
    OpenMetadataClient ownerClient = clientFor(owner);
    Fixture fixture = createFixture(ns, List.of(owner.getEntityReference()));

    assertForbidden(
        () -> listIncidents(ownerClient, params()),
        "without a test-case scope the table-gated user is refused");
    ResultList<TestCaseResolutionStatus> byFqn =
        listIncidents(ownerClient, byFqn(fixture.ownedCase()));
    assertEquals(2, total(byFqn), "the FQN scope lists the owned case's two records");

    ResultList<TestCaseResolutionStatus> byId =
        listIncidents(ownerClient, byId(fixture.ownedCase()));
    assertEquals(2, total(byId), "testCaseId scopes the total to that test case");
    assertEquals(Set.of(fqn(fixture.ownedCase())), listedTestCaseFQNs(byId));
    assertEquals(recordIds(byFqn), recordIds(byId), "testCaseId lists what testCaseFQN lists");
    assertEquals(
        1,
        total(listIncidents(ownerClient, byId(fixture.ownedColumnCase()))),
        "a column-level case is scoped and authorized through its table");
    assertForbidden(
        () -> listIncidents(ownerClient, byId(fixture.otherCase())),
        "testCaseId of a table the caller cannot view is refused");
  }

  @Test
  void tableGatedOwner_testCaseIdCannotReachAnotherTableThroughOriginEntityFQN(TestNamespace ns) {
    User owner = tableGatedUser(ns);
    OpenMetadataClient ownerClient = clientFor(owner);
    Fixture fixture = createFixture(ns, List.of(owner.getEntityReference()));

    ResultList<TestCaseResolutionStatus> otherOrigin =
        listIncidents(
            ownerClient,
            params(
                TEST_CASE_ID,
                id(fixture.ownedCase()),
                ORIGIN_ENTITY_FQN,
                fixture.otherTable().getFullyQualifiedName()));
    assertEquals(0, total(otherOrigin), "another table's incidents stay out of reach");
    assertTrue(otherOrigin.getData().isEmpty());

    ResultList<TestCaseResolutionStatus> ownOrigin =
        listIncidents(
            ownerClient,
            params(
                TEST_CASE_ID,
                id(fixture.ownedCase()),
                ORIGIN_ENTITY_FQN,
                fixture.ownedTable().getFullyQualifiedName()));
    assertEquals(2, total(ownOrigin), "the origin filter composes with the test-case scope");
    assertEquals(Set.of(fqn(fixture.ownedCase())), listedTestCaseFQNs(ownOrigin));
  }

  @Test
  void fullyGatedOwner_testCaseIdIsAuthorizedAgainstThatTestCase(TestNamespace ns) {
    User owner =
        DenyPolicyPrincipals.userDeniedWhen(
            ns.shortPrefix("all"), "All", MetadataOperation.VIEW_ALL, OWNER_CONDITION);
    OpenMetadataClient ownerClient = clientFor(owner);
    Fixture fixture = createFixture(ns, List.of(owner.getEntityReference()));

    assertEquals(
        2,
        total(listIncidents(ownerClient, byFqn(fixture.ownedCase()))),
        "the FQN scope authorizes the owner against the test case");
    assertEquals(
        2,
        total(listIncidents(ownerClient, byId(fixture.ownedCase()))),
        "the id scope authorizes the owner against the same test case, not an empty context");
  }

  @Test
  void admin_testCaseIdFiltersListAndTotal(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Fixture fixture = createFixture(ns, List.of());

    ResultList<TestCaseResolutionStatus> page = listIncidents(admin, byId(fixture.ownedCase()));
    assertEquals(2, total(page), "an admin's listing is filtered too");
    assertEquals(Set.of(fqn(fixture.ownedCase())), listedTestCaseFQNs(page));

    ResultList<TestCaseResolutionStatus> countOnly =
        listIncidents(admin, params(TEST_CASE_ID, id(fixture.ownedCase()), LIMIT, "0"));
    assertTrue(countOnly.getData().isEmpty());
    assertEquals(2, total(countOnly), "limit=0 counts the scoped test case only");
  }

  @Test
  void testCaseId_pagesWithinTheTestCase(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Fixture fixture = createFixture(ns, List.of());
    String testCaseId = id(fixture.ownedCase());

    ResultList<TestCaseResolutionStatus> first =
        listIncidents(admin, params(TEST_CASE_ID, testCaseId, LIMIT, "1"));
    assertEquals(1, first.getData().size());
    assertEquals(2, total(first));
    assertNotNull(first.getPaging().getAfter(), "a second record of the case remains");

    ResultList<TestCaseResolutionStatus> second =
        listIncidents(
            admin,
            params(TEST_CASE_ID, testCaseId, LIMIT, "1", "offset", first.getPaging().getAfter()));
    assertEquals(1, second.getData().size());
    assertNotEquals(recordIds(first), recordIds(second), "the cursor moves to the other record");
    assertEquals(Set.of(fqn(fixture.ownedCase())), listedTestCaseFQNs(second));
    assertNull(second.getPaging().getAfter(), "the case has no third record");

    ResultList<TestCaseResolutionStatus> pageTwo =
        listIncidents(admin, params(TEST_CASE_ID, testCaseId, LIMIT, "1", "page", "2"));
    assertEquals(recordIds(second), recordIds(pageTwo), "page=2 is the second cursor page");
  }

  @Test
  void testCaseId_latestReturnsTheLatestRecordOfThatTestCase(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Fixture fixture = createFixture(ns, List.of());

    ResultList<TestCaseResolutionStatus> latest =
        listIncidents(admin, params(TEST_CASE_ID, id(fixture.ownedCase()), "latest", "true"));
    assertEquals(1, total(latest), "one incident, so one latest record");
    assertEquals(
        TestCaseResolutionStatusTypes.Ack,
        latest.getData().getFirst().getTestCaseResolutionStatusType());
    assertEquals(Set.of(fqn(fixture.ownedCase())), listedTestCaseFQNs(latest));
  }

  @Test
  void testCaseIdAndTestCaseFQN_mustNameTheSameTestCase(TestNamespace ns) {
    User owner = tableGatedUser(ns);
    OpenMetadataClient ownerClient = clientFor(owner);
    Fixture fixture = createFixture(ns, List.of(owner.getEntityReference()));
    Map<String, String> mismatch =
        params(TEST_CASE_ID, id(fixture.ownedCase()), TEST_CASE_FQN, fqn(fixture.otherCase()));

    OpenMetadataException adminFailure =
        assertBadRequest(
            () -> listIncidents(SdkClients.adminClient(), mismatch),
            "an id and an FQN of different test cases are rejected");
    assertTrue(
        adminFailure.getMessage().contains(id(fixture.ownedCase())),
        "the rejection names the conflicting id: " + adminFailure.getMessage());
    assertBadRequest(
        () -> listIncidents(ownerClient, mismatch),
        "the pair is rejected before it can be authorized against either test case");

    Map<String, String> matching =
        params(TEST_CASE_ID, id(fixture.ownedCase()), TEST_CASE_FQN, fqn(fixture.ownedCase()));
    assertEquals(2, total(listIncidents(ownerClient, matching)));
  }

  @Test
  void unknownTestCaseId_isNotFound(TestNamespace ns) {
    OpenMetadataClient ownerClient = clientFor(tableGatedUser(ns));
    Map<String, String> unknown = params(TEST_CASE_ID, UUID.randomUUID().toString());

    assertNotFound(
        () -> listIncidents(SdkClients.adminClient(), unknown),
        "an unknown test case id is not found for an admin");
    assertNotFound(
        () -> listIncidents(ownerClient, unknown),
        "an unknown test case id is not found for a restricted user");
  }

  @Test
  void testCaseId_honorsIncludeForASoftDeletedTestCase(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Fixture fixture = createFixture(ns, List.of());
    String testCaseId = id(fixture.ownedCase());
    admin.testCases().delete(testCaseId, Map.of("recursive", "true", "hardDelete", "false"));

    assertEquals(
        0,
        total(listIncidents(admin, params(TEST_CASE_ID, testCaseId))),
        "the default include hides a soft-deleted case's incidents");
    assertEquals(
        2, total(listIncidents(admin, params(TEST_CASE_ID, testCaseId, INCLUDE, "deleted"))));
    assertEquals(2, total(listIncidents(admin, params(TEST_CASE_ID, testCaseId, INCLUDE, "all"))));
  }

  @Test
  void testCaseId_composesWithTestDefinition(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Fixture fixture = createFixture(ns, List.of());
    String testCaseId = id(fixture.ownedCase());

    assertEquals(
        2,
        total(
            listIncidents(
                admin,
                params(TEST_CASE_ID, testCaseId, "testDefinition", TABLE_ROW_COUNT_TO_EQUAL))));
    assertEquals(
        0,
        total(
            listIncidents(
                admin,
                params(TEST_CASE_ID, testCaseId, "testDefinition", COLUMN_VALUES_TO_BE_NOT_NULL))),
        "another definition's incidents are not the case's");
  }

  private static User tableGatedUser(TestNamespace ns) {
    return DenyPolicyPrincipals.userDeniedWhen(
        ns.shortPrefix("tbl"), Entity.TABLE, MetadataOperation.VIEW_ALL, OWNER_CONDITION);
  }

  private static OpenMetadataClient clientFor(User user) {
    return SdkClients.createClient(user.getName(), user.getEmail(), new String[] {});
  }

  /**
   * Two tables in one schema: the owned one carries a table-level case with a New then Ack
   * incident and a column-level case with a New incident; the other carries one New incident.
   */
  private static Fixture createFixture(TestNamespace ns, List<EntityReference> owners) {
    String id = ns.shortPrefix();
    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("sv" + id, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimpleWithName("sc" + id, ns, service);
    Table ownedTable = createTable("owned" + id, schema, owners);
    Table otherTable = createTable("other" + id, schema, List.of());
    Fixture fixture =
        new Fixture(
            ownedTable,
            otherTable,
            createTableCase("ownedTc" + id, ownedTable),
            createColumnCase("ownedColTc" + id, ownedTable),
            createTableCase("otherTc" + id, otherTable));
    openIncidents(fixture);
    return fixture;
  }

  private static Table createTable(
      String name, DatabaseSchema schema, List<EntityReference> owners) {
    CreateTable request =
        new CreateTable()
            .withName(name)
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(
                List.of(new Column().withName(ID_COLUMN).withDataType(ColumnDataType.BIGINT)))
            .withOwners(owners);
    return SdkClients.adminClient().tables().create(request);
  }

  private static TestCase createTableCase(String name, Table table) {
    return TestCaseBuilder.create(SdkClients.adminClient())
        .name(name)
        .forTable(table)
        .testDefinition(TABLE_ROW_COUNT_TO_EQUAL)
        .parameter("value", "100")
        .create();
  }

  private static TestCase createColumnCase(String name, Table table) {
    return TestCaseBuilder.create(SdkClients.adminClient())
        .name(name)
        .forColumn(table, ID_COLUMN)
        .testDefinition(COLUMN_VALUES_TO_BE_NOT_NULL)
        .create();
  }

  private static void openIncidents(Fixture fixture) {
    createStatus(fixture.ownedCase(), TestCaseResolutionStatusTypes.New);
    createStatus(fixture.ownedCase(), TestCaseResolutionStatusTypes.Ack);
    createStatus(fixture.ownedColumnCase(), TestCaseResolutionStatusTypes.New);
    createStatus(fixture.otherCase(), TestCaseResolutionStatusTypes.New);
    // The Ack may land through the incident task workflow rather than in the POST itself.
    await()
        .atMost(Duration.ofSeconds(30))
        .until(
            () -> total(listIncidents(SdkClients.adminClient(), byFqn(fixture.ownedCase()))) == 2);
  }

  private static void createStatus(TestCase testCase, TestCaseResolutionStatusTypes type) {
    SdkClients.adminClient()
        .testCaseResolutionStatuses()
        .create(
            new CreateTestCaseResolutionStatus()
                .withTestCaseResolutionStatusType(type)
                .withTestCaseReference(testCase.getFullyQualifiedName()));
  }

  /** Every call spans all time, so only the scope under test decides what is listed. */
  private static ResultList<TestCaseResolutionStatus> listIncidents(
      OpenMetadataClient client, Map<String, String> scope) {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("startTs", "0")
            .queryParam("endTs", String.valueOf(System.currentTimeMillis() + RANGE_END_SLACK_MS))
            .queryParams(scope)
            .build();
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, INCIDENT_LISTING_PATH, null, options);
    return JsonUtils.readValue(response, INCIDENT_PAGE);
  }

  private static Map<String, String> params(String... keysAndValues) {
    Map<String, String> params = new LinkedHashMap<>();
    for (int index = 0; index < keysAndValues.length; index += 2) {
      params.put(keysAndValues[index], keysAndValues[index + 1]);
    }
    return params;
  }

  private static Map<String, String> byId(TestCase testCase) {
    return params(TEST_CASE_ID, id(testCase));
  }

  private static Map<String, String> byFqn(TestCase testCase) {
    return params(TEST_CASE_FQN, fqn(testCase));
  }

  private static String id(TestCase testCase) {
    return testCase.getId().toString();
  }

  private static String fqn(TestCase testCase) {
    return testCase.getFullyQualifiedName();
  }

  private static int total(ResultList<TestCaseResolutionStatus> page) {
    return page.getPaging().getTotal();
  }

  private static Set<String> listedTestCaseFQNs(ResultList<TestCaseResolutionStatus> page) {
    return page.getData().stream()
        .map(record -> record.getTestCaseReference().getFullyQualifiedName())
        .collect(Collectors.toSet());
  }

  private static Set<UUID> recordIds(ResultList<TestCaseResolutionStatus> page) {
    return page.getData().stream().map(TestCaseResolutionStatus::getId).collect(Collectors.toSet());
  }
}
