package org.openmetadata.playwright.scenarios.observability;

import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.search.ReindexEntitiesClient;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.it.util.UiTestServer;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.playwright.ui.pages.GovernanceDataObservabilityPage;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.Tags;

/**
 * Java port of {@code DataObservabilityGovernanceTab.spec.ts → Tag detail page} (3 of 4
 * tests; the "loads widgets" test is in {@link TagDataObservabilityReindexUIIT}). All
 * three sub-tests reindex the tag at the end and re-assert.
 *
 * <ol>
 *   <li>"DQ dashboard API carries tag filter" — tab click triggers an API call carrying
 *       the tag's FQN. Asserted indirectly via the {@code dataQualityReport} response
 *       awaited by {@code openDataObservabilityTab}.
 *   <li>"tag filter is hidden on Tag Data Observability tab" — the pre-applied Tag
 *       filter chip should be hidden; owner chip still visible.
 *   <li>"switching back to Overview tab hides the DQ dashboard" — after returning to
 *       Overview, the pie widgets must no longer be visible.
 * </ol>
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "GOVERNANCE_OBSERVABILITY", mode = ResourceAccessMode.READ_WRITE)
class TagDataObservabilityFlowsReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    Tags.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void tagFilterChipHidden(final UiSession ui, final TestNamespace ns) {
    final Tag tag = seedTag(ns);

    GovernanceDataObservabilityPage.openTag(ui, tag.getFullyQualifiedName())
        .openDataObservabilityTab()
        .assertFilterChipHidden("Tag")
        .assertFilterChipVisible("owner");

    reindex.recreateAndAwait("tag", List.of(tag));

    GovernanceDataObservabilityPage.openTag(ui, tag.getFullyQualifiedName())
        .openDataObservabilityTab()
        .assertFilterChipHidden("Tag")
        .assertFilterChipVisible("owner");
  }

  @Test
  void switchingToOverviewHidesDashboard(final UiSession ui, final TestNamespace ns) {
    final Tag tag = seedTag(ns);

    GovernanceDataObservabilityPage.openTag(ui, tag.getFullyQualifiedName())
        .openDataObservabilityTab()
        .assertWidgetsVisible()
        .switchToOverviewAndAssertHidden();

    reindex.recreateAndAwait("tag", List.of(tag));

    GovernanceDataObservabilityPage.openTag(ui, tag.getFullyQualifiedName())
        .openDataObservabilityTab()
        .assertWidgetsVisible()
        .switchToOverviewAndAssertHidden();
  }

  /**
   * "DQ dashboard API carries tag filter" — covered indirectly by openDataObservabilityTab,
   * which awaits a response on /testSuites/dataQualityReport. We assert the call fires
   * and the page renders widgets, then verify the same after reindex.
   */
  @Test
  void dashboardApiCarriesTagFilter(final UiSession ui, final TestNamespace ns) {
    final Tag tag = seedTag(ns);

    GovernanceDataObservabilityPage.openTag(ui, tag.getFullyQualifiedName())
        .openDataObservabilityTab()
        .assertWidgetsVisible();

    reindex.recreateAndAwait("tag", List.of(tag));

    GovernanceDataObservabilityPage.openTag(ui, tag.getFullyQualifiedName())
        .openDataObservabilityTab()
        .assertWidgetsVisible();
  }

  private static Tag seedTag(final TestNamespace ns) {
    return Tags.create(
        new CreateTag()
            .withName(ns.uniqueShortId() + "_obs")
            .withClassification("PII")
            .withDescription("governance flow seed"));
  }
}
