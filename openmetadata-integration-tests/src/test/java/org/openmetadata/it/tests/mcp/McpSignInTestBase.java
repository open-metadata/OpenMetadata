package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

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
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterAll;
import org.openmetadata.it.sso.MockHttp;
import org.openmetadata.it.sso.browser.SsoBrowser;
import org.openmetadata.it.sso.browser.SsoNavigation;
import org.openmetadata.it.sso.config.SsoServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;

/**
 * The steps an MCP client and the person using it take to sign in to {@code /mcp}: discovery,
 * registration, the authorization request, the sign-in, the code, the tokens and tool calls.
 */
abstract class McpSignInTestBase extends McpTestBase {
  protected static final String EMAIL_DOMAIN = "@open-metadata.org";
  protected static final String SCOPE = "openid profile email offline_access";
  protected static final String MCP_PATH = "/mcp";
  protected static final String AS_METADATA_PATH = "/.well-known/oauth-authorization-server/mcp";
  protected static final String PROTOCOL_VERSION_HEADER = "MCP-Protocol-Version";
  protected static final String FORWARDED_FOR = "X-Forwarded-For";
  protected static final String FORM = "application/x-www-form-urlencoded";
  protected static final String JSON = "application/json";
  protected static final Duration TIMEOUT = Duration.ofSeconds(30);
  protected static final Pattern RESOURCE_METADATA =
      Pattern.compile("resource_metadata=\"([^\"]+)\"");
  protected static final Pattern CONSENT_ACTION = Pattern.compile("<form[^>]*action=\"([^\"]+)\"");
  protected static final Pattern CONSENT_TOKEN =
      Pattern.compile("name=\"consent_token\" value=\"([^\"]+)\"");
  protected static final Pattern CLIENT_REDIRECT =
      Pattern.compile("window\\.location\\.href=\"([^\"]+)\"");
  protected static final Pattern CSRF_TOKEN =
      Pattern.compile("name=\"csrf_token\" value=\"([^\"]+)\"");
  protected static final String LOGIN_PATH = "/mcp/login";
  protected static final String PASSWORD = "Mcp-Client-It-Passw0rd!";
  protected static final SecureRandom RANDOM = new SecureRandom();
  private static final AtomicInteger REGISTRATIONS = new AtomicInteger();
  private static final List<String> REGISTERED_CLIENTS = new CopyOnWriteArrayList<>();
  private static String clientAddress = "203.0.113.254";

  /** How the person signs in once the authorization request is made; returns the callback's parameters. */
  @FunctionalInterface
  protected interface SignInStep {
    Map<String, String> callback(JsonNode server, Map<String, String> authorize) throws Exception;
  }

  /** An authorization request and the PKCE verifier that redeems its code. */
  protected record Authorization(Map<String, String> request, String verifier) {}

  /** Where the consent page posts the decision, and the token it posts with it. */
  protected record ConsentPage(String action, String token) {}

  /** The tokens of one sign-in. */
  protected record Grant(String accessToken, String refreshToken) {}

  protected void assertClientConnects(McpClientProfile profile, User user, SignInStep signInStep)
      throws Exception {
    JsonNode server = discoverAuthorizationServer();
    String clientId = register(profile, server);

    Grant grant = signIn(profile, server, clientId, signInStep);
    assertCallsToolsAs(profile, grant.accessToken(), user);

    Grant rotated = refresh(profile, server, clientId, grant.refreshToken());
    assertThat(rotated.refreshToken()).isNotEqualTo(grant.refreshToken());
    // A refresh has to leave the client able to work, and the later 401 has to be the revocation.
    assertCallsToolsAs(profile, rotated.accessToken(), user);
    assertThat(tokenRequest(profile, server, refreshForm(clientId, grant.refreshToken())))
        .extracting(HttpResponse::statusCode)
        .isEqualTo(400);

    revoke(profile, server, clientId, rotated.refreshToken());
    assertThat(mcp(profile, rotated.accessToken(), rpc("tools/list", Map.of())).statusCode())
        .isEqualTo(401);
  }

  protected static User createUser(CreateUser create, String name) {
    return SdkClients.adminClient()
        .users()
        .create(create.withName(name).withEmail(name + EMAIL_DOMAIN));
  }

  protected static void hardDelete(User user) {
    SdkClients.adminClient().users().delete(user.getId().toString(), Map.of("hardDelete", "true"));
  }

  // What a client knows at the start is the /mcp URL: the 401 names the resource metadata, which
  // names the authorization server.
  protected JsonNode discoverAuthorizationServer() throws Exception {
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

  // Runs for a class its @BeforeAll skipped too, where no application holds a DAO to look up.
  @AfterAll
  static void deleteRegisteredClients() {
    if (!REGISTERED_CLIENTS.isEmpty()) {
      final var clients = Entity.getCollectionDAO().oauthClientDAO();
      REGISTERED_CLIENTS.forEach(clients::deleteWithGrants);
      REGISTERED_CLIENTS.clear();
    }
  }

  protected String register(McpClientProfile profile, JsonNode server) throws Exception {
    clientAddress = "203.0.113." + (1 + REGISTRATIONS.getAndIncrement() % 250);
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
    String clientId = client.path("client_id").asText();
    REGISTERED_CLIENTS.add(clientId);
    return clientId;
  }

  protected Grant signIn(
      McpClientProfile profile, JsonNode server, String clientId, SignInStep signInStep)
      throws Exception {
    Authorization authorization = authorizationFor(profile, server, clientId);
    Map<String, String> callback = signInStep.callback(server, authorization.request());
    assertThat(callback.get("state")).isEqualTo(authorization.request().get("state"));
    assertThat(callback.get("iss")).isEqualTo(server.path("issuer").asText());
    return grantFrom(
        tokenRequest(
            profile,
            server,
            exchangeForm(profile, server, clientId, authorization, callback.get("code"))));
  }

  protected static Authorization authorizationFor(
      McpClientProfile profile, JsonNode server, String clientId) throws Exception {
    String verifier = randomUrlSafe(48);
    Map<String, String> request = new LinkedHashMap<>();
    request.put("response_type", "code");
    request.put("client_id", clientId);
    request.put("redirect_uri", profile.redirectUri());
    request.put("code_challenge", s256(verifier));
    request.put("code_challenge_method", "S256");
    request.put("state", randomUrlSafe(16));
    request.put("scope", SCOPE);
    addResource(profile, server, request);
    return new Authorization(request, verifier);
  }

  protected static Map<String, String> exchangeForm(
      McpClientProfile profile,
      JsonNode server,
      String clientId,
      Authorization authorization,
      String code) {
    Map<String, String> exchange = new LinkedHashMap<>();
    exchange.put("grant_type", "authorization_code");
    exchange.put("code", code);
    exchange.put("redirect_uri", profile.redirectUri());
    exchange.put("client_id", clientId);
    exchange.put("code_verifier", authorization.verifier());
    addResource(profile, server, exchange);
    return exchange;
  }

  /** The consent page reached by signing in at the identity provider. */
  protected static ConsentPage consentPage(
      SsoBrowser browser, JsonNode server, Map<String, String> authorize) {
    String authorizeUrl =
        MockHttp.withQuery(onTestServer(server.path("authorization_endpoint").asText()), authorize);
    SsoNavigation navigation = browser.navigate(authorizeUrl);
    String page = navigation.last().body();
    Matcher action = CONSENT_ACTION.matcher(page);
    Matcher token = CONSENT_TOKEN.matcher(page);
    assertThat(action.find() && token.find())
        .as("Expected the consent page:\n%s\n%s", navigation.describe(), page)
        .isTrue();
    return new ConsentPage(onTestServer(action.group(1).replace("&amp;", "&")), token.group(1));
  }

  /**
   * Answers the consent page and returns the parameters of the redirect back to the client. The
   * redirect is read, never followed: it targets the client's own callback, which may be a public
   * https address or an application scheme.
   */
  protected static Map<String, String> decide(
      SsoBrowser browser, ConsentPage consent, String decision, String redirectUri) {
    HttpResponse<String> answer =
        browser.postForm(
            consent.action(), Map.of("consent_token", consent.token(), "decision", decision));
    // The server answers with a page whose script sends the browser to the client's callback.
    Matcher redirect = CLIENT_REDIRECT.matcher(answer.body());
    String location =
        redirect.find()
            ? redirect.group(1)
            : answer.headers().firstValue(MockHttp.LOCATION).orElse("");
    assertThat(location).as(answer.body()).startsWith(redirectUri);
    return MockHttp.decode(location.substring(location.indexOf('?') + 1));
  }

  /** Signs in at the provider and approves the client on the consent page. */
  protected Map<String, String> approveConsent(JsonNode server, Map<String, String> authorize) {
    SsoBrowser browser = new SsoBrowser();
    return decide(
        browser, consentPage(browser, server, authorize), "approve", authorize.get("redirect_uri"));
  }

  /** Signs in on the server's password form, which redirects straight back to the client. */
  protected Map<String, String> enterPassword(
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

  protected void assertCallsToolsAs(McpClientProfile profile, String accessToken, User user)
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

  protected Grant refresh(
      McpClientProfile profile, JsonNode server, String clientId, String refreshToken)
      throws Exception {
    return grantFrom(tokenRequest(profile, server, refreshForm(clientId, refreshToken)));
  }

  protected static Map<String, String> refreshForm(String clientId, String refreshToken) {
    return Map.of(
        "grant_type", "refresh_token", "refresh_token", refreshToken, "client_id", clientId);
  }

  protected void revoke(
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

  protected HttpResponse<String> tokenRequest(
      McpClientProfile profile, JsonNode server, Map<String, String> form) throws Exception {
    return send(formPost(profile, server.path("token_endpoint").asText(), form));
  }

  protected static Grant grantFrom(HttpResponse<String> response) throws Exception {
    assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
    JsonNode tokens = OBJECT_MAPPER.readTree(response.body());
    assertThat(tokens.hasNonNull("access_token") && tokens.hasNonNull("refresh_token"))
        .as(response.body())
        .isTrue();
    return new Grant(tokens.get("access_token").asText(), tokens.get("refresh_token").asText());
  }

  protected HttpResponse<String> mcp(
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

  protected static JsonNode result(HttpResponse<String> response) throws Exception {
    assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
    JsonNode message = OBJECT_MAPPER.readTree(extractJsonFromResponse(response.body()));
    assertThat(message.has("result")).as(response.body()).isTrue();
    return message.get("result");
  }

  protected static Map<String, Object> rpc(String method, Map<String, Object> params) {
    return Map.of("jsonrpc", "2.0", "id", 1, "method", method, "params", params);
  }

  protected static void addResource(
      McpClientProfile profile, JsonNode server, Map<String, String> parameters) {
    if (profile.sendsResource()) {
      parameters.put("resource", server.path("issuer").asText());
    }
  }

  protected static HttpRequest formPost(
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

  protected static HttpRequest jsonPost(String path, String body) {
    return HttpRequest.newBuilder(URI.create(SsoServer.url(path)))
        .timeout(TIMEOUT)
        .header("Content-Type", JSON)
        .header("Accept", "application/json, text/event-stream")
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build();
  }

  // Registration and token requests are limited per address. The server trusts X-Forwarded-For
  // from a loopback peer, so each registered client gets its own allowance.
  protected static HttpRequest.Builder request(McpClientProfile profile, String url) {
    HttpRequest.Builder request =
        HttpRequest.newBuilder(URI.create(onTestServer(url)))
            .timeout(TIMEOUT)
            .header(FORWARDED_FOR, clientAddress);
    if (profile.userAgent() != null) {
      request.header("User-Agent", profile.userAgent());
    }
    return request;
  }

  protected static JsonNode getJson(String url) throws Exception {
    HttpResponse<String> response =
        send(HttpRequest.newBuilder(URI.create(url)).timeout(TIMEOUT).GET().build());
    assertThat(response.statusCode()).as(url).isEqualTo(200);
    return OBJECT_MAPPER.readTree(response.body());
  }

  protected static HttpResponse<String> send(HttpRequest request) throws Exception {
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  // The server advertises its configured base URL, while the embedded server listens on a port
  // chosen at start: keep the advertised path and query, send it to the server under test.
  protected static String onTestServer(String advertisedUrl) {
    URI advertised = URI.create(advertisedUrl);
    String query = advertised.getRawQuery() == null ? "" : "?" + advertised.getRawQuery();
    return SsoServer.url(advertised.getRawPath() + query);
  }

  protected static String randomUrlSafe(int bytes) {
    byte[] buffer = new byte[bytes];
    RANDOM.nextBytes(buffer);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(buffer);
  }

  protected static String s256(String verifier) throws Exception {
    byte[] digest =
        MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII));
    return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
  }

  protected static String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
