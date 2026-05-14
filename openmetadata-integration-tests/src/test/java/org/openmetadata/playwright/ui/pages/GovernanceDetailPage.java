package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.WaitForSelectorState;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Page object for governance entity detail pages — Tag ({@code /tags/<fqn>}),
 * Domain ({@code /domain/<fqn>}), Glossary Term ({@code /glossary/<fqn>}). Each of
 * these surfaces a Data Observability tab that aggregates child-entity test results.
 *
 * <p>Reindex tests open the detail page, snapshot the visible aggregation, run a
 * {@code reindexEntities} on the entity, and re-snapshot.
 */
public final class GovernanceDetailPage extends PageObject {

  private GovernanceDetailPage(final Page page, final UiSession session) {
    super(page, session);
  }

  public static GovernanceDetailPage openTag(final UiSession ui, final String fqn) {
    return open(ui, "/tags/" + fqn);
  }

  public static GovernanceDetailPage openDomain(final UiSession ui, final String fqn) {
    return open(ui, "/domain/" + fqn);
  }

  public static GovernanceDetailPage openGlossaryTerm(final UiSession ui, final String fqn) {
    return open(ui, "/glossary/" + fqn);
  }

  private static GovernanceDetailPage open(final UiSession ui, final String path) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl(path));
    final GovernanceDetailPage instance = new GovernanceDetailPage(page, ui);
    instance.waitForLoaded();
    return instance;
  }

  /**
   * Whitespace-normalized text of the entity-detail container — stable across
   * Tag (data-testid="data-classification") and adequate for Domain / GlossaryTerm
   * pages via their root containers.
   */
  public String headerSnapshot() {
    final Locator container = rootContainer();
    if (container.count() == 0) {
      return "";
    }
    final String text = container.textContent();
    return text == null ? "" : text.replaceAll("\\s+", " ").trim();
  }

  private Locator rootContainer() {
    return page.locator(
            "[data-testid='data-classification'],"
                + " [data-testid='domain-details'],"
                + " [data-testid='glossary-details']")
        .first();
  }

  @Override
  protected void waitForLoaded() {
    page.waitForLoadState();
    rootContainer().waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
  }
}
