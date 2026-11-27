package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.function.Executable;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.it.sso.MockHttp;
import org.openmetadata.it.sso.MockResponseGate;
import org.openmetadata.it.sso.browser.SsoBrowser;
import org.openmetadata.it.sso.browser.SsoNavigation;
import org.openmetadata.it.sso.config.SecurityConfigSwap;
import org.openmetadata.it.sso.config.SsoConfigs;
import org.openmetadata.it.sso.config.SsoServer;
import org.openmetadata.it.sso.oidc.IdTokenDefect;
import org.openmetadata.it.sso.oidc.MockOidcIdentity;
import org.openmetadata.it.sso.oidc.MockOidcProvider;
import org.openmetadata.it.sso.oidc.OidcProviderProfile;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.fluent.Users;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

/**
 * What a real sign-in to {@code /mcp} must hold beyond the happy path: each identity provider's
 * shape, the refusals that only exist once a person has signed in, and the client behaviours the
 * server does not support yet, pinned to what it answers today.
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class SsoMcpSignInChecksIT extends McpSignInTestBase {
  private static final McpClientProfile CLIENT = McpClientProfile.oauthClients().getFirst();
  private static final String CIMD_CLIENT_ID =
      "https://claude.ai/oauth/claude-code-client-metadata";
  private static final String NEXT_PROTOCOL_VERSION = "2026-07-28";
  private static final String ANOTHER_RESOURCE = "https://another-server.example/mcp";

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

  @ParameterizedTest(name = "a client signs in through {0}")
  @EnumSource(OidcProviderProfile.class)
  void clientSignsInThroughEachProviderShape(OidcProviderProfile shape, TestNamespace ns)
      throws Throwable {
    try (MockOidcProvider shaped = MockOidcProvider.start(shape)) {
      securityConfig.withVariant(
          config -> SsoConfigs.confidentialOidc(securityConfig.originalCopy(), shaped),
          () -> {
            String name = ns.shortPrefix(shape.name().toLowerCase(Locale.ROOT));
            User user = createUser(new CreateUser(), name);
            try {
              shaped.signIn(MockOidcIdentity.forEmail(user.getEmail()).withDisplayName(name));
              assertClientConnects(CLIENT, user, this::approveConsent);
            } finally {
              hardDelete(user);
            }
          });
    }
  }

  @Test
  void authorizationCodeIsRedeemedOnce(TestNamespace ns) throws Exception {
    User user = signedInUser(ns);
    try {
      JsonNode server = discoverAuthorizationServer();
      String clientId = register(CLIENT, server);
      Authorization authorization = authorizationFor(CLIENT, server, clientId);
      String code = approveConsent(server, authorization.request()).get("code");
      Map<String, String> exchange = exchangeForm(CLIENT, server, clientId, authorization, code);

      assertThat(tokenRequest(CLIENT, server, exchange).statusCode()).isEqualTo(200);
      HttpResponse<String> replay = tokenRequest(CLIENT, server, exchange);
      assertThat(replay.statusCode()).as(replay.body()).isEqualTo(400);
      assertThat(replay.body()).contains("invalid_grant");
    } finally {
      hardDelete(user);
    }
  }

  @Test
  void denyingConsentReturnsAccessDeniedToTheClient(TestNamespace ns) throws Exception {
    User user = signedInUser(ns);
    try {
      JsonNode server = discoverAuthorizationServer();
      Authorization authorization = authorizationFor(CLIENT, server, register(CLIENT, server));
      SsoBrowser browser = new SsoBrowser();
      Map<String, String> callback =
          decide(
              browser,
              consentPage(browser, server, authorization.request()),
              "deny",
              CLIENT.redirectUri());

      assertThat(callback).containsEntry("error", "access_denied").doesNotContainKey("code");
      assertThat(callback.get("state")).isEqualTo(authorization.request().get("state"));
    } finally {
      hardDelete(user);
    }
  }

  @Test
  void refreshTokenOfAnotherClientIsRefused(TestNamespace ns) throws Exception {
    User user = signedInUser(ns);
    try {
      JsonNode server = discoverAuthorizationServer();
      Grant grant = signIn(CLIENT, server, register(CLIENT, server), this::approveConsent);
      String otherClient = register(CLIENT, server);

      HttpResponse<String> refused =
          tokenRequest(CLIENT, server, refreshForm(otherClient, grant.refreshToken()));
      assertThat(refused.statusCode()).as(refused.body()).isEqualTo(400);
      assertThat(refused.body()).contains("invalid_grant");
    } finally {
      hardDelete(user);
    }
  }

  /** With self-signup off, signing in at the provider is not enough: the person needs an account. */
  @Test
  void personWithoutAnAccountIsDeniedBeforeConsent(TestNamespace ns) throws Throwable {
    securityConfig.withVariant(
        config -> {
          config.getAuthenticationConfiguration().withEnableSelfSignup(false);
          return config;
        },
        () -> {
          provider.signIn(MockOidcIdentity.forEmail(ns.shortPrefix("stranger") + EMAIL_DOMAIN));
          JsonNode server = discoverAuthorizationServer();
          Authorization authorization = authorizationFor(CLIENT, server, register(CLIENT, server));

          SsoNavigation navigation = navigateUntilTheClient(server, authorization);

          assertThat(navigation.last().status()).as(navigation.describe()).isEqualTo(403);
          assertThat(navigation.last().body())
              .contains("Access Denied")
              .doesNotContain("consent_token");
        });
  }

  // Known gaps. Each test pins what the server answers today for a client behaviour it does not
  // support yet; when support lands, the test fails and is rewritten to expect it.

  /** ChatGPT only uses its stable callback when this RFC 9207 flag is advertised. */
  @Test
  void gapIssuerParameterSupportIsNotAdvertised() throws Exception {
    JsonNode server = discoverAuthorizationServer();

    assertThat(server.has("authorization_response_iss_parameter_supported")).isFalse();
  }

  /** Claude, VS Code, ChatGPT and Codex prefer a client ID metadata document over registration. */
  @Test
  void gapClientIdMetadataDocumentIsNotAccepted() throws Exception {
    provider.clearJournal();
    JsonNode server = discoverAuthorizationServer();
    assertThat(server.has("client_id_metadata_document_supported")).isFalse();
    Authorization authorization = authorizationFor(CLIENT, server, CIMD_CLIENT_ID);

    SsoNavigation navigation = navigateUntilTheClient(server, authorization);

    assertThat(navigation.last().status()).as(navigation.describe()).isEqualTo(400);
    assertThat(provider.requests()).isEmpty();
  }

  /** Claude Code opens with the stateless protocol and falls back to the handshake on this 400. */
  @Test
  void gapStatelessProtocolVersionIsRefused(TestNamespace ns) throws Exception {
    User user = signedInUser(ns);
    try {
      JsonNode server = discoverAuthorizationServer();
      Grant grant = signIn(CLIENT, server, register(CLIENT, server), this::approveConsent);

      HttpResponse<String> probe =
          mcp(
              CLIENT.withProtocolVersion(NEXT_PROTOCOL_VERSION),
              grant.accessToken(),
              rpc("server/discover", Map.of()));

      assertThat(probe.statusCode()).as(probe.body()).isEqualTo(400);
      assertThat(probe.body()).contains("-32600").contains(CLIENT.protocolVersion());
    } finally {
      hardDelete(user);
    }
  }

  /** RFC 8707: a token asked for another resource should be refused; it is issued today. */
  @Test
  void gapResourceParameterIsNotChecked(TestNamespace ns) throws Exception {
    User user = signedInUser(ns);
    try {
      JsonNode server = discoverAuthorizationServer();
      String clientId = register(CLIENT, server);
      Authorization authorization = authorizationFor(CLIENT, server, clientId);
      Map<String, String> request = new LinkedHashMap<>(authorization.request());
      request.put("resource", ANOTHER_RESOURCE);
      String code = approveConsent(server, request).get("code");
      Map<String, String> exchange = exchangeForm(CLIENT, server, clientId, authorization, code);
      exchange.put("resource", ANOTHER_RESOURCE);

      HttpResponse<String> issued = tokenRequest(CLIENT, server, exchange);

      assertThat(issued.statusCode()).as(issued.body()).isEqualTo(200);
      String accessToken = OBJECT_MAPPER.readTree(issued.body()).path("access_token").asText();
      assertThat(mcp(CLIENT, accessToken, rpc("tools/list", Map.of())).statusCode()).isEqualTo(200);
    } finally {
      hardDelete(user);
    }
  }

  @Test
  void publicOidcClientSignsInAndCallsATool(TestNamespace ns) throws Throwable {
    try (MockOidcProvider publicProvider = MockOidcProvider.startPublicClient()) {
      withPublicProvider(
          publicProvider,
          () -> {
            User user = createUser(new CreateUser(), ns.shortPrefix("public"));
            try {
              publicProvider.signIn(MockOidcIdentity.forEmail(user.getEmail()));
              assertClientConnects(CLIENT, user, this::approveConsent);

              assertThat(publicProvider.authorizeRequests()).hasSize(1);
              assertThat(publicProvider.tokenRequests()).hasSize(1);
              var authorization = publicProvider.authorizeRequests().getFirst();
              var exchange = publicProvider.tokenRequests().getFirst();
              String callback = SsoServer.url("/mcp/callback");
              assertThat(authorization.parameter("state")).isNotBlank();
              assertThat(authorization.parameter("nonce")).isNotBlank();
              assertThat(exchange.parameter("code_verifier")).isNotBlank();
              assertThat(authorization.parameters())
                  .containsEntry("client_id", publicProvider.clientId())
                  .containsEntry("redirect_uri", callback)
                  .containsEntry("code_challenge_method", "S256")
                  .containsEntry("code_challenge", s256(exchange.parameter("code_verifier")));
              assertThat(exchange.parameters())
                  .containsEntry("grant_type", "authorization_code")
                  .containsEntry("client_id", publicProvider.clientId())
                  .containsEntry("redirect_uri", callback)
                  .doesNotContainKey("client_secret");
              assertThat(exchange.authorization()).isNull();
            } finally {
              hardDelete(user);
            }
          });
    }
  }

  @Test
  void browserOnlyProviderRegistrationStopsBeforeConsent(TestNamespace ns) throws Throwable {
    try (MockOidcProvider publicProvider = MockOidcProvider.startPublicClient()) {
      publicProvider.registerRedirectForBrowserOnly();
      withPublicProvider(
          publicProvider,
          () -> {
            publicProvider.signIn(
                MockOidcIdentity.forEmail(ns.shortPrefix("browser") + EMAIL_DOMAIN));
            JsonNode server = discoverAuthorizationServer();
            Authorization authorization =
                authorizationFor(CLIENT, server, register(CLIENT, server));

            SsoNavigation navigation = navigateUntilTheClient(server, authorization);

            assertThat(publicProvider.tokenRequests()).hasSize(1);
            assertThat(navigation.last().status()).isEqualTo(502);
            assertThat(navigation.last().body())
                .contains("server-side code exchange")
                .doesNotContain("consent_token");
            assertThat(navigation.pendingUrl()).isNull();
          });
    }
  }

  @Test
  void unexpectedPublicProviderIssuerLeavesTheUserSignedOut(TestNamespace ns) throws Throwable {
    try (MockOidcProvider publicProvider = MockOidcProvider.startPublicClient()) {
      withPublicProvider(
          publicProvider,
          () -> {
            User user = createUser(new CreateUser(), ns.shortPrefix("issuer"));
            try {
              publicProvider.signIn(MockOidcIdentity.forEmail(user.getEmail()));
              publicProvider.defectNextIdToken(IdTokenDefect.WRONG_ISSUER);
              JsonNode server = discoverAuthorizationServer();
              Authorization authorization =
                  authorizationFor(CLIENT, server, register(CLIENT, server));
              SsoBrowser browser = new SsoBrowser();
              SsoNavigation navigation =
                  browser.navigate(
                      authorizeUrl(server, authorization),
                      next -> next.toString().startsWith(CLIENT.redirectUri()));
              assertThat(publicProvider.tokenRequests()).hasSize(1);
              assertThat(navigation.last().status()).isGreaterThanOrEqualTo(400);
              assertThat(navigation.last().body()).doesNotContain("consent_token");
              assertThat(Users.get(user.getId().toString(), "lastLoginTime").getLastLoginTime())
                  .isNull();
              assertThat(browser.get(SsoServer.url(SsoServer.LOGGED_IN_USER_PATH)).statusCode())
                  .isEqualTo(401);
            } finally {
              hardDelete(user);
            }
          });
    }
  }

  @Test
  void publicCallbackUsesItsProvidersKeysDuringConfigurationReload(TestNamespace ns)
      throws Throwable {
    try (MockOidcProvider publicProvider = MockOidcProvider.startPublicClient()) {
      withPublicProvider(
          publicProvider,
          () -> {
            User user = createUser(new CreateUser(), ns.shortPrefix("reload"));
            try {
              publicProvider.signIn(MockOidcIdentity.forEmail(user.getEmail()));
              JsonNode server = discoverAuthorizationServer();
              Authorization authorization =
                  authorizationFor(CLIENT, server, register(CLIENT, server));
              MockResponseGate exchange = publicProvider.holdNextTokenResponse();
              CompletableFuture<SsoNavigation> login =
                  CompletableFuture.supplyAsync(
                      () -> navigateUntilTheClient(server, authorization));
              try {
                assertThat(exchange.awaitArrival(TIMEOUT))
                    .as("public callback reached its provider")
                    .isTrue();
                securityConfig.restoreBaseline();
              } finally {
                exchange.release();
              }
              SsoNavigation result = login.get(TIMEOUT.toSeconds(), TimeUnit.SECONDS);
              assertThat(result.last().status()).isEqualTo(200);
              assertThat(result.last().body()).contains("consent_token");
              assertThat(publicProvider.jwksRequests()).isNotEmpty();
            } finally {
              hardDelete(user);
            }
          });
    }
  }

  private static void withPublicProvider(MockOidcProvider provider, Executable check)
      throws Throwable {
    securityConfig.withVariant(
        config -> SsoConfigs.publicOidc(config, provider),
        () -> {
          // The embedded server listens on an ephemeral port. Advertise that public MCP base to the
          // provider.
          final MCPConfiguration original = SecurityConfigurationManager.getCurrentMcpConfig();
          final MCPConfiguration local =
              original == null
                  ? new MCPConfiguration()
                  : JsonUtils.deepCopy(original, MCPConfiguration.class);
          final SecurityConfigurationManager manager = SecurityConfigurationManager.getInstance();
          try {
            manager.setCurrentMcpConfig(local.withBaseUrl(SsoServer.root()));
            check.execute();
          } finally {
            manager.setCurrentMcpConfig(original);
          }
        });
  }

  private User signedInUser(TestNamespace ns) {
    User user = createUser(new CreateUser(), ns.shortPrefix("mcp"));
    provider.signIn(MockOidcIdentity.forEmail(user.getEmail()));
    provider.clearJournal();
    return user;
  }

  // Stops before the redirect back to the client, whose callback nothing listens on.
  private static SsoNavigation navigateUntilTheClient(
      JsonNode server, Authorization authorization) {
    return new SsoBrowser()
        .navigate(
            authorizeUrl(server, authorization),
            next -> next.toString().startsWith(CLIENT.redirectUri()));
  }

  private static String authorizeUrl(JsonNode server, Authorization authorization) {
    return MockHttp.withQuery(
        onTestServer(server.path("authorization_endpoint").asText()), authorization.request());
  }
}
