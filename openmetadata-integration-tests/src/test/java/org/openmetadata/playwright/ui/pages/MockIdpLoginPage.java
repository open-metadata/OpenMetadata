package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Page object for {@code navikt/mock-oauth2-server}'s interactive login form. Reached by
 * the browser when the OM UI redirects to the IdP's authorize endpoint and the IdP shows
 * its built-in HTML login GUI (default behavior — set {@code interactiveLogin: false} in
 * the mock config to skip the form for headless flows).
 *
 * <p>The form is plain HTML — no testids are emitted by the mock server — so locators here
 * use the form-element {@code name} attributes, which the project pins.
 */
public final class MockIdpLoginPage extends PageObject {

  private static final String USERNAME_INPUT_SELECTOR = "input[name=\"username\"]";

  public MockIdpLoginPage(final Page page, final UiSession session) {
    super(page, session);
  }

  public Locator usernameInput() {
    return page.locator(USERNAME_INPUT_SELECTOR);
  }

  public Locator submitButton() {
    return page.getByRole(AriaRole.BUTTON);
  }

  /** Fill the username with the given email and submit the form. */
  public void signInAs(final String email) {
    usernameInput().fill(email);
    submitButton().first().click();
  }

  @Override
  protected void waitForLoaded() {
    usernameInput().waitFor();
  }
}
