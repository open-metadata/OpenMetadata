package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.openmetadata.it.sso.SsoFlows.idTokenFrom;
import static org.openmetadata.it.sso.SsoFlows.loggedInUser;
import static org.openmetadata.it.sso.SsoFlows.login;

import java.net.http.HttpResponse;
import java.util.Locale;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.it.sso.browser.SsoBrowser;
import org.openmetadata.it.sso.config.SecurityConfigSwap;
import org.openmetadata.it.sso.config.SsoConfigs;
import org.openmetadata.it.sso.oidc.MockOidcIdentity;
import org.openmetadata.it.sso.oidc.MockOidcProvider;
import org.openmetadata.it.sso.oidc.OidcProviderProfile;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Each supported identity provider's issuer and claim shapes, end to end: Google's schemeless
 * issuer, Entra's tenant template and email-less tokens, Auth0's trailing-slash issuer, Cognito and
 * Keycloak claims. Every case runs against its own mock provider.
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class SsoOidcProviderProfilesIT {
  private static final String EMAIL_DOMAIN = "@open-metadata.org";

  private static SecurityConfigSwap securityConfig;

  @BeforeAll
  static void snapshotTheLiveConfiguration() {
    assumeFalse(OssTestServer.isExternalMode(), "Reconfigures the embedded server's SSO");
    securityConfig = SecurityConfigSwap.snapshotLiveConfig();
  }

  @AfterAll
  static void restoreTheLiveConfiguration() {
    if (securityConfig != null) {
      securityConfig.close();
    }
  }

  @ParameterizedTest(name = "OC-02/03 a confidential login works for {0}")
  @EnumSource(OidcProviderProfile.class)
  void confidentialLoginWorksForEachProvider(OidcProviderProfile profile, TestNamespace ns) {
    try (MockOidcProvider provider = MockOidcProvider.start(profile)) {
      securityConfig.apply(SsoConfigs.confidentialOidc(securityConfig.originalCopy(), provider));
      MockOidcIdentity identity = identityFor(profile, ns);
      provider.signIn(identity);
      SsoBrowser browser = new SsoBrowser();

      String idToken = idTokenFrom(login(browser));

      assertSignedInAs(identity, loggedInUser(browser, idToken));
      if (profile == OidcProviderProfile.GOOGLE) {
        assertEquals("offline", provider.authorizeRequests().getFirst().parameter("access_type"));
      }
    }
  }

  @ParameterizedTest(name = "OP-01 a public client accepts {0} tokens")
  @EnumSource(OidcProviderProfile.class)
  void publicClientAcceptsEachProvidersTokens(OidcProviderProfile profile, TestNamespace ns) {
    try (MockOidcProvider provider = MockOidcProvider.start(profile)) {
      securityConfig.apply(SsoConfigs.publicOidc(securityConfig.originalCopy(), provider));
      MockOidcIdentity identity = identityFor(profile, ns);
      createUser(identity);

      HttpResponse<String> response =
          loggedInUser(new SsoBrowser(), provider.issueIdToken(identity));

      assertSignedInAs(identity, response);
    }
  }

  private static MockOidcIdentity identityFor(OidcProviderProfile profile, TestNamespace ns) {
    String name = ns.shortPrefix(profile.name().toLowerCase(Locale.ROOT));
    return MockOidcIdentity.forEmail(name + EMAIL_DOMAIN).withDisplayName(name);
  }

  private static void createUser(MockOidcIdentity identity) {
    String name = identity.email().substring(0, identity.email().indexOf('@'));
    SdkClients.adminClient()
        .users()
        .create(new CreateUser().withName(name).withEmail(identity.email()));
  }

  private static void assertSignedInAs(MockOidcIdentity identity, HttpResponse<String> response) {
    assertEquals(200, response.statusCode(), response.body());
    assertEquals(identity.email(), JsonUtils.readTree(response.body()).get("email").asText());
  }
}
