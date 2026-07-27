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
import org.openmetadata.playwright.ui.pages.TagDataObservabilityPage;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.Tags;

/**
 * Java port of {@code DataObservabilityGovernanceTab.spec.ts → "clicking Data Observability
 * tab loads DQ dashboard widgets" (Tag detail page)} with
 * {@code POST /v1/search/reindexEntities} of the tag injected before the second tab
 * navigation.
 *
 * <p>Flow:
 *
 * <ol>
 *   <li>API seed: a Tag under the existing PII classification.
 *   <li>UI: navigate to {@code /tag/<fqn>}.
 *   <li>UI: click "Data Observability" tab → assert all three pie widgets visible.
 *   <li><b>Reindex inject:</b> recreate the tag.
 *   <li>UI: reload page, click the tab again → all three widgets must still render.
 * </ol>
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "GOVERNANCE_OBSERVABILITY", mode = ResourceAccessMode.READ_WRITE)
class TagDataObservabilityReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    Tags.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void tagDataObservabilityWidgetsSurviveRecreate(final UiSession ui, final TestNamespace ns) {
    final Tag tag =
        Tags.create(
            new CreateTag()
                .withName(ns.uniqueShortId() + "_obs")
                .withClassification("PII")
                .withDescription("Governance observability seed tag"));

    // --- Pre-reindex: open tag, click Data Observability tab, assert widgets. ---
    TagDataObservabilityPage.open(ui, tag.getFullyQualifiedName())
        .openDataObservabilityTab()
        .assertWidgetsVisible();

    // --- Reindex inject ---
    reindex.recreateAndAwait("tag", List.of(tag));

    // --- Post-reindex: same flow, same assertions. ---
    TagDataObservabilityPage.open(ui, tag.getFullyQualifiedName())
        .openDataObservabilityTab()
        .assertWidgetsVisible();
  }
}
