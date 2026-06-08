package org.openmetadata.playwright.scenarios.observability;

import com.microsoft.playwright.assertions.LocatorAssertions;
import com.microsoft.playwright.assertions.PlaywrightAssertions;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
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
import org.openmetadata.playwright.ui.pages.DataQualityListPage;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.TestCases;

/**
 * Java port of {@code DataQuality.spec.ts → "Pagination functionality in test cases list"}.
 * Seeds 25 test cases, asserts pagination controls + state, navigates next/prev, then
 * reindexes all 25 and re-verifies pagination works identically.
 *
 * <p>Reindex injection point: between the initial pagination round-trip and the
 * second one. The test must show that 25 docs survive recreate without messing up
 * the page-indicator text or the prev/next disabled states.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "DQ_LIST", mode = ResourceAccessMode.READ_WRITE)
class DataQualityPaginationReindexUIIT {

  private static final int SEED_COUNT = 25;
  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    TestCases.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void paginationStillWorksAfterReindex(final UiSession ui, final TestNamespace ns) {
    final Table table = ShortStackFactory.table(ns);
    final String tag = UUID.randomUUID().toString().substring(0, 8);

    final List<TestCase> seeded = new ArrayList<>(SEED_COUNT);
    for (int i = 0; i < SEED_COUNT; i++) {
      seeded.add(
          TestCases.create()
              .name("tc_pg_" + tag + "_" + i)
              .forTable(table)
              .testDefinition("tableRowCountToBeBetween")
              .parameter("minValue", String.valueOf(10 + i))
              .parameter("maxValue", String.valueOf(100 + i))
              .description("pagination seed")
              .execute());
    }

    runPaginationFlow(ui);

    // --- Reindex inject ---
    reindex.recreateAndAwait("testCase", seeded);

    runPaginationFlow(ui);
  }

  private static void runPaginationFlow(final UiSession ui) {
    final DataQualityListPage page = DataQualityListPage.open(ui);

    // Pagination controls visible
    final LocatorAssertions.IsVisibleOptions vis =
        new LocatorAssertions.IsVisibleOptions().setTimeout(20_000);
    PlaywrightAssertions.assertThat(page.paginationContainer()).isVisible(vis);
    PlaywrightAssertions.assertThat(page.previousButton()).isVisible(vis);
    PlaywrightAssertions.assertThat(page.nextButton()).isVisible(vis);
    PlaywrightAssertions.assertThat(page.pageIndicator()).isVisible(vis);

    // First page state: prev disabled, indicator "1 of"
    PlaywrightAssertions.assertThat(page.previousButton()).isDisabled();
    PlaywrightAssertions.assertThat(page.nextButton()).not().isDisabled();
    PlaywrightAssertions.assertThat(page.pageIndicator()).containsText("1 of");

    // Navigate to page 2
    page.clickNext();
    PlaywrightAssertions.assertThat(page.previousButton()).not().isDisabled();
    PlaywrightAssertions.assertThat(page.pageIndicator()).containsText("2 of");

    // Navigate back to page 1
    page.clickPrevious();
    PlaywrightAssertions.assertThat(page.previousButton()).isDisabled();
    PlaywrightAssertions.assertThat(page.pageIndicator()).containsText("1 of");

    // Page-size dropdown shows the 3 standard options
    page.assertPageSizeOptionsCount(3);
  }
}
