package org.openmetadata.playwright.scenarios.search.reindex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.microsoft.playwright.assertions.PlaywrightAssertions;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.playwright.ui.pages.DataQualityListPage;
import org.openmetadata.playwright.ui.pages.ExplorePage;
import org.openmetadata.playwright.ui.pages.ExplorePage.Tab;
import org.openmetadata.playwright.ui.pages.SearchIndexAppPage;
import org.openmetadata.playwright.ui.pages.TablePage;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.api.data.CreateSpreadsheet;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateWorksheet;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.CreateDriveService;
import org.openmetadata.schema.api.services.CreateDriveService.DriveServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.services.connections.drive.GoogleDriveConnection;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DailyCount;
import org.openmetadata.schema.type.DriveConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityUsage;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Regression gate for the selective-field reindex path (PR #27723).
 *
 * <p>Reindex fetches only the fields declared in each {@code *Index.getRequiredReindexFields()};
 * live indexing fetches the full entity payload. A field that the UI consumes via the search
 * index but isn't in the declared set will disappear from {@code _source} on full reindex,
 * while the UI keeps working between change events. Several such regressions shipped in
 * 1.12.7 / 1.13.0 (Novartis queries-tab, worksheet column-name search). This test seeds the
 * smallest fixture that exercises every UI-coverable field added to a
 * {@code getRequiredReindexFields()} override, then asserts each surface twice: once before
 * reindex (live-indexing baseline — should always pass) and once after reindex (the actual
 * regression gate).
 *
 * <p>Flow:
 *
 * <ol>
 *   <li>Seed via SDK: one Table (with a uniquely-named column and a PK constraint), one
 *       Query pointing to that Table via {@code queryUsedIn}, one TestCase tied to the
 *       Table plus a Success {@code TestCaseResult} (which also auto-creates the basic
 *       TestSuite), and one Worksheet with a uniquely-named column.
 *   <li>Assert all UI surfaces — proves the live-indexing path populates them. Failure
 *       here points at seed shape, not reindex.
 *   <li>Trigger reindex via {@code /settings/apps/SearchIndexingApplication} and block on
 *       {@code Success}.
 *   <li>Assert the same UI surfaces — the regression gate.
 * </ol>
 *
 * <p>UI-coverable fields gated by this test (entity → field added to required reindex set
 * → search-backed UI surface):
 *
 * <ul>
 *   <li>{@code TableIndex.columns} → Explore → Tables column-name search.
 *   <li>{@code QueryIndex.queryUsedIn} → Table → Queries tab.
 *   <li>{@code TestCaseIndex.testSuite/testCaseResult} → DQ → Test Cases list presence.
 *   <li>{@code TestSuiteIndex.summary} → DQ → Test Suites list presence (basic suite).
 *   <li>{@code WorksheetIndex.columns} → Explore → Worksheets column-name search.
 *   <li><strong>Suspected gap</strong> — {@code TableIndex} does <em>not</em> currently request
 *       {@code usageSummary}, but {@code TableRepository.clearFields} nulls it when not
 *       requested. The UI Explore → Tables "Sort by Weekly Usage" surface reads
 *       {@code _source.usageSummary.weeklyStats.count} (see
 *       {@code tableSortingFields} in {@code explore.constants.ts}). Until
 *       {@code TableIndex.getRequiredReindexFields()} adds {@code "usageSummary"} this test
 *       fails AFTER reindex — that's the regression gate. Tracked via a separate one-line
 *       OM fix PR.
 * </ul>
 *
 * <p>Fields added back defensively without a UI surface backed by search ({@code
 * Table.schemaDefinition}, {@code Table.tableConstraints}, {@code File.columns}, {@code
 * DynamicAgent.persona}, {@code Dashboard.charts}, {@code Pipeline.tasks}, {@code
 * Container.dataModel}, {@code Spreadsheet.worksheets}, {@code Database.usageSummary},
 * {@code GlossaryTerm.relatedTerms}, {@code IngestionPipeline.pipelineStatuses}, {@code
 * User.teams/roles}, {@code Team.parents}, {@code Page.*}) are not covered: their detail
 * tabs read directly from the REST entity API, or no UI surface queries them via search
 * (e.g. {@code FileIndex.getFields()} doesn't weight {@code columns.*}). Gating those
 * regressions belongs in an {@code /api/v1/search/query} {@code _source}-shape test under
 * {@code org.openmetadata.it.tests.search}, not here.
 *
 * <p>Tagged {@link ResourceLock} on {@code SEARCH_INDEX_APP} so this serializes against the
 * sibling reindex tests.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class SelectiveFieldReindexUIIT {

  private static final Logger LOG = LoggerFactory.getLogger(SelectiveFieldReindexUIIT.class);

  private static final Duration REINDEX_TIMEOUT = Duration.ofMinutes(10);
  private static final String STATUS_SUCCESS = "Success";

  // Pattern adopted from SimpleReindexTriggerUIIT: "Run Now" Success means the app finished,
  // but ES refresh on the new shards can lag a beat — and the Explore tab list filters out
  // tabs whose hit count is zero, so a not-yet-refreshed search returns a missing tab testid
  // (not just a 0 count). Re-issuing the navigation on each tick lets the assertion absorb
  // that lag instead of failing at the first Playwright timeout.
  private static final Duration UI_ASSERT_TIMEOUT = Duration.ofMinutes(2);
  private static final Duration UI_ASSERT_POLL_INTERVAL = Duration.ofSeconds(3);
  // Inner Playwright assertion timeout — short, since the Awaitility retry handles the long
  // wait. Long inner timeouts would only fire once and miss the next ES refresh.
  private static final Duration INNER_ASSERT_TIMEOUT = Duration.ofSeconds(5);

  // Built-in test definition used for the seeded TestCase. Choice is arbitrary as long as
  // the definition exists in the bootstrap data — we never actually run the test.
  private static final String SEED_TEST_DEFINITION = "tableRowCountToEqual";
  private static final String SEED_TEST_DEFINITION_PARAM_NAME = "value";
  private static final String SEED_TEST_DEFINITION_PARAM_VALUE = "100";

  // Path used by the SDK's HTTP client to create a DriveService — there's no fluent helper
  // for DriveService creation in the SDK, so we POST directly. Mirrors the pattern in
  // DriveServiceTestFactory.
  private static final String DRIVE_SERVICES_PATH = "/v1/services/driveServices";

  // Daily usage we POST against the seeded table so weeklyStats.count is non-zero. The exact
  // count value doesn't matter — only that _source.usageSummary.weeklyStats.count > 0 after
  // live indexing (BEFORE) and stays > 0 after reindex (AFTER) once the OM fix lands.
  private static final int SEED_USAGE_COUNT = 100;

  // Reused for parsing the /api/v1/search/query response.
  private static final ObjectMapper JSON_MAPPER = new ObjectMapper();

  @Test
  void selectiveFieldReindexPreservesUiCriticalFields(final UiSession ui, final TestNamespace ns) {
    final SeededFixtures fixtures = seed(ns);

    assertUiSurfaces(ui, fixtures, "BEFORE reindex (live-indexing baseline)");

    LOG.info("Triggering reindex via SearchIndexingApplication");
    SearchIndexAppPage.open(ui).triggerAndWaitForStatus(STATUS_SUCCESS, REINDEX_TIMEOUT);
    LOG.info("Reindex completed");

    assertUiSurfaces(ui, fixtures, "AFTER reindex (selective-field regression gate)");
  }

  private static void assertUiSurfaces(
      final UiSession ui, final SeededFixtures fixtures, final String phase) {
    LOG.info("Asserting UI surfaces — {}", phase);
    assertTableSearchableByColumnName(ui, fixtures, phase);
    assertQueryRendersOnTableQueriesTab(ui, fixtures, phase);
    assertWorksheetSearchableByColumnName(ui, fixtures, phase);
    assertTestCaseAppearsInDqList(ui, fixtures, phase);
    assertTestSuiteAppearsInDqList(ui, fixtures, phase);
    assertTableUsageSummaryInSource(ui, fixtures, phase);
  }

  private static void assertTableSearchableByColumnName(
      final UiSession ui, final SeededFixtures fixtures, final String phase) {
    final String description =
        "TableIndex.columns → Explore[Tables] search by '"
            + fixtures.tableColumnMarker
            + "' — "
            + phase;
    LOG.info("Asserting {}", description);
    pollUiAssertion(
        description,
        () -> {
          final ExplorePage explore =
              ExplorePage.openWithSearch(ui, Tab.TABLES, fixtures.tableColumnMarker);
          explore.assertCountForTab(Tab.TABLES, 1);
        });
  }

  private static void assertQueryRendersOnTableQueriesTab(
      final UiSession ui, final SeededFixtures fixtures, final String phase) {
    final String description =
        "QueryIndex.queryUsedIn → Table[" + fixtures.tableFqn + "] Queries tab — " + phase;
    LOG.info("Asserting {}", description);
    pollUiAssertion(
        description,
        () -> {
          final TablePage table = TablePage.open(ui, fixtures.tableFqn);
          table.openQueriesTab();
          PlaywrightAssertions.assertThat(table.queryCards().first())
              .isVisible(
                  new LocatorAssertions.IsVisibleOptions()
                      .setTimeout(INNER_ASSERT_TIMEOUT.toMillis()));
        });
  }

  private static void assertWorksheetSearchableByColumnName(
      final UiSession ui, final SeededFixtures fixtures, final String phase) {
    final String description =
        "WorksheetIndex.columns → Explore[Worksheets] search by '"
            + fixtures.worksheetColumnMarker
            + "' — "
            + phase;
    LOG.info("Asserting {}", description);
    pollUiAssertion(
        description,
        () -> {
          final ExplorePage explore =
              ExplorePage.openWithSearch(ui, Tab.WORKSHEETS, fixtures.worksheetColumnMarker);
          explore.assertCountForTab(Tab.WORKSHEETS, 1);
        });
  }

  private static void assertTestCaseAppearsInDqList(
      final UiSession ui, final SeededFixtures fixtures, final String phase) {
    final String description =
        "TestCaseIndex.testSuite/testCaseResult → DQ Test Cases list shows '"
            + fixtures.testCaseName
            + "' — "
            + phase;
    LOG.info("Asserting {}", description);
    pollUiAssertion(
        description,
        () ->
            DataQualityListPage.open(ui)
                .searchByName(fixtures.testCaseName)
                .assertTestCaseVisible(fixtures.testCaseName));
  }

  /**
   * Asserts {@code _source.usageSummary.weeklyStats.count > 0} on the table's search doc.
   * Uses the UiSession's authenticated request context to hit {@code /api/v1/search/query}
   * directly — the UI surface that depends on this field is Explore → Tables "Sort by Weekly
   * Usage", which doesn't visibly render the count, so a DOM-only assertion can't cleanly
   * distinguish "field dropped" from "field present but tied with others". The {@code
   * _source} shape is the cleanest signal.
   */
  private static void assertTableUsageSummaryInSource(
      final UiSession ui, final SeededFixtures fixtures, final String phase) {
    final String description =
        "TableIndex.usageSummary → table_search_index._source.usageSummary.weeklyStats.count"
            + " for '"
            + fixtures.tableName
            + "' — "
            + phase;
    LOG.info("Asserting {}", description);
    pollUiAssertion(
        description,
        () -> {
          // Query the search API through the authenticated SDK HTTP client, not the
          // browser's APIRequestContext: auth is injected into localStorage (read by the
          // SPA), and ui.context().request() doesn't run page JS so it sends no Bearer
          // header -> 401. The _source shape is identical regardless of caller.
          final String path =
              "/v1/search/query?q="
                  + URLEncoder.encode(fixtures.tableName, StandardCharsets.UTF_8)
                  + "&index=table_search_index&from=0&size=1";
          final Object raw =
              ui.server().sdk().getHttpClient().execute(HttpMethod.GET, path, null, Object.class);
          final JsonNode body = JSON_MAPPER.valueToTree(raw);
          final JsonNode count = body.at("/hits/hits/0/_source/usageSummary/weeklyStats/count");
          if (count.isMissingNode() || count.isNull() || count.asLong() <= 0) {
            throw new AssertionError(
                "Expected _source.usageSummary.weeklyStats.count > 0 for table '"
                    + fixtures.tableName
                    + "', got: "
                    + count
                    + ". If this only fails AFTER reindex, TableIndex.getRequiredReindexFields()"
                    + " is missing \"usageSummary\".");
          }
        });
  }

  private static void assertTestSuiteAppearsInDqList(
      final UiSession ui, final SeededFixtures fixtures, final String phase) {
    final String description =
        "TestSuiteIndex.summary → DQ Test Suites list shows basic suite for '"
            + fixtures.tableFqn
            + "' — "
            + phase;
    LOG.info("Asserting {}", description);
    // Search by the table's leaf name (no dots — tokenizes cleanly in the search API) but
    // assert by the link's visible text, which renders the table FQN per
    // TestSuites.component.tsx:renderNameCell. The suite's own `record.name` is the long
    // dotted form which makes a testid-based match brittle.
    pollUiAssertion(
        description,
        () ->
            DataQualityListPage.open(ui)
                .openTestSuitesTab()
                .searchTestSuiteByName(fixtures.tableName)
                .assertTestSuiteVisible(fixtures.tableFqn));
  }

  private static void pollUiAssertion(final String description, final Runnable assertion) {
    Awaitility.await(description)
        .atMost(UI_ASSERT_TIMEOUT)
        .pollInterval(UI_ASSERT_POLL_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreNoExceptions()
        .untilAsserted(assertion::run);
  }

  private static SeededFixtures seed(final TestNamespace ns) {
    // Short, namespace-unique id used for every seeded entity name. The basic TestSuite
    // auto-created for the table has name `<table.fqn>.testSuite`; with the long
    // TestNamespace.prefix("...") shape this overflows the MySQL test_suite.name column.
    // TestCaseResourceIT.createTable uses the same short-name pattern.
    final String shortId = ns.uniqueShortId();
    LOG.info("Seeding entities for selective-field reindex coverage (shortId={})", shortId);

    final DatabaseService dbService = createShortPostgresService(shortId);
    final DatabaseSchema schema = createShortSchema(shortId, dbService);

    final String tableColumnMarker = "tcol" + shortId;
    final Table table = createTable(shortId, schema.getFullyQualifiedName(), tableColumnMarker);
    reportTableUsage(table);
    createQueryLinkedTo(shortId, dbService.getFullyQualifiedName(), table);
    final TestCaseSeed testCaseSeed = createTestCaseWithResult(shortId, table);

    final DriveService driveService = createShortDriveService(shortId);
    final String worksheetColumnMarker = "wcol" + shortId;
    createWorksheetWithColumnMarker(
        shortId, driveService.getFullyQualifiedName(), worksheetColumnMarker);

    return new SeededFixtures(
        table.getFullyQualifiedName(),
        table.getName(),
        tableColumnMarker,
        worksheetColumnMarker,
        testCaseSeed.testCaseName,
        testCaseSeed.testSuiteName);
  }

  private static DatabaseService createShortPostgresService(final String shortId) {
    final PostgresConnection postgres =
        new PostgresConnection().withHostPort("localhost:5432").withUsername("test");
    final CreateDatabaseService request =
        new CreateDatabaseService()
            .withName("pg_" + shortId)
            .withServiceType(DatabaseServiceType.Postgres)
            .withConnection(new DatabaseConnection().withConfig(postgres))
            .withDescription("Selective-field reindex seed");
    return SdkClients.adminClient().databaseServices().create(request);
  }

  private static DatabaseSchema createShortSchema(
      final String shortId, final DatabaseService dbService) {
    final Database database =
        SdkClients.adminClient()
            .databases()
            .create(
                new CreateDatabase()
                    .withName("db_" + shortId)
                    .withService(dbService.getFullyQualifiedName()));
    return SdkClients.adminClient()
        .databaseSchemas()
        .create(
            new CreateDatabaseSchema()
                .withName("s_" + shortId)
                .withDatabase(database.getFullyQualifiedName()));
  }

  private static Table createTable(
      final String shortId, final String schemaFqn, final String columnMarker) {
    final Column idColumn = new Column().withName("id").withDataType(ColumnDataType.BIGINT);
    final Column markerColumn =
        new Column().withName(columnMarker).withDataType(ColumnDataType.STRING);
    final TableConstraint primaryKey =
        new TableConstraint()
            .withConstraintType(TableConstraint.ConstraintType.PRIMARY_KEY)
            .withColumns(List.of(idColumn.getName()));
    final CreateTable request =
        new CreateTable()
            .withName("t_" + shortId)
            .withDatabaseSchema(schemaFqn)
            .withColumns(List.of(idColumn, markerColumn))
            .withTableConstraints(List.of(primaryKey));
    return SdkClients.adminClient().tables().create(request);
  }

  /**
   * Reports a daily usage count against the seeded table so the change-event indexing path
   * populates {@code _source.usageSummary.weeklyStats.count}. The AFTER-reindex check then
   * verifies the field survives the selective-fields reindex path.
   */
  private static void reportTableUsage(final Table table) {
    final DailyCount usage =
        new DailyCount().withDate(LocalDate.now().toString()).withCount(SEED_USAGE_COUNT);
    try {
      SdkClients.adminClient()
          .getHttpClient()
          .execute(HttpMethod.POST, "/v1/usage/table/" + table.getId(), usage, EntityUsage.class);
    } catch (final OpenMetadataException e) {
      throw new IllegalStateException("Failed to POST daily usage for table " + table.getName(), e);
    }
  }

  private static void createQueryLinkedTo(
      final String shortId, final String dbServiceFqn, final Table table) {
    // EntityReference.type is @NotNull and table.getEntityReference() can come back with a
    // null type (the SDK-returned Table's class name doesn't resolve in the canonical-name
    // map), which 400s queryUsedIn validation. Build the ref with the type set explicitly.
    final EntityReference tableRef =
        new EntityReference()
            .withId(table.getId())
            .withType("table")
            .withName(table.getName())
            .withFullyQualifiedName(table.getFullyQualifiedName());
    final CreateQuery request =
        new CreateQuery()
            .withName("q_" + shortId)
            .withQuery("SELECT * FROM " + table.getName())
            .withQueryUsedIn(List.of(tableRef))
            .withService(dbServiceFqn)
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());
    SdkClients.adminClient().queries().create(request);
  }

  /**
   * Creates a basic TestCase tied to the table (server auto-creates the basic TestSuite),
   * pushes a Success TestCaseResult so {@code testCaseResult} is non-null, then refetches
   * with {@code fields=testSuite} so we know the auto-created suite's name to assert
   * against later.
   */
  private static TestCaseSeed createTestCaseWithResult(final String shortId, final Table table) {
    final TestCase created =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name("tc_" + shortId)
            .forTable(table)
            .testDefinition(SEED_TEST_DEFINITION)
            .parameter(SEED_TEST_DEFINITION_PARAM_NAME, SEED_TEST_DEFINITION_PARAM_VALUE)
            .create();

    final CreateTestCaseResult result =
        new CreateTestCaseResult()
            .withTimestamp(System.currentTimeMillis())
            .withTestCaseStatus(TestCaseStatus.Success)
            .withResult("Seeded by SelectiveFieldReindexUIIT");
    SdkClients.adminClient().testCaseResults().create(created.getFullyQualifiedName(), result);

    final TestCase withSuite =
        SdkClients.adminClient().testCases().get(created.getId().toString(), "testSuite");
    return new TestCaseSeed(created.getName(), withSuite.getTestSuite().getName());
  }

  private static DriveService createShortDriveService(final String shortId) {
    final CreateDriveService request =
        new CreateDriveService()
            .withName("ds_" + shortId)
            .withServiceType(DriveServiceType.GoogleDrive)
            .withConnection(new DriveConnection().withConfig(new GoogleDriveConnection()))
            .withDescription("Selective-field reindex seed");
    try {
      return SdkClients.adminClient()
          .getHttpClient()
          .execute(HttpMethod.POST, DRIVE_SERVICES_PATH, request, DriveService.class);
    } catch (final OpenMetadataException e) {
      throw new IllegalStateException("Failed to create DriveService for seed", e);
    }
  }

  private static void createWorksheetWithColumnMarker(
      final String shortId, final String driveServiceFqn, final String columnMarker) {
    final Spreadsheet spreadsheet =
        SdkClients.adminClient()
            .spreadsheets()
            .create(new CreateSpreadsheet().withName("sh_" + shortId).withService(driveServiceFqn));
    final Column markerColumn =
        new Column().withName(columnMarker).withDataType(ColumnDataType.STRING);
    final CreateWorksheet request =
        new CreateWorksheet()
            .withName("ws_" + shortId)
            .withSpreadsheet(spreadsheet.getFullyQualifiedName())
            .withColumns(List.of(markerColumn));
    SdkClients.adminClient().worksheets().create(request);
  }

  private record SeededFixtures(
      String tableFqn,
      String tableName,
      String tableColumnMarker,
      String worksheetColumnMarker,
      String testCaseName,
      String testSuiteName) {}

  private record TestCaseSeed(String testCaseName, String testSuiteName) {}
}
