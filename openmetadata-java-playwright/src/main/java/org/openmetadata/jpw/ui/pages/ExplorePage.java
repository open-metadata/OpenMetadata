package org.openmetadata.jpw.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.LoadState;
import org.openmetadata.jpw.ui.UiSession;

/**
 * Page object for {@code /explore/<tab>} — the entity discovery surface.
 *
 * <p>Use {@link #open(UiSession, Tab)} to navigate; chain {@link #search(String)} and
 * read results via {@link #firstResultByName(String)}.
 */
public final class ExplorePage extends PageObject {

  private static final String SEARCH_PLACEHOLDER = "Search";
  private static final String EXPLORE_PATH_PREFIX = "/explore/";

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

  public ExplorePage search(final String query) {
    page.getByPlaceholder(SEARCH_PLACEHOLDER).first().fill(query);
    page.keyboard().press("Enter");
    return this;
  }

  public Locator firstResultByName(final String name) {
    return page.getByText(name).first();
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
