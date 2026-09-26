/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicReference;
import java.util.zip.Inflater;
import org.eclipse.jetty.ee10.servlet.ServletContextHandler;
import org.eclipse.jetty.ee10.servlet.ServletHolder;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.ServerConnector;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.catalog.type.SamlSecurityConfig;
import org.openmetadata.catalog.type.ServiceProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.security.auth.SamlAuthServletHandler;
import org.openmetadata.service.security.saml.MockSamlIdp;
import org.openmetadata.service.security.saml.SamlAssertionConsumerServlet;
import org.openmetadata.service.security.saml.SamlLoginServlet;
import org.openmetadata.service.security.saml.SamlMetadataServlet;
import org.openmetadata.service.security.saml.SamlSettingsHolder;
import org.openmetadata.service.security.session.SessionIdGenerator;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.SessionStore;
import org.openmetadata.service.security.session.SessionType;
import org.openmetadata.service.security.session.UserSession;

class SsoRedirectBoundaryTest {
  private static final String TRUSTED_REDIRECT = "https://app.example.com/auth/callback";
  private static final String ATTACKER_REDIRECT = "https://attacker.example/collect";
  private static final String SERVER_URL = "https://openmetadata.example.com";
  private static final String INVALID_REDIRECT_MESSAGE =
      "Redirect URI must exactly match a trusted redirect URI";
  private static final String PRIMARY_CALLBACK = SERVER_URL + "/callback";
  private static final String DR_CALLBACK = "https://dr.example.com/callback";
  private static final String DR_AUTH_CALLBACK = "https://dr.example.com/auth/callback";
  private static final String SP_ENTITY_ID = SERVER_URL + "/api/v1/saml/metadata";
  private static final String PRIMARY_ACS = SERVER_URL + "/api/v1/saml/acs";
  private static final String DR_ACS = "https://dr.example.com/api/v1/saml/acs";
  private static final String IDP_ENTITY_ID = "https://idp.example.com/metadata";

  private final HttpClient httpClient =
      HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();
  private Server server;
  private HttpServer oidcProvider;
  private final AtomicReference<String> tokenRequestBody = new AtomicReference<>();

  @AfterEach
  void stopServer() throws Exception {
    if (server != null) {
      server.stop();
    }
    if (oidcProvider != null) {
      oidcProvider.stop(0);
    }
  }

  @Test
  void oidcLoginRejectsUntrustedRedirectWithoutPersistingSession() throws Exception {
    InMemorySessionStore store = new InMemorySessionStore();
    URI baseUri = startServer(newOidcHandler(store));

    HttpResponse<String> response =
        get(
            baseUri.resolve(
                "/api/v1/auth/login?redirectUri="
                    + URLEncoder.encode(ATTACKER_REDIRECT, StandardCharsets.UTF_8)),
            null);

    assertRejected(response);
    assertTrue(store.isEmpty());
  }

  @Test
  void oidcCallbackRejectsTamperedSessionWithoutConsumingIt() throws Exception {
    InMemorySessionStore store = new InMemorySessionStore();
    UserSession pendingSession = storeTamperedPendingSession(store, "google");
    URI baseUri = startServer(newOidcHandler(store));

    HttpResponse<String> response =
        get(
            baseUri.resolve("/callback?code=authorization-code&state=state-abc"),
            "OM_SESSION=" + pendingSession.getId());

    assertRejected(response);
    assertPendingSessionUnchanged(store, pendingSession);
  }

  @Test
  void samlLoginRejectsUntrustedRedirectWithoutPersistingSession() throws Exception {
    InMemorySessionStore store = new InMemorySessionStore();
    URI baseUri = startServer(newSamlHandler(store));

    HttpResponse<String> response =
        get(
            baseUri.resolve(
                "/api/v1/saml/login?callback="
                    + URLEncoder.encode(ATTACKER_REDIRECT, StandardCharsets.UTF_8)),
            null);

    assertRejected(response);
    assertTrue(store.isEmpty());
  }

  @Test
  void samlCallbackRejectsTamperedSessionWithoutConsumingIt() throws Exception {
    InMemorySessionStore store = new InMemorySessionStore();
    UserSession pendingSession = storeTamperedPendingSession(store, "saml");
    URI baseUri = startServer(newSamlHandler(store));

    HttpRequest request =
        HttpRequest.newBuilder(baseUri.resolve("/api/v1/saml/acs"))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(
                HttpRequest.BodyPublishers.ofString(
                    "RelayState="
                        + URLEncoder.encode(pendingSession.getId(), StandardCharsets.UTF_8)))
            .build();
    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

    assertRejected(response);
    assertPendingSessionUnchanged(store, pendingSession);
  }

  @Test
  void oidcLoginSendsTheCallbackUrlRegisteredForTheRequestHost() throws Exception {
    InMemorySessionStore store = new InMemorySessionStore();
    URI baseUri = startServer(newOidcHandler(store, List.of(DR_CALLBACK)));

    HttpResponse<String> response = loginVia(baseUri, "dr.example.com", DR_AUTH_CALLBACK);

    assertEquals(302, response.statusCode());
    assertEquals(DR_CALLBACK, sentRedirectUri(response));
    UserSession pendingSession = store.onlySession();
    assertEquals(DR_CALLBACK, pendingSession.getIdpRedirectUri());
    assertEquals(DR_AUTH_CALLBACK, pendingSession.getRedirectUri());
  }

  /** A forged host can make the login land on itself, but never send an unregistered callback. */
  @Test
  void oidcLoginKeepsThePrimaryCallbackUrlForAnUnregisteredHost() throws Exception {
    InMemorySessionStore store = new InMemorySessionStore();
    URI baseUri = startServer(newOidcHandler(store, List.of(DR_CALLBACK)));

    HttpResponse<String> response =
        loginVia(baseUri, "evil.example.com", "https://evil.example.com/auth/callback");

    assertEquals(302, response.statusCode());
    assertEquals(PRIMARY_CALLBACK, sentRedirectUri(response));
    assertNull(store.onlySession().getIdpRedirectUri());
  }

  @Test
  void oidcLoginKeepsThePrimaryCallbackUrlWhenNoneAreConfigured() throws Exception {
    InMemorySessionStore store = new InMemorySessionStore();
    URI baseUri = startServer(newOidcHandler(store));

    HttpResponse<String> response = loginVia(baseUri, "dr.example.com", DR_AUTH_CALLBACK);

    assertEquals(302, response.statusCode());
    assertEquals(PRIMARY_CALLBACK, sentRedirectUri(response));
    assertNull(store.onlySession().getIdpRedirectUri());
  }

  /** RFC 6749 §4.1.3: the token request repeats the redirect_uri the login sent, byte for byte. */
  @Test
  void oidcCallbackExchangesTheCodeWithTheCallbackUrlTheLoginSent() throws Exception {
    InMemorySessionStore store = new InMemorySessionStore();
    URI baseUri = startServer(newOidcHandler(store, List.of(DR_CALLBACK)));
    UserSession pendingSession = storePendingSession(store, DR_CALLBACK);

    HttpResponse<String> callback =
        get(
            baseUri.resolve("/callback?code=authorization-code&state=state-abc"),
            "OM_SESSION=" + pendingSession.getId(),
            arrivingVia("dr.example.com"));

    assertEquals(
        DR_CALLBACK,
        formParameter(tokenRequestBody.get(), "redirect_uri"),
        () -> "callback answered " + callback.statusCode() + ": " + callback.body());
  }

  @Test
  void oidcCallbackExchangesTheCodeWithThePrimaryForSessionsThatRecordedNone() throws Exception {
    InMemorySessionStore store = new InMemorySessionStore();
    URI baseUri = startServer(newOidcHandler(store, List.of(DR_CALLBACK)));
    UserSession pendingSession = storePendingSession(store, null);

    HttpResponse<String> callback =
        get(
            baseUri.resolve("/callback?code=authorization-code&state=state-abc"),
            "OM_SESSION=" + pendingSession.getId(),
            arrivingVia("dr.example.com"));

    assertEquals(
        PRIMARY_CALLBACK,
        formParameter(tokenRequestBody.get(), "redirect_uri"),
        () -> "callback answered " + callback.statusCode() + ": " + callback.body());
  }

  @Test
  void oidcCallbackWithoutPendingSessionSendsSigninToTheRegisteredRequestHostOnly()
      throws Exception {
    URI baseUri = startServer(newOidcHandler(new InMemorySessionStore(), List.of(DR_CALLBACK)));
    URI callback = baseUri.resolve("/callback?code=authorization-code&state=state-abc");

    HttpResponse<String> onRegisteredHost = get(callback, null, arrivingVia("dr.example.com"));
    HttpResponse<String> onForgedHost = get(callback, null, arrivingVia("evil.example.com"));

    assertEquals(
        "https://dr.example.com/signin",
        onRegisteredHost.headers().firstValue("Location").orElseThrow());
    assertEquals(
        SERVER_URL + "/signin", onForgedHost.headers().firstValue("Location").orElseThrow());
  }

  @Test
  void samlLoginSendsTheAcsRegisteredForTheRequestHost() throws Exception {
    InMemorySessionStore store = new InMemorySessionStore();
    URI baseUri = startServer(newMultiHostSamlHandler(store));

    HttpResponse<String> response =
        get(samlLogin(baseUri, DR_AUTH_CALLBACK), null, arrivingVia("dr.example.com"));

    assertEquals(302, response.statusCode());
    String authnRequest = decodedAuthnRequest(response);
    assertTrue(
        authnRequest.contains("AssertionConsumerServiceURL=\"" + DR_ACS + "\""), authnRequest);
    assertTrue(authnRequest.contains(">" + SP_ENTITY_ID + "</saml:Issuer>"), authnRequest);
    assertEquals(DR_ACS, store.onlySession().getIdpRedirectUri());
  }

  @Test
  void samlMetadataAdvertisesEveryAcsUnderOneEntityId() throws Exception {
    URI baseUri = startServer(newMultiHostSamlHandler(new InMemorySessionStore()));

    HttpResponse<String> response = get(baseUri.resolve("/api/v1/saml/metadata"), null);

    assertEquals(200, response.statusCode());
    assertTrue(response.body().contains("Location=\"" + PRIMARY_ACS + "\""), response.body());
    assertTrue(response.body().contains("Location=\"" + DR_ACS + "\""), response.body());
    assertTrue(response.body().contains("entityID=\"" + SP_ENTITY_ID + "\""), response.body());
  }

  @Test
  void samlLoginKeepsThePrimaryAcsForAnUnregisteredHost() throws Exception {
    InMemorySessionStore store = new InMemorySessionStore();
    URI baseUri = startServer(newMultiHostSamlHandler(store));

    HttpResponse<String> response =
        get(samlLogin(baseUri, TRUSTED_REDIRECT), null, arrivingVia("evil.example.com"));

    assertEquals(302, response.statusCode());
    String authnRequest = decodedAuthnRequest(response);
    assertTrue(
        authnRequest.contains("AssertionConsumerServiceURL=\"" + PRIMARY_ACS + "\""), authnRequest);
    assertTrue(authnRequest.contains(">" + SP_ENTITY_ID + "</saml:Issuer>"), authnRequest);
    assertNull(store.onlySession().getIdpRedirectUri());
  }

  private AuthenticationCodeFlowHandler newOidcHandler(InMemorySessionStore store) {
    return newOidcHandler(store, List.of());
  }

  private AuthenticationCodeFlowHandler newOidcHandler(
      InMemorySessionStore store, List<String> additionalCallbackUrls) {
    AuthenticationConfiguration authConfig =
        oidcAuthConfig(startOidcProvider()).withAdditionalCallbackUrls(additionalCallbackUrls);
    return new AuthenticationCodeFlowHandler(
        authConfig, new AuthorizerConfiguration(), new SessionService(authConfig, store));
  }

  private SamlAuthServletHandler newSamlHandler(InMemorySessionStore store) {
    AuthenticationConfiguration authConfig = samlAuthConfig();
    return new SamlAuthServletHandler(
        authConfig, new AuthorizerConfiguration(), new SessionService(authConfig, store));
  }

  private SamlAuthServletHandler newMultiHostSamlHandler(InMemorySessionStore store)
      throws Exception {
    SamlSSOClientConfig samlConfig =
        new SamlSSOClientConfig()
            .withIdp(
                new IdentityProviderConfig()
                    .withEntityId(IDP_ENTITY_ID)
                    .withSsoLoginUrl("https://idp.example.com/sso")
                    .withIdpX509Certificate(new MockSamlIdp(IDP_ENTITY_ID).idpCertificatePem()))
            .withSp(
                new ServiceProviderConfig()
                    .withEntityId(SP_ENTITY_ID)
                    .withAcs(PRIMARY_ACS)
                    .withCallback(TRUSTED_REDIRECT)
                    .withAdditionalAcsUrls(List.of(DR_ACS)))
            .withSecurity(new SamlSecurityConfig());
    SamlSettingsHolder.initSettings(samlConfig);
    AuthenticationConfiguration authConfig =
        baseAuthConfig(AuthProvider.SAML).withSamlConfiguration(samlConfig);
    return new SamlAuthServletHandler(
        authConfig, new AuthorizerConfiguration(), new SessionService(authConfig, store));
  }

  private static URI samlLogin(URI baseUri, String callback) {
    return baseUri.resolve(
        "/api/v1/saml/login?callback=" + URLEncoder.encode(callback, StandardCharsets.UTF_8));
  }

  /** The HTTP-Redirect binding carries the AuthnRequest raw-deflated and base64-encoded. */
  private static String decodedAuthnRequest(HttpResponse<String> response) throws Exception {
    URI location = URI.create(response.headers().firstValue("Location").orElseThrow());
    byte[] deflated =
        Base64.getDecoder().decode(formParameter(location.getRawQuery(), "SAMLRequest"));
    Inflater inflater = new Inflater(true);
    inflater.setInput(deflated);
    byte[] buffer = new byte[65536];
    int length = inflater.inflate(buffer);
    inflater.end();
    return new String(buffer, 0, length, StandardCharsets.UTF_8);
  }

  private AuthenticationConfiguration oidcAuthConfig(String discoveryUri) {
    OidcClientConfig oidcConfig =
        new OidcClientConfig()
            .withId("boundary-test-client")
            .withSecret("boundary-test-secret")
            .withDiscoveryUri(discoveryUri)
            .withServerUrl(SERVER_URL)
            .withCallbackUrl(SERVER_URL + "/callback");
    return baseAuthConfig(AuthProvider.GOOGLE).withOidcConfiguration(oidcConfig);
  }

  private String startOidcProvider() {
    try {
      oidcProvider = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
      String issuer = "http://127.0.0.1:" + oidcProvider.getAddress().getPort();
      byte[] discoveryDocument =
          ("""
          {
            "issuer": "%s",
            "authorization_endpoint": "%s/authorize",
            "token_endpoint": "%s/token",
            "jwks_uri": "%s/keys",
            "response_types_supported": ["code"],
            "subject_types_supported": ["public"],
            "id_token_signing_alg_values_supported": ["RS256"],
            "scopes_supported": ["openid", "profile", "email"],
            "token_endpoint_auth_methods_supported": ["client_secret_post"],
            "grant_types_supported": ["authorization_code"]
          }
          """
                  .formatted(issuer, issuer, issuer, issuer))
              .getBytes(StandardCharsets.UTF_8);
      oidcProvider.createContext(
          "/.well-known/openid-configuration",
          exchange -> {
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, discoveryDocument.length);
            try (OutputStream responseBody = exchange.getResponseBody()) {
              responseBody.write(discoveryDocument);
            }
          });
      oidcProvider.createContext(
          "/token",
          exchange -> {
            tokenRequestBody.set(
                new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] refusal = "{\"error\":\"invalid_grant\"}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(400, refusal.length);
            try (OutputStream responseBody = exchange.getResponseBody()) {
              responseBody.write(refusal);
            }
          });
      oidcProvider.start();
      return issuer + "/.well-known/openid-configuration";
    } catch (IOException e) {
      throw new IllegalStateException("Failed to start the OIDC boundary", e);
    }
  }

  private AuthenticationConfiguration samlAuthConfig() {
    ServiceProviderConfig serviceProvider =
        new ServiceProviderConfig()
            .withAcs(SERVER_URL + "/api/v1/saml/acs")
            .withCallback(TRUSTED_REDIRECT);
    return baseAuthConfig(AuthProvider.SAML)
        .withSamlConfiguration(new SamlSSOClientConfig().withSp(serviceProvider));
  }

  private AuthenticationConfiguration baseAuthConfig(AuthProvider provider) {
    return new AuthenticationConfiguration()
        .withProvider(provider)
        .withCallbackUrl(TRUSTED_REDIRECT)
        .withAdditionalTrustedRedirectUris(List.of())
        .withForceSecureSessionCookie(false);
  }

  private URI startServer(AuthServeletHandler handler) throws Exception {
    server = new Server(0);
    ServletContextHandler context = new ServletContextHandler();
    context.setContextPath("/");
    context.setAttribute(AuthServeletHandlerRegistry.AUTH_HANDLER_ATTRIBUTE, handler);
    context.addServlet(new ServletHolder(new AuthLoginServlet()), "/api/v1/auth/login");
    context.addServlet(new ServletHolder(new AuthCallbackServlet()), "/callback");
    context.addServlet(new ServletHolder(new SamlLoginServlet()), "/api/v1/saml/login");
    context.addServlet(new ServletHolder(new SamlAssertionConsumerServlet()), "/api/v1/saml/acs");
    context.addServlet(new ServletHolder(new SamlMetadataServlet()), "/api/v1/saml/metadata");
    server.setHandler(context);
    server.start();
    int port = ((ServerConnector) server.getConnectors()[0]).getLocalPort();
    return URI.create("http://127.0.0.1:" + port);
  }

  private HttpResponse<String> get(URI uri, String cookie) throws Exception {
    return get(uri, cookie, Map.of());
  }

  private HttpResponse<String> get(URI uri, String cookie, Map<String, String> headers)
      throws Exception {
    HttpRequest.Builder request = HttpRequest.newBuilder(uri).GET();
    if (cookie != null) {
      request.header("Cookie", cookie);
    }
    headers.forEach(request::header);
    return httpClient.send(request.build(), HttpResponse.BodyHandlers.ofString());
  }

  private HttpResponse<String> loginVia(URI baseUri, String host, String redirectUri)
      throws Exception {
    return get(
        baseUri.resolve(
            "/api/v1/auth/login?redirectUri="
                + URLEncoder.encode(redirectUri, StandardCharsets.UTF_8)),
        null,
        arrivingVia(host));
  }

  private static Map<String, String> arrivingVia(String host) {
    return Map.of("X-Forwarded-Proto", "https", "X-Forwarded-Host", host);
  }

  private static String sentRedirectUri(HttpResponse<String> loginResponse) {
    URI location = URI.create(loginResponse.headers().firstValue("Location").orElseThrow());
    return formParameter(location.getRawQuery(), "redirect_uri");
  }

  private static String formParameter(String encodedPairs, String name) {
    return encodedPairs == null
        ? null
        : Arrays.stream(encodedPairs.split("&"))
            .map(pair -> pair.split("=", 2))
            .filter(pair -> pair.length == 2 && pair[0].equals(name))
            .map(pair -> URLDecoder.decode(pair[1], StandardCharsets.UTF_8))
            .findFirst()
            .orElse(null);
  }

  private UserSession storePendingSession(InMemorySessionStore store, String idpRedirectUri) {
    long now = System.currentTimeMillis();
    UserSession session =
        UserSession.builder()
            .id(SessionIdGenerator.newSessionId())
            .type(SessionType.AUTH)
            .provider("google")
            .status(SessionStatus.PENDING)
            .redirectUri(TRUSTED_REDIRECT)
            .idpRedirectUri(idpRedirectUri)
            .state("state-abc")
            .version(0L)
            .createdAt(now)
            .updatedAt(now)
            .lastAccessedAt(now)
            .expiresAt(now + 60_000)
            .idleExpiresAt(now + 60_000)
            .build();
    store.create(session);
    return session;
  }

  private UserSession storeTamperedPendingSession(InMemorySessionStore store, String provider) {
    long now = System.currentTimeMillis();
    UserSession session =
        UserSession.builder()
            .id(SessionIdGenerator.newSessionId())
            .type(SessionType.AUTH)
            .provider(provider)
            .status(SessionStatus.PENDING)
            .redirectUri(ATTACKER_REDIRECT)
            .state("state-abc")
            .version(0L)
            .createdAt(now)
            .updatedAt(now)
            .lastAccessedAt(now)
            .expiresAt(now + 60_000)
            .idleExpiresAt(now + 60_000)
            .build();
    store.create(session);
    return session;
  }

  private void assertRejected(HttpResponse<String> response) {
    assertEquals(400, response.statusCode());
    assertTrue(response.body().contains(INVALID_REDIRECT_MESSAGE));
    assertFalse(response.headers().firstValue("Location").isPresent());
  }

  private void assertPendingSessionUnchanged(
      InMemorySessionStore store, UserSession expectedSession) {
    UserSession storedSession = store.findById(expectedSession.getId()).orElseThrow();
    assertEquals(SessionStatus.PENDING, storedSession.getStatus());
    assertEquals(ATTACKER_REDIRECT, storedSession.getRedirectUri());
    assertEquals(expectedSession.getVersion(), storedSession.getVersion());
  }

  private static final class InMemorySessionStore implements SessionStore {
    private final ConcurrentMap<String, UserSession> sessions = new ConcurrentHashMap<>();

    @Override
    public Optional<UserSession> findById(String sessionId) {
      return Optional.ofNullable(sessions.get(sessionId));
    }

    @Override
    public List<UserSession> findByUserIdAndStatus(String userId, SessionStatus status, int limit) {
      return sessions.values().stream()
          .filter(
              session ->
                  Objects.equals(userId, session.getUserId()) && status == session.getStatus())
          .sorted(
              Comparator.comparing(
                  UserSession::getLastAccessedAt, Comparator.nullsFirst(Comparator.naturalOrder())))
          .limit(limit)
          .toList();
    }

    @Override
    public List<UserSession> findSessionsToExpire(long now, int limit) {
      return List.of();
    }

    @Override
    public List<UserSession> findSessionsToPrune(long cutoff, int limit) {
      return List.of();
    }

    @Override
    public void create(UserSession session) {
      sessions.put(session.getId(), session);
    }

    @Override
    public synchronized boolean updateIfVersion(UserSession session, long expectedVersion) {
      UserSession current = sessions.get(session.getId());
      if (current == null || !Objects.equals(current.getVersion(), expectedVersion)) {
        return false;
      }
      sessions.put(session.getId(), session);
      return true;
    }

    @Override
    public void delete(String sessionId) {
      sessions.remove(sessionId);
    }

    @Override
    public int deleteByIds(List<String> sessionIds) {
      int deleted = 0;
      for (String sessionId : sessionIds) {
        if (sessions.remove(sessionId) != null) {
          deleted++;
        }
      }
      return deleted;
    }

    private boolean isEmpty() {
      return sessions.isEmpty();
    }

    private UserSession onlySession() {
      assertEquals(1, sessions.size());
      return sessions.values().iterator().next();
    }
  }
}
