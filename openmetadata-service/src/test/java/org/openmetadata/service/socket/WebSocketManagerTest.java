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
package org.openmetadata.service.socket;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.dropwizard.core.setup.Environment;
import io.socket.engineio.server.Emitter;
import io.socket.engineio.server.EngineIoServerOptions;
import io.socket.socketio.server.SocketIoSocket;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import java.util.function.Predicate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.AuthenticationException;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.security.auth.SecurityConfigurationManager.ConfigurationChangeListener;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.SessionStore;
import org.openmetadata.service.security.session.UserSession;

class WebSocketManagerTest {
  /** The wire name the UI listens for; pinned here so a rename cannot silently break the UI. */
  private static final String TOKEN_EXPIRED_CHANNEL = "tokenExpiredChannel";

  @Test
  void tokenExpiredChannelIsTheNameTheUiListensFor() {
    assertEquals(TOKEN_EXPIRED_CHANNEL, WebSocketManager.TOKEN_EXPIRED_CHANNEL);
  }

  private WebSocketManager manager;
  private AuthenticationConfiguration configuredBefore;
  private SocketAddressFilter handshakeFilter;

  /** Built the way initializeWebsockets builds it: on the provider its handshake filter applied. */
  @BeforeEach
  void setUp() throws Exception {
    configuredBefore = SecurityConfigurationManager.getCurrentAuthConfig();
    handshakeFilter = PushFeedFilters.validatingUnder(AuthProvider.GOOGLE);
    WebSocketManager.WebSocketManagerBuilder.build(
        EngineIoServerOptions.newFromDefault(), handshakeFilter::validatingProvider);
    manager = WebSocketManager.getInstance();
    manager.getActivityFeedEndpoints().clear();
    clearManagerMap("socketSessionIds");
    clearManagerMap("socketSessionValidatedAt");
  }

  @AfterEach
  void restoreConfiguredProvider() {
    SecurityConfigurationManager.getInstance().setCurrentAuthConfig(configuredBefore);
  }

  @Test
  void disconnectAllForUser_closesEverySocketAndRemovesEntry() {
    UUID userId = UUID.randomUUID();
    SocketIoSocket socketA = mock(SocketIoSocket.class);
    SocketIoSocket socketB = mock(SocketIoSocket.class);
    when(socketA.getId()).thenReturn("socket-a");
    when(socketB.getId()).thenReturn("socket-b");
    Map<String, SocketIoSocket> userSockets = new ConcurrentHashMap<>();
    userSockets.put("socket-a", socketA);
    userSockets.put("socket-b", socketB);
    manager.getActivityFeedEndpoints().put(userId, userSockets);

    manager.disconnectAllForUser(userId);

    verify(socketA, times(1)).disconnect(true);
    verify(socketB, times(1)).disconnect(true);
    assertFalse(manager.getActivityFeedEndpoints().containsKey(userId));
  }

  @Test
  void disconnectForSession_closesOnlySocketsForThatSession() throws Exception {
    UUID userId = UUID.randomUUID();
    SocketIoSocket sessionSocket = mock(SocketIoSocket.class);
    SocketIoSocket otherSessionSocket = mock(SocketIoSocket.class);
    when(sessionSocket.getId()).thenReturn("session-socket");
    when(otherSessionSocket.getId()).thenReturn("other-session-socket");
    Map<String, SocketIoSocket> userSockets = new ConcurrentHashMap<>();
    userSockets.put("session-socket", sessionSocket);
    userSockets.put("other-session-socket", otherSessionSocket);
    manager.getActivityFeedEndpoints().put(userId, userSockets);
    java.lang.reflect.Field socketSessionIds =
        WebSocketManager.class.getDeclaredField("socketSessionIds");
    socketSessionIds.setAccessible(true);
    @SuppressWarnings("unchecked")
    Map<String, String> sessionIds = (Map<String, String>) socketSessionIds.get(manager);
    sessionIds.put("session-socket", "session-a");
    sessionIds.put("other-session-socket", "session-b");

    manager.disconnectForSession(userId, "session-a");

    verify(sessionSocket, times(1)).disconnect(true);
    verify(otherSessionSocket, never()).disconnect(anyBoolean());
    assertFalse(manager.getActivityFeedEndpoints().get(userId).containsKey("session-socket"));
    assertTrue(manager.getActivityFeedEndpoints().get(userId).containsKey("other-session-socket"));
  }

  @Test
  void disconnectAllForUser_isNoOpWhenUserHasNoSockets() {
    UUID userId = UUID.randomUUID();
    SocketIoSocket otherUserSocket = mock(SocketIoSocket.class);
    when(otherUserSocket.getId()).thenReturn("other");
    UUID otherUserId = UUID.randomUUID();
    Map<String, SocketIoSocket> otherUserSockets = new ConcurrentHashMap<>();
    otherUserSockets.put("other", otherUserSocket);
    manager.getActivityFeedEndpoints().put(otherUserId, otherUserSockets);

    manager.disconnectAllForUser(userId);

    verify(otherUserSocket, never()).disconnect(anyBoolean());
    assertTrue(manager.getActivityFeedEndpoints().containsKey(otherUserId));
  }

  @Test
  void disconnectAllForUser_swallowsPerSocketDisconnectFailuresAndContinues() {
    UUID userId = UUID.randomUUID();
    SocketIoSocket failing = mock(SocketIoSocket.class);
    SocketIoSocket healthy = mock(SocketIoSocket.class);
    when(failing.getId()).thenReturn("failing");
    when(healthy.getId()).thenReturn("healthy");
    doThrow(new RuntimeException("boom")).when(failing).disconnect(true);
    Map<String, SocketIoSocket> sockets = new ConcurrentHashMap<>();
    sockets.put("failing", failing);
    sockets.put("healthy", healthy);
    manager.getActivityFeedEndpoints().put(userId, sockets);

    manager.disconnectAllForUser(userId);

    // Both attempts made even though the first threw.
    verify(failing, times(1)).disconnect(true);
    verify(healthy, times(1)).disconnect(true);
    assertFalse(manager.getActivityFeedEndpoints().containsKey(userId));
  }

  @Test
  void disconnectAllForUser_isNoOpOnNullUserId() {
    UUID userId = UUID.randomUUID();
    SocketIoSocket socket = mock(SocketIoSocket.class);
    when(socket.getId()).thenReturn("sock");
    Map<String, SocketIoSocket> sockets = new ConcurrentHashMap<>();
    sockets.put("sock", socket);
    manager.getActivityFeedEndpoints().put(userId, sockets);

    manager.disconnectAllForUser(null);

    verify(socket, never()).disconnect(anyBoolean());
    assertTrue(manager.getActivityFeedEndpoints().containsKey(userId));
  }

  @Test
  void disconnectInactiveSessionsThrottlesFreshSessionLookups() throws Exception {
    UUID userId = UUID.randomUUID();
    SocketIoSocket socket = mock(SocketIoSocket.class);
    when(socket.getId()).thenReturn("socket-a");
    Map<String, SocketIoSocket> sockets = new ConcurrentHashMap<>();
    sockets.put("socket-a", socket);
    manager.getActivityFeedEndpoints().put(userId, sockets);
    java.lang.reflect.Field socketSessionIds =
        WebSocketManager.class.getDeclaredField("socketSessionIds");
    socketSessionIds.setAccessible(true);
    @SuppressWarnings("unchecked")
    Map<String, String> sessionIds = (Map<String, String>) socketSessionIds.get(manager);
    sessionIds.put("socket-a", "session-a");
    SessionService sessionService = mock(SessionService.class);
    when(sessionService.getFreshSessionById("session-a"))
        .thenReturn(Optional.of(activeSession("session-a", userId)));

    manager.disconnectInactiveSessions(sessionService, 60_000L);
    manager.disconnectInactiveSessions(sessionService, 60_000L);

    verify(sessionService, times(1)).getFreshSessionById("session-a");
    verify(socket, never()).disconnect(anyBoolean());
  }

  @Test
  void disconnectInactiveSessions_closesSocketsWhoseSessionProviderIsNoLongerConfigured()
      throws Exception {
    UUID userId = UUID.randomUUID();
    SessionService sessionService =
        sessionServiceStoring(
            AuthProvider.GOOGLE,
            sessionIssuedBy(AuthProvider.GOOGLE, "session-g", userId),
            sessionIssuedBy(AuthProvider.AZURE, "session-z", userId));
    SocketIoSocket socketA1 = trackSocket(userId, "socket-a1", "session-g");
    SocketIoSocket socketA2 = trackSocket(userId, "socket-a2", "session-g");

    manager.disconnectInactiveSessions(sessionService, 0L);

    verify(socketA1, never()).disconnect(anyBoolean());
    verify(socketA2, never()).disconnect(anyBoolean());

    sessionService.updateConfiguration(PushFeedFilters.authenticationFor(AuthProvider.AZURE));
    applyReloadedProvider(AuthProvider.AZURE);
    SocketIoSocket socketB = trackSocket(userId, "socket-b", "session-z");

    manager.disconnectInactiveSessions(sessionService, 0L);

    verify(socketA1, times(1)).disconnect(true);
    verify(socketA2, times(1)).disconnect(true);
    verify(socketB, never()).disconnect(anyBoolean());
    assertEquals(Set.of("socket-b"), manager.getActivityFeedEndpoints().get(userId).keySet());
  }

  /**
   * A reload hands SessionService the new provider before it initializes the new authenticator,
   * and that can still fail and roll back. Until the reload succeeds the push feed still validates
   * under the old provider, and a server-closed socket is never reconnected by the UI.
   */
  @Test
  void disconnectInactiveSessions_keepsSocketsWhileAReloadHasNotAppliedItsProvider()
      throws Exception {
    UUID userId = UUID.randomUUID();
    SessionService sessionService =
        sessionServiceStoring(
            AuthProvider.GOOGLE, sessionIssuedBy(AuthProvider.GOOGLE, "session-g", userId));
    SocketIoSocket socket = trackSocket(userId, "socket-g", "session-g");

    sessionService.updateConfiguration(PushFeedFilters.authenticationFor(AuthProvider.LDAP));
    manager.disconnectInactiveSessions(sessionService, 0L);

    verify(socket, never()).disconnect(anyBoolean());
    assertEquals(Set.of("socket-g"), manager.getActivityFeedEndpoints().get(userId).keySet());
  }

  @Test
  void disconnectAll_closesSessionBoundAndSessionlessSockets() throws Exception {
    SocketIoSocket sessionBound = trackSocket(UUID.randomUUID(), "socket-a", "session-a");
    SocketIoSocket sessionless = registerSocket(UUID.randomUUID(), "socket-b");

    manager.disconnectAll();

    verify(sessionBound, times(1)).disconnect(true);
    verify(sessionless, times(1)).disconnect(true);
    assertTrue(manager.getActivityFeedEndpoints().isEmpty());
    assertTrue(socketSessionIds().isEmpty());
  }

  /**
   * The handshake is validated on the upgrade and the socket registers a round trip later, so a
   * provider switch can land in between: the reload's disconnectAll has already run when the late
   * sockets register, and the sweep never looks at one without a session.
   */
  @Test
  void onConnection_closesASocketValidatedUnderTheOldProviderThatRegistersAfterTheSwitch()
      throws Exception {
    SocketIoSocket openBeforeSwitch =
        connect(UUID.randomUUID(), "socket-open", null, AuthProvider.GOOGLE);

    publishReloadedProvider(AuthProvider.AZURE);
    applyReloadedProvider(AuthProvider.AZURE);
    manager.disconnectAll();
    UUID lateUser = UUID.randomUUID();
    SocketIoSocket lateSessionless = connect(lateUser, "socket-late", null, AuthProvider.GOOGLE);
    SocketIoSocket lateWithSession =
        connect(lateUser, "socket-late-session", "session-g", AuthProvider.GOOGLE);
    SocketIoSocket validatedUnderAzure =
        connect(lateUser, "socket-azure", null, AuthProvider.AZURE);

    verify(openBeforeSwitch, times(1)).disconnect(true);
    verify(lateSessionless, times(1)).disconnect(true);
    verify(lateWithSession, times(1)).disconnect(true);
    verify(validatedUnderAzure, never()).disconnect(anyBoolean());
    assertEquals(
        Map.of(lateUser, Map.of("socket-azure", validatedUnderAzure)),
        manager.getActivityFeedEndpoints());
    assertTrue(socketSessionIds().isEmpty());
  }

  /**
   * A real reload that fails after a socket registered: reloadSecuritySystem publishes the new
   * provider, the socket's CONNECT arrives while the new authenticator initializes, that fails (an
   * unreachable LDAP server, say) and the reload rolls back. The server accepts the socket again,
   * and the UI never reconnects after a server close, so the socket must still be open.
   */
  @Test
  void onConnection_keepsASocketThatRegisteredDuringAReloadThatFailed() throws Exception {
    SecurityConfigurationManager reloads = SecurityConfigurationManager.getInstance();
    Map<String, Object> reloadWiringBefore =
        fieldValues(reloads, "application", "config", "environment");
    AuthorizerConfiguration authorizerBefore = SecurityConfigurationManager.getCurrentAuthzConfig();
    MCPConfiguration mcpBefore = SecurityConfigurationManager.getCurrentMcpConfig();
    UUID userId = UUID.randomUUID();
    List<SocketIoSocket> registeredMidReload = new ArrayList<>();
    List<AuthProvider> publishedMidReload = new ArrayList<>();
    OpenMetadataApplication application = mock(OpenMetadataApplication.class);
    doAnswer(
            invocation -> {
              publishedMidReload.add(
                  SecurityConfigurationManager.getCurrentAuthConfig().getProvider());
              registeredMidReload.add(connect(userId, "socket-token", null, AuthProvider.GOOGLE));
              registeredMidReload.add(
                  connect(userId, "socket-session", "session-g", AuthProvider.GOOGLE));
              throw new IllegalStateException("LDAP server unreachable");
            })
        .doNothing()
        .when(application)
        .reinitializeAuthSystem(any(), any());
    AtomicInteger listenerRuns = new AtomicInteger();
    ConfigurationChangeListener listener = (auth, authz, mcp) -> listenerRuns.incrementAndGet();
    reloads.addConfigurationChangeListener(listener);
    AuthProvider rolledBackTo;
    try (MockedStatic<SettingsCache> settings = mockStatic(SettingsCache.class)) {
      settings
          .when(
              () ->
                  SettingsCache.getSetting(
                      SettingsType.AUTHENTICATION_CONFIGURATION, AuthenticationConfiguration.class))
          .thenReturn(
              PushFeedFilters.authenticationFor(AuthProvider.GOOGLE),
              PushFeedFilters.authenticationFor(AuthProvider.LDAP));
      settings
          .when(
              () ->
                  SettingsCache.getSetting(
                      SettingsType.AUTHORIZER_CONFIGURATION, AuthorizerConfiguration.class))
          .thenReturn(new AuthorizerConfiguration());
      reloads.initialize(
          application, mock(OpenMetadataApplicationConfig.class), mock(Environment.class));

      assertThrows(AuthenticationException.class, reloads::reloadSecuritySystem);
      rolledBackTo = SecurityConfigurationManager.getCurrentAuthConfig().getProvider();
    } finally {
      reloads.removeConfigurationChangeListener(listener);
      restoreFields(reloads, reloadWiringBefore);
      reloads.setCurrentAuthzConfig(authorizerBefore);
      reloads.setCurrentMcpConfig(mcpBefore);
    }

    assertEquals(List.of(AuthProvider.LDAP), publishedMidReload);
    assertEquals(AuthProvider.GOOGLE, rolledBackTo);
    assertEquals(0, listenerRuns.get());
    registeredMidReload.forEach(socket -> verify(socket, never()).disconnect(anyBoolean()));
    assertEquals(
        Set.of("socket-token", "socket-session"),
        manager.getActivityFeedEndpoints().get(userId).keySet());
  }

  @Test
  void onConnection_keepsASocketValidatedUnderTheOtherNativePasswordProviderName() {
    applyReloadedProvider(AuthProvider.OPENMETADATA);
    UUID userId = UUID.randomUUID();

    SocketIoSocket socket = connect(userId, "socket-basic", "session-b", AuthProvider.BASIC);

    verify(socket, never()).disconnect(anyBoolean());
    assertEquals(Set.of("socket-basic"), manager.getActivityFeedEndpoints().get(userId).keySet());
  }

  /**
   * A socket opened with a provider token has no session for the sweep to re-check, so the token's
   * expiry, stamped at the handshake, is what bounds it (#38245).
   */
  @Test
  void disconnectInactiveSessions_closesASessionlessSocketOnceItsTokenHasExpired() {
    UUID userId = UUID.randomUUID();
    SocketIoSocket expired =
        connectWithTokenExpiry(userId, "socket-expired", epochMillisAgo(1_000));
    SocketIoSocket current =
        connectWithTokenExpiry(userId, "socket-current", epochMillisAgo(-60_000));

    manager.disconnectInactiveSessions(mock(SessionService.class), 0L);

    verify(expired, times(1)).disconnect(true);
    verify(current, never()).disconnect(anyBoolean());
    assertEquals(Set.of("socket-current"), manager.getActivityFeedEndpoints().get(userId).keySet());
  }

  /** The UI reconnects after a server close only when this notice came first. */
  @Test
  void disconnectInactiveSessions_sendsTheTokenExpiredNoticeBeforeClosing() {
    SocketIoSocket expired =
        connectWithTokenExpiry(UUID.randomUUID(), "socket-expired", epochMillisAgo(1_000));

    manager.disconnectInactiveSessions(mock(SessionService.class), 0L);

    InOrder closing = inOrder(expired);
    closing.verify(expired).send(TOKEN_EXPIRED_CHANNEL);
    closing.verify(expired).disconnect(true);
  }

  /** The notice is best effort: a socket whose transport already failed still closes. */
  @Test
  void disconnectInactiveSessions_closesAnExpiredSocketEvenWhenTheNoticeCannotBeSent() {
    UUID userId = UUID.randomUUID();
    SocketIoSocket expired =
        connectWithTokenExpiry(userId, "socket-expired", epochMillisAgo(1_000));
    doThrow(new IllegalStateException("transport closed"))
        .when(expired)
        .send(TOKEN_EXPIRED_CHANNEL);

    manager.disconnectInactiveSessions(mock(SessionService.class), 0L);

    verify(expired, times(1)).disconnect(true);
    assertFalse(manager.getActivityFeedEndpoints().containsKey(userId));
  }

  /** The expiry is server-stamped; a value the server cannot read fails closed. */
  @Test
  void onConnection_treatsAMalformedExpiryAsExpired() {
    UUID userId = UUID.randomUUID();
    SocketIoSocket socket = connectWithTokenExpiry(userId, "socket-malformed", "not-a-number");

    manager.disconnectInactiveSessions(mock(SessionService.class), 0L);

    verify(socket, times(1)).disconnect(true);
    assertFalse(manager.getActivityFeedEndpoints().containsKey(userId));
  }

  /** Exp is the last instant the token is valid: kept at exp, closed just after, as on REST. */
  @Test
  void disconnectInactiveSessions_keepsASessionlessSocketUntilItsTokenExpires() {
    MutableClock clock = new MutableClock(Instant.parse("2026-11-26T10:00:00Z"));
    buildManager(policy(clock, userId -> false, userId -> {}));
    UUID userId = UUID.randomUUID();
    SocketIoSocket socket =
        connectWithTokenExpiry(userId, "socket-at-exp", millisOf(clock.instant()));

    manager.disconnectInactiveSessions(mock(SessionService.class), 0L);

    verify(socket, never()).disconnect(anyBoolean());

    clock.advance(Duration.ofMillis(1));
    manager.disconnectInactiveSessions(mock(SessionService.class), 0L);

    verify(socket, times(1)).disconnect(true);
    assertFalse(manager.getActivityFeedEndpoints().containsKey(userId));
  }

  /** An Unlimited bot token or a personal access token without exp is not bounded by expiry. */
  @Test
  void disconnectInactiveSessions_keepsASessionlessSocketWhoseTokenHasNoExpiry() {
    MutableClock clock = new MutableClock(Instant.parse("2026-11-26T10:00:00Z"));
    buildManager(policy(clock, userId -> false, userId -> {}));
    UUID userId = UUID.randomUUID();
    SocketIoSocket socket = connect(userId, "socket-unlimited", null, AuthProvider.GOOGLE);

    clock.advance(Duration.ofDays(3650));
    manager.disconnectInactiveSessions(mock(SessionService.class), 0L);

    verify(socket, never()).disconnect(anyBoolean());
    assertEquals(
        Set.of("socket-unlimited"), manager.getActivityFeedEndpoints().get(userId).keySet());
  }

  /**
   * A peer without Redis never hears of a delete, and a handshake validated just before the delete
   * can register after it: the sweep closes every socket of a user who is gone, session or not.
   */
  @Test
  void disconnectInactiveSessions_closesEverySocketOfAUserWhoIsGone() {
    UUID goneUser = UUID.randomUUID();
    UUID presentUser = UUID.randomUUID();
    buildManager(policy(Clock.systemUTC(), goneUser::equals, userId -> {}));
    SocketIoSocket sessionless = connect(goneUser, "socket-token", null, AuthProvider.GOOGLE);
    SocketIoSocket withSession =
        connect(goneUser, "socket-session", "session-g", AuthProvider.GOOGLE);
    SocketIoSocket presentUsers = connect(presentUser, "socket-present", null, AuthProvider.GOOGLE);

    manager.disconnectInactiveSessions(mock(SessionService.class), 60_000L);

    verify(sessionless, times(1)).disconnect(true);
    verify(withSession, times(1)).disconnect(true);
    verify(presentUsers, never()).disconnect(anyBoolean());
    assertEquals(Set.of(presentUser), manager.getActivityFeedEndpoints().keySet());
  }

  /** A delete revokes the user's sessions, which closes such sockets, so they cost no lookup. */
  @Test
  void disconnectInactiveSessions_neverLooksUpUsersWhoseSocketsAllHaveSessions() {
    List<UUID> lookedUp = new ArrayList<>();
    buildManager(
        policy(
            Clock.systemUTC(),
            userId -> {
              lookedUp.add(userId);
              return false;
            },
            userId -> {}));
    UUID sessionUser = UUID.randomUUID();
    UUID tokenUser = UUID.randomUUID();
    SessionService sessionService =
        sessionServiceStoring(
            AuthProvider.GOOGLE, sessionIssuedBy(AuthProvider.GOOGLE, "session-g", sessionUser));
    connect(sessionUser, "socket-session", "session-g", AuthProvider.GOOGLE);
    connect(tokenUser, "socket-token", null, AuthProvider.GOOGLE);

    manager.disconnectInactiveSessions(sessionService, 0L);

    assertEquals(List.of(tokenUser), lookedUp);
  }

  @Test
  void endAccessForUser_closesLocalSocketsAndSignalsPeers() {
    List<UUID> signalled = new ArrayList<>();
    buildManager(policy(Clock.systemUTC(), userId -> false, signalled::add));
    UUID deletedUser = UUID.randomUUID();
    UUID otherUser = UUID.randomUUID();
    SocketIoSocket sessionless = connect(deletedUser, "socket-token", null, AuthProvider.GOOGLE);
    SocketIoSocket withSession =
        connect(deletedUser, "socket-session", "session-g", AuthProvider.GOOGLE);
    SocketIoSocket othersSocket = connect(otherUser, "socket-other", null, AuthProvider.GOOGLE);

    manager.endAccessForUser(deletedUser);
    manager.endAccessForUser(null);

    verify(sessionless, times(1)).disconnect(true);
    verify(withSession, times(1)).disconnect(true);
    verify(othersSocket, never()).disconnect(anyBoolean());
    assertEquals(List.of(deletedUser), signalled);
    assertEquals(Set.of(otherUser), manager.getActivityFeedEndpoints().keySet());
  }

  /** Every per-socket entry goes with its socket, whichever side closes it. */
  @Test
  void disconnect_forgetsTheSocketsExpiry() throws Exception {
    UUID userId = UUID.randomUUID();
    SocketIoSocket closedByClient =
        connectWithTokenExpiry(userId, "socket-client", epochMillisAgo(-60_000));
    connectWithTokenExpiry(userId, "socket-server", epochMillisAgo(-60_000));

    disconnectListenerOf(closedByClient).call();

    assertFalse(tokenExpiries().isTracked("socket-client"));
    assertTrue(tokenExpiries().isTracked("socket-server"));

    manager.disconnectAllForUser(userId);

    assertFalse(tokenExpiries().isTracked("socket-server"));
    assertTrue(manager.getActivityFeedEndpoints().isEmpty());
  }

  @Test
  void disconnectInactiveSessions_keepsASessionBoundSocketWhoseSessionIsActive() {
    UUID userId = UUID.randomUUID();
    SessionService sessionService =
        sessionServiceStoring(
            AuthProvider.GOOGLE, sessionIssuedBy(AuthProvider.GOOGLE, "session-g", userId));
    SocketIoSocket socket = connect(userId, "socket-session", "session-g", AuthProvider.GOOGLE);

    manager.disconnectInactiveSessions(sessionService, 0L);

    verify(socket, never()).disconnect(anyBoolean());
    assertEquals(Set.of("socket-session"), manager.getActivityFeedEndpoints().get(userId).keySet());
  }

  @Test
  void sendToOne_deliversLocallyAndPublishesToRelay() {
    UUID userId = UUID.randomUUID();
    SocketIoSocket socket = mock(SocketIoSocket.class);
    when(socket.getId()).thenReturn("s1");
    Map<String, SocketIoSocket> sockets = new ConcurrentHashMap<>();
    sockets.put("s1", socket);
    manager.getActivityFeedEndpoints().put(userId, sockets);
    CapturingRelay relay = new CapturingRelay();
    manager.setRelay(relay);

    manager.sendToOne(userId, WebSocketManager.CSV_IMPORT_CHANNEL, "payload");

    verify(socket, times(1)).send(WebSocketManager.CSV_IMPORT_CHANNEL, "payload");
    assertEquals(1, relay.count);
    assertEquals(WebSocketRelay.SCOPE_USER, relay.lastScope);
    assertEquals(userId.toString(), relay.lastTarget);
    assertEquals(WebSocketManager.CSV_IMPORT_CHANNEL, relay.lastEvent);
    assertEquals("payload", relay.lastMessage);
  }

  @Test
  void sendToOne_publishesToRelayEvenWhenNoLocalSocket() {
    UUID userId = UUID.randomUUID();
    CapturingRelay relay = new CapturingRelay();
    manager.setRelay(relay);

    manager.sendToOne(userId, WebSocketManager.CSV_IMPORT_CHANNEL, "payload");

    // No local socket: the peer pod holding it must still be reached via the relay.
    assertEquals(1, relay.count);
    assertEquals(WebSocketRelay.SCOPE_USER, relay.lastScope);
    assertEquals(userId.toString(), relay.lastTarget);
  }

  @Test
  void deliverRelayedFrame_userScopeDeliversToThatUserLocally() {
    UUID userId = UUID.randomUUID();
    SocketIoSocket socket = mock(SocketIoSocket.class);
    when(socket.getId()).thenReturn("s1");
    Map<String, SocketIoSocket> sockets = new ConcurrentHashMap<>();
    sockets.put("s1", socket);
    manager.getActivityFeedEndpoints().put(userId, sockets);
    CapturingRelay relay = new CapturingRelay();
    manager.setRelay(relay);

    manager.deliverRelayedFrame(
        WebSocketRelay.SCOPE_USER, userId.toString(), WebSocketManager.CSV_IMPORT_CHANNEL, "p");

    verify(socket, times(1)).send(WebSocketManager.CSV_IMPORT_CHANNEL, "p");
    // A received frame is delivered locally only — never re-published.
    assertEquals(0, relay.count);
  }

  @Test
  void deliverRelayedFrame_allScopeBroadcastsToEveryLocalSocket() {
    UUID userA = UUID.randomUUID();
    UUID userB = UUID.randomUUID();
    SocketIoSocket socketA = mock(SocketIoSocket.class);
    SocketIoSocket socketB = mock(SocketIoSocket.class);
    when(socketA.getId()).thenReturn("a");
    when(socketB.getId()).thenReturn("b");
    Map<String, SocketIoSocket> sa = new ConcurrentHashMap<>();
    sa.put("a", socketA);
    Map<String, SocketIoSocket> sb = new ConcurrentHashMap<>();
    sb.put("b", socketB);
    manager.getActivityFeedEndpoints().put(userA, sa);
    manager.getActivityFeedEndpoints().put(userB, sb);

    manager.deliverRelayedFrame(
        WebSocketRelay.SCOPE_ALL, null, WebSocketManager.ANNOUNCEMENT_CHANNEL, "all");

    verify(socketA, times(1)).send(WebSocketManager.ANNOUNCEMENT_CHANNEL, "all");
    verify(socketB, times(1)).send(WebSocketManager.ANNOUNCEMENT_CHANNEL, "all");
  }

  @Test
  void sendToOneLocal_deliversWithoutPublishing() {
    UUID userId = UUID.randomUUID();
    SocketIoSocket socket = mock(SocketIoSocket.class);
    when(socket.getId()).thenReturn("s1");
    Map<String, SocketIoSocket> sockets = new ConcurrentHashMap<>();
    sockets.put("s1", socket);
    manager.getActivityFeedEndpoints().put(userId, sockets);
    CapturingRelay relay = new CapturingRelay();
    manager.setRelay(relay);

    manager.sendToOneLocal(userId, WebSocketManager.CSV_IMPORT_CHANNEL, "payload");

    verify(socket, times(1)).send(WebSocketManager.CSV_IMPORT_CHANNEL, "payload");
    // A relayed frame must not be re-published, or peers would loop.
    assertEquals(0, relay.count);
  }

  @Test
  void setRelay_nullFallsBackToNoop() {
    manager.setRelay(null);
    assertInstanceOf(NoopWebSocketRelay.class, manager.getRelay());
  }

  private static final class CapturingRelay implements WebSocketRelay {
    private int count;
    private String lastScope;
    private String lastTarget;
    private String lastEvent;
    private String lastMessage;

    @Override
    public void publish(String scope, String target, String event, String message) {
      count++;
      lastScope = scope;
      lastTarget = target;
      lastEvent = event;
      lastMessage = message;
    }
  }

  private UserSession activeSession(String sessionId, UUID userId) {
    long now = System.currentTimeMillis();
    return UserSession.builder()
        .id(sessionId)
        .userId(userId.toString())
        .status(SessionStatus.ACTIVE)
        .expiresAt(now + 60_000)
        .idleExpiresAt(now + 60_000)
        .build();
  }

  private UserSession sessionIssuedBy(AuthProvider provider, String sessionId, UUID userId) {
    return activeSession(sessionId, userId).toBuilder().provider(provider.value()).build();
  }

  /** The first step of reloadSecuritySystem: the new configuration is visible to every reader. */
  private static void publishReloadedProvider(AuthProvider provider) {
    SecurityConfigurationManager.getInstance()
        .setCurrentAuthConfig(PushFeedFilters.authenticationFor(provider));
  }

  /** What the push-feed reload listener does once a reload has succeeded. */
  private void applyReloadedProvider(AuthProvider provider) {
    PushFeedFilters.applyReload(handshakeFilter, provider);
  }

  private static SessionService sessionServiceStoring(
      AuthProvider configuredProvider, UserSession... sessions) {
    SessionStore store = mock(SessionStore.class);
    for (UserSession session : sessions) {
      when(store.findById(session.getId())).thenReturn(Optional.of(session));
    }
    return new SessionService(PushFeedFilters.authenticationFor(configuredProvider), store);
  }

  /** A socket whose handshake headers were stamped the way SocketAddressFilter stamps them. */
  private SocketIoSocket connect(
      UUID userId, String socketId, String sessionId, AuthProvider validatedUnder) {
    SocketIoSocket socket = mock(SocketIoSocket.class);
    when(socket.getId()).thenReturn(socketId);
    Map<String, List<String>> headers = new HashMap<>();
    headers.put("UserId", List.of(userId.toString()));
    headers.put("AuthProvider", List.of(validatedUnder.value()));
    if (sessionId != null) {
      headers.put("SessionId", List.of(sessionId));
    }
    when(socket.getInitialHeaders()).thenReturn(headers);
    manager.onConnection(socket);
    return socket;
  }

  private void buildManager(PushFeedSocketPolicy policy) {
    WebSocketManager.WebSocketManagerBuilder.build(EngineIoServerOptions.newFromDefault(), policy);
    manager = WebSocketManager.getInstance();
  }

  private PushFeedSocketPolicy policy(
      Clock clock, Predicate<UUID> isUserGone, Consumer<UUID> notifyPeers) {
    return new PushFeedSocketPolicy(
        handshakeFilter::validatingProvider, clock, isUserGone, notifyPeers);
  }

  private static String millisOf(Instant instant) {
    return String.valueOf(instant.toEpochMilli());
  }

  private static Emitter.Listener disconnectListenerOf(SocketIoSocket socket) {
    ArgumentCaptor<Emitter.Listener> listener = ArgumentCaptor.forClass(Emitter.Listener.class);
    verify(socket).on(eq("disconnect"), listener.capture());
    return listener.getValue();
  }

  private SocketTokenExpiries tokenExpiries() throws Exception {
    java.lang.reflect.Field field = WebSocketManager.class.getDeclaredField("socketTokenExpiries");
    field.setAccessible(true);
    return (SocketTokenExpiries) field.get(manager);
  }

  /** A clock the test moves by hand, so expiry is checked at exact instants. */
  private static final class MutableClock extends Clock {
    private Instant now;

    private MutableClock(Instant now) {
      this.now = now;
    }

    private void advance(Duration duration) {
      now = now.plus(duration);
    }

    @Override
    public ZoneId getZone() {
      return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
      return this;
    }

    @Override
    public Instant instant() {
      return now;
    }
  }

  /** A sessionless socket stamped the way the handshake stamps one opened with a provider token. */
  private SocketIoSocket connectWithTokenExpiry(UUID userId, String socketId, String expiresAt) {
    SocketIoSocket socket = mock(SocketIoSocket.class);
    when(socket.getId()).thenReturn(socketId);
    Map<String, List<String>> headers = new HashMap<>();
    headers.put("UserId", List.of(userId.toString()));
    headers.put("AuthProvider", List.of(AuthProvider.GOOGLE.value()));
    headers.put("TokenExpiresAt", List.of(expiresAt));
    when(socket.getInitialHeaders()).thenReturn(headers);
    manager.onConnection(socket);
    return socket;
  }

  private static String epochMillisAgo(long millis) {
    return String.valueOf(System.currentTimeMillis() - millis);
  }

  private SocketIoSocket trackSocket(UUID userId, String socketId, String sessionId)
      throws Exception {
    SocketIoSocket socket = registerSocket(userId, socketId);
    socketSessionIds().put(socketId, sessionId);
    return socket;
  }

  private SocketIoSocket registerSocket(UUID userId, String socketId) {
    SocketIoSocket socket = mock(SocketIoSocket.class);
    when(socket.getId()).thenReturn(socketId);
    manager
        .getActivityFeedEndpoints()
        .computeIfAbsent(userId, id -> new ConcurrentHashMap<>())
        .put(socketId, socket);
    return socket;
  }

  private static Map<String, Object> fieldValues(Object target, String... names) throws Exception {
    Map<String, Object> values = new HashMap<>();
    for (String name : names) {
      java.lang.reflect.Field field = target.getClass().getDeclaredField(name);
      field.setAccessible(true);
      values.put(name, field.get(target));
    }
    return values;
  }

  private static void restoreFields(Object target, Map<String, Object> values) throws Exception {
    for (Map.Entry<String, Object> value : values.entrySet()) {
      java.lang.reflect.Field field = target.getClass().getDeclaredField(value.getKey());
      field.setAccessible(true);
      field.set(target, value.getValue());
    }
  }

  @SuppressWarnings("unchecked")
  private Map<String, String> socketSessionIds() throws Exception {
    java.lang.reflect.Field field = WebSocketManager.class.getDeclaredField("socketSessionIds");
    field.setAccessible(true);
    return (Map<String, String>) field.get(manager);
  }

  private void clearManagerMap(String fieldName) throws Exception {
    java.lang.reflect.Field field = WebSocketManager.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    ((Map<?, ?>) field.get(manager)).clear();
  }
}
