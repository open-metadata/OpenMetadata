package org.openmetadata.jpw.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.LoadState;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.openmetadata.jpw.ui.UiSession;

/**
 * Page object for {@code /explore/<tab>} — the entity discovery surface.
 *
 * <p>Use {@link #open(UiSession, Tab)} to land on a specific entity tab without a search,
 * or {@link #openWithSearch(UiSession, String)} to navigate directly to a filtered view.
 * Read results via {@link #firstResultByName(String)} or {@link #countForTab(Tab)}.
 */
public final class ExplorePage extends PageObject {

  private static final String EXPLORE_PATH_PREFIX = "/explore/";
  private static final String TESTID_FILTER_COUNT = "filter-count";

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
   * Opens Explore filtered by the given search query. Navigates directly to
   * {@code /explore/?search=<encoded-query>}; we deliberately do not type into the
   * navbar's {@code searchBox} because OM binds it to a React-controlled value, so
   * subsequent {@code fill()} on a fresh page picks up the previous query from app state
   * instead of replacing it.
   */
  public static ExplorePage openWithSearch(final UiSession ui, final String query) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl(EXPLORE_PATH_PREFIX + "?search=" + urlEncode(query)));
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
      case GLOSSARY_TERMS -> "glossaries-tab";
      case TAGS -> "tags-tab";
    };
  }

  @Override
  protected void waitForLoaded() {
    page.waitForLoadState(LoadState.NETWORKIDLE);
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
    DASHBOARD_DATA_MODELS("dashboardDataModels"),
    GLOSSARY_TERMS("glossaries"),
    TAGS("tags");

    final String path;

    Tab(final String path) {
      this.path = path;
    }
  }
}
