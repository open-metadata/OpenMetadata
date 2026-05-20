package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.microsoft.playwright.assertions.PlaywrightAssertions;
import com.microsoft.playwright.options.WaitForSelectorState;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Page object for {@code /explore/<tab>} — the entity discovery surface.
 *
 * <p>Use {@link #open(UiSession, Tab)} to land on a specific entity tab without a search,
 * or {@link #openWithSearch(UiSession, Tab, String)} to navigate directly to a filtered view.
 * Read results via {@link #firstResultByName(String)} or {@link #countForTab(Tab)}.
 */
public final class ExplorePage extends PageObject {

  private static final String EXPLORE_PATH_PREFIX = "/explore/";
  private static final String TESTID_FILTER_COUNT = "filter-count";
  private static final String TESTID_EXPLORE_PAGE = "explore-page";
  private static final String SEARCH_API_PATH = "/api/v1/search/query";
  private static final double SEARCH_API_TIMEOUT_MS = 60_000;
  private static final double COUNT_ASSERT_TIMEOUT_MS = 30_000;

  private ExplorePage(final Page page, final UiSession session) {
    super(page, session);
  }

  public static ExplorePage open(final UiSession ui, final Tab tab) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl(EXPLORE_PATH_PREFIX + tab.path));
    final ExplorePage instance = new ExplorePage(page, ui);
    instance.waitForLoaded();
    return instance;
  }

  /**
   * Opens Explore on the given tab filtered by the search query. Two guarantees that
   * make {@link #countForTab(Tab)} race-free:
   *
   * <ol>
   *   <li>The URL includes the tab segment ({@code /explore/<tab>?search=...}). OM's
   *       Explore filters tabs to those with hits OR matching the active
   *       {@code searchCriteria}; including the tab in the URL ensures the tab itself is
   *       always rendered, even before {@code searchHitCounts} arrive.
   *   <li>We block until the {@code /api/v1/search/query} aggregation response arrives
   *       so {@code searchHitCounts} has populated the per-tab count badges.
   * </ol>
   *
   * <p>We deliberately do not type into the navbar's {@code searchBox} — OM binds it to
   * React-controlled state that {@code fill()} can't reliably override across navigations.
   */
  public static ExplorePage openWithSearch(final UiSession ui, final Tab tab, final String query) {
    final Page page = ui.newPage();
    final String url = ui.uiUrl(EXPLORE_PATH_PREFIX + tab.path + "?search=" + urlEncode(query));
    page.waitForResponse(
        response -> response.url().contains(SEARCH_API_PATH) && response.status() == 200,
        new Page.WaitForResponseOptions().setTimeout(SEARCH_API_TIMEOUT_MS),
        () -> page.navigate(url));
    final ExplorePage instance = new ExplorePage(page, ui);
    instance.waitForLoaded();
    return instance;
  }

  private static String urlEncode(final String s) {
    return URLEncoder.encode(s, StandardCharsets.UTF_8);
  }

  public Locator firstResultByName(final String name) {
    return page.getByText(name).first();
  }

  /**
   * Count badge for the given tab in the Explore left nav. Each tab carries its own
   * {@code filter-count}; we scope by the tab's outer testid ({@code <label>-tab}, e.g.
   * {@code tables-tab}) so we don't pick up another tab's value.
   */
  public Locator countBadgeForTab(final Tab tab) {
    return page.getByTestId(tabTestId(tab)).getByTestId(TESTID_FILTER_COUNT);
  }

  /** Reads the count for the given tab as a non-negative int. */
  public int countForTab(final Tab tab) {
    final String text = countBadgeForTab(tab).textContent();
    if (text == null || text.isBlank()) {
      throw new IllegalStateException("filter-count badge has no text for " + tab);
    }
    return Integer.parseInt(text.trim());
  }

  /**
   * Web-first assertion that the tab's count badge eventually reads {@code expected}.
   * Polls the badge until match or timeout — preferred over {@link #countForTab(Tab)} +
   * an external equality check, which can race against the React render that follows the
   * search aggregation response.
   */
  public void assertCountForTab(final Tab tab, final int expected) {
    PlaywrightAssertions.assertThat(countBadgeForTab(tab))
        .hasText(
            String.valueOf(expected),
            new LocatorAssertions.HasTextOptions().setTimeout(COUNT_ASSERT_TIMEOUT_MS));
  }

  private static String tabTestId(final Tab tab) {
    // The OM UI computes the testid as `${lowercase(tabLabel)}-tab`. Tab labels match the
    // English plural form of the entity (Tables, Topics, etc.), so lowercased they line
    // up with the values we keep here for stability.
    return switch (tab) {
      case TABLES -> "tables-tab";
      case TOPICS -> "topics-tab";
      case DASHBOARDS -> "dashboards-tab";
      case PIPELINES -> "pipelines-tab";
      case ML_MODELS -> "ml models-tab";
      case CONTAINERS -> "containers-tab";
      case SEARCH_INDEXES -> "search indexes-tab";
      case DASHBOARD_DATA_MODELS -> "dashboard data models-tab";
      case GLOSSARY_TERMS -> "glossary terms-tab";
      case TAGS -> "tags-tab";
      case WORKSHEETS -> "worksheets-tab";
      case FILES -> "files-tab";
    };
  }

  @Override
  protected void waitForLoaded() {
    byTestId(TESTID_EXPLORE_PAGE)
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
  }

  /** Top-level entity tabs on the Explore page. Path matches the URL segment. */
  public enum Tab {
    TABLES("tables"),
    DASHBOARDS("dashboards"),
    TOPICS("topics"),
    PIPELINES("pipelines"),
    ML_MODELS("mlmodels"),
    CONTAINERS("containers"),
    SEARCH_INDEXES("searchIndexes"),
    DASHBOARD_DATA_MODELS("dashboardDataModel"),
    GLOSSARY_TERMS("glossaries"),
    TAGS("tags"),
    WORKSHEETS("worksheets"),
    FILES("files");

    final String path;

    Tab(final String path) {
      this.path = path;
    }
  }
}
