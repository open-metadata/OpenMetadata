package org.openmetadata.it.tests.mcp;

import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.sso.config.SecurityConfigSwap;
import org.openmetadata.it.sso.config.SsoConfigs;
import org.openmetadata.it.sso.oidc.MockOidcIdentity;
import org.openmetadata.it.sso.oidc.MockOidcProvider;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;

/**
 * Each MCP client's recorded connection profile signs in to {@code /mcp} through a confidential
 * OIDC provider and calls a tool: registration, the authorization request, the provider login, the
 * consent page, the code, the tokens, a tool call as the signed-in user, refresh and revocation.
 * Nothing is written to the database on the client's behalf.
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class SsoMcpClientProfilesIT extends McpSignInTestBase {
  private static MockOidcProvider provider;
  private static SecurityConfigSwap securityConfig;

  @BeforeAll
  static void pointTheServerAtTheMockProvider() {
    assumeFalse(OssTestServer.isExternalMode(), "Reconfigures the embedded server's SSO");
    provider = MockOidcProvider.start();
    securityConfig = SecurityConfigSwap.snapshotLiveConfig();
    securityConfig.applyBaseline(
        SsoConfigs.confidentialOidc(securityConfig.originalCopy(), provider));
  }

  @AfterAll
  static void restoreTheLiveConfiguration() {
    if (securityConfig != null) {
      securityConfig.close();
    }
    if (provider != null) {
      provider.close();
    }
  }

  static List<McpClientProfile> oauthClients() {
    return McpClientProfile.oauthClients();
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("oauthClients")
  void clientSignsInThroughSsoAndCallsATool(McpClientProfile profile, TestNamespace ns)
      throws Exception {
    User user = createUser(new CreateUser(), ns.shortPrefix("mcp"));
    try {
      provider.signIn(MockOidcIdentity.forEmail(user.getEmail()));
      assertClientConnects(profile, user, this::approveConsent);
    } finally {
      hardDelete(user);
    }
  }

  /** With the basic provider the sign-in is the server's own password form, with no consent page. */
  @Test
  void clientSignsInWithAPasswordAndCallsATool(TestNamespace ns) throws Throwable {
    securityConfig.withVariant(
        SsoMcpClientProfilesIT::basicProvider,
        () -> {
          CreateUser withPassword =
              new CreateUser()
                  .withPassword(PASSWORD)
                  .withConfirmPassword(PASSWORD)
                  .withCreatePasswordType(CreateUser.CreatePasswordType.ADMIN_CREATE);
          User user = createUser(withPassword, ns.shortPrefix("mcp"));
          try {
            assertClientConnects(
                McpClientProfile.oauthClients().getFirst(),
                user,
                (server, authorize) -> enterPassword(server, authorize, user));
          } finally {
            hardDelete(user);
          }
        });
  }

  private static SecurityConfiguration basicProvider(SecurityConfiguration config) {
    config
        .getAuthenticationConfiguration()
        .withProvider(AuthProvider.BASIC)
        .withProviderName("OpenMetadata")
        .withClientType(ClientType.PUBLIC);
    return config;
  }
}
