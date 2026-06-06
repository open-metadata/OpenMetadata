package org.openmetadata.playwright.scenarios.observability;

import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.search.ReindexEntitiesClient;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.it.util.UiTestServer;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.playwright.ui.pages.BundleTestSuitePage;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.TestCases;

/**
 * Java port of {@code TestSuiteDetailsPage.spec.ts → "Add test case modal on Test Suite
 * details page - filters and select"}.
 *
 * <p>Flow:
 *
 * <ol>
 *   <li>Seed: table + 2 testCases via SDK.
 *   <li>UI: open bundle-suites page → click Add Test Suite → fill name + description
 *       → search for testCase → click row → submit. Wait for testSuites POST.
 *   <li>UI: navigate to {@code /test-suites/<name>} → click Add Test Case button →
 *       wait for modal list response.
 *   <li>Assert 4 modal filter dropdowns visible (Status, Test Type, Table, Column).
 *   <li>Toggle select-all on/off; assert first row checkbox state matches.
 *   <li>Cancel modal; assert dialog gone.
 *   <li><b>Reindex testCases via SDK</b> → re-open detail page → re-open modal →
 *       assert dropdowns + select-all still work.
 * </ol>
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "TEST_SUITE_DETAILS", mode = ResourceAccessMode.READ_WRITE)
class TestSuiteDetailsPageReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    TestCases.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void addTestCaseModalSurvivesReindex(final UiSession ui, final TestNamespace ns) {
    final Table table = ShortStackFactory.table(ns);
    final String shortId = ns.uniqueShortId();
    final TestCase tc1 =
        TestCases.create()
            .name("tc_bts_" + shortId + "_1")
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "10")
            .description("bundle suite seed 1")
            .execute();
    final TestCase tc2 =
        TestCases.create()
            .name("tc_bts_" + shortId + "_2")
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "20")
            .description("bundle suite seed 2")
            .execute();
    reindex.awaitIndexed("testCase", java.util.List.of(tc1, tc2));

    final String suiteName = "ts_bd_" + UUID.randomUUID().toString().substring(0, 8);
    BundleTestSuitePage.openCreateForm(ui)
        .fillNameDescriptionAndAttach(suiteName, "bundle suite e2e", tc1.getName());

    runDetailModalFlow(ui, suiteName);

    // Reindex the seeded testCases — verify the modal still functions after rebuild.
    reindex.recreateAndAwait("testCase", java.util.List.of(tc1, tc2));

    runDetailModalFlow(ui, suiteName);
  }

  private static void runDetailModalFlow(final UiSession ui, final String suiteName) {
    BundleTestSuitePage.openCreateForm(ui)
        .openDetail(suiteName)
        .openAddTestCaseModal()
        .assertModalFilterDropdownsVisible()
        .exerciseSelectAllToggle()
        .cancelAddModal();
  }
}
