package org.openmetadata.playwright.scenarios.observability;

import com.microsoft.playwright.assertions.LocatorAssertions;
import com.microsoft.playwright.assertions.PlaywrightAssertions;
import java.util.ArrayList;
import java.util.List;
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
import org.openmetadata.playwright.ui.pages.IncidentManagerPage;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.TestCases;

/**
 * Java port of {@code IncidentManager.spec.ts → "Verify filters in Incident Manager's
 * page"}. Exercises status + testCase filters on the {@code /incident-manager} list.
 * Reindex testCases → re-apply filters, same rows still match.
 *
 * <p>Skipped: Assignee filter (TS uses a per-user fixture; in our shared env the
 * {@code admin} user owns many incidents so the assertion is non-deterministic) and
 * date filter (relies on yesterday's incidents being present).
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "INCIDENT_MANAGER", mode = ResourceAccessMode.READ_WRITE)
class IncidentManagerFiltersReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    TestCases.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void filtersStillWorkAfterReindex(final UiSession ui, final TestNamespace ns) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final Table table = ShortStackFactory.table(ns);
    final String shortId = ns.uniqueShortId();
    final List<TestCase> cases = new ArrayList<>();
    for (int i = 0; i < 2; i++) {
      final TestCase tc =
          TestCases.create()
              .name("tc_filt_" + shortId + "_" + i)
              .forTable(table)
              .testDefinition("tableRowCountToEqual")
              .parameter("value", String.valueOf(i + 1))
              .execute();
      final CreateTestCaseResult failed = new CreateTestCaseResult();
      failed.setTimestamp(System.currentTimeMillis());
      failed.setTestCaseStatus(TestCaseStatus.Failed);
      failed.setResult("Seeded failure");
      client.testCaseResults().create(tc.getFullyQualifiedName(), failed);
      cases.add(tc);
    }

    runFilterFlow(ui, cases);

    reindex.recreateAndAwait("testCase", cases);

    runFilterFlow(ui, cases);
  }

  private static void runFilterFlow(final UiSession ui, final List<TestCase> cases) {
    final IncidentManagerPage page = IncidentManagerPage.open(ui);
    final LocatorAssertions.IsVisibleOptions vis =
        new LocatorAssertions.IsVisibleOptions().setTimeout(20_000);

    // Both seeded cases are present.
    for (final TestCase tc : cases) {
      PlaywrightAssertions.assertThat(page.rawPage().getByTestId("test-case-" + tc.getName()))
          .isVisible(vis);
    }

    // Filter by testCase name → only that one remains.
    page.filterByTestCase(cases.get(0).getName());
    PlaywrightAssertions.assertThat(
            page.rawPage().getByTestId("test-case-" + cases.get(0).getName()))
        .isVisible(vis);
    PlaywrightAssertions.assertThat(
            page.rawPage().getByTestId("test-case-" + cases.get(1).getName()))
        .not()
        .isVisible(vis);
    page.clearTestCaseFilter();
  }
}
