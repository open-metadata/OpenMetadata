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
 * Java port of {@code IncidentManager.spec.ts → "Acknowledge table test case's failure"}
 * (without the Airflow pipeline dependency — the failure is injected via the
 * {@code testCaseResults} API). Reindex injected after the UI acknowledge.
 *
 * <p>Flow:
 *
 * <ol>
 *   <li>API seed: short-named table → testCase → POST a Failed result; that triggers
 *       an open incident.
 *   <li>UI: open Incident Manager, assert the row appears within 60 s.
 *   <li>UI: click into the test case → Incident tab → open resolution editor → set
 *       status to "Ack" → confirm.
 *   <li><b>Reindex inject:</b> recreate the testCase via SDK.
 *   <li>UI: reload Incident Manager, assert the row is still listed and the status
 *       reads "Ack" (acknowledge state survived reindex).
 * </ol>
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "INCIDENT_MANAGER", mode = ResourceAccessMode.READ_WRITE)
class IncidentManagerAcknowledgeReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    TestCases.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void acknowledgeFlowSurvivesReindex(final UiSession ui, final TestNamespace ns) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final Table table = ShortStackFactory.table(ns);
    final String shortId = ns.uniqueShortId();
    final String testCaseName = "tc_inc_" + shortId;

    final TestCase testCase =
        TestCases.create()
            .name(testCaseName)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "1")
            .description("incident seed")
            .execute();

    // Inject a Failed result so an incident is opened automatically.
    final CreateTestCaseResult failedResult = new CreateTestCaseResult();
    failedResult.setTimestamp(System.currentTimeMillis());
    failedResult.setTestCaseStatus(TestCaseStatus.Failed);
    failedResult.setResult("Seeded failure for incident UIIT");
    client.testCaseResults().create(testCase.getFullyQualifiedName(), failedResult);

    // --- UI: open Incident Manager, assert the incident row appears, acknowledge it. ---
    final IncidentManagerPage list = IncidentManagerPage.open(ui);
    list.assertIncidentVisible(testCaseName)
        .openIncidentDetail(testCaseName)
        .acknowledgeFromDetail();

    // --- Reindex inject ---
    reindex.recreateAndAwait("testCase", List.of(testCase));

    // --- UI verification: row still listed, status reads "Ack". ---
    final IncidentManagerPage afterReindex = IncidentManagerPage.open(ui);
    afterReindex.assertIncidentVisible(testCaseName);
    final String status = afterReindex.statusForTestCase(testCaseName);
    assertThat(status)
        .as("Acknowledged status must survive recreate reindex of the testCase")
        .containsIgnoringCase("Ack");
  }
}
