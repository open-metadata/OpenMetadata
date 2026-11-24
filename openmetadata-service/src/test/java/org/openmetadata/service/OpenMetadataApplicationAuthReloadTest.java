/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.socket.engineio.server.EngineIoServerOptions;
import io.socket.socketio.server.SocketIoSocket;
import java.lang.reflect.Field;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.security.AuthServeletHandler;
import org.openmetadata.service.security.auth.AuthenticatorHandler;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.security.auth.SecurityConfigurationManager.ConfigurationChangeListener;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.SessionStore;
import org.openmetadata.service.security.session.UserSession;
import org.openmetadata.service.socket.PushFeedFilters;
import org.openmetadata.service.socket.SocketAddressFilter;
import org.openmetadata.service.socket.WebSocketManager;

/** What a security reload closes: the auth handlers it replaced, and sockets on a provider swap. */
class OpenMetadataApplicationAuthReloadTest {
  private final AuthServeletHandler previousHandler = mock(AuthServeletHandler.class);
  private final AuthServeletHandler currentHandler = mock(AuthServeletHandler.class);
  private final AuthenticatorHandler previousAuthenticator = mock(AuthenticatorHandler.class);
  private final AuthenticatorHandler currentAuthenticator = mock(AuthenticatorHandler.class);

  @Test
  void closesTheHandlersAReloadReplacedEvenIfItFailedAfterTheSwap() {
    OpenMetadataApplication.closeReplacedAuthHandlers(
        previousHandler, currentHandler, previousAuthenticator, currentAuthenticator);

    verify(previousHandler).close();
    verify(previousAuthenticator).close();
    verify(currentHandler, never()).close();
    verify(currentAuthenticator, never()).close();
  }

  @Test
  void leavesOpenTheHandlersAReloadNeverReplaced() {
    // A reload that failed before reaching the swap leaves the old handlers serving logins.
    OpenMetadataApplication.closeReplacedAuthHandlers(
        previousHandler, previousHandler, previousAuthenticator, previousAuthenticator);

    verify(previousHandler, never()).close();
    verify(previousAuthenticator, never()).close();
  }

  @Test
  void aFailingCloseNeitherEscapesNorSkipsTheOtherHandler() {
    doThrow(new IllegalStateException("pool already gone")).when(previousHandler).close();

    assertDoesNotThrow(
        () ->
            OpenMetadataApplication.closeReplacedAuthHandlers(
                previousHandler, currentHandler, previousAuthenticator, currentAuthenticator));

    verify(previousAuthenticator).close();
  }

  @ParameterizedTest(name = "{0} -> {1} closes sockets: {2}")
  @MethodSource("providerChanges")
  void closeSocketsOnProviderSwitch_closesOnlyOnAProviderSwitch(
      AuthProvider previous, AuthProvider current, boolean closes) throws Exception {
    WebSocketManager.WebSocketManagerBuilder.build(EngineIoServerOptions.newFromDefault());
    WebSocketManager sockets = WebSocketManager.getInstance();
    UUID sessionUser = UUID.randomUUID();
    UUID sessionlessUser = UUID.randomUUID();
    SocketIoSocket sessionBound = openSocket(sockets, sessionUser, "socket-session");
    trackedSessionIds(sockets).put("socket-session", "session-a");
    SocketIoSocket sessionless = openSocket(sockets, sessionlessUser, "socket-token");

    Map<UUID, Map<String, SocketIoSocket>> socketsBefore =
        Map.of(
            sessionUser, Map.of("socket-session", sessionBound),
            sessionlessUser, Map.of("socket-token", sessionless));

    OpenMetadataApplication.closeSocketsOnProviderSwitch(previous, current, sockets);

    verify(sessionBound, times(closes ? 1 : 0)).disconnect(true);
    verify(sessionless, times(closes ? 1 : 0)).disconnect(true);
    assertEquals(closes ? Map.of() : socketsBefore, sockets.getActivityFeedEndpoints());
  }

  private static Stream<Arguments> providerChanges() {
    return Stream.of(
        Arguments.of(AuthProvider.GOOGLE, AuthProvider.AZURE, true),
        Arguments.of(AuthProvider.LDAP, AuthProvider.BASIC, true),
        Arguments.of(AuthProvider.BASIC, AuthProvider.OPENMETADATA, false),
        Arguments.of(AuthProvider.GOOGLE, AuthProvider.GOOGLE, false));
  }

  @Test
  void pushFeedReloadListener_closesSocketsOnlyWhenAReloadChangesTheProvider() throws Exception {
    WebSocketManager.WebSocketManagerBuilder.build(EngineIoServerOptions.newFromDefault());
    WebSocketManager sockets = WebSocketManager.getInstance();
    ConfigurationChangeListener listener =
        OpenMetadataApplication.pushFeedReloadListener(
            new SocketAddressFilter(), AuthProvider.GOOGLE, () -> sockets);
    SocketIoSocket sessionBound = openSocket(sockets, UUID.randomUUID(), "socket-session");
    trackedSessionIds(sockets).put("socket-session", "session-a");
    SocketIoSocket sessionless = openSocket(sockets, UUID.randomUUID(), "socket-token");

    reloadWith(listener, AuthProvider.GOOGLE);

    verify(sessionBound, never()).disconnect(anyBoolean());
    verify(sessionless, never()).disconnect(anyBoolean());

    reloadWith(listener, AuthProvider.AZURE);

    verify(sessionBound).disconnect(true);
    verify(sessionless).disconnect(true);
    assertEquals(Map.of(), sockets.getActivityFeedEndpoints());

    SocketIoSocket openedUnderAzure = openSocket(sockets, UUID.randomUUID(), "socket-azure");
    reloadWith(listener, AuthProvider.AZURE);

    verify(openedUnderAzure, never()).disconnect(anyBoolean());
  }

  /**
   * initializeWebsockets builds the manager this way. A reload hands SessionService the new provider
   * before its authenticator can fail to initialize, so the sweep follows the handshake filter,
   * which only a reload that succeeded rebuilds.
   */
  @Test
  void buildPushFeedSockets_sweepsAgainstTheProviderTheHandshakeFilterValidatesUnder()
      throws Exception {
    SocketAddressFilter handshakeFilter = PushFeedFilters.validatingUnder(AuthProvider.GOOGLE);
    OpenMetadataApplication.buildPushFeedSockets(
        EngineIoServerOptions.newFromDefault(), handshakeFilter);
    WebSocketManager sockets = WebSocketManager.getInstance();
    UUID userId = UUID.randomUUID();
    SessionStore store = mock(SessionStore.class);
    when(store.findById("session-g")).thenReturn(Optional.of(googleSession("session-g", userId)));
    SessionService handedLdap =
        new SessionService(PushFeedFilters.authenticationFor(AuthProvider.LDAP), store);
    SocketIoSocket socket = openSocket(sockets, userId, "socket-session");
    trackedSessionIds(sockets).put("socket-session", "session-g");

    sockets.disconnectInactiveSessions(handedLdap, 0L);

    verify(socket, never()).disconnect(anyBoolean());

    PushFeedFilters.applyReload(handshakeFilter, AuthProvider.AZURE);
    sockets.disconnectInactiveSessions(handedLdap, 0L);

    verify(socket).disconnect(true);
    assertEquals(Map.of(), sockets.getActivityFeedEndpoints());
  }

  private static UserSession googleSession(String sessionId, UUID userId) {
    long now = System.currentTimeMillis();
    return UserSession.builder()
        .id(sessionId)
        .userId(userId.toString())
        .provider(AuthProvider.GOOGLE.value())
        .status(SessionStatus.ACTIVE)
        .expiresAt(now + 60_000)
        .idleExpiresAt(now + 60_000)
        .build();
  }

  private static void reloadWith(ConfigurationChangeListener listener, AuthProvider provider) {
    listener.onConfigurationChanged(
        new AuthenticationConfiguration().withProvider(provider), null, null);
  }

  private static SocketIoSocket openSocket(WebSocketManager sockets, UUID userId, String socketId) {
    SocketIoSocket socket = mock(SocketIoSocket.class);
    when(socket.getId()).thenReturn(socketId);
    sockets
        .getActivityFeedEndpoints()
        .put(userId, new ConcurrentHashMap<>(Map.of(socketId, socket)));
    return socket;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, String> trackedSessionIds(WebSocketManager sockets) throws Exception {
    Field field = WebSocketManager.class.getDeclaredField("socketSessionIds");
    field.setAccessible(true);
    return (Map<String, String>) field.get(sockets);
  }

  @Test
  void aReloadedAuthenticatorIsRegisteredOnlyOnceItIsInitialized() {
    SecurityConfigurationManager registry = SecurityConfigurationManager.getInstance();
    AuthenticatorHandler registeredBefore = registry.getAuthenticatorHandler();
    registry.setAuthenticatorHandler(previousAuthenticator);
    try {
      doAnswer(
              init -> {
                assertSame(previousAuthenticator, registry.getAuthenticatorHandler());
                return null;
              })
          .when(currentAuthenticator)
          .init(any());

      OpenMetadataApplication.initializeThenPublish(
          currentAuthenticator, mock(OpenMetadataApplicationConfig.class));

      assertSame(currentAuthenticator, registry.getAuthenticatorHandler());
    } finally {
      registry.setAuthenticatorHandler(registeredBefore);
    }
  }

  @Test
  void aReloadedAuthenticatorThatFailsToStartIsClosedAndNeverRegistered() {
    SecurityConfigurationManager registry = SecurityConfigurationManager.getInstance();
    AuthenticatorHandler registeredBefore = registry.getAuthenticatorHandler();
    registry.setAuthenticatorHandler(previousAuthenticator);
    try {
      doThrow(new IllegalStateException("directory unreachable"))
          .when(currentAuthenticator)
          .init(any());

      assertThrows(
          IllegalStateException.class,
          () ->
              OpenMetadataApplication.initializeThenPublish(
                  currentAuthenticator, mock(OpenMetadataApplicationConfig.class)));

      verify(currentAuthenticator).close();
      assertSame(previousAuthenticator, registry.getAuthenticatorHandler());
    } finally {
      registry.setAuthenticatorHandler(registeredBefore);
    }
  }
}
