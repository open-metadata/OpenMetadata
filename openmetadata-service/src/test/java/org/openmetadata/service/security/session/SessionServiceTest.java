package org.openmetadata.service.security.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.fernet.Fernet;

@ExtendWith(MockitoExtension.class)
class SessionServiceTest {

  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";

  @Mock private AuthenticationConfiguration authConfig;
  @Mock private SessionStore repository;
  @Mock private ScheduledExecutorService scheduler;
  @Mock private HttpServletRequest request;
  @Mock private HttpServletResponse response;

  private SessionService sessionService;

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    lenient().when(authConfig.getForceSecureSessionCookie()).thenReturn(false);
    lenient().when(authConfig.getSessionExpiry()).thenReturn(null);
    lenient().when(authConfig.getMaxActiveSessionsPerUser()).thenReturn(null);
    lenient().when(request.isSecure()).thenReturn(false);
    sessionService =
        new SessionService(authConfig, repository, Caffeine.newBuilder().build(), scheduler);
  }

  @AfterEach
  void tearDown() {
    Fernet.getInstance().setFernetKey((String) null);
  }

  @Test
  void createPendingSession_persistsSessionAndSetsCookie() {
    UserSession session =
        sessionService.createPendingSession(
            request,
            response,
            "basic",
            "http://localhost:3000/callback",
            "state-123",
            "nonce-123",
            "pkce-123");

    ArgumentCaptor<UserSession> sessionCaptor = ArgumentCaptor.forClass(UserSession.class);
    verify(repository).create(sessionCaptor.capture());
    verify(response)
        .addHeader(eq("Set-Cookie"), org.mockito.ArgumentMatchers.contains("OM_SESSION="));

    UserSession storedSession = sessionCaptor.getValue();
    assertEquals(session.getId(), storedSession.getId());
    assertEquals(SessionStatus.PENDING, storedSession.getStatus());
    assertEquals("state-123", storedSession.getState());
    assertEquals("nonce-123", storedSession.getNonce());
    assertEquals("pkce-123", storedSession.getPkceVerifier());
  }

  @Test
  void activatePendingSession_promotesPendingSessionAndEncryptsTokens() {
    long now = System.currentTimeMillis();
    String pendingId = validSessionId('p');
    UserSession pendingSession =
        UserSession.builder()
            .id(pendingId)
            .type(SessionType.AUTH)
            .provider("okta")
            .status(SessionStatus.PENDING)
            .state("state")
            .nonce("nonce")
            .pkceVerifier("pkce")
            .redirectUri("https://example.com/auth/callback")
            .version(0L)
            .expiresAt(now + 1_000)
            .idleExpiresAt(now + 1_000)
            .build();
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName("oidc-user")
            .withEmail("oidc-user@example.com");
    when(repository.updateIfVersion(any(UserSession.class), eq(0L))).thenReturn(true);
    when(repository.findByUserIdAndStatus(
            eq(user.getId().toString()), eq(SessionStatus.ACTIVE), anyInt()))
        .thenReturn(List.of());

    UserSession activated =
        sessionService
            .activatePendingSession(
                request, response, pendingSession, user, "om-refresh", "provider-refresh")
            .orElseThrow();

    assertEquals(SessionStatus.ACTIVE, activated.getStatus());
    assertEquals(user.getId().toString(), activated.getUserId());
    assertTrue(activated.getExpiresAt() > now + 60_000);
    assertNotEquals("om-refresh", activated.getOmRefreshToken());
    assertNotEquals("provider-refresh", activated.getProviderRefreshToken());
    assertEquals("om-refresh", sessionService.decryptOmRefreshToken(activated));
    assertEquals("provider-refresh", sessionService.decryptProviderRefreshToken(activated));
  }

  @Test
  void activatePendingSession_issuesNewSessionId_preventingSessionFixation() {
    long now = System.currentTimeMillis();
    String pendingId = validSessionId('f');
    UserSession pendingSession =
        UserSession.builder()
            .id(pendingId)
            .type(SessionType.AUTH)
            .provider("okta")
            .status(SessionStatus.PENDING)
            .state("state")
            .nonce("nonce")
            .pkceVerifier("pkce")
            .redirectUri("https://example.com/auth/callback")
            .version(0L)
            .expiresAt(now + 600_000)
            .idleExpiresAt(now + 600_000)
            .build();
    User user = new User().withId(UUID.randomUUID()).withName("user").withEmail("user@example.com");
    when(repository.updateIfVersion(any(UserSession.class), eq(0L))).thenReturn(true);
    when(repository.findByUserIdAndStatus(
            eq(user.getId().toString()), eq(SessionStatus.ACTIVE), anyInt()))
        .thenReturn(List.of());

    UserSession activated =
        sessionService
            .activatePendingSession(
                request, response, pendingSession, user, "om-refresh", "provider-refresh")
            .orElseThrow();

    // Session fixation defense: the activated session MUST have a different ID than the pending one
    assertNotEquals(
        pendingId,
        activated.getId(),
        "Session ID must be regenerated on activation to prevent session fixation");
    assertEquals(SessionStatus.ACTIVE, activated.getStatus());

    // Verify the old pending session was expired in the database
    ArgumentCaptor<UserSession> expiredCaptor = ArgumentCaptor.forClass(UserSession.class);
    verify(repository).updateIfVersion(expiredCaptor.capture(), eq(0L));
    assertEquals(SessionStatus.EXPIRED, expiredCaptor.getValue().getStatus());
    assertEquals(pendingId, expiredCaptor.getValue().getId());

    // Verify a new session was created in the database
    ArgumentCaptor<UserSession> createdCaptor = ArgumentCaptor.forClass(UserSession.class);
    verify(repository).create(createdCaptor.capture());
    assertNotEquals(pendingId, createdCaptor.getValue().getId());
    assertEquals(SessionStatus.ACTIVE, createdCaptor.getValue().getStatus());
  }

  @Test
  void getActiveSession_expiredSessionIsMarkedExpiredAndCookieCleared() {
    String sessionId = validSessionId('e');
    UserSession expiredSession =
        UserSession.builder()
            .id(sessionId)
            .status(SessionStatus.ACTIVE)
            .version(3L)
            .expiresAt(System.currentTimeMillis() - 1_000)
            .idleExpiresAt(System.currentTimeMillis() - 1_000)
            .updatedAt(System.currentTimeMillis() - 2_000)
            .build();

    when(request.getCookies()).thenReturn(new Cookie[] {new Cookie("OM_SESSION", sessionId)});
    when(repository.findById(sessionId)).thenReturn(Optional.of(expiredSession));
    when(repository.updateIfVersion(any(UserSession.class), anyLong())).thenReturn(true);

    Optional<UserSession> maybeSession = sessionService.getActiveSession(request, response);

    ArgumentCaptor<UserSession> sessionCaptor = ArgumentCaptor.forClass(UserSession.class);
    verify(repository).updateIfVersion(sessionCaptor.capture(), eq(3L));
    verify(response)
        .addHeader(eq("Set-Cookie"), org.mockito.ArgumentMatchers.contains("Max-Age=0"));

    assertTrue(maybeSession.isEmpty());
    assertEquals(SessionStatus.EXPIRED, sessionCaptor.getValue().getStatus());
  }

  @Test
  void getSession_ignoresInvalidSessionCookieWithoutDatabaseLookup() {
    when(request.getCookies()).thenReturn(new Cookie[] {new Cookie("OM_SESSION", "invalid")});

    Optional<UserSession> maybeSession = sessionService.getSession(request);

    assertTrue(maybeSession.isEmpty());
    verify(repository, never()).findById(any());
  }

  @Test
  void getSessionById_returnsCachedSessionWithoutDatabaseLookup() {
    UserSession createdSession =
        sessionService.createPendingSession(
            request,
            response,
            "basic",
            "http://localhost:3000/callback",
            "state-123",
            "nonce-123",
            "pkce-123");

    Optional<UserSession> maybeSession = sessionService.getSessionById(createdSession.getId());

    assertTrue(maybeSession.isPresent());
    assertEquals(createdSession.getId(), maybeSession.get().getId());
    verify(repository, never()).findById(createdSession.getId());
  }

  @Test
  void acquireRefreshLease_throwsRetryableExceptionWhenLeaseIsHeld() {
    String sessionId = validSessionId('r');
    long now = System.currentTimeMillis();
    UserSession refreshingSession =
        UserSession.builder()
            .id(sessionId)
            .status(SessionStatus.REFRESHING)
            .refreshLeaseUntil(now + 5_000)
            .version(2L)
            .expiresAt(now + 60_000)
            .idleExpiresAt(now + 60_000)
            .build();

    when(request.getCookies()).thenReturn(new Cookie[] {new Cookie("OM_SESSION", sessionId)});
    when(repository.findById(sessionId)).thenReturn(Optional.of(refreshingSession));

    SessionRefreshInProgressException exception =
        assertThrows(
            SessionRefreshInProgressException.class,
            () -> sessionService.acquireRefreshLease(request, response));

    assertTrue(exception.getRetryAfterSeconds() >= 1);
  }

  @Test
  void acquireRefreshLease_reclaimsStaleLease() {
    String sessionId = validSessionId('s');
    long now = System.currentTimeMillis();
    UserSession staleLease =
        UserSession.builder()
            .id(sessionId)
            .status(SessionStatus.REFRESHING)
            .refreshLeaseUntil(now - 1_000)
            .version(4L)
            .expiresAt(now + 60_000)
            .idleExpiresAt(now + 60_000)
            .build();

    when(request.getCookies()).thenReturn(new Cookie[] {new Cookie("OM_SESSION", sessionId)});
    when(repository.findById(sessionId)).thenReturn(Optional.of(staleLease));
    when(repository.updateIfVersion(any(UserSession.class), eq(4L))).thenReturn(true);

    UserSession leased = sessionService.acquireRefreshLease(request, response).orElseThrow();

    assertEquals(SessionStatus.REFRESHING, leased.getStatus());
    assertTrue(leased.getRefreshLeaseUntil() > now);
    assertEquals(5L, leased.getVersion());
  }

  @Test
  void acquireRefreshLease_reloadsOnVersionConflictAndReturnsBusyState() {
    String sessionId = validSessionId('l');
    long now = System.currentTimeMillis();
    UserSession activeSession =
        UserSession.builder()
            .id(sessionId)
            .status(SessionStatus.ACTIVE)
            .version(7L)
            .expiresAt(now + 60_000)
            .idleExpiresAt(now + 60_000)
            .build();
    UserSession busySession =
        activeSession.toBuilder()
            .status(SessionStatus.REFRESHING)
            .refreshLeaseUntil(now + 5_000)
            .version(8L)
            .build();

    when(request.getCookies()).thenReturn(new Cookie[] {new Cookie("OM_SESSION", sessionId)});
    when(repository.findById(sessionId))
        .thenReturn(Optional.of(activeSession))
        .thenReturn(Optional.of(busySession));
    when(repository.updateIfVersion(any(UserSession.class), eq(7L))).thenReturn(false);

    assertThrows(
        SessionRefreshInProgressException.class,
        () -> sessionService.acquireRefreshLease(request, response));
  }

  @Test
  void acquireRefreshLease_rechecksDatabaseBeforeRejectingCachedBusySession() {
    String sessionId = validSessionId('q');
    long now = System.currentTimeMillis();
    UserSession cachedRefreshingSession =
        UserSession.builder()
            .id(sessionId)
            .status(SessionStatus.REFRESHING)
            .refreshLeaseUntil(now + 5_000)
            .version(2L)
            .expiresAt(now + 60_000)
            .idleExpiresAt(now + 60_000)
            .build();
    UserSession freshActiveSession =
        cachedRefreshingSession.toBuilder()
            .status(SessionStatus.ACTIVE)
            .refreshLeaseUntil(null)
            .version(3L)
            .build();

    when(request.getCookies()).thenReturn(new Cookie[] {new Cookie("OM_SESSION", sessionId)});
    when(repository.findById(sessionId))
        .thenReturn(Optional.of(cachedRefreshingSession))
        .thenReturn(Optional.of(freshActiveSession));
    when(repository.updateIfVersion(any(UserSession.class), eq(3L))).thenReturn(true);

    sessionService.getSessionById(sessionId);
    UserSession leased = sessionService.acquireRefreshLease(request, response).orElseThrow();

    assertEquals(SessionStatus.REFRESHING, leased.getStatus());
    assertEquals(4L, leased.getVersion());
    verify(repository, times(2)).findById(sessionId);
    verify(repository).updateIfVersion(any(UserSession.class), eq(3L));
  }

  @Test
  void completeRefresh_restoresActiveSessionAndEncryptsTokens() {
    long now = System.currentTimeMillis();
    UserSession leasedSession =
        UserSession.builder()
            .id("leased-session")
            .status(SessionStatus.REFRESHING)
            .version(1L)
            .refreshLeaseUntil(now + 5_000)
            .expiresAt(now + 60_000)
            .idleExpiresAt(now + 60_000)
            .build();
    when(repository.updateIfVersion(any(UserSession.class), eq(1L))).thenReturn(true);

    UserSession refreshed =
        sessionService
            .completeRefresh(leasedSession, "rotated-om", "rotated-provider")
            .orElseThrow();

    assertEquals(SessionStatus.ACTIVE, refreshed.getStatus());
    assertNull(refreshed.getRefreshLeaseUntil());
    assertEquals("rotated-om", sessionService.decryptOmRefreshToken(refreshed));
    assertEquals("rotated-provider", sessionService.decryptProviderRefreshToken(refreshed));
  }

  @Test
  void acquireRefreshLease_rewritesCookieWithRemainingSessionLifetime() {
    when(authConfig.getSessionExpiry()).thenReturn(3600);
    String sessionId = validSessionId('m');
    long now = System.currentTimeMillis();
    UserSession activeSession =
        UserSession.builder()
            .id(sessionId)
            .status(SessionStatus.ACTIVE)
            .version(1L)
            .expiresAt(now + 300_000)
            .idleExpiresAt(now + 60_000)
            .build();

    when(request.getCookies()).thenReturn(new Cookie[] {new Cookie("OM_SESSION", sessionId)});
    when(repository.findById(sessionId)).thenReturn(Optional.of(activeSession));
    when(repository.updateIfVersion(any(UserSession.class), eq(1L))).thenReturn(true);

    UserSession leased = sessionService.acquireRefreshLease(request, response).orElseThrow();

    assertEquals(activeSession.getExpiresAt(), leased.getIdleExpiresAt());
    ArgumentCaptor<String> cookieCaptor = ArgumentCaptor.forClass(String.class);
    verify(response).addHeader(eq("Set-Cookie"), cookieCaptor.capture());
    int maxAge = cookieMaxAge(cookieCaptor.getValue());
    assertTrue(maxAge > 240);
    assertTrue(maxAge <= 300);
  }

  @Test
  void releaseRefreshLease_revertsRefreshingSessionToActive() {
    long now = System.currentTimeMillis();
    UserSession leased =
        UserSession.builder()
            .id("leased-session")
            .status(SessionStatus.REFRESHING)
            .version(2L)
            .refreshLeaseUntil(now + 5_000)
            .expiresAt(now + 60_000)
            .idleExpiresAt(now + 60_000)
            .build();
    when(repository.findById("leased-session")).thenReturn(Optional.of(leased));
    when(repository.updateIfVersion(any(UserSession.class), eq(2L))).thenReturn(true);

    sessionService.releaseRefreshLease(leased);

    ArgumentCaptor<UserSession> captor = ArgumentCaptor.forClass(UserSession.class);
    verify(repository).updateIfVersion(captor.capture(), eq(2L));
    assertEquals(SessionStatus.ACTIVE, captor.getValue().getStatus());
    assertNull(captor.getValue().getRefreshLeaseUntil());
  }

  @Test
  void releaseRefreshLease_noOpWhenLeasedSessionNotRefreshing() {
    UserSession active =
        UserSession.builder().id("active-session").status(SessionStatus.ACTIVE).version(1L).build();

    sessionService.releaseRefreshLease(active);

    verify(repository, never()).updateIfVersion(any(UserSession.class), anyLong());
  }

  @Test
  void revokeSession_marksSessionRevokedAndClearsCookie() {
    String sessionId = validSessionId('a');
    UserSession activeSession =
        UserSession.builder()
            .id(sessionId)
            .status(SessionStatus.ACTIVE)
            .version(4L)
            .updatedAt(System.currentTimeMillis())
            .lastAccessedAt(System.currentTimeMillis())
            .build();

    when(request.getCookies()).thenReturn(new Cookie[] {new Cookie("OM_SESSION", sessionId)});
    when(repository.findById(sessionId)).thenReturn(Optional.of(activeSession));
    when(repository.updateIfVersion(any(UserSession.class), anyLong())).thenReturn(true);

    sessionService.revokeSession(request, response);

    ArgumentCaptor<UserSession> sessionCaptor = ArgumentCaptor.forClass(UserSession.class);
    verify(repository).updateIfVersion(sessionCaptor.capture(), eq(4L));
    verify(response)
        .addHeader(eq("Set-Cookie"), org.mockito.ArgumentMatchers.contains("Max-Age=0"));

    assertEquals(SessionStatus.REVOKED, sessionCaptor.getValue().getStatus());
  }

  @Test
  void revokeSession_firesRegisteredRevocationListenerWithUserId() {
    String sessionId = validSessionId('w');
    String userId = UUID.randomUUID().toString();
    long now = System.currentTimeMillis();
    UserSession active =
        UserSession.builder()
            .id(sessionId)
            .userId(userId)
            .status(SessionStatus.ACTIVE)
            .version(0L)
            .expiresAt(now + 60_000)
            .idleExpiresAt(now + 60_000)
            .updatedAt(now)
            .lastAccessedAt(now)
            .build();
    when(repository.findById(sessionId)).thenReturn(Optional.of(active));
    when(repository.updateIfVersion(any(UserSession.class), eq(0L))).thenReturn(true);

    java.util.concurrent.atomic.AtomicReference<String> capturedUserId =
        new java.util.concurrent.atomic.AtomicReference<>();
    sessionService.registerRevocationListener(session -> capturedUserId.set(session.getUserId()));

    sessionService.revokeSession(sessionId).orElseThrow();

    assertEquals(userId, capturedUserId.get());
  }

  @Test
  void revokeSession_listenerNotFiredOnVersionConflictExhaustion() {
    String sessionId = validSessionId('x');
    String userId = UUID.randomUUID().toString();
    long now = System.currentTimeMillis();
    UserSession active =
        UserSession.builder()
            .id(sessionId)
            .userId(userId)
            .status(SessionStatus.ACTIVE)
            .version(0L)
            .expiresAt(now + 60_000)
            .idleExpiresAt(now + 60_000)
            .updatedAt(now)
            .lastAccessedAt(now)
            .build();
    when(repository.findById(sessionId)).thenReturn(Optional.of(active));
    when(repository.updateIfVersion(any(UserSession.class), anyLong())).thenReturn(false);

    java.util.concurrent.atomic.AtomicBoolean fired =
        new java.util.concurrent.atomic.AtomicBoolean(false);
    sessionService.registerRevocationListener(u -> fired.set(true));

    sessionService.revokeSession(sessionId);

    assertFalse(fired.get(), "Listener must not fire when revocation never succeeded");
  }

  @Test
  void revokeSession_retriesVersionConflictUntilSessionIsRevoked() {
    String sessionId = validSessionId('v');
    long now = System.currentTimeMillis();
    UserSession firstRead =
        UserSession.builder()
            .id(sessionId)
            .status(SessionStatus.ACTIVE)
            .version(4L)
            .expiresAt(now + 60_000)
            .idleExpiresAt(now + 60_000)
            .updatedAt(now)
            .lastAccessedAt(now)
            .build();
    UserSession secondRead = firstRead.toBuilder().version(5L).build();

    when(repository.findById(sessionId))
        .thenReturn(Optional.of(firstRead))
        .thenReturn(Optional.of(secondRead));
    when(repository.updateIfVersion(any(UserSession.class), eq(4L))).thenReturn(false);
    when(repository.updateIfVersion(any(UserSession.class), eq(5L))).thenReturn(true);

    UserSession revoked = sessionService.revokeSession(sessionId).orElseThrow();

    assertEquals(SessionStatus.REVOKED, revoked.getStatus());
    assertEquals(6L, revoked.getVersion());
    verify(repository).updateIfVersion(any(UserSession.class), eq(4L));
    verify(repository).updateIfVersion(any(UserSession.class), eq(5L));
    verify(repository, times(2)).findById(sessionId);
  }

  @Test
  void createActiveSession_appliesUserSessionLimitAndEncryptsRefreshToken() {
    String oldestSessionId = validSessionId('o');
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName("session-user")
            .withEmail("session-user@example.com");
    UserSession oldestSession =
        UserSession.builder()
            .id(oldestSessionId)
            .status(SessionStatus.ACTIVE)
            .userId(user.getId().toString())
            .version(9L)
            .lastAccessedAt(1L)
            .build();
    List<UserSession> activeSessions =
        List.of(
            oldestSession,
            activeSession(validSessionId('b'), user, 2L, 2L),
            activeSession(validSessionId('c'), user, 3L, 3L),
            activeSession(validSessionId('d'), user, 4L, 4L),
            activeSession(validSessionId('f'), user, 5L, 5L),
            activeSession(validSessionId('g'), user, 6L, 6L));
    List<UserSession> remainingSessions = activeSessions.stream().skip(1).toList();
    when(repository.findByUserIdAndStatus(
            eq(user.getId().toString()), eq(SessionStatus.ACTIVE), anyInt()))
        .thenReturn(activeSessions, remainingSessions);
    when(repository.findById(oldestSessionId)).thenReturn(Optional.of(oldestSession));
    when(repository.updateIfVersion(any(UserSession.class), anyLong())).thenReturn(true);

    UserSession session =
        sessionService.createActiveSession(request, response, "basic", user, "refresh-token");

    assertEquals(SessionStatus.ACTIVE, session.getStatus());
    assertEquals(user.getId().toString(), session.getUserId());
    assertEquals("refresh-token", sessionService.decryptOmRefreshToken(session));
    verify(repository).findById(oldestSessionId);
  }

  @Test
  void createActiveSession_usesConfiguredSessionLimit() {
    when(authConfig.getMaxActiveSessionsPerUser()).thenReturn(2);
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName("session-user")
            .withEmail("session-user@example.com");
    UserSession oldestSession = activeSession(validSessionId('a'), user, 1L, 1L);
    UserSession nextOldestSession = activeSession(validSessionId('b'), user, 2L, 2L);
    UserSession thirdSession = activeSession(validSessionId('c'), user, 3L, 3L);
    UserSession newestSession = activeSession(validSessionId('d'), user, 4L, 4L);
    List<UserSession> activeSessions =
        List.of(oldestSession, nextOldestSession, thirdSession, newestSession);
    when(repository.findByUserIdAndStatus(
            eq(user.getId().toString()), eq(SessionStatus.ACTIVE), eq(8)))
        .thenReturn(activeSessions, List.of(thirdSession, newestSession));
    when(repository.findById(oldestSession.getId())).thenReturn(Optional.of(oldestSession));
    when(repository.findById(nextOldestSession.getId())).thenReturn(Optional.of(nextOldestSession));
    when(repository.updateIfVersion(any(UserSession.class), anyLong())).thenReturn(true);

    sessionService.createActiveSession(request, response, "basic", user, "refresh-token");

    verify(repository).findById(oldestSession.getId());
    verify(repository).findById(nextOldestSession.getId());
    verify(repository, never()).findById(thirdSession.getId());
    verify(repository, never()).findById(newestSession.getId());
  }

  @Test
  void bearerAccessRefreshesLruPositionBeforeSessionLimitEviction() {
    when(authConfig.getMaxActiveSessionsPerUser()).thenReturn(5);
    long now = System.currentTimeMillis();
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName("session-user")
            .withEmail("session-user@example.com");
    UserSession bearerSession =
        activeSession(validSessionId('a'), user, 10L, 1L).toBuilder()
            .username(user.getName())
            .expiresAt(now + TimeUnit.HOURS.toMillis(1))
            .idleExpiresAt(now + TimeUnit.HOURS.toMillis(1))
            .build();
    when(repository.updateIfVersion(any(UserSession.class), anyLong())).thenReturn(true);

    UserSession refreshedBearerSession =
        sessionService.recordSessionAccess(bearerSession).orElseThrow();
    UserSession evictedSession = activeSession(validSessionId('b'), user, 2L, 2L);
    List<UserSession> activeSessions =
        List.of(
            refreshedBearerSession,
            evictedSession,
            activeSession(validSessionId('c'), user, 3L, 3L),
            activeSession(validSessionId('d'), user, 4L, 4L),
            activeSession(validSessionId('e'), user, 5L, 5L),
            activeSession(validSessionId('f'), user, 6L, 6L));
    when(repository.findByUserIdAndStatus(
            eq(user.getId().toString()), eq(SessionStatus.ACTIVE), eq(20)))
        .thenReturn(
            activeSessions, activeSessions.stream().filter(s -> s != evictedSession).toList());
    when(repository.findById(evictedSession.getId())).thenReturn(Optional.of(evictedSession));

    sessionService.createActiveSession(request, response, "basic", user, "refresh-token");

    assertTrue(refreshedBearerSession.getLastAccessedAt() > bearerSession.getLastAccessedAt());
    verify(repository).findById(evictedSession.getId());
    verify(repository, never()).findById(bearerSession.getId());
  }

  @Test
  void recordSessionAccess_skipsStoreWriteWhenAccessWasRecentlyRecorded() {
    long now = System.currentTimeMillis();
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName("session-user")
            .withEmail("session-user@example.com");
    UserSession freshSession =
        activeSession(validSessionId('r'), user, 10L, now).toBuilder()
            .username(user.getName())
            .expiresAt(now + TimeUnit.HOURS.toMillis(1))
            .idleExpiresAt(now + TimeUnit.HOURS.toMillis(1))
            .build();

    UserSession result = sessionService.recordSessionAccess(freshSession).orElseThrow();

    assertEquals(freshSession.getId(), result.getId());
    assertEquals(freshSession.getLastAccessedAt(), result.getLastAccessedAt());
    verify(repository, never()).updateIfVersion(any(UserSession.class), anyLong());
  }

  @Test
  void recordSessionAccess_refreshesStoreWriteWhenIdleExpiryIsNear() {
    long now = System.currentTimeMillis();
    long nearIdleExpiry = now + 10_000;
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName("session-user")
            .withEmail("session-user@example.com");
    UserSession freshSessionNearIdleExpiry =
        activeSession(validSessionId('i'), user, 10L, now).toBuilder()
            .username(user.getName())
            .expiresAt(now + TimeUnit.HOURS.toMillis(1))
            .idleExpiresAt(nearIdleExpiry)
            .build();
    when(repository.updateIfVersion(any(UserSession.class), anyLong())).thenReturn(true);

    UserSession result =
        sessionService.recordSessionAccess(freshSessionNearIdleExpiry).orElseThrow();

    assertTrue(result.getIdleExpiresAt() > nearIdleExpiry);
    verify(repository).updateIfVersion(any(UserSession.class), eq(10L));
  }

  @Test
  void createActiveSession_usesConfiguredSessionExpiryForAbsoluteExpiryAndCookie() {
    when(authConfig.getSessionExpiry()).thenReturn(3600);
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName("session-user")
            .withEmail("session-user@example.com");
    when(repository.findByUserIdAndStatus(
            eq(user.getId().toString()), eq(SessionStatus.ACTIVE), anyInt()))
        .thenReturn(List.of());

    UserSession session =
        sessionService.createActiveSession(request, response, "basic", user, "refresh-token");

    ArgumentCaptor<UserSession> sessionCaptor = ArgumentCaptor.forClass(UserSession.class);
    verify(repository).create(sessionCaptor.capture());
    UserSession storedSession = sessionCaptor.getValue();
    assertEquals(
        TimeUnit.SECONDS.toMillis(3600),
        storedSession.getExpiresAt() - storedSession.getCreatedAt());
    assertEquals(storedSession.getExpiresAt(), storedSession.getIdleExpiresAt());
    assertEquals(storedSession.getExpiresAt(), session.getExpiresAt());
    verify(response)
        .addHeader(eq("Set-Cookie"), org.mockito.ArgumentMatchers.contains("Max-Age=3600"));
  }

  @Test
  void createActiveSession_enforcesSessionLimitAcrossMultipleBatches() {
    when(authConfig.getMaxActiveSessionsPerUser()).thenReturn(5);
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName("session-user")
            .withEmail("session-user@example.com");
    List<UserSession> firstBatch =
        java.util.stream.IntStream.range(0, 11)
            .mapToObj(i -> activeSession(validSessionId((char) ('a' + i)), user, i + 1L, i + 1L))
            .toList();
    List<UserSession> remaining = firstBatch.stream().skip(6).toList();
    when(repository.findByUserIdAndStatus(
            eq(user.getId().toString()), eq(SessionStatus.ACTIVE), eq(20)))
        .thenReturn(firstBatch, remaining);
    firstBatch
        .subList(0, 6)
        .forEach(
            session -> when(repository.findById(session.getId())).thenReturn(Optional.of(session)));
    when(repository.updateIfVersion(any(UserSession.class), anyLong())).thenReturn(true);

    sessionService.createActiveSession(request, response, "basic", user, "refresh-token");

    for (UserSession session : firstBatch.subList(0, 6)) {
      verify(repository).findById(session.getId());
    }
    verify(repository, never()).findById(firstBatch.get(6).getId());
  }

  @Test
  void runCleanupOnce_batchesExpiringAndPruningSessions() {
    long now = System.currentTimeMillis();
    UserSession expiredActive =
        UserSession.builder()
            .id("expired-active")
            .status(SessionStatus.ACTIVE)
            .version(1L)
            .expiresAt(now - 1_000)
            .idleExpiresAt(now - 1_000)
            .updatedAt(now - 2_000)
            .build();
    UserSession expiredRefreshing =
        UserSession.builder()
            .id("expired-refreshing")
            .status(SessionStatus.REFRESHING)
            .version(2L)
            .expiresAt(now - 1_000)
            .idleExpiresAt(now - 1_000)
            .updatedAt(now - 2_000)
            .build();
    UserSession pruned =
        UserSession.builder().id("pruned-session").status(SessionStatus.REVOKED).build();

    when(repository.findSessionsToExpire(anyLong(), anyInt()))
        .thenReturn(List.of(expiredActive, expiredRefreshing), List.of());
    when(repository.findSessionsToPrune(anyLong(), anyInt()))
        .thenReturn(List.of(pruned), List.of());
    when(repository.updateIfVersion(any(UserSession.class), anyLong())).thenReturn(true);

    sessionService.runCleanupOnce();

    ArgumentCaptor<UserSession> updateCaptor = ArgumentCaptor.forClass(UserSession.class);
    verify(repository, atLeast(2)).updateIfVersion(updateCaptor.capture(), anyLong());
    assertTrue(
        updateCaptor.getAllValues().stream()
            .allMatch(session -> session.getStatus() == SessionStatus.EXPIRED));
    verify(repository).deleteByIds(List.of("pruned-session"));
  }

  @Test
  void getPendingSessionById_resolvesPendingSessionByIdAlone() {
    String id = validSessionId('p');
    when(repository.findById(id))
        .thenReturn(Optional.of(pendingSession(id, System.currentTimeMillis() + 60_000)));

    assertTrue(sessionService.getPendingSessionById(id).isPresent());
  }

  @Test
  void getPendingSessionById_rejectsActiveSession() {
    String id = validSessionId('a');
    UserSession active =
        pendingSession(id, System.currentTimeMillis() + 60_000).toBuilder()
            .status(SessionStatus.ACTIVE)
            .build();
    when(repository.findById(id)).thenReturn(Optional.of(active));

    assertFalse(sessionService.getPendingSessionById(id).isPresent());
  }

  @Test
  void getPendingSessionById_rejectsExpiredSession() {
    String id = validSessionId('e');
    when(repository.findById(id))
        .thenReturn(Optional.of(pendingSession(id, System.currentTimeMillis() - 60_000)));

    assertFalse(sessionService.getPendingSessionById(id).isPresent());
  }

  @Test
  void getPendingSessionById_rejectsUnknownSession() {
    String id = validSessionId('u');
    when(repository.findById(id)).thenReturn(Optional.empty());

    assertFalse(sessionService.getPendingSessionById(id).isPresent());
  }

  @Test
  void getPendingSessionById_rejectsMalformedIdWithoutHittingStore() {
    assertFalse(sessionService.getPendingSessionById("not-a-valid-session-id").isPresent());

    verify(repository, never()).findById(any());
  }

  private UserSession pendingSession(String id, long expiresAt) {
    return UserSession.builder()
        .id(id)
        .type(SessionType.AUTH)
        .provider("saml")
        .status(SessionStatus.PENDING)
        .version(0L)
        .expiresAt(expiresAt)
        .idleExpiresAt(expiresAt)
        .build();
  }

  private UserSession activeSession(String id, User user, long version, long lastAccessedAt) {
    return UserSession.builder()
        .id(id)
        .status(SessionStatus.ACTIVE)
        .userId(user.getId().toString())
        .version(version)
        .lastAccessedAt(lastAccessedAt)
        .build();
  }

  private String validSessionId(char value) {
    return String.valueOf(value).repeat(43);
  }

  private int cookieMaxAge(String setCookieHeader) {
    return java.util.Arrays.stream(setCookieHeader.split(";"))
        .map(String::trim)
        .filter(value -> value.startsWith("Max-Age="))
        .map(value -> value.substring("Max-Age=".length()))
        .mapToInt(Integer::parseInt)
        .findFirst()
        .orElseThrow();
  }
}
