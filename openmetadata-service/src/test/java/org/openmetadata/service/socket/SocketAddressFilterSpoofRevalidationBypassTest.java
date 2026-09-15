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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.auth0.jwt.interfaces.Claim;
import io.socket.engineio.server.EngineIoServerOptions;
import io.socket.socketio.server.SocketIoSocket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.net.URISyntaxException;
import java.nio.file.Path;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.jwt.JWTTokenConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

/**
 * Regression test for the WebSocket push-feed identity-spoofing / revalidation-bypass defect.
 *
 * <p>Scenario under test: an authenticated attacker (own valid JWT + own ACTIVE session) opens a
 * push-feed socket while sending spoofed client HTTP headers {@code UserId: <victim-uuid>} and
 * {@code SessionId:} (empty value). {@link SocketAddressFilter} validates the caller and writes the
 * <em>validated</em> {@code UserId}/{@code SessionId} into a {@link HeaderRequestWrapper}; engine.io
 * polling then builds the socket's initial headers via {@link HttpServletRequest#getHeaders(String)}
 * and {@link WebSocketManager} takes element {@code 0} as the socket identity / session.
 *
 * <p>Before the fix, {@link HeaderRequestWrapper#getHeaders(String)} returned client values first
 * and appended the validated value last, so {@code get(0)} was the client-controlled value,
 * enabling impersonation and (with the empty {@code SessionId}) evasion of session revalidation.
 * After the fix, the validated value is the sole element for an overridden header; these tests
 * assert that fixed behaviour end-to-end.
 */
@ExtendWith(MockitoExtension.class)
class SocketAddressFilterSpoofRevalidationBypassTest {

  private static final String SESSION_ID = String.valueOf('s').repeat(43);

  @Mock private AuthenticationConfiguration authConfig;
  @Mock private AuthorizerConfiguration authorizerConfig;
  @Mock private jakarta.servlet.http.HttpServletRequest request;
  @Mock private HttpServletResponse response;
  @Mock private FilterChain chain;
  @Mock private org.openmetadata.service.security.JwtFilter jwtFilter;
  @Mock private org.openmetadata.service.security.session.SessionService sessionService;

  private SocketAddressFilter filter;
  private WebSocketManager manager;

  @BeforeEach
  void setUp() throws Exception {
    initializeJwtTokenGenerator();
    when(authorizerConfig.getEnableSecureSocketConnection()).thenReturn(true);
    when(authConfig.getPublicKeyUrls()).thenReturn(List.of());
    when(authConfig.getJwtPrincipalClaims()).thenReturn(List.of("sub"));
    when(authConfig.getJwtPrincipalClaimsMapping()).thenReturn(List.of());
    filter = new SocketAddressFilter(authConfig, authorizerConfig, sessionService);
    java.lang.reflect.Field jwtFilterField =
        SocketAddressFilter.class.getDeclaredField("jwtFilter");
    jwtFilterField.setAccessible(true);
    jwtFilterField.set(filter, jwtFilter);

    WebSocketManager.WebSocketManagerBuilder.build(EngineIoServerOptions.newFromDefault());
    manager = WebSocketManager.getInstance();
    manager.getActivityFeedEndpoints().clear();
    clearManagerMap("socketSessionIds");
    clearManagerMap("socketSessionValidatedAt");
  }

  @Test
  void validatedHeadersAreSoleElementAndShadowClientSpoofedValues() throws Exception {
    UUID attackerUserId = UUID.randomUUID();
    UUID victimUserId = UUID.randomUUID();
    PrimeBuilder builder =
        primeRequest(attackerUserId, victimUserId).stubActiveAttackerSession().stubEntity();

    try (MockedStatic<Entity> ignored = builder.apply()) {
      filter.doFilter(request, response, chain);
    }

    HttpServletRequest wrapped = captureWrappedRequest();
    List<String> userIdHeaders = Collections.list(wrapped.getHeaders("UserId"));
    List<String> sessionIdHeaders = Collections.list(wrapped.getHeaders("SessionId"));

    // Validated values are the SOLE elements — client spoofed values do not survive.
    assertEquals(List.of(attackerUserId.toString()), userIdHeaders);
    assertFalse(userIdHeaders.contains(victimUserId.toString()));
    assertEquals(List.of(SESSION_ID), sessionIdHeaders);
    assertFalse(sessionIdHeaders.contains(""));

    // Singular accessor and multi-value accessor agree (the original divergence was the bug).
    assertEquals(attackerUserId.toString(), wrapped.getHeader("UserId"));
    assertEquals(SESSION_ID, wrapped.getHeader("SessionId"));
  }

  @Test
  void spoofSocketRegistersUnderAttackerAndRevalidationDisconnectsWhenSessionRevoked()
      throws Exception {
    UUID attackerUserId = UUID.randomUUID();
    UUID victimUserId = UUID.randomUUID();
    PrimeBuilder builder =
        primeRequest(attackerUserId, victimUserId).stubEntity().stubSessionActiveThenRevoked();
    try (MockedStatic<Entity> ignored = builder.apply()) {
      filter.doFilter(request, response, chain);
    }

    SocketIoSocket spoofSocket = mock(SocketIoSocket.class);
    when(spoofSocket.getId()).thenReturn("spoof-socket");
    replicateConnectionHandler(captureWrappedRequest(), spoofSocket);

    // Registered under the ATTACKER (validated principal), never under the victim.
    assertTrue(manager.getActivityFeedEndpoints().containsKey(attackerUserId));
    assertFalse(manager.getActivityFeedEndpoints().containsKey(victimUserId));
    // Session tracking is populated (validated non-empty SessionId is element 0), so revalidation
    // applies — the empty-client-header bypass is closed.
    assertEquals(SESSION_ID, getSocketSessionId("spoof-socket"));

    // Session is revoked at revalidation time -> the spoof socket is reaped. Before the fix, the
    // socket was keyed under the victim with no sessionId entry and survived this tick.
    manager.disconnectInactiveSessions(sessionService, 0L);

    verify(spoofSocket).disconnect(true);
    assertFalse(manager.getActivityFeedEndpoints().containsKey(attackerUserId));
    assertFalse(manager.getActivityFeedEndpoints().containsKey(victimUserId));
  }

  @Test
  void revokingAttackerOwnSessionDisconnectsTheSpoofSocket() throws Exception {
    UUID attackerUserId = UUID.randomUUID();
    UUID victimUserId = UUID.randomUUID();
    PrimeBuilder builder =
        primeRequest(attackerUserId, victimUserId).stubActiveAttackerSession().stubEntity();
    try (MockedStatic<Entity> ignored = builder.apply()) {
      filter.doFilter(request, response, chain);
    }

    SocketIoSocket spoofSocket = mock(SocketIoSocket.class);
    when(spoofSocket.getId()).thenReturn("spoof-socket");
    replicateConnectionHandler(captureWrappedRequest(), spoofSocket);

    // Revoking the attacker's OWN session drops the socket because it is correctly keyed under the
    // attacker with the attacker's session id. Before the fix this was a no-op (keyed under the
    // victim, no socketSessionIds entry).
    manager.disconnectForSession(attackerUserId, SESSION_ID);

    verify(spoofSocket).disconnect(true);
    assertFalse(manager.getActivityFeedEndpoints().containsKey(victimUserId));
  }

  // ----- helpers -----

  /**
   * Drives the real {@link SocketAddressFilter} through {@code doFilter} for the spoof scenario and
   * returns the wrapped request handed to {@link FilterChain#doFilter}, after which the caller
   * inspects {@code getHeaders(...)} exactly as engine.io polling would.
   */
  private HttpServletRequest captureWrappedRequest() throws Exception {
    ArgumentCaptor<ServletRequest> captor = ArgumentCaptor.forClass(ServletRequest.class);
    verify(chain).doFilter(captor.capture(), eq(response));
    return (HttpServletRequest) captor.getValue();
  }

  /**
   * Replays {@link WebSocketManager#initializeHandlers}'s connection-handler registration block
   * using the wrapped request's headers (the same map engine.io polling would have built). This
   * exercises the real {@code userIdHeaders.get(0)}/{@code sessionIdHeaders.get(0)} logic with the
   * filter-validated headers.
   */
  @SuppressWarnings("PMD.CloseResource")
  private void replicateConnectionHandler(HttpServletRequest wrapped, SocketIoSocket socket) {
    Map<String, List<String>> initialHeaders = new HashMap<>();
    initialHeaders.put("UserId", Collections.list(wrapped.getHeaders("UserId")));
    initialHeaders.put("SessionId", Collections.list(wrapped.getHeaders("SessionId")));
    List<String> userIdHeaders = listOrEmpty(initialHeaders.get("UserId"));
    List<String> sessionIdHeaders = listOrEmpty(initialHeaders.get("SessionId"));
    String userId = userIdHeaders.isEmpty() ? null : userIdHeaders.get(0);
    String sessionId = sessionIdHeaders.isEmpty() ? null : sessionIdHeaders.get(0);

    if (userId != null && !userId.isEmpty()) {
      UUID id = UUID.fromString(userId);
      manager
          .getActivityFeedEndpoints()
          .computeIfAbsent(id, k -> new ConcurrentHashMap<>())
          .put(socket.getId(), socket);
      if (sessionId != null && !sessionId.isEmpty()) {
        putSocketSessionId(socket.getId(), sessionId);
      }
    }
  }

  private PrimeBuilder primeRequest(UUID attackerUserId, UUID victimUserId) {
    return new PrimeBuilder(attackerUserId, victimUserId);
  }

  private org.openmetadata.service.security.session.UserSession activeSession(
      String sessionId, String username, UUID userId) {
    long now = System.currentTimeMillis();
    return org.openmetadata.service.security.session.UserSession.builder()
        .id(sessionId)
        .userId(userId.toString())
        .username(username)
        .status(org.openmetadata.service.security.session.SessionStatus.ACTIVE)
        .expiresAt(now + 60_000)
        .idleExpiresAt(now + 60_000)
        .build();
  }

  @SuppressWarnings("unchecked")
  private void putSocketSessionId(String socketId, String sessionId) {
    try {
      java.lang.reflect.Field field = WebSocketManager.class.getDeclaredField("socketSessionIds");
      field.setAccessible(true);
      ((Map<String, String>) field.get(manager)).put(socketId, sessionId);
    } catch (ReflectiveOperationException e) {
      throw new AssertionError(e);
    }
  }

  @SuppressWarnings("unchecked")
  private String getSocketSessionId(String socketId) {
    try {
      java.lang.reflect.Field field = WebSocketManager.class.getDeclaredField("socketSessionIds");
      field.setAccessible(true);
      return ((Map<String, String>) field.get(manager)).get(socketId);
    } catch (ReflectiveOperationException e) {
      throw new AssertionError(e);
    }
  }

  private void clearManagerMap(String fieldName) throws Exception {
    java.lang.reflect.Field field = WebSocketManager.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    ((Map<?, ?>) field.get(manager)).clear();
  }

  private static void initializeJwtTokenGenerator() {
    JWTTokenConfiguration tokenConfiguration = new JWTTokenConfiguration();
    tokenConfiguration.setJwtissuer("open-metadata.org");
    tokenConfiguration.setKeyId("test-key");
    tokenConfiguration.setRsaprivateKeyFilePath(resourceFilePath("private_key.der"));
    tokenConfiguration.setRsapublicKeyFilePath(resourceFilePath("public_key.der"));
    JWTTokenGenerator.getInstance()
        .init(AuthenticationConfiguration.TokenValidationAlgorithm.RS_256, tokenConfiguration);
  }

  private static String resourceFilePath(String resourceName) {
    try {
      return Path.of(
              Thread.currentThread().getContextClassLoader().getResource(resourceName).toURI())
          .toString();
    } catch (URISyntaxException e) {
      throw new RuntimeException(e);
    }
  }

  /**
   * Fluent helper to configure the mocked request / JWT / session for the spoof scenario. The
   * client-supplied spoof headers ({@code UserId: <victim>}, {@code SessionId:} empty) are stubbed
   * leniently: with the fix the wrapper never consults {@code super.getHeaders(...)} for an
   * overridden header, so those stubs model the precondition rather than an expected invocation.
   */
  private final class PrimeBuilder {
    private final UUID attackerUserId;
    private final UUID victimUserId;
    private final String username = "attacker-username";
    private boolean stubSession = false;
    private boolean activeThenRevoked = false;

    private PrimeBuilder(UUID attackerUserId, UUID victimUserId) {
      this.attackerUserId = attackerUserId;
      this.victimUserId = victimUserId;
    }

    PrimeBuilder stubActiveAttackerSession() {
      stubSession = true;
      return this;
    }

    PrimeBuilder stubSessionActiveThenRevoked() {
      stubSession = true;
      activeThenRevoked = true;
      return this;
    }

    PrimeBuilder stubEntity() {
      return this;
    }

    /**
     * Applies the request mocks and returns the {@link MockedStatic} for {@link Entity} so the
     * caller controls its scope. Entity stubbing is applied inside the static mock because {@code
     * Entity.getEntityReferenceByName} is a static method.
     */
    MockedStatic<Entity> apply() {
      when(request.getQueryString()).thenReturn("userId=" + attackerUserId);
      when(request.getRemoteAddr()).thenReturn("127.0.0.1");
      when(request.getHeader("Authorization")).thenReturn("Bearer token");
      // Client-supplied spoofed headers — lenient: with the fix these are NOT consulted for
      // overridden headers, but they model the attacker's precondition and turn the test into a
      // real regression guard (with the bug, get(0) would read them).
      lenient().when(request.getHeaders("UserId")).thenReturn(enumeration(victimUserId.toString()));
      lenient().when(request.getHeaders("SessionId")).thenReturn(enumeration(""));

      mockTokenClaims();
      if (stubSession) {
        if (activeThenRevoked) {
          when(sessionService.getFreshSessionById(SESSION_ID))
              .thenReturn(Optional.of(activeSession(SESSION_ID, username, attackerUserId)))
              .thenReturn(Optional.empty());
        } else {
          when(sessionService.getFreshSessionById(SESSION_ID))
              .thenReturn(Optional.of(activeSession(SESSION_ID, username, attackerUserId)));
        }
      }

      MockedStatic<Entity> entityMock = mockStatic(Entity.class);
      entityMock
          .when(() -> Entity.getEntityReferenceByName(Entity.USER, username, Include.NON_DELETED))
          .thenReturn(new EntityReference().withId(attackerUserId));
      return entityMock;
    }

    private void mockTokenClaims() {
      Claim usernameClaim = mock(Claim.class);
      Claim sessionClaim = mock(Claim.class);
      when(usernameClaim.asString()).thenReturn(username);
      when(sessionClaim.asString()).thenReturn(SESSION_ID);
      when(jwtFilter.validateJwtAndGetClaims("token"))
          .thenReturn(
              Map.of("sub", usernameClaim, JWTTokenGenerator.SESSION_ID_CLAIM, sessionClaim));
      when(jwtFilter.getJwtPrincipalClaims()).thenReturn(List.of("sub"));
    }

    private Enumeration<String> enumeration(String... values) {
      return Collections.enumeration(List.of(values));
    }
  }
}
