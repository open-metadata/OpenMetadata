package org.openmetadata.playwright.scenarios.auth.signin;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Page;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.auth.AuthAssumptions;
import org.openmetadata.it.auth.NoPreloadAuth;
import org.openmetadata.it.server.sso.MockOidcServer;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.playwright.ui.pages.MockIdpLoginPage;
import org.openmetadata.playwright.ui.pages.SignInPage;

/**
 * End-to-end sign-in flow under the Google SSO confidential-client backend: clicks the
 * "Sign in with Google" button on the OM sign-in page, follows the redirect to the mock
 * IdP, fills the IdP's login form, and asserts the browser lands authenticated on the OM
 * home view.
 *
 * <p>Skips with an {@code Assumption} when the suite is running under any other backend —
 * enables {@code mvn verify} to walk every UIIT regardless of {@code jpw.auth} without
 * mode mismatches turning into failures.
 */
@ExtendWith(UiSessionExtension.class)
class GoogleSsoSignInUIIT {

  private static final String ADMIN_EMAIL = "admin@open-metadata.org";
  private static final Pattern AUTHENTICATED_URL = Pattern.compile(".*/(my-data|explore)\\??.*");

  @Test
  @NoPreloadAuth
  void clickingGoogleSsoButtonCompletesLoginAndLandsOnHome(final UiSession ui) {
    AuthAssumptions.onlyWhenBackendIs("sso-google-confidential");

    final SignInPage signIn = SignInPage.open(ui);
    signIn.ssoButton("Google").click();

    final Page page = signIn.rawPage();
    page.waitForURL(Pattern.compile(".*om-mock-idp:" + MockOidcServer.PORT + "/.*"));
    new MockIdpLoginPage(page, ui).signInAs(ADMIN_EMAIL);

    page.waitForURL(AUTHENTICATED_URL);
    assertThat(page).hasURL(AUTHENTICATED_URL);
  }
}
