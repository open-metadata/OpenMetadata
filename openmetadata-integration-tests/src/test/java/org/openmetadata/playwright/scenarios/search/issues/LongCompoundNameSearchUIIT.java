package org.openmetadata.playwright.scenarios.search.issues;

import com.microsoft.playwright.assertions.LocatorAssertions.IsVisibleOptions;
import com.microsoft.playwright.assertions.PlaywrightAssertions;
import java.time.Duration;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchAssertions;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.playwright.ui.pages.ExplorePage;
import org.openmetadata.playwright.ui.pages.ExplorePage.Tab;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.Entity;

/**
 * Regression guard for the {@code too_many_nested_clauses} drop-out (fix #21502/#21505):
 * searching a long underscore-segmented table name (e.g.
 * {@code v_location_category...}) exploded the boolean query past {@code indices.query.bool.max_clause_count}
 * — every searchable compound field ({@code name.compound}, {@code displayName.compound}) multiplies
 * the clause count — so the table silently dropped out of results.
 *
 * <p>This creates a table with a long, heavily-underscored name and asserts it is still findable by
 * its full name through the real Explore search path (which builds the multi-field compound query
 * the bug lived in). A clause-count regression makes the search 500 or return nothing, failing the
 * Explore visibility assertion.
 *
 * <p><b>Generalizes to</b>: {@code name.compound}/{@code displayName.compound} exist on every data
 * asset index, so the same clause growth affects dashboards, topics, pipelines, etc. — the table is
 * the representative.
 */
// READ lock: asserts a live-indexed table is present and findable, so it must not run while a
// sibling's recreate reindex (READ_WRITE) swaps the alias and drops the freshly-indexed doc.
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ)
class LongCompoundNameSearchUIIT {

  // ~160 chars, many underscore segments — the shape that multiplies compound-field clauses.
  private static final String LONG_NAME =
      "v_location_category_region_subregion_country_state_city_year_month_day_hour_partition_segment_bucket_shard_replica_primary_secondary_tertiary_lookup_dimension_fact";

  private static final Duration INDEX_TIMEOUT = ReindexHelpers.searchPropagationTimeout();
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);

  @Test
  void longUnderscoreNameStaysSearchable(final UiSession ui, final TestNamespace ns) {
    final Table stackTable = ShortStackFactory.table(ns);
    final String fqn = stackTable.getFullyQualifiedName();
    final String schemaFqn = fqn.substring(0, fqn.lastIndexOf('.'));

    final Table longTable = TableTestFactory.createSimpleWithName(LONG_NAME, ns, schemaFqn);

    final SearchAssertions search = new SearchAssertions(ui.server());
    final String index = new IndexAliasInspector(ui.server()).indexNameFor(Entity.TABLE);
    awaitIndexed(search, index, longTable.getFullyQualifiedName());

    // The table is confirmed in the index above, so the Explore search returns it; give the result
    // row the propagation budget to render rather than the default 5s (tight on a loaded cluster).
    final ExplorePage explore = ExplorePage.openWithSearch(ui, Tab.TABLES, LONG_NAME);
    PlaywrightAssertions.assertThat(explore.firstResultByName(LONG_NAME))
        .isVisible(new IsVisibleOptions().setTimeout(INDEX_TIMEOUT.toMillis()));
  }

  private static void awaitIndexed(
      final SearchAssertions search, final String index, final String fqn) {
    Awaitility.await("table '" + fqn + "' indexed")
        .atMost(INDEX_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreNoExceptions()
        .untilAsserted(() -> search.assertEntityIndexed(index, "table", fqn));
  }
}
