package org.openmetadata.playwright.scenarios.observability;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.microsoft.playwright.assertions.PlaywrightAssertions;
import com.microsoft.playwright.options.AriaRole;
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
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.TestCases;

/**
 * Java port of {@code IncidentManager.spec.ts → "Validate Incident Tab in Entity
 * details page"}. Verifies the Profiler → Incidents tab on the table page lists every
 * test case with an open incident. Reindex testCases → re-render → all rows still
 * present.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "INCIDENT_MANAGER", mode = ResourceAccessMode.READ_WRITE)
class IncidentTabOnEntityPageReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    TestCases.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void incidentsTabRendersOpenIncidents(final UiSession ui, final TestNamespace ns) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final Table table = ShortStackFactory.table(ns);
    final String shortId = ns.uniqueShortId();
    final List<TestCase> cases = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      final TestCase tc =
          TestCases.create()
              .name("tc_inc_tab_" + shortId + "_" + i)
              .forTable(table)
              .testDefinition("tableRowCountToEqual")
              .parameter("value", String.valueOf(i + 1))
              .description("incident-tab seed " + i)
              .execute();
      final CreateTestCaseResult failed = new CreateTestCaseResult();
      failed.setTimestamp(System.currentTimeMillis());
      failed.setTestCaseStatus(TestCaseStatus.Failed);
      failed.setResult("Seeded failure");
      client.testCaseResults().create(tc.getFullyQualifiedName(), failed);
      cases.add(tc);
    }

    runIncidentsTabFlow(ui, table.getFullyQualifiedName(), cases);

    reindex.recreateAndAwait("testCase", cases);

    runIncidentsTabFlow(ui, table.getFullyQualifiedName(), cases);
  }

  private static void runIncidentsTabFlow(
      final UiSession ui, final String tableFqn, final List<TestCase> cases) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl("/table/" + tableFqn + "/profiler/data-quality"));
    page.waitForLoadState();

    page.waitForResponse(
        r -> r.url().contains("/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list"),
        () ->
            page.getByRole(
                    AriaRole.TAB,
                    new Page.GetByRoleOptions()
                        .setName(
                            java.util.regex.Pattern.compile(
                                "incidents", java.util.regex.Pattern.CASE_INSENSITIVE)))
                .click());

    final LocatorAssertions.IsVisibleOptions opts =
        new LocatorAssertions.IsVisibleOptions().setTimeout(20_000);
    for (final TestCase tc : cases) {
      PlaywrightAssertions.assertThat(page.getByTestId("test-case-" + tc.getName()))
          .isVisible(opts);
    }
    page.close();
  }
}
