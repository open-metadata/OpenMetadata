package org.openmetadata.it.sso.oidc;

import static org.openmetadata.it.sso.oidc.MockOidcProtocol.AUTHORIZE_PATH;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.CODE;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.CODE_CHALLENGE;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.DISCOVERY_PATH;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.ERROR;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.GRANT_AUTHORIZATION_CODE;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.GRANT_CLIENT_CREDENTIALS;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.GRANT_REFRESH_TOKEN;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.ISSUER;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.JWKS_PATH;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.LOGIN_REQUIRED;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.NONCE;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.OFFLINE_ACCESS;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.REDIRECT_URI;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.SCOPE;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.STATE;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.TOKEN_PATH;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.USERINFO_PATH;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.openmetadata.it.sso.MockHttp;
import org.openmetadata.it.sso.MockRequestJournal;
import org.openmetadata.it.sso.MockRequestJournal.RecordedRequest;
import org.openmetadata.it.sso.MockResponseGate;
import org.openmetadata.it.sso.oidc.MockOidcProtocol.Discovery;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * An OpenID provider that runs inside the integration-test JVM. It signs real RS256 ID tokens,
 * serves discovery and JWKS, and answers the authorize and token endpoints for one registered
 * client, so the server under test runs its production OIDC code against it unchanged.
 *
 * <p>The authorize endpoint never shows a login page: it consents for whoever {@link #signIn}
 * named, and answers {@code login_required} when nobody is signed in.
 */
public final class MockOidcProvider implements AutoCloseable {
  public static final String CLIENT_ID = "om-sso-it-client";
  public static final String CLIENT_SECRET = "om-sso-it-client-secret";
  public static final String CLIENT_SECRET_BASIC = "client_secret_basic";
  public static final String CLIENT_SECRET_POST = "client_secret_post";
  private static final String WRONG_ISSUER = "https://a-different-issuer.example.com";
  private static final int OK = 200;
  private static final int UNAUTHORIZED = 401;

  private final MockHttp.LoopbackServer server;
  private final OidcProviderProfile profile;
  private final String baseUrl;
  private final String issuer;
  private final MockOidcKeys keys = new MockOidcKeys();
  private final MockRequestJournal journal = new MockRequestJournal();
  private final MockOidcTokens tokens;
  private final MockOidcTokenEndpoint tokenEndpoint;
  private final AtomicReference<MockOidcIdentity> signedInUser = new AtomicReference<>();
  private final AtomicReference<IssuerParameter> issuerParameter =
      new AtomicReference<>(IssuerParameter.NOT_ADVERTISED);
  private final AtomicReference<MockResponseGate> nextJwksGate = new AtomicReference<>();

  private MockOidcProvider(MockHttp.LoopbackServer server, OidcProviderProfile profile) {
    this.server = server;
    this.profile = profile;
    this.baseUrl = server.localhostUrl();
    this.issuer = profile.discoveryIssuer(baseUrl);
    this.tokens = new MockOidcTokens(profile.tokenIssuer(baseUrl), CLIENT_ID, keys, profile);
    this.tokenEndpoint = new MockOidcTokenEndpoint(tokens, journal, CLIENT_ID, CLIENT_SECRET);
  }

  public static MockOidcProvider start() {
    return start(OidcProviderProfile.CUSTOM);
  }

  /** A provider that shapes its issuer and claims the way {@code profile}'s real one does. */
  public static MockOidcProvider start(OidcProviderProfile profile) {
    MockOidcProvider provider = new MockOidcProvider(MockHttp.bindLoopbackServer(), profile);
    provider.server.start(provider.routes());
    return provider;
  }

  public OidcProviderProfile profile() {
    return profile;
  }

  /** The issuer the discovery document names, which need not be the mock's own address. */
  public String issuer() {
    return issuer;
  }

  public String discoveryUri() {
    return baseUrl + DISCOVERY_PATH;
  }

  public String jwksUri() {
    return baseUrl + JWKS_PATH;
  }

  /** Makes {@code identity} the user signed in at the provider; logins consent as them. */
  public void signIn(MockOidcIdentity identity) {
    signedInUser.set(identity);
  }

  public void signOut() {
    signedInUser.set(null);
  }

  /** Mints an ID token directly, as a single-page app receives one in the public-client flow. */
  public String issueIdToken(MockOidcIdentity identity) {
    return tokens.idToken(identity, null);
  }

  /** An ID token for {@code identity} that only looks like this provider issued it. */
  public String issueForgedIdToken(MockOidcIdentity identity, TokenForgery forgery) {
    return tokens.forgedIdToken(identity, forgery);
  }

  public String lastIssuedIdToken() {
    return tokens.lastIssuedIdToken();
  }

  /** The next ID token issued (at login, refresh or {@link #issueIdToken}) carries {@code defect}. */
  public void defectNextIdToken(IdTokenDefect defect) {
    tokens.defectNextIdToken(defect);
  }

  public void answerRefreshesWith(RefreshOutcome outcome) {
    tokenEndpoint.answerRefreshesWith(outcome);
  }

  /**
   * Holds a token response until the returned gate is released. Calling it twice holds the next two
   * token requests, in the order they arrive.
   */
  public MockResponseGate holdNextTokenResponse() {
    return tokenEndpoint.holdNextResponse();
  }

  /** Holds the next JWKS response until the returned gate is released. */
  public MockResponseGate holdNextJwksResponse() {
    MockResponseGate gate = new MockResponseGate();
    nextJwksGate.set(gate);
    return gate;
  }

  public void useIssuerParameter(IssuerParameter mode) {
    issuerParameter.set(mode);
  }

  public void rotateSigningKey() {
    keys.rotate();
  }

  public List<RecordedRequest> requests() {
    return journal.requests();
  }

  public List<RecordedRequest> tokenRequests() {
    return journal.requestsTo(TOKEN_PATH);
  }

  public List<RecordedRequest> authorizeRequests() {
    return journal.requestsTo(AUTHORIZE_PATH);
  }

  public List<RecordedRequest> jwksRequests() {
    return journal.requestsTo(JWKS_PATH);
  }

  public List<RecordedRequest> userinfoRequests() {
    return journal.requestsTo(USERINFO_PATH);
  }

  public void clearJournal() {
    journal.clear();
  }

  @Override
  public void close() {
    server.close();
  }

  private Map<String, HttpHandler> routes() {
    return Map.of(
        DISCOVERY_PATH, this::handleDiscovery,
        AUTHORIZE_PATH, this::handleAuthorize,
        TOKEN_PATH, tokenEndpoint,
        JWKS_PATH, this::handleJwks,
        USERINFO_PATH, this::handleUserinfo);
  }

  private void handleDiscovery(HttpExchange exchange) throws IOException {
    journal.record(exchange, Map.of());
    MockHttp.respondJson(exchange, OK, JsonUtils.pojoToJson(discovery()));
  }

  private void handleJwks(HttpExchange exchange) throws IOException {
    journal.record(exchange, Map.of());
    Optional.ofNullable(nextJwksGate.getAndSet(null)).ifPresent(MockResponseGate::holdResponse);
    MockHttp.respondJson(exchange, OK, keys.jwksJson());
  }

  private void handleUserinfo(HttpExchange exchange) throws IOException {
    journal.record(exchange, Map.of());
    MockOidcIdentity user = signedInUser.get();
    if (user == null) {
      MockHttp.respond(exchange, UNAUTHORIZED, "no user is signed in");
    } else {
      Map<String, Object> claims = new LinkedHashMap<>(user.identityClaims());
      claims.put("sub", user.subject());
      MockHttp.respondJson(exchange, OK, JsonUtils.pojoToJson(claims));
    }
  }

  private void handleAuthorize(HttpExchange exchange) throws IOException {
    Map<String, String> query = MockHttp.queryParameters(exchange);
    journal.record(exchange, query);
    Map<String, String> callback = new LinkedHashMap<>(authorizationResult(query));
    copyState(query, callback);
    addIssuerParameter(callback);
    MockHttp.redirect(exchange, MockHttp.withQuery(query.get(REDIRECT_URI), callback));
  }

  private Map<String, String> authorizationResult(Map<String, String> query) {
    MockOidcIdentity user = signedInUser.get();
    return user == null ? Map.of(ERROR, LOGIN_REQUIRED) : Map.of(CODE, issueCode(user, query));
  }

  private String issueCode(MockOidcIdentity user, Map<String, String> query) {
    return tokens.issueCode(
        new AuthorizationGrant(
            user,
            query.get(REDIRECT_URI),
            query.get(NONCE),
            query.get(CODE_CHALLENGE),
            query.get(SCOPE)));
  }

  private static void copyState(Map<String, String> query, Map<String, String> callback) {
    if (query.containsKey(STATE)) {
      callback.put(STATE, query.get(STATE));
    }
  }

  private void addIssuerParameter(Map<String, String> callback) {
    switch (issuerParameter.get()) {
      case CORRECT -> callback.put(ISSUER, issuer);
      case WRONG -> callback.put(ISSUER, WRONG_ISSUER);
      case NOT_ADVERTISED, OMITTED -> {}
    }
  }

  private Discovery discovery() {
    IssuerParameter mode = issuerParameter.get();
    return new Discovery(
        issuer,
        baseUrl + AUTHORIZE_PATH,
        baseUrl + TOKEN_PATH,
        jwksUri(),
        baseUrl + USERINFO_PATH,
        List.of("openid", "email", "profile", OFFLINE_ACCESS),
        List.of("code", "id_token", "code id_token"),
        List.of("public"),
        List.of("RS256"),
        List.of(CLIENT_SECRET_BASIC, CLIENT_SECRET_POST),
        List.of("S256"),
        List.of(GRANT_AUTHORIZATION_CODE, GRANT_REFRESH_TOKEN, GRANT_CLIENT_CREDENTIALS),
        mode.isAdvertised() ? Boolean.TRUE : null);
  }
}
