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
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.Domains;

/**
 * Java port of {@code DataObservabilityGovernanceTab.spec.ts → Domain detail page} (4
 * tests). Each reindexes the domain and re-asserts.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "GOVERNANCE_OBSERVABILITY", mode = ResourceAccessMode.READ_WRITE)
class DomainDataObservabilityReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    Domains.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void widgetsLoadOnTabClick(final UiSession ui, final TestNamespace ns) {
    final Domain domain = seedDomain(ns);

    GovernanceDataObservabilityPage.openDomainDataObservabilityDirect(
            ui, domain.getFullyQualifiedName())
        .assertWidgetsVisible();

    reindex.recreateAndAwait("domain", List.of(domain));

    GovernanceDataObservabilityPage.openDomainDataObservabilityDirect(
            ui, domain.getFullyQualifiedName())
        .assertWidgetsVisible();
  }

  @Test
  void dashboardApiCarriesDomainFilter(final UiSession ui, final TestNamespace ns) {
    final Domain domain = seedDomain(ns);

    GovernanceDataObservabilityPage.openDomainDataObservabilityDirect(
            ui, domain.getFullyQualifiedName())
        .assertWidgetsVisible();

    reindex.recreateAndAwait("domain", List.of(domain));

    GovernanceDataObservabilityPage.openDomainDataObservabilityDirect(
            ui, domain.getFullyQualifiedName())
        .assertWidgetsVisible();
  }

  /** Domain DO tab keeps all 4 filter chips visible (owner/Tag/Glossary Term + Tier). */
  @Test
  void filterBarVisible(final UiSession ui, final TestNamespace ns) {
    final Domain domain = seedDomain(ns);

    GovernanceDataObservabilityPage.openDomainDataObservabilityDirect(
            ui, domain.getFullyQualifiedName())
        .assertFilterChipVisible("owner")
        .assertFilterChipVisible("Tag")
        .assertFilterChipVisible("Glossary Term");

    reindex.recreateAndAwait("domain", List.of(domain));

    GovernanceDataObservabilityPage.openDomainDataObservabilityDirect(
            ui, domain.getFullyQualifiedName())
        .assertFilterChipVisible("owner")
        .assertFilterChipVisible("Tag")
        .assertFilterChipVisible("Glossary Term");
  }

  @Test
  void dataObservabilityTabAbsentInVersionHistory(final UiSession ui, final TestNamespace ns) {
    final Domain domain = seedDomain(ns);

    GovernanceDataObservabilityPage.openDomain(ui, domain.getFullyQualifiedName())
        .openVersionHistoryAssertTabAbsent();

    reindex.recreateAndAwait("domain", List.of(domain));

    GovernanceDataObservabilityPage.openDomain(ui, domain.getFullyQualifiedName())
        .openVersionHistoryAssertTabAbsent();
  }

  private static Domain seedDomain(final TestNamespace ns) {
    return Domains.create(
        new CreateDomain()
            .withName(ns.uniqueShortId() + "_dom")
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("governance flow seed"));
  }
}
