package org.openmetadata.playwright.scenarios.observability;

import static org.assertj.core.api.Assertions.assertThat;

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
 * Java port of {@code IncidentManager.spec.ts → "Resolve task from incident list page"}
 * — the simpler resolve flow (acknowledge → resolve, no assign in between). Reindex is
 * injected after the acknowledge so the resolve is exercised against a freshly
 * reindexed testCase doc.
 *
 * <p>Flow:
 *
 * <ol>
 *   <li>Seed: table + testCase + Failed result via API.
 *   <li>UI: open Incident Manager → click into detail → acknowledge.
 *   <li><b>Reindex inject:</b> recreate the testCase.
 *   <li>UI: reload list, assert "Ack" survived.
 *   <li>UI: status chip → "Resolved" → MissingData reason → comment → submit.
 *   <li>Assert badge reads "Resolved".
 * </ol>
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "INCIDENT_MANAGER", mode = ResourceAccessMode.READ_WRITE)
class IncidentManagerResolveReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    TestCases.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void resolveSurvivesReindexOfAck(final UiSession ui, final TestNamespace ns) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final Table table = ShortStackFactory.table(ns);
    final String shortId = ns.uniqueShortId();
    final String testCaseName = "tc_res_" + shortId;

    final TestCase testCase =
        TestCases.create()
            .name(testCaseName)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "1")
            .description("incident resolve seed")
            .execute();

    final CreateTestCaseResult failedResult = new CreateTestCaseResult();
    failedResult.setTimestamp(System.currentTimeMillis());
    failedResult.setTestCaseStatus(TestCaseStatus.Failed);
    failedResult.setResult("Seeded failure");
    client.testCaseResults().create(testCase.getFullyQualifiedName(), failedResult);

    // --- UI: acknowledge from detail page. ---
    IncidentManagerPage.open(ui)
        .assertIncidentVisible(testCaseName)
        .openIncidentDetail(testCaseName)
        .acknowledgeFromDetail();

    // --- Reindex inject ---
    reindex.recreateAndAwait("testCase", List.of(testCase));

    // --- UI: reload list, assert Ack survived, then resolve. ---
    final IncidentManagerPage afterReindex = IncidentManagerPage.open(ui);
    assertThat(afterReindex.statusForTestCase(testCaseName))
        .as("Acknowledge must survive recreate reindex")
        .containsIgnoringCase("Ack");

    afterReindex.resolveIncident(testCaseName, "Resolved by UIIT");
    assertThat(afterReindex.statusForTestCase(testCaseName))
        .as("status after resolve")
        .containsIgnoringCase("Resolved");
  }
}
