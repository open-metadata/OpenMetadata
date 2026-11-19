package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.sso.MockHttp;
import org.openmetadata.it.sso.browser.SsoBrowser;
import org.openmetadata.it.sso.browser.SsoNavigation;
import org.openmetadata.it.sso.config.SecurityConfigSwap;
import org.openmetadata.it.sso.config.SsoConfigs;
import org.openmetadata.it.sso.config.SsoServer;
import org.openmetadata.it.sso.oidc.MockOidcIdentity;
import org.openmetadata.it.sso.oidc.MockOidcProvider;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
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
class SsoMcpClientProfilesIT extends McpTestBase {
  private static final String EMAIL_DOMAIN = "@open-metadata.org";
  private static final String SCOPE = "openid profile email offline_access";
  private static final String MCP_PATH = "/mcp";
  private static final String AS_METADATA_PATH = "/.well-known/oauth-authorization-server/mcp";
  private static final String PROTOCOL_VERSION_HEADER = "MCP-Protocol-Version";
  private static final String FORWARDED_FOR = "X-Forwarded-For";
  private static final String FORM = "application/x-www-form-urlencoded";
  private static final String JSON = "application/json";
  private static final Duration TIMEOUT = Duration.ofSeconds(30);
  private static final Pattern RESOURCE_METADATA =
      Pattern.compile("resource_metadata=\"([^\"]+)\"");
  private static final Pattern CONSENT_ACTION = Pattern.compile("<form[^>]*action=\"([^\"]+)\"");
  private static final Pattern CONSENT_TOKEN =
      Pattern.compile("name=\"consent_token\" value=\"([^\"]+)\"");
  private static final Pattern CLIENT_REDIRECT =
      Pattern.compile("window\\.location\\.href=\"([^\"]+)\"");
  private static final Pattern CSRF_TOKEN =
      Pattern.compile("name=\"csrf_token\" value=\"([^\"]+)\"");
  private static final String LOGIN_PATH = "/mcp/login";
  private static final String PASSWORD = "Mcp-Client-It-Passw0rd!";
  private static final SecureRandom RANDOM = new SecureRandom();

  private static MockOidcProvider provider;
  private static SecurityConfigSwap securityConfig;

  /** How the person signs in once the authorization request is made; returns the callback's parameters. */
  @FunctionalInterface
  private interface SignInStep {
    Map<String, String> callback(JsonNode server, Map<String, String> authorize) throws Exception;
  }

  /** The tokens of one sign-in. */
  private record Grant(String accessToken, String refreshToken) {}

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

  private void assertClientConnects(McpClientProfile profile, User user, SignInStep signInStep)
      throws Exception {
    JsonNode server = discoverAuthorizationServer();
    String clientId = register(profile, server);

    Grant grant = signIn(profile, server, clientId, signInStep);
    assertCallsToolsAs(profile, grant.accessToken(), user);

    Grant rotated = refresh(profile, server, clientId, grant.refreshToken());
    assertThat(rotated.refreshToken()).isNotEqualTo(grant.refreshToken());
    assertThat(tokenRequest(profile, server, refreshForm(clientId, grant.refreshToken())))
        .extracting(HttpResponse::statusCode)
        .isEqualTo(400);

    revoke(profile, server, clientId, rotated.refreshToken());
    assertThat(mcp(profile, rotated.accessToken(), rpc("tools/list", Map.of())).statusCode())
        .isEqualTo(401);
  }

  private static SecurityConfiguration basicProvider(SecurityConfiguration config) {
    config
        .getAuthenticationConfiguration()
        .withProvider(AuthProvider.BASIC)
        .withProviderName("OpenMetadata")
        .withClientType(ClientType.PUBLIC);
    return config;
  }

  private static User createUser(CreateUser create, String name) {
    return SdkClients.adminClient()
        .users()
        .create(create.withName(name).withEmail(name + EMAIL_DOMAIN));
  }

  private static void hardDelete(User user) {
    SdkClients.adminClient().users().delete(user.getId().toString(), Map.of("hardDelete", "true"));
  }

  // What a client knows at the start is the /mcp URL: the 401 names the resource metadata, which
  // names the authorization server.
  private JsonNode discoverAuthorizationServer() throws Exception {
    HttpResponse<String> unauthenticated =
        send(jsonPost(MCP_PATH, OBJECT_MAPPER.writeValueAsString(rpc("tools/list", Map.of()))));
    assertThat(unauthenticated.statusCode()).isEqualTo(401);
    Matcher challenge =
        RESOURCE_METADATA.matcher(
            unauthenticated.headers().firstValue("WWW-Authenticate").orElse(""));
    assertThat(challenge.find()).as("401 names the resource metadata").isTrue();

    JsonNode resource = getJson(onTestServer(challenge.group(1)));
    assertThat(resource.path("authorization_servers").path(0).asText()).endsWith(MCP_PATH);

    JsonNode server = getJson(SsoServer.url(AS_METADATA_PATH));
    assertThat(server.path("issuer").asText())
        .isEqualTo(resource.path("authorization_servers").path(0).asText());
    assertThat(server.path("code_challenge_methods_supported").toString()).contains("S256");
    return server;
  }

  private String register(McpClientProfile profile, JsonNode server) throws Exception {
    HttpResponse<String> response =
        send(
            request(profile, server.path("registration_endpoint").asText())
                .header("Content-Type", JSON)
                .POST(
                    HttpRequest.BodyPublishers.ofString(
                        OBJECT_MAPPER.writeValueAsString(profile.registration())))
                .build());
    assertThat(response.statusCode()).as(response.body()).isEqualTo(201);
    JsonNode client = OBJECT_MAPPER.readTree(response.body());
    assertThat(client.hasNonNull("client_secret")).as("a public client gets no secret").isFalse();
    return client.path("client_id").asText();
  }

  private Grant signIn(
      McpClientProfile profile, JsonNode server, String clientId, SignInStep signInStep)
      throws Exception {
    String verifier = randomUrlSafe(48);
    String state = randomUrlSafe(16);
    Map<String, String> authorize = new LinkedHashMap<>();
    authorize.put("response_type", "code");
    authorize.put("client_id", clientId);
    authorize.put("redirect_uri", profile.redirectUri());
    authorize.put("code_challenge", s256(verifier));
    authorize.put("code_challenge_method", "S256");
    authorize.put("state", state);
    authorize.put("scope", SCOPE);
    addResource(profile, server, authorize);

    Map<String, String> callback = signInStep.callback(server, authorize);
    assertThat(callback.get("state")).isEqualTo(state);
    assertThat(callback.get("iss")).isEqualTo(server.path("issuer").asText());

    Map<String, String> exchange = new LinkedHashMap<>();
    exchange.put("grant_type", "authorization_code");
    exchange.put("code", callback.get("code"));
    exchange.put("redirect_uri", profile.redirectUri());
    exchange.put("client_id", clientId);
    exchange.put("code_verifier", verifier);
    addResource(profile, server, exchange);
    return grantFrom(tokenRequest(profile, server, exchange));
  }

  /**
   * Signs in at the provider and approves the client on the consent page, returning the parameters
   * of the redirect back to the client. The redirect is read, never followed: it targets the
   * client's own callback, which may be a public https address or an application scheme.
   */
  private Map<String, String> approveConsent(JsonNode server, Map<String, String> authorize) {
    SsoBrowser browser = new SsoBrowser();
    String authorizeUrl =
        MockHttp.withQuery(onTestServer(server.path("authorization_endpoint").asText()), authorize);
    SsoNavigation navigation = browser.navigate(authorizeUrl);
    String consentPage = navigation.last().body();
    Matcher action = CONSENT_ACTION.matcher(consentPage);
    Matcher token = CONSENT_TOKEN.matcher(consentPage);
    assertThat(action.find() && token.find())
        .as("Expected the consent page:\n%s\n%s", navigation.describe(), consentPage)
        .isTrue();

    HttpResponse<String> decision =
        browser.postForm(
            onTestServer(action.group(1).replace("&amp;", "&")),
            Map.of("consent_token", token.group(1), "decision", "approve"));
    // The server answers with a page whose script sends the browser to the client's callback.
    Matcher redirect = CLIENT_REDIRECT.matcher(decision.body());
    assertThat(redirect.find()).as(decision.body()).isTrue();
    String location = redirect.group(1);
    assertThat(location).startsWith(authorize.get("redirect_uri"));
    return MockHttp.decode(location.substring(location.indexOf('?') + 1));
  }

  /** Signs in on the server's password form, which redirects straight back to the client. */
  private Map<String, String> enterPassword(
      JsonNode server, Map<String, String> authorize, User user) {
    SsoBrowser browser = new SsoBrowser();
    String authorizeUrl =
        MockHttp.withQuery(onTestServer(server.path("authorization_endpoint").asText()), authorize);
    // The redirect to the login form names the advertised base URL, so it is not followed as is.
    String loginUrl =
        onTestServer(
            browser
                .navigate(authorizeUrl, SsoBrowser.pathIs(LOGIN_PATH))
                .requirePendingUrl()
                .toString());
    HttpResponse<String> form = browser.get(loginUrl);
    Matcher csrf = CSRF_TOKEN.matcher(form.body());
    assertThat(csrf.find()).as("Expected the login form:\n%s", form.body()).isTrue();

    HttpResponse<String> login =
        browser.postForm(
            SsoServer.url(LOGIN_PATH),
            Map.of("csrf_token", csrf.group(1), "username", user.getEmail(), "password", PASSWORD));
    String location = login.headers().firstValue(MockHttp.LOCATION).orElse("");
    assertThat(location).as(login.body()).startsWith(authorize.get("redirect_uri"));
    return MockHttp.decode(location.substring(location.indexOf('?') + 1));
  }

  private void assertCallsToolsAs(McpClientProfile profile, String accessToken, User user)
      throws Exception {
    Map<String, Object> initialize =
        Map.of(
            "protocolVersion", profile.protocolVersion(),
            "capabilities", Map.of(),
            "clientInfo", Map.of("name", profile.label(), "version", "1.0.0"));
    JsonNode initialized = result(mcp(profile, accessToken, rpc("initialize", initialize)));
    assertThat(initialized.path("protocolVersion").asText()).isEqualTo(profile.protocolVersion());

    JsonNode tools = result(mcp(profile, accessToken, rpc("tools/list", Map.of())));
    assertThat(tools.path("tools")).isNotEmpty();

    Map<String, Object> call =
        Map.of(
            "name",
            "get_user_context",
            "arguments",
            Map.of("includeOwnedSummary", false, "includeFollowedSummary", false));
    JsonNode called = result(mcp(profile, accessToken, rpc("tools/call", call)));
    JsonNode payload =
        called.has("structuredContent")
            ? called.get("structuredContent")
            : OBJECT_MAPPER.readTree(called.path("content").path(0).path("text").asText());
    assertThat(payload.path("user").path("name").asText()).isEqualTo(user.getName());
  }

  private Grant refresh(
      McpClientProfile profile, JsonNode server, String clientId, String refreshToken)
      throws Exception {
    return grantFrom(tokenRequest(profile, server, refreshForm(clientId, refreshToken)));
  }

  private static Map<String, String> refreshForm(String clientId, String refreshToken) {
    return Map.of(
        "grant_type", "refresh_token", "refresh_token", refreshToken, "client_id", clientId);
  }

  private void revoke(
      McpClientProfile profile, JsonNode server, String clientId, String refreshToken)
      throws Exception {
    HttpResponse<String> response =
        send(
            formPost(
                profile,
                server.path("revocation_endpoint").asText(),
                Map.of("token", refreshToken, "client_id", clientId)));
    assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
  }

  private HttpResponse<String> tokenRequest(
      McpClientProfile profile, JsonNode server, Map<String, String> form) throws Exception {
    return send(formPost(profile, server.path("token_endpoint").asText(), form));
  }

  private static Grant grantFrom(HttpResponse<String> response) throws Exception {
    assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
    JsonNode tokens = OBJECT_MAPPER.readTree(response.body());
    assertThat(tokens.hasNonNull("access_token") && tokens.hasNonNull("refresh_token"))
        .as(response.body())
        .isTrue();
    return new Grant(tokens.get("access_token").asText(), tokens.get("refresh_token").asText());
  }

  private HttpResponse<String> mcp(
      McpClientProfile profile, String accessToken, Map<String, Object> message) throws Exception {
    HttpRequest.Builder request =
        request(profile, SsoServer.url(MCP_PATH))
            .header("Content-Type", JSON)
            .header("Accept", "application/json, text/event-stream")
            .header(MockHttp.AUTHORIZATION, "Bearer " + accessToken);
    if (!"initialize".equals(message.get("method"))) {
      request.header(PROTOCOL_VERSION_HEADER, profile.protocolVersion());
    }
    return send(
        request
            .POST(HttpRequest.BodyPublishers.ofString(OBJECT_MAPPER.writeValueAsString(message)))
            .build());
  }

  private static JsonNode result(HttpResponse<String> response) throws Exception {
    assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
    JsonNode message = OBJECT_MAPPER.readTree(extractJsonFromResponse(response.body()));
    assertThat(message.has("result")).as(response.body()).isTrue();
    return message.get("result");
  }

  private static Map<String, Object> rpc(String method, Map<String, Object> params) {
    return Map.of("jsonrpc", "2.0", "id", 1, "method", method, "params", params);
  }

  private static void addResource(
      McpClientProfile profile, JsonNode server, Map<String, String> parameters) {
    if (profile.sendsResource()) {
      parameters.put("resource", server.path("issuer").asText());
    }
  }

  private static HttpRequest formPost(
      McpClientProfile profile, String url, Map<String, String> form) {
    String body =
        form.entrySet().stream()
            .map(field -> encode(field.getKey()) + "=" + encode(field.getValue()))
            .collect(Collectors.joining("&"));
    return request(profile, url)
        .header("Content-Type", FORM)
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build();
  }

  private static HttpRequest jsonPost(String path, String body) {
    return HttpRequest.newBuilder(URI.create(SsoServer.url(path)))
        .timeout(TIMEOUT)
        .header("Content-Type", JSON)
        .header("Accept", "application/json, text/event-stream")
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build();
  }

  // Registration and token requests are limited per address. The server trusts X-Forwarded-For
  // from a loopback peer, so each profile gets its own allowance.
  private static HttpRequest.Builder request(McpClientProfile profile, String url) {
    HttpRequest.Builder request =
        HttpRequest.newBuilder(URI.create(onTestServer(url)))
            .timeout(TIMEOUT)
            .header(
                FORWARDED_FOR,
                "203.0.113." + (10 + McpClientProfile.oauthClients().indexOf(profile)));
    if (profile.userAgent() != null) {
      request.header("User-Agent", profile.userAgent());
    }
    return request;
  }

  private static JsonNode getJson(String url) throws Exception {
    HttpResponse<String> response =
        send(HttpRequest.newBuilder(URI.create(url)).timeout(TIMEOUT).GET().build());
    assertThat(response.statusCode()).as(url).isEqualTo(200);
    return OBJECT_MAPPER.readTree(response.body());
  }

  private static HttpResponse<String> send(HttpRequest request) throws Exception {
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  // The server advertises its configured base URL, while the embedded server listens on a port
  // chosen at start: keep the advertised path and query, send it to the server under test.
  private static String onTestServer(String advertisedUrl) {
    URI advertised = URI.create(advertisedUrl);
    String query = advertised.getRawQuery() == null ? "" : "?" + advertised.getRawQuery();
    return SsoServer.url(advertised.getRawPath() + query);
  }

  private static String randomUrlSafe(int bytes) {
    byte[] buffer = new byte[bytes];
    RANDOM.nextBytes(buffer);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(buffer);
  }

  private static String s256(String verifier) throws Exception {
    byte[] digest =
        MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII));
    return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
  }

  private static String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
