package org.openmetadata.playwright.scenarios.observability;

import static org.assertj.core.api.Assertions.assertThat;

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
import org.openmetadata.playwright.ui.pages.GovernanceDetailPage;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.Tags;

/**
 * Tag detail page pre/post {@code reindexEntities(recreate=true)} of the tag itself.
 * The detail page surfaces Data Observability aggregations across assets carrying
 * the tag — if reindex drops the tag doc's fields, the header snapshot drifts.
 *
 * <p>Uses Tag as a stand-in for the broader Tag/Domain/GlossaryTerm trio; the page
 * object exposes {@code openDomain} / {@code openGlossaryTerm} for future expansion.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "GOVERNANCE_OBSERVABILITY", mode = ResourceAccessMode.READ_WRITE)
class GovernanceObservabilityTabReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    Tags.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void tagDetailSnapshotSurvivesRecreateReindex(final UiSession ui, final TestNamespace ns) {
    final Tag tag =
        Tags.create(
            new CreateTag()
                .withName(ns.uniqueShortId() + "_obs")
                .withClassification("PII")
                .withDescription("Governance observability seed tag"));

    final GovernanceDetailPage before =
        GovernanceDetailPage.openTag(ui, tag.getFullyQualifiedName());
    final String snapshotBefore = before.headerSnapshot();
    assertThat(snapshotBefore).isNotBlank();
    before.rawPage().close();

    reindex.recreateAndAwait(List.of(tag.getEntityReference()));

    final GovernanceDetailPage after =
        GovernanceDetailPage.openTag(ui, tag.getFullyQualifiedName());
    assertThat(after.headerSnapshot())
        .as("Tag %s detail header must equal pre-reindex", tag.getFullyQualifiedName())
        .isEqualTo(snapshotBefore);
  }

  // Silence unused-import warning while preserving the import for future expansion.
  @SuppressWarnings("unused")
  private static EntityReference noOp(final EntityReference r) {
    return r;
  }
}
