package org.openmetadata.playwright.scenarios.observability;

import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.search.ReindexEntitiesClient;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.it.util.UiTestServer;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.playwright.ui.pages.GovernanceDataObservabilityPage;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.sdk.fluent.Apps;

/**
 * Java port of {@code DataObservabilityGovernanceTab.spec.ts → GlossaryTerm detail page}
 * (4 tests). Each reindexes the term and re-asserts.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "GOVERNANCE_OBSERVABILITY", mode = ResourceAccessMode.READ_WRITE)
class GlossaryTermDataObservabilityReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void widgetsLoadOnTabClick(final UiSession ui, final TestNamespace ns) {
    final GlossaryTerm term = seedGlossaryTerm(ns);

    GovernanceDataObservabilityPage.openGlossaryTerm(ui, term.getFullyQualifiedName())
        .openDataObservabilityTab()
        .assertWidgetsVisible();

    reindex.recreateAndAwait("glossaryTerm", List.of(term));

    GovernanceDataObservabilityPage.openGlossaryTerm(ui, term.getFullyQualifiedName())
        .openDataObservabilityTab()
        .assertWidgetsVisible();
  }

  /** "DQ dashboard API carries glossaryTerms filter" — proven by tab click awaiting the API. */
  @Test
  void dashboardApiCarriesGlossaryFilter(final UiSession ui, final TestNamespace ns) {
    final GlossaryTerm term = seedGlossaryTerm(ns);

    GovernanceDataObservabilityPage.openGlossaryTerm(ui, term.getFullyQualifiedName())
        .openDataObservabilityTab()
        .assertWidgetsVisible();

    reindex.recreateAndAwait("glossaryTerm", List.of(term));

    GovernanceDataObservabilityPage.openGlossaryTerm(ui, term.getFullyQualifiedName())
        .openDataObservabilityTab()
        .assertWidgetsVisible();
  }

  @Test
  void glossaryFilterChipHidden(final UiSession ui, final TestNamespace ns) {
    final GlossaryTerm term = seedGlossaryTerm(ns);

    GovernanceDataObservabilityPage.openGlossaryTerm(ui, term.getFullyQualifiedName())
        .openDataObservabilityTab()
        .assertFilterChipHidden("Glossary Term")
        .assertFilterChipVisible("owner");

    reindex.recreateAndAwait("glossaryTerm", List.of(term));

    GovernanceDataObservabilityPage.openGlossaryTerm(ui, term.getFullyQualifiedName())
        .openDataObservabilityTab()
        .assertFilterChipHidden("Glossary Term")
        .assertFilterChipVisible("owner");
  }

  @Test
  void dataObservabilityTabAbsentInVersionHistory(final UiSession ui, final TestNamespace ns) {
    final GlossaryTerm term = seedGlossaryTerm(ns);

    GovernanceDataObservabilityPage.openGlossaryTerm(ui, term.getFullyQualifiedName())
        .openVersionHistoryAssertTabAbsent();

    reindex.recreateAndAwait("glossaryTerm", List.of(term));

    GovernanceDataObservabilityPage.openGlossaryTerm(ui, term.getFullyQualifiedName())
        .openVersionHistoryAssertTabAbsent();
  }

  private static GlossaryTerm seedGlossaryTerm(final TestNamespace ns) {
    final Glossary glossary = GlossaryTestFactory.createSimple(ns);
    return GlossaryTermTestFactory.createSimple(ns, glossary);
  }
}
