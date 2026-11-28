package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SharedResourceLocks;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Test case results and incidents are scoped like the test cases they belong to (#38979). The
 * caller is the issue's {@code user_a}: a member of a group team whose default roles are
 * DataConsumer and DomainOnlyAccessRole and whose domain is the only one the member has. Such a
 * member is refused the other domain's test case, so its result text and its incidents must not
 * reach them through a listing either.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@ResourceLock(value = SharedResourceLocks.SEARCH_SETTINGS, mode = ResourceAccessMode.READ_WRITE)
public class DataQualityTimeSeriesDomainScopeIT {

  private static final Logger LOG =
      LoggerFactory.getLogger(DataQualityTimeSeriesDomainScopeIT.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String RESULT_SEARCH_LIST_PATH =
      "/v1/dataQuality/testCases/testCaseResults/search/list";
  private static final String RESULT_SEARCH_LATEST_PATH =
      "/v1/dataQuality/testCases/testCaseResults/search/latest";
  private static final String INCIDENT_LIST_PATH =
      "/v1/dataQuality/testCases/testCaseIncidentStatus";
  private static final String NOT_NULL_TEST_DEFINITION = "columnValuesToBeNotNull";
  private static final Column ID_COLUMN =
      new Column().withName("id").withDataType(ColumnDataType.INT);
  private static final Duration SEARCH_TIMEOUT = Duration.ofSeconds(120);
  private static final long WINDOW_SLACK_MS = 1_000;
  private static final int PAGE_SIZE = 1000;
  // Puts a result after every other one in the shared index, so it is the newest of them all.
  private static final long FUTURE_MS = Duration.ofDays(3650).toMillis();

  private record DomainCase(Domain domain, Table table, TestCase testCase, String resultText) {}

  /**
   * {@code createdFrom} and {@code createdTo} bound the unscoped listings to the rows written while
   * the fixture was built, so they fit one page.
   */
  private record Fixture(
      DomainCase own,
      DomainCase foreign,
      OpenMetadataClient member,
      long createdFrom,
      long createdTo) {}

  /** The issue's setup turns search access control on; the result search listing runs under it. */
  @Test
  void resultSearchListLeavesOutResultsOfAnotherDomain(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      enableSearchAccessControl(admin, cleanup);
      Fixture fixture = createFixture(admin, ns.shortPrefix(), cleanup);
      awaitResultsIndexed(admin, fixture);
      Set<String> unscoped =
          resultTexts(listPage(fixture.member(), RESULT_SEARCH_LIST_PATH, resultWindow(fixture)));
      assertTrue(
          unscoped.contains(fixture.own().resultText()),
          "the unscoped listing lists the own-domain result. Saw: " + unscoped);
      assertFalse(
          unscoped.contains(fixture.foreign().resultText()),
          "the unscoped listing leaves out the other domain's result. Saw: " + unscoped);
      for (boolean latest : List.of(false, true)) {
        Set<String> own = listedResultTexts(fixture.member(), byTable(fixture.own(), latest));
        Set<String> foreign =
            listedResultTexts(fixture.member(), byTable(fixture.foreign(), latest));
        assertTrue(
            own.contains(fixture.own().resultText()),
            "own-domain result is listed (latest=" + latest + "). Saw: " + own);
        assertFalse(
            foreign.contains(fixture.foreign().resultText()),
            "other-domain result is left out (latest=" + latest + "). Saw: " + foreign);
      }
    } finally {
      drain(cleanup);
    }
  }

  /** Called with no filter, the latest result is the newest one in the index, of any domain. */
  @Test
  void latestResultSearchLeavesOutResultsOfAnotherDomain(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      enableSearchAccessControl(admin, cleanup);
      Fixture fixture = createFixture(admin, ns.shortPrefix(), cleanup);
      String newestText = fixture.foreign().resultText() + " newest";
      String foreignFqn = fixture.foreign().testCase().getFullyQualifiedName();
      long newestTimestamp = System.currentTimeMillis() + FUTURE_MS;
      addResult(admin, fixture.foreign().testCase(), newestTimestamp, newestText);
      cleanup.push(() -> admin.testCaseResults().delete(foreignFqn, newestTimestamp));
      Awaitility.await("the other domain's newest result is indexed")
          .atMost(SEARCH_TIMEOUT)
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(() -> assertEquals(newestText, latestResultText(admin, Map.of())));
      assertEquals(
          fixture.own().resultText(),
          latestResultText(fixture.member(), byTestCase(fixture.own())),
          "own-domain latest result is returned");
      String unscoped = latestResultText(fixture.member(), Map.of());
      assertNotEquals(
          newestText, unscoped, "the unscoped latest result leaves out the other domain's");
    } finally {
      drain(cleanup);
    }
  }

  /** The incident listings read the database, so search settings are left as they are. */
  @Test
  void incidentListingLeavesOutIncidentsOfAnotherDomain(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      Fixture fixture = createFixture(admin, ns.shortPrefix(), cleanup);
      String ownFqn = fixture.own().testCase().getFullyQualifiedName();
      String foreignFqn = fixture.foreign().testCase().getFullyQualifiedName();
      for (boolean latest : List.of(false, true)) {
        assertTrue(
            incidentFqns(listIncidents(admin, fixture, byDomain(fixture.foreign()), latest))
                .contains(foreignFqn),
            "admin lists the other domain's incident (latest=" + latest + ")");
        Set<String> unscoped =
            incidentFqns(listIncidents(fixture.member(), fixture, Map.of(), latest));
        Set<String> own =
            incidentFqns(listIncidents(fixture.member(), fixture, byDomain(fixture.own()), latest));
        Set<String> foreign =
            incidentFqns(
                listIncidents(fixture.member(), fixture, byDomain(fixture.foreign()), latest));
        assertTrue(
            unscoped.contains(ownFqn) && own.contains(ownFqn),
            "own-domain incident is listed (latest=" + latest + "). Saw: " + unscoped);
        assertFalse(
            unscoped.contains(foreignFqn),
            "the unscoped listing leaves out the other domain's incident (latest="
                + latest
                + "). Saw: "
                + unscoped);
        assertFalse(
            foreign.contains(foreignFqn),
            "domain=<other domain> leaves out its incident (latest="
                + latest
                + "). Saw: "
                + foreign);
      }
      assertFalse(
          incidentHistory(fixture.member(), stateIdOf(admin, fixture, fixture.own())).isEmpty(),
          "the own-domain incident's history is listed");
      List<JsonNode> foreignHistory =
          incidentHistory(fixture.member(), stateIdOf(admin, fixture, fixture.foreign()));
      assertTrue(
          foreignHistory.isEmpty(),
          "the other domain's incident history is left out. Saw: " + foreignHistory);
    } finally {
      drain(cleanup);
    }
  }

  private Fixture createFixture(OpenMetadataClient admin, String prefix, Deque<Runnable> cleanup) {
    long createdFrom = System.currentTimeMillis();
    DatabaseSchema schema = createShortNamedSchema(admin, prefix, cleanup);
    DomainCase own = createDomainCase(admin, prefix + "_a", schema, cleanup);
    DomainCase foreign = createDomainCase(admin, prefix + "_b", schema, cleanup);
    OpenMetadataClient member = createTeamMember(admin, prefix + "_a", own.domain(), cleanup);
    return new Fixture(own, foreign, member, createdFrom, System.currentTimeMillis());
  }

  /** A domain with one table in it, and a test case on that table with a result and an incident. */
  private DomainCase createDomainCase(
      OpenMetadataClient admin, String name, DatabaseSchema schema, Deque<Runnable> cleanup) {
    Domain domain =
        admin
            .domains()
            .create(
                new CreateDomain()
                    .withName(name + "_domain")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withDescription("DQ time series domain scope"));
    cleanup.push(() -> admin.domains().delete(domain.getId().toString()));
    Table table =
        admin
            .tables()
            .create(
                new CreateTable()
                    .withName(name + "_tbl")
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withColumns(List.of(ID_COLUMN))
                    .withDomains(List.of(domain.getFullyQualifiedName())));
    TestCase testCase =
        admin
            .testCases()
            .create(
                new CreateTestCase()
                    .withName(name + "_tc")
                    .withEntityLink(
                        "<#E::table::" + table.getFullyQualifiedName() + "::columns::id>")
                    .withTestDefinition(NOT_NULL_TEST_DEFINITION));
    String resultText = name + " result text";
    addResult(admin, testCase, System.currentTimeMillis(), resultText);
    admin
        .testCaseResolutionStatuses()
        .create(
            new CreateTestCaseResolutionStatus()
                .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.New)
                .withTestCaseReference(testCase.getFullyQualifiedName())
                .withSeverity(Severity.Severity2));
    return new DomainCase(domain, table, testCase, resultText);
  }

  /** The issue's user_a: in a group team with the team's domain and its default roles. */
  private OpenMetadataClient createTeamMember(
      OpenMetadataClient admin, String name, Domain domain, Deque<Runnable> cleanup) {
    Role dataConsumer = admin.roles().getByName("DataConsumer");
    Role domainOnly = admin.roles().getByName("DomainOnlyAccessRole");
    Team team =
        admin
            .teams()
            .create(
                new CreateTeam()
                    .withName(name + "_team")
                    .withTeamType(CreateTeam.TeamType.GROUP)
                    .withDomains(List.of(domain.getFullyQualifiedName()))
                    .withDefaultRoles(List.of(dataConsumer.getId(), domainOnly.getId())));
    cleanup.push(() -> admin.teams().delete(team.getId().toString(), Map.of("hardDelete", "true")));
    String email = name + "_user@test.openmetadata.org";
    User user =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(name + "_user")
                    .withEmail(email)
                    .withTeams(List.of(team.getId())));
    cleanup.push(() -> admin.users().delete(user.getId()));
    return SdkClients.createClient(email, email, new String[] {});
  }

  /**
   * Creating a test case creates a test suite named after the table's FQN, so the database and
   * schema get short names to keep that name inside its column.
   */
  private DatabaseSchema createShortNamedSchema(
      OpenMetadataClient admin, String prefix, Deque<Runnable> cleanup) {
    Database database =
        admin
            .databases()
            .create(
                new CreateDatabase()
                    .withName(prefix + "_db")
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    cleanup.push(
        () ->
            admin
                .databases()
                .delete(
                    database.getId().toString(),
                    Map.of("recursive", "true", "hardDelete", "true")));
    return admin
        .databaseSchemas()
        .create(
            new CreateDatabaseSchema()
                .withName(prefix + "_sch")
                .withDatabase(database.getFullyQualifiedName()));
  }

  private void addResult(OpenMetadataClient admin, TestCase testCase, long timestamp, String text) {
    admin
        .testCaseResults()
        .create(
            testCase.getFullyQualifiedName(),
            new CreateTestCaseResult()
                .withTimestamp(timestamp)
                .withTestCaseStatus(TestCaseStatus.Success)
                .withResult(text));
  }

  /** Waits until the admin can find both results, so a missing row is never an indexing delay. */
  private void awaitResultsIndexed(OpenMetadataClient admin, Fixture fixture) {
    Awaitility.await("results of both domains are indexed")
        .atMost(SEARCH_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              for (DomainCase domainCase : List.of(fixture.own(), fixture.foreign())) {
                assertTrue(
                    listedResultTexts(admin, byTable(domainCase, false))
                        .contains(domainCase.resultText()),
                    "admin lists " + domainCase.resultText());
              }
            });
  }

  private static Map<String, String> byTable(DomainCase domainCase, boolean latest) {
    return Map.of(
        "entityFQN", domainCase.table().getFullyQualifiedName(), "latest", String.valueOf(latest));
  }

  private static Map<String, String> byTestCase(DomainCase domainCase) {
    return Map.of("testCaseFQN", domainCase.testCase().getFullyQualifiedName());
  }

  private static Map<String, String> byDomain(DomainCase domainCase) {
    return Map.of("domain", domainCase.domain().getFullyQualifiedName());
  }

  private static Map<String, String> resultWindow(Fixture fixture) {
    return Map.of(
        "startTimestamp",
        String.valueOf(fixture.createdFrom()),
        "endTimestamp",
        String.valueOf(fixture.createdTo() + WINDOW_SLACK_MS));
  }

  private Set<String> listedResultTexts(OpenMetadataClient client, Map<String, String> scope) {
    return resultTexts(listPage(client, RESULT_SEARCH_LIST_PATH, scope));
  }

  private static Set<String> resultTexts(JsonNode page) {
    Set<String> texts = new HashSet<>();
    for (JsonNode result : page.path("data")) {
      texts.add(result.path("result").asText());
    }
    return texts;
  }

  private String latestResultText(OpenMetadataClient client, Map<String, String> scope) {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                RESULT_SEARCH_LATEST_PATH,
                null,
                RequestOptions.builder().queryParams(scope).build());
    String text = null;
    if (response != null && !response.isBlank()) {
      text = readTree(response).path("result").asText(null);
    }
    return text;
  }

  private JsonNode listIncidents(
      OpenMetadataClient client, Fixture fixture, Map<String, String> scope, boolean latest) {
    Map<String, String> params = new HashMap<>(scope);
    params.put("startTs", String.valueOf(fixture.createdFrom()));
    params.put("endTs", String.valueOf(fixture.createdTo() + WINDOW_SLACK_MS));
    params.put("latest", String.valueOf(latest));
    return listPage(client, INCIDENT_LIST_PATH, params);
  }

  private static Set<String> incidentFqns(JsonNode page) {
    Set<String> fqns = new HashSet<>();
    for (JsonNode incident : page.path("data")) {
      fqns.add(incident.path("testCaseReference").path("fullyQualifiedName").asText());
    }
    return fqns;
  }

  private String stateIdOf(OpenMetadataClient admin, Fixture fixture, DomainCase domainCase) {
    String fqn = domainCase.testCase().getFullyQualifiedName();
    String stateId = null;
    for (JsonNode incident :
        listIncidents(admin, fixture, byDomain(domainCase), false).path("data")) {
      if (fqn.equals(incident.path("testCaseReference").path("fullyQualifiedName").asText())) {
        stateId = incident.path("stateId").asText();
      }
    }
    assertNotNull(stateId, "admin lists an incident of " + fqn);
    return stateId;
  }

  private List<JsonNode> incidentHistory(OpenMetadataClient client, String stateId) {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, INCIDENT_LIST_PATH + "/stateId/" + stateId, null, null);
    List<JsonNode> records = new ArrayList<>();
    readTree(response).path("data").forEach(records::add);
    return records;
  }

  /** A page of a listing; it must hold every row in scope, or a missing row would prove nothing. */
  private JsonNode listPage(OpenMetadataClient client, String path, Map<String, String> scope) {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("limit", String.valueOf(PAGE_SIZE))
            .queryParams(scope)
            .build();
    JsonNode page =
        readTree(client.getHttpClient().executeForString(HttpMethod.GET, path, null, options));
    assertTrue(
        page.path("paging").path("total").asInt() <= PAGE_SIZE,
        "every row in scope fits one page of " + path + ": " + page.path("paging"));
    return page;
  }

  private static JsonNode readTree(String json) {
    try {
      return MAPPER.readTree(json);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Unreadable response: " + json, e);
    }
  }

  private void enableSearchAccessControl(OpenMetadataClient admin, Deque<Runnable> cleanup)
      throws Exception {
    String path = "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value();
    Settings settings =
        MAPPER.readValue(
            admin
                .getHttpClient()
                .executeForString(HttpMethod.GET, path, null, RequestOptions.builder().build()),
            Settings.class);
    SearchSettings searchSettings =
        MAPPER.convertValue(settings.getConfigValue(), SearchSettings.class);
    boolean wasEnabled =
        Boolean.TRUE.equals(searchSettings.getGlobalSettings().getEnableAccessControl());
    searchSettings.getGlobalSettings().setEnableAccessControl(true);
    admin
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/system/settings",
            MAPPER.writeValueAsString(
                new Settings()
                    .withConfigType(SettingsType.SEARCH_SETTINGS)
                    .withConfigValue(searchSettings)),
            RequestOptions.builder().build());
    if (!wasEnabled) {
      cleanup.push(
          () ->
              admin
                  .getHttpClient()
                  .executeForString(
                      HttpMethod.PUT,
                      "/v1/system/settings/reset/" + SettingsType.SEARCH_SETTINGS.value(),
                      null,
                      RequestOptions.builder().build()));
    }
  }

  private static void drain(Deque<Runnable> cleanup) {
    while (!cleanup.isEmpty()) {
      try {
        cleanup.pop().run();
      } catch (RuntimeException e) {
        // Teardown is best effort: every entity is named by the namespace, so a leftover is
        // harmless.
      }
    }
  }
}
