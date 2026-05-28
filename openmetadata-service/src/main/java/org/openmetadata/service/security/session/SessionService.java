package org.openmetadata.service.security.session;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.dropwizard.lifecycle.Managed;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.fernet.Fernet;

@Slf4j
public class SessionService implements Managed {
  private static final int PENDING_SESSION_TIMEOUT_SECONDS = 10 * 60;
  private static final long REFRESH_LEASE_MILLIS = 15_000L;
  private static final long CLEANUP_INTERVAL_MINUTES = 15L;
  private static final long CLEANUP_RETENTION_MILLIS = TimeUnit.DAYS.toMillis(7);
  private static final int CLEANUP_BATCH_SIZE = 1_000;
  private static final int DEFAULT_MAX_ACTIVE_SESSIONS_PER_USER = 5;
  private static final int SESSION_LIMIT_RETRIES = 3;
  private static final int SESSION_LIMIT_MAX_ITERATIONS = 20;
  private static final int SESSION_LIMIT_LOOKUP_MULTIPLIER = 4;

  private volatile AuthenticationConfiguration authConfig;
  private final SessionStore repository;
  private final Cache<String, UserSession> cache;
  private final ScheduledExecutorService scheduler;
  private final AtomicBoolean started = new AtomicBoolean(false);
  private final AtomicBoolean lowIdleTimeoutLogged = new AtomicBoolean(false);
  // Notified once per local revocation with the revoked session. Listeners include
  // WebSocketManager (closes active sockets for the user) and SessionRevocationBroadcaster
  // (republishes to Redis so other pods do the same). Failures in a listener are logged and
  // do not block the revocation result.
  private final List<Consumer<UserSession>> revocationListeners = new CopyOnWriteArrayList<>();

  public SessionService(AuthenticationConfiguration authConfig) {
    this(authConfig, SessionStoreFactory.create());
  }

  public SessionService(AuthenticationConfiguration authConfig, SessionStore store) {
    this(
        authConfig,
        store,
        Caffeine.newBuilder().maximumSize(10_000).expireAfterAccess(10, TimeUnit.SECONDS).build(),
        Executors.newSingleThreadScheduledExecutor(
            runnable ->
                Thread.ofPlatform().name("om-session-cleanup").daemon(true).unstarted(runnable)));
  }

  SessionService(
      AuthenticationConfiguration authConfig,
      SessionStore repository,
      Cache<String, UserSession> cache,
      ScheduledExecutorService scheduler) {
    this.authConfig = authConfig;
    this.repository = repository;
    this.cache = cache;
    this.scheduler = scheduler;
  }

  public void updateConfiguration(AuthenticationConfiguration authConfig) {
    this.authConfig = authConfig;
    lowIdleTimeoutLogged.set(false);
  }

  /**
   * Register a callback fired on each successful local revocation. Idempotent — registering the same
   * listener twice is allowed but harmless.
   */
  public void registerRevocationListener(Consumer<UserSession> listener) {
    if (listener != null && !revocationListeners.contains(listener)) {
      revocationListeners.add(listener);
    }
  }

  private void notifyRevocation(UserSession session) {
    if (session == null || session.getUserId() == null) {
      return;
    }
    for (Consumer<UserSession> listener : revocationListeners) {
      try {
        listener.accept(session);
      } catch (Exception e) {
        LOG.warn(
            "Session revocation listener failed for session {}", truncateId(session.getId()), e);
      }
    }
  }

  @Override
  public void start() {
    if (!started.compareAndSet(false, true)) {
      return;
    }
    scheduler.scheduleWithFixedDelay(
        this::runCleanupSafely,
        CLEANUP_INTERVAL_MINUTES,
        CLEANUP_INTERVAL_MINUTES,
        TimeUnit.MINUTES);
  }

  @Override
  public void stop() {
    if (!started.compareAndSet(true, false)) {
      return;
    }
    scheduler.shutdownNow();
  }

  public UserSession createActiveSession(
      jakarta.servlet.http.HttpServletRequest request,
      jakarta.servlet.http.HttpServletResponse response,
      String provider,
      User user,
      String omRefreshToken) {
    long now = System.currentTimeMillis();
    int sessionExpirySeconds = getSessionExpirySeconds();
    long expiresAt = now + TimeUnit.SECONDS.toMillis(sessionExpirySeconds);
    UserSession session =
        UserSession.builder()
            .id(SessionIdGenerator.newSessionId())
            .type(SessionType.AUTH)
            .provider(provider)
            .status(SessionStatus.ACTIVE)
            .userId(user.getId().toString())
            .username(user.getName())
            .email(user.getEmail())
            .omRefreshToken(encryptIfPresent(omRefreshToken))
            .version(0L)
            .createdAt(now)
            .updatedAt(now)
            .lastAccessedAt(now)
            .expiresAt(expiresAt)
            .idleExpiresAt(expiresAt)
            .build();
    repository.create(session);
    cache.put(session.getId(), session);
    applySessionLimit(user.getId().toString(), session.getId());
    SessionCookieUtil.writeSessionCookie(
        request, response, authConfig, session.getId(), sessionExpirySeconds);
    return session;
  }

  public UserSession createPendingSession(
      jakarta.servlet.http.HttpServletRequest request,
      jakarta.servlet.http.HttpServletResponse response,
      String provider,
      String redirectUri,
      String state,
      String nonce,
      String pkceVerifier) {
    long now = System.currentTimeMillis();
    long pendingExpiry = now + TimeUnit.SECONDS.toMillis(PENDING_SESSION_TIMEOUT_SECONDS);
    UserSession session =
        UserSession.builder()
            .id(SessionIdGenerator.newSessionId())
            .type(SessionType.AUTH)
            .provider(provider)
            .status(SessionStatus.PENDING)
            .redirectUri(redirectUri)
            .state(state)
            .nonce(nonce)
            .pkceVerifier(pkceVerifier)
            .version(0L)
            .createdAt(now)
            .updatedAt(now)
            .lastAccessedAt(now)
            .expiresAt(pendingExpiry)
            .idleExpiresAt(pendingExpiry)
            .build();
    repository.create(session);
    cache.put(session.getId(), session);
    SessionCookieUtil.writeSessionCookie(
        request, response, authConfig, session.getId(), PENDING_SESSION_TIMEOUT_SECONDS);
    return session;
  }

  public Optional<UserSession> activatePendingSession(
      jakarta.servlet.http.HttpServletRequest request,
      jakarta.servlet.http.HttpServletResponse response,
      UserSession pendingSession,
      User user,
      String omRefreshToken,
      String providerRefreshToken) {
    long now = System.currentTimeMillis();
    long expectedVersion = safeVersion(pendingSession);

    // Expire the pending session to prevent reuse (session fixation defense)
    UserSession expired =
        pendingSession.toBuilder()
            .status(SessionStatus.EXPIRED)
            .version(expectedVersion + 1)
            .build();
    if (!repository.updateIfVersion(expired, expectedVersion)) {
      LOG.warn(
          "Failed to expire pending session {} during activation due to concurrent modification; refusing to issue an active session",
          truncateId(pendingSession.getId()));
      cache.invalidate(pendingSession.getId());
      SessionCookieUtil.clearSessionCookie(request, response, authConfig);
      return Optional.empty();
    }
    cache.invalidate(pendingSession.getId());

    int sessionExpirySeconds = getSessionExpirySeconds();
    long expiresAt = now + TimeUnit.SECONDS.toMillis(sessionExpirySeconds);
    String newSessionId = SessionIdGenerator.newSessionId();
    UserSession activated =
        UserSession.builder()
            .id(newSessionId)
            .type(pendingSession.getType())
            .provider(pendingSession.getProvider())
            .status(SessionStatus.ACTIVE)
            .userId(user.getId().toString())
            .username(user.getName())
            .email(user.getEmail())
            .omRefreshToken(encryptIfPresent(omRefreshToken))
            .providerRefreshToken(encryptIfPresent(providerRefreshToken))
            .redirectUri(pendingSession.getRedirectUri())
            .lastAccessedAt(now)
            .createdAt(now)
            .updatedAt(now)
            .expiresAt(expiresAt)
            .idleExpiresAt(expiresAt)
            .version(0L)
            .build();
    repository.create(activated);
    cache.put(activated.getId(), activated);
    applySessionLimit(user.getId().toString(), activated.getId());
    SessionCookieUtil.writeSessionCookie(
        request, response, authConfig, activated.getId(), sessionExpirySeconds);
    return Optional.of(activated);
  }

  public Optional<UserSession> getSession(jakarta.servlet.http.HttpServletRequest request) {
    return SessionCookieUtil.getSessionId(request).flatMap(this::getSessionById);
  }

  public Optional<UserSession> getPendingSession(
      jakarta.servlet.http.HttpServletRequest request,
      jakarta.servlet.http.HttpServletResponse response) {
    Optional<UserSession> session = getSession(request);
    if (session.isEmpty()) {
      SessionCookieUtil.clearSessionCookie(request, response, authConfig);
      return Optional.empty();
    }

    UserSession userSession = session.get();
    if (userSession.getStatus() != SessionStatus.PENDING || userSession.isExpired(now())) {
      expireIfNecessary(userSession);
      SessionCookieUtil.clearSessionCookie(request, response, authConfig);
      return Optional.empty();
    }
    return Optional.of(userSession);
  }

  public Optional<UserSession> getActiveSession(
      jakarta.servlet.http.HttpServletRequest request,
      jakarta.servlet.http.HttpServletResponse response) {
    Optional<UserSession> session =
        SessionCookieUtil.getSessionId(request).flatMap(this::reloadSession);
    if (session.isEmpty()) {
      SessionCookieUtil.clearSessionCookie(request, response, authConfig);
      return Optional.empty();
    }
    UserSession userSession = session.get();
    if (userSession.getStatus() != SessionStatus.ACTIVE || userSession.isExpired(now())) {
      expireIfNecessary(userSession);
      SessionCookieUtil.clearSessionCookie(request, response, authConfig);
      return Optional.empty();
    }
    return Optional.of(userSession);
  }

  public Optional<UserSession> acquireRefreshLease(
      jakarta.servlet.http.HttpServletRequest request,
      jakarta.servlet.http.HttpServletResponse response) {
    Optional<UserSession> maybeSession = getSession(request);
    if (maybeSession.isEmpty()) {
      SessionCookieUtil.clearSessionCookie(request, response, authConfig);
      return Optional.empty();
    }

    UserSession current = maybeSession.get();

    int maxAttempts = 5;
    for (int attempt = 0; attempt < maxAttempts && current != null; attempt++) {
      long now = now();
      if (current.isExpired(now)
          || current.getStatus() == SessionStatus.REVOKED
          || current.getStatus() == SessionStatus.EXPIRED
          || current.getStatus() == SessionStatus.PENDING) {
        expireIfNecessary(current);
        SessionCookieUtil.clearSessionCookie(request, response, authConfig);
        return Optional.empty();
      }

      if (current.getStatus() == SessionStatus.REFRESHING && !current.hasStaleRefreshLease(now)) {
        UserSession refreshed = reloadSession(current.getId()).orElse(null);
        if (refreshed == null) {
          SessionCookieUtil.clearSessionCookie(request, response, authConfig);
          return Optional.empty();
        }
        if (refreshed.getStatus() == SessionStatus.REFRESHING
            && !refreshed.hasStaleRefreshLease(now)) {
          throw new SessionRefreshInProgressException(getRetryAfterMillis(refreshed, now));
        }
        current = refreshed;
        continue;
      }

      long expectedVersion = safeVersion(current);
      UserSession leased =
          current.toBuilder()
              .status(SessionStatus.REFRESHING)
              .refreshLeaseUntil(now + REFRESH_LEASE_MILLIS)
              .lastAccessedAt(now)
              .updatedAt(now)
              .idleExpiresAt(refreshedIdleExpiresAt(now, current))
              .version(expectedVersion + 1)
              .build();
      if (repository.updateIfVersion(leased, expectedVersion)) {
        cache.put(leased.getId(), leased);
        SessionCookieUtil.writeSessionCookie(
            request, response, authConfig, leased.getId(), sessionCookieMaxAgeSeconds(leased, now));
        return Optional.of(leased);
      }

      current = reloadSession(current.getId()).orElse(null);
    }

    SessionCookieUtil.clearSessionCookie(request, response, authConfig);
    return Optional.empty();
  }

  public Optional<UserSession> completeRefresh(
      UserSession leasedSession, String omRefreshToken, String providerRefreshToken) {
    long now = System.currentTimeMillis();
    long expectedVersion = safeVersion(leasedSession);
    UserSession refreshed =
        leasedSession.toBuilder()
            .status(SessionStatus.ACTIVE)
            .omRefreshToken(
                omRefreshToken == null
                    ? leasedSession.getOmRefreshToken()
                    : encryptIfPresent(omRefreshToken))
            .providerRefreshToken(
                providerRefreshToken == null
                    ? leasedSession.getProviderRefreshToken()
                    : encryptIfPresent(providerRefreshToken))
            .refreshLeaseUntil(null)
            .lastAccessedAt(now)
            .updatedAt(now)
            .idleExpiresAt(refreshedIdleExpiresAt(now, leasedSession))
            .version(expectedVersion + 1)
            .build();
    if (!repository.updateIfVersion(refreshed, expectedVersion)) {
      return reloadSession(refreshed.getId());
    }
    cache.put(refreshed.getId(), refreshed);
    return Optional.of(refreshed);
  }

  /**
   * Best-effort release of a refresh lease back to {@code ACTIVE} when a refresh fails after the
   * lease was acquired. Without this, a transient provider/token error would leave the session
   * {@code REFRESHING} until the lease expires, making concurrent refreshes return 503 in the
   * meantime. A lost compare-and-set is ignored — another node already moved the session on, and
   * stale-lease recovery covers the rest.
   */
  public void releaseRefreshLease(UserSession leasedSession) {
    if (leasedSession == null || leasedSession.getStatus() != SessionStatus.REFRESHING) {
      return;
    }
    UserSession current = reloadSession(leasedSession.getId()).orElse(null);
    if (current == null || current.getStatus() != SessionStatus.REFRESHING) {
      return;
    }
    long now = System.currentTimeMillis();
    long expectedVersion = safeVersion(current);
    UserSession released =
        current.toBuilder()
            .status(SessionStatus.ACTIVE)
            .refreshLeaseUntil(null)
            .updatedAt(now)
            .version(expectedVersion + 1)
            .build();
    if (repository.updateIfVersion(released, expectedVersion)) {
      cache.put(released.getId(), released);
    }
  }

  public void revokeSession(
      jakarta.servlet.http.HttpServletRequest request,
      jakarta.servlet.http.HttpServletResponse response) {
    SessionCookieUtil.getSessionId(request).ifPresent(this::revokeSession);
    SessionCookieUtil.clearSessionCookie(request, response, authConfig);
  }

  public Optional<UserSession> revokeSession(String sessionId) {
    UserSession current = reloadSession(sessionId).orElse(null);
    if (current == null) {
      cache.invalidate(sessionId);
      return Optional.empty();
    }

    for (int attempt = 0; attempt < SESSION_LIMIT_RETRIES && current != null; attempt++) {
      if (current.getStatus() == SessionStatus.REVOKED
          || current.getStatus() == SessionStatus.EXPIRED) {
        cache.put(current.getId(), current);
        return Optional.of(current);
      }

      long now = System.currentTimeMillis();
      if (current.isExpired(now)) {
        expireIfNecessary(current);
        current = reloadSession(sessionId).orElse(null);
        continue;
      }

      long expectedVersion = safeVersion(current);
      UserSession revoked =
          current.toBuilder()
              .status(SessionStatus.REVOKED)
              .refreshLeaseUntil(null)
              .updatedAt(now)
              .lastAccessedAt(now)
              .version(expectedVersion + 1)
              .build();
      if (repository.updateIfVersion(revoked, expectedVersion)) {
        cache.put(revoked.getId(), revoked);
        notifyRevocation(revoked);
        return Optional.of(revoked);
      }

      current = reloadSession(sessionId).orElse(null);
    }

    if (current == null) {
      cache.invalidate(sessionId);
      return Optional.empty();
    }
    LOG.error(
        "Failed to revoke session {}... after {} attempts",
        truncateId(sessionId),
        SESSION_LIMIT_RETRIES);
    cache.put(current.getId(), current);
    return Optional.of(current);
  }

  public Optional<UserSession> getSessionById(String sessionId) {
    UserSession cachedSession = cache.getIfPresent(sessionId);
    if (cachedSession != null) {
      return Optional.of(cachedSession);
    }

    return reloadSession(sessionId);
  }

  public Optional<UserSession> getFreshSessionById(String sessionId) {
    return reloadSession(sessionId);
  }

  public String decryptProviderRefreshToken(UserSession session) {
    if (nullOrEmpty(session.getProviderRefreshToken())) {
      return null;
    }
    return Fernet.getInstance().decryptIfApplies(session.getProviderRefreshToken());
  }

  public String decryptOmRefreshToken(UserSession session) {
    if (nullOrEmpty(session.getOmRefreshToken())) {
      return null;
    }
    return Fernet.getInstance().decryptIfApplies(session.getOmRefreshToken());
  }

  public void runCleanupOnce() {
    long now = now();
    expireSessionsInBatches(now);
    pruneSessionsInBatches(now - CLEANUP_RETENTION_MILLIS);
  }

  private void runCleanupSafely() {
    try {
      runCleanupOnce();
    } catch (Exception e) {
      LOG.warn("Failed to run session cleanup", e);
    }
  }

  private void applySessionLimit(String userId, String currentSessionId) {
    int maxActiveSessionsPerUser = getMaxActiveSessionsPerUser();
    int sessionLookupLimit = sessionLookupLimit(maxActiveSessionsPerUser);
    for (int attempt = 0; attempt < SESSION_LIMIT_MAX_ITERATIONS; attempt++) {
      List<UserSession> sessions =
          new ArrayList<>(
              repository.findByUserIdAndStatus(userId, SessionStatus.ACTIVE, sessionLookupLimit));
      if (sessions.size() <= maxActiveSessionsPerUser) {
        return;
      }

      List<UserSession> sessionsToRevoke =
          sessions.stream()
              .filter(session -> !currentSessionId.equals(session.getId()))
              .sorted(
                  Comparator.comparing(
                      session ->
                          session.getLastAccessedAt() == null ? 0L : session.getLastAccessedAt()))
              .limit(Math.max(0, sessions.size() - maxActiveSessionsPerUser))
              .toList();
      if (sessionsToRevoke.isEmpty()) {
        return;
      }

      sessionsToRevoke.forEach(
          session -> {
            revokeSession(session.getId());
            cache.invalidate(session.getId());
          });
    }
    LOG.warn("Unable to enforce active session limit for user {}", userId);
  }

  private int getMaxActiveSessionsPerUser() {
    Integer configuredLimit = authConfig == null ? null : authConfig.getMaxActiveSessionsPerUser();
    return configuredLimit != null && configuredLimit >= 1
        ? configuredLimit
        : DEFAULT_MAX_ACTIVE_SESSIONS_PER_USER;
  }

  private int sessionLookupLimit(int maxActiveSessionsPerUser) {
    long lookupLimit = (long) maxActiveSessionsPerUser * SESSION_LIMIT_LOOKUP_MULTIPLIER;
    return lookupLimit > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) lookupLimit;
  }

  private void expireSessionsInBatches(long now) {
    int maxIterations = 100;
    java.util.Set<String> previousBatchIds = java.util.Collections.emptySet();
    for (int i = 0; i < maxIterations; i++) {
      List<UserSession> sessions = repository.findSessionsToExpire(now, CLEANUP_BATCH_SIZE);
      if (sessions.isEmpty()) {
        return;
      }
      java.util.Set<String> currentBatchIds =
          sessions.stream().map(UserSession::getId).collect(java.util.stream.Collectors.toSet());
      if (currentBatchIds.equals(previousBatchIds)) {
        LOG.warn(
            "expireSessionsInBatches making no progress on {} sessions; aborting to avoid loop",
            currentBatchIds.size());
        return;
      }
      sessions.forEach(this::expireIfNecessary);
      if (sessions.size() < CLEANUP_BATCH_SIZE) {
        return;
      }
      previousBatchIds = currentBatchIds;
    }
    LOG.warn("expireSessionsInBatches reached maximum iterations ({})", maxIterations);
  }

  private Optional<UserSession> reloadSession(String sessionId) {
    Optional<UserSession> session = repository.findById(sessionId);
    if (session.isPresent()) {
      cache.put(session.get().getId(), session.get());
    } else {
      cache.invalidate(sessionId);
    }
    return session;
  }

  private long getRetryAfterMillis(UserSession session, long now) {
    if (session.getRefreshLeaseUntil() == null) {
      return REFRESH_LEASE_MILLIS;
    }
    return Math.max(1L, session.getRefreshLeaseUntil() - now);
  }

  private void pruneSessionsInBatches(long cutoff) {
    int maxIterations = 100;
    for (int i = 0; i < maxIterations; i++) {
      List<UserSession> sessions = repository.findSessionsToPrune(cutoff, CLEANUP_BATCH_SIZE);
      if (sessions.isEmpty()) {
        return;
      }
      List<String> ids = sessions.stream().map(UserSession::getId).toList();
      int deleted = repository.deleteByIds(ids);
      ids.forEach(cache::invalidate);
      LOG.debug("Pruned {} sessions in batch", deleted);
      if (sessions.size() < CLEANUP_BATCH_SIZE) {
        return;
      }
    }
    LOG.warn("pruneSessionsInBatches reached maximum iterations ({})", maxIterations);
  }

  private void expireIfNecessary(UserSession session) {
    long now = System.currentTimeMillis();
    if (!session.isExpired(now) || session.getStatus() == SessionStatus.REVOKED) {
      return;
    }

    long expectedVersion = safeVersion(session);
    UserSession expired =
        session.toBuilder()
            .status(SessionStatus.EXPIRED)
            .refreshLeaseUntil(null)
            .updatedAt(now)
            .version(expectedVersion + 1)
            .build();
    if (repository.updateIfVersion(expired, expectedVersion)) {
      cache.put(expired.getId(), expired);
    } else {
      repository.findById(session.getId()).ifPresent(value -> cache.put(value.getId(), value));
    }
  }

  private String encryptIfPresent(String value) {
    if (nullOrEmpty(value)) {
      return null;
    }
    Fernet fernet = Fernet.getInstance();
    if (!fernet.isKeyDefined()) {
      throw new IllegalStateException(
          "Fernet encryption key is not configured; refresh tokens cannot be persisted without "
              + "encryption. Configure fernetConfiguration.fernetKey before enabling session "
              + "storage.");
    }
    try {
      return fernet.encryptIfApplies(value);
    } catch (Exception e) {
      throw new IllegalStateException(
          "Fernet encryption failed while persisting a session refresh token", e);
    }
  }

  private int getSessionExpirySeconds() {
    Integer configuredSessionExpiry =
        SessionTimeoutResolver.getConfiguredSessionExpirySeconds(authConfig);
    if (configuredSessionExpiry != null) {
      if (configuredSessionExpiry >= SessionTimeoutResolver.MIN_SESSION_EXPIRY_SECONDS) {
        return configuredSessionExpiry;
      }
      if (lowIdleTimeoutLogged.compareAndSet(false, true)) {
        LOG.warn(
            "Configured sessionExpiry {} is below the supported minimum {}. Falling back to {} seconds.",
            configuredSessionExpiry,
            SessionTimeoutResolver.MIN_SESSION_EXPIRY_SECONDS,
            SessionTimeoutResolver.DEFAULT_SESSION_EXPIRY_SECONDS);
      }
    }
    return SessionTimeoutResolver.DEFAULT_SESSION_EXPIRY_SECONDS;
  }

  private long refreshedIdleExpiresAt(long now, UserSession session) {
    long idleExpiresAt = now + TimeUnit.SECONDS.toMillis(getSessionExpirySeconds());
    return session.getExpiresAt() == null
        ? idleExpiresAt
        : Math.min(idleExpiresAt, session.getExpiresAt());
  }

  private int sessionCookieMaxAgeSeconds(UserSession session, long now) {
    long effectiveExpiresAt = Long.MAX_VALUE;
    if (session.getExpiresAt() != null) {
      effectiveExpiresAt = Math.min(effectiveExpiresAt, session.getExpiresAt());
    }
    if (session.getIdleExpiresAt() != null) {
      effectiveExpiresAt = Math.min(effectiveExpiresAt, session.getIdleExpiresAt());
    }
    if (effectiveExpiresAt == Long.MAX_VALUE) {
      return getSessionExpirySeconds();
    }
    long maxAgeSeconds = TimeUnit.MILLISECONDS.toSeconds(Math.max(0L, effectiveExpiresAt - now));
    return maxAgeSeconds > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) maxAgeSeconds;
  }

  private long safeVersion(UserSession session) {
    return session.getVersion() == null ? 0L : session.getVersion();
  }

  private long now() {
    return System.currentTimeMillis();
  }

  public static String truncateId(String sessionId) {
    if (sessionId == null || sessionId.length() <= 8) {
      return sessionId;
    }
    return sessionId.substring(0, 8) + "...";
  }
}
