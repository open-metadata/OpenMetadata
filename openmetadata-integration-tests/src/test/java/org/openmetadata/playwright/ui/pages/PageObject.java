package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.WaitForSelectorState;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Base class for OM UI page objects.
 *
 * <p>A page object encapsulates the locators and interactions for one page, so that test
 * scenarios stay declarative. Rules every subclass should follow:
 *
 * <ol>
 *   <li>Prefer returning the page object itself (or another page object) from actions for
 *       chaining; expose {@link Locator}-returning methods only when the test legitimately
 *       needs to perform a Playwright-level assertion on a specific element. The {@link
 *       #rawPage()} escape hatch is available for cases (URL assertions, SSO redirects)
 *       that need direct {@link Page} access.
 *   <li>Locators prefer {@code data-testid} attributes via {@link #byTestId(String)}; fall
 *       back to roles or labels before resorting to text or CSS.
 *   <li>Define every selector as a {@code private static final} constant — no magic
 *       strings inline.
 * </ol>
 *
 * <p>Subclasses expose a static {@code open(...)} factory that performs the navigation and
 * returns a fully-loaded instance. Use {@link #waitForLoaded()} (override per page) to
 * gate that on a page-specific readiness signal.
 */
public abstract class PageObject {

  protected final Page page;
  protected final UiSession session;

  protected PageObject(final Page page, final UiSession session) {
    this.page = page;
    this.session = session;
  }

  /** Convenience accessor for {@code data-testid} locators — prefer over text/CSS. */
  protected final Locator byTestId(final String testId) {
    return page.getByTestId(testId);
  }

  /**
   * Open an Ant Design dropdown/menu. Ant triggers TOGGLE on click, so we click exactly once and
   * wait for the panel. A speculative second click (to guard against a "swallowed" first click)
   * would instead close a menu the first click already opened slowly, and any follow-up item click
   * then burns its full timeout on the collapsing panel. Matches the single-click pattern the
   * source {@code *.spec.ts} files use for these same dropdowns.
   */
  protected final void openMenu(final Locator trigger, final Locator menu) {
    trigger.click();
    menu.waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
  }

  /** Override to wait for a page-specific readiness signal after navigation. */
  protected void waitForLoaded() {
    // default: no-op; subclasses override
  }

  public final Page rawPage() {
    return page;
  }
}
