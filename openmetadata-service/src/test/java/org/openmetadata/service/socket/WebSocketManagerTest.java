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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.socket.engineio.server.EngineIoServerOptions;
import io.socket.socketio.server.SocketIoSocket;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.UserSession;

class WebSocketManagerTest {

  private WebSocketManager manager;

  @BeforeEach
  void setUp() throws Exception {
    WebSocketManager.WebSocketManagerBuilder.build(EngineIoServerOptions.newFromDefault());
    manager = WebSocketManager.getInstance();
    manager.getActivityFeedEndpoints().clear();
    clearManagerMap("socketSessionIds");
    clearManagerMap("socketSessionValidatedAt");
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

  private void clearManagerMap(String fieldName) throws Exception {
    java.lang.reflect.Field field = WebSocketManager.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    ((Map<?, ?>) field.get(manager)).clear();
  }
}
