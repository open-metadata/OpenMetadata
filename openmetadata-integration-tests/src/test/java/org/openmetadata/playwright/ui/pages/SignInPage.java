package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Page object for the OM sign-in surface ({@code /signin}). Exposes both the basic-auth
 * email/password form and the SSO provider buttons so a single page object covers every
 * sign-in flow test, regardless of which {@code jpw.auth} backend is active.
 *
 * <p>The SSO button has no testid in the OM source — it's a generic {@code <Button>} whose
 * visible text is {@code "Sign in with <ProviderName>"}. We locate it by accessible role +
 * name; that's stable across UI refactors that swap CSS classes.
 */
public final class SignInPage extends PageObject {

  private static final String SIGNIN_PATH = "/signin";
  private static final String TESTID_FORM_CONTAINER = "login-form-container";
  private static final String TESTID_EMAIL = "email";
  private static final String TESTID_PASSWORD = "password";
  private static final String TESTID_LOGIN = "login";
  private static final String TESTID_SIGNUP = "signup";
  private static final String TESTID_FORGOT_PASSWORD = "forgot-password";
  private static final String SSO_BUTTON_PREFIX = "Sign in with";

  private SignInPage(final Page page, final UiSession session) {
    super(page, session);
  }

  public static SignInPage open(final UiSession ui) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl(SIGNIN_PATH));
    final SignInPage instance = new SignInPage(page, ui);
    instance.waitForLoaded();
    return instance;
  }

  public Locator emailInput() {
    return byTestId(TESTID_EMAIL);
  }

  public Locator passwordInput() {
    return byTestId(TESTID_PASSWORD);
  }

  public Locator loginButton() {
    return byTestId(TESTID_LOGIN);
  }

  public Locator signupLink() {
    return byTestId(TESTID_SIGNUP);
  }

  public Locator forgotPasswordLink() {
    return byTestId(TESTID_FORGOT_PASSWORD);
  }

  /** SSO sign-in button for the given provider (e.g. {@code "Google"}, {@code "Okta"}). */
  public Locator ssoButton(final String providerDisplayName) {
    return page.getByRole(
        AriaRole.BUTTON,
        new Page.GetByRoleOptions().setName(SSO_BUTTON_PREFIX + " " + providerDisplayName));
  }

  @Override
  protected void waitForLoaded() {
    byTestId(TESTID_FORM_CONTAINER).waitFor();
  }
}
