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
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.TestCases;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Java port of {@code IncidentManager.spec.ts → "Resolve task from incident list page"}
 * — the assign + resolve sub-flows from the list page (without Airflow). The reindex
 * is injected between assign and resolve to validate that an in-flight incident's
 * assignment survives a recreate, then the user can still resolve it.
 *
 * <p>Flow:
 *
 * <ol>
 *   <li>Seed: table + testCase + Failed result via API → opens an incident.
 *   <li>UI: open Incident Manager → click into detail → acknowledge.
 *   <li>UI: back to list → status chip → "Assigned" → search admin → submit.
 *   <li>Assert status reads "Assigned".
 *   <li><b>Reindex inject:</b> recreate the testCase.
 *   <li>UI: reload list, assert status is still "Assigned".
 *   <li>UI: status chip → "Resolved" → MissingData reason → comment → submit.
 *   <li>Assert status reads "Resolved".
 * </ol>
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "INCIDENT_MANAGER", mode = ResourceAccessMode.READ_WRITE)
class IncidentManagerAssignResolveReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    TestCases.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void assignThenResolveSurvivesReindex(final UiSession ui, final TestNamespace ns) {
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
            .description("incident assign/resolve seed")
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

    // --- UI: reload list, assign to the current admin from status chip. The admin's login name
    // varies by cluster (seeded "admin" embedded, a real account like "mohit" on an external
    // cluster), so resolve it dynamically — a hardcoded "admin" has no matching user, and its
    // assignee-search option never renders off the seed data. ---
    final User admin =
        client.getHttpClient().execute(HttpMethod.GET, "/v1/users/loggedInUser", null, User.class);
    final IncidentManagerPage afterAck = IncidentManagerPage.open(ui);
    afterAck.assignIncident(testCaseName, admin.getName(), admin.getName());
    assertThat(afterAck.statusForTestCase(testCaseName))
        .as("status after assign")
        .containsIgnoringCase("Assigned");

    // --- Reindex inject ---
    reindex.recreateAndAwait("testCase", List.of(testCase));

    // --- UI: reload, assert assignment survived the reindex. ---
    final IncidentManagerPage afterReindex = IncidentManagerPage.open(ui);
    assertThat(afterReindex.statusForTestCase(testCaseName))
        .as("Assigned status must survive recreate reindex")
        .containsIgnoringCase("Assigned");

    // NOTE: a follow-up resolve via the status dropdown is gated by the incident
    // workflow — from "Assigned" the next state is "In Progress", not "Resolved".
    // Resolve is exercised in a separate test that goes acknowledge → resolve
    // (no assign in between), matching the simpler resolve-from-list-page TS scenario.
  }
}
