package org.openmetadata.mcp;

import com.google.common.util.concurrent.RateLimiter;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.Builder;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

/**
 * Connection manager for MCP to prevent resource exhaustion.
 * Implements multiple protection layers:
 * 1. Global connection limit
 * 2. Per-user connection limit
 * 3. Per-organization connection limit
 * 4. Rate limiting for connection creation
 * 5. Circuit breaker for overload protection
 */
@Slf4j
@Getter
public class McpConnectionManager {
  // Configuration
  private final int maxGlobalConnections;
  private final int maxUserConnections;
  private final int maxOrgConnections;
  private final double connectionsPerSecond;
  private final boolean enableCircuitBreaker;
  private final boolean enableRateLimiting;

  // Global limits
  private final Semaphore globalConnectionSemaphore;
  private final RateLimiter connectionRateLimiter;
  private final AtomicInteger activeConnections = new AtomicInteger(0);

  // Per-user/org tracking
  private final Map<String, AtomicInteger> userConnections = new ConcurrentHashMap<>();
  private final Map<String, AtomicInteger> orgConnections = new ConcurrentHashMap<>();
  private final Map<String, Bucket> userRateLimitBuckets = new ConcurrentHashMap<>();

  // Circuit breaker
  private volatile boolean circuitOpen = false;
  private volatile long circuitOpenTime = 0;
  private final long circuitResetTimeMs = 30000; // 30 seconds
  private final AtomicInteger consecutiveFailures = new AtomicInteger(0);
  private final int failureThreshold = 10;

  // Metrics
  private final McpMetrics metrics;

  @Builder
  public McpConnectionManager(
      int maxGlobalConnections,
      int maxUserConnections,
      int maxOrgConnections,
      double connectionsPerSecond,
      boolean enableCircuitBreaker,
      boolean enableRateLimiting,
      McpMetrics metrics) {

    this.maxGlobalConnections = maxGlobalConnections > 0 ? maxGlobalConnections : 100;
    this.maxUserConnections = maxUserConnections > 0 ? maxUserConnections : 10;
    this.maxOrgConnections = maxOrgConnections > 0 ? maxOrgConnections : 30;
    this.connectionsPerSecond = connectionsPerSecond > 0 ? connectionsPerSecond : 10.0;
    this.enableCircuitBreaker = enableCircuitBreaker;
    this.enableRateLimiting = enableRateLimiting;
    this.metrics = metrics != null ? metrics : McpMetrics.NO_OP;

    this.globalConnectionSemaphore = new Semaphore(this.maxGlobalConnections, true);
    // Create rate limiter - it will enforce rate after initial connections
    this.connectionRateLimiter = RateLimiter.create(this.connectionsPerSecond);

    LOG.info(
        "MCP Connection Manager initialized - Global: {}, User: {}, Org: {}, Rate: {}/sec",
        this.maxGlobalConnections,
        this.maxUserConnections,
        this.maxOrgConnections,
        this.connectionsPerSecond);
  }

  /**
   * Create from McpApplication configuration with environment variable overrides.
   */
  public static McpConnectionManager fromAppConfig(McpMetrics metrics) {
    // Get configuration from McpApplication
    org.openmetadata.service.apps.bundles.mcp.McpApplication.McpAppConfiguration appConfig =
        org.openmetadata.service.apps.bundles.mcp.McpApplication.getCurrentConfiguration();

    org.openmetadata.service.apps.bundles.mcp.McpApplication.ConnectionLimits limits =
        appConfig.getConnectionLimits();

    // Use environment variables if set, otherwise use app config values
    int maxGlobal = getEnvOrDefault("MCP_MAX_CONNECTIONS", limits.getMaxConnections());
    int maxUser = getEnvOrDefault("MCP_MAX_USER_CONNECTIONS", limits.getMaxUserConnections());
    int maxOrg = getEnvOrDefault("MCP_MAX_ORG_CONNECTIONS", limits.getMaxOrgConnections());
    double rateLimit =
        getEnvOrDefaultDouble("MCP_CONNECTIONS_PER_SECOND", limits.getConnectionsPerSecond());
    boolean circuitBreaker =
        getEnvOrDefaultBoolean("MCP_ENABLE_CIRCUIT_BREAKER", limits.isEnableCircuitBreaker());

    LOG.info(
        "Creating MCP Connection Manager from app config - Global: {}, User: {}, Org: {}",
        maxGlobal,
        maxUser,
        maxOrg);

    return McpConnectionManager.builder()
        .maxGlobalConnections(maxGlobal)
        .maxUserConnections(maxUser)
        .maxOrgConnections(maxOrg)
        .connectionsPerSecond(rateLimit)
        .enableCircuitBreaker(circuitBreaker)
        .enableRateLimiting(true) // Enable rate limiting by default in production
        .metrics(metrics)
        .build();
  }

  private static int getEnvOrDefault(String envVar, int defaultValue) {
    String value = System.getenv(envVar);
    if (value != null) {
      try {
        return Integer.parseInt(value);
      } catch (NumberFormatException e) {
        LOG.warn("Invalid value for {}: {}, using default: {}", envVar, value, defaultValue);
      }
    }
    return defaultValue;
  }

  private static double getEnvOrDefaultDouble(String envVar, double defaultValue) {
    String value = System.getenv(envVar);
    if (value != null) {
      try {
        return Double.parseDouble(value);
      } catch (NumberFormatException e) {
        LOG.warn("Invalid value for {}: {}, using default: {}", envVar, value, defaultValue);
      }
    }
    return defaultValue;
  }

  private static boolean getEnvOrDefaultBoolean(String envVar, boolean defaultValue) {
    String value = System.getenv(envVar);
    if (value != null) {
      return Boolean.parseBoolean(value);
    }
    return defaultValue;
  }

  /**
   * Try to acquire a connection slot for a user/org.
   * Returns true if allowed, false if rejected.
   */
  public boolean tryAcquireConnection(String userId, String orgId, String connectionType) {
    // Check circuit breaker first
    if (isCircuitOpen()) {
      LOG.warn("Circuit breaker open - rejecting connection from user: {}", userId);
      metrics.connectionFailed("circuit_breaker_open");
      return false;
    }

    // Check global rate limit if enabled
    if (enableRateLimiting) {
      // Only apply rate limiting after some initial connections to allow startup burst
      int halfGlobalLimit = maxGlobalConnections / 2;
      if (activeConnections.get() >= halfGlobalLimit) {
        if (!connectionRateLimiter.tryAcquire()) {
          LOG.warn("Global rate limit exceeded - rejecting connection from user: {}", userId);
          metrics.connectionFailed("rate_limit_exceeded");
          recordFailure();
          return false;
        }
      }
    }

    // Check global connection limit
    if (!globalConnectionSemaphore.tryAcquire()) {
      LOG.warn(
          "Global connection limit reached: {}/{}", activeConnections.get(), maxGlobalConnections);
      metrics.connectionFailed("global_limit_exceeded");
      metrics.threadPoolExhausted();
      recordFailure();
      return false;
    }

    // Check per-user limit
    if (userId != null) {
      int userCount = userConnections.computeIfAbsent(userId, k -> new AtomicInteger(0)).get();
      if (userCount >= maxUserConnections) {
        LOG.warn("User {} exceeded connection limit: {}/{}", userId, userCount, maxUserConnections);
        globalConnectionSemaphore.release();
        metrics.connectionFailed("user_limit_exceeded");
        recordFailure();
        return false;
      }

      // Check user rate limit (10 connections per minute per user)
      Bucket userBucket = getUserRateLimitBucket(userId);
      if (!userBucket.tryConsume(1)) {
        LOG.warn("User {} exceeded rate limit", userId);
        globalConnectionSemaphore.release();
        metrics.connectionFailed("user_rate_limit_exceeded");
        recordFailure();
        return false;
      }
    }

    // Check per-org limit
    if (orgId != null) {
      int orgCount = orgConnections.computeIfAbsent(orgId, k -> new AtomicInteger(0)).get();
      if (orgCount >= maxOrgConnections) {
        LOG.warn("Org {} exceeded connection limit: {}/{}", orgId, orgCount, maxOrgConnections);
        globalConnectionSemaphore.release();
        metrics.connectionFailed("org_limit_exceeded");
        recordFailure();
        return false;
      }
    }

    // All checks passed - acquire the connection
    activeConnections.incrementAndGet();
    if (userId != null) {
      userConnections.get(userId).incrementAndGet();
    }
    if (orgId != null) {
      orgConnections.get(orgId).incrementAndGet();
    }

    // Reset failure counter on success
    consecutiveFailures.set(0);

    LOG.debug(
        "Connection acquired - User: {}, Org: {}, Type: {}, Active: {}",
        userId,
        orgId,
        connectionType,
        activeConnections.get());

    return true;
  }

  /**
   * Release a connection slot.
   */
  public void releaseConnection(String userId, String orgId) {
    globalConnectionSemaphore.release();
    activeConnections.decrementAndGet();

    if (userId != null && userConnections.containsKey(userId)) {
      int count = userConnections.get(userId).decrementAndGet();
      if (count <= 0) {
        userConnections.remove(userId);
      }
    }

    if (orgId != null && orgConnections.containsKey(orgId)) {
      int count = orgConnections.get(orgId).decrementAndGet();
      if (count <= 0) {
        orgConnections.remove(orgId);
      }
    }

    LOG.debug(
        "Connection released - User: {}, Org: {}, Active: {}",
        userId,
        orgId,
        activeConnections.get());
  }

  /**
   * Get or create rate limit bucket for a user.
   * Allows 10 connections per minute per user.
   */
  private Bucket getUserRateLimitBucket(String userId) {
    return userRateLimitBuckets.computeIfAbsent(
        userId,
        k -> {
          Bandwidth limit = Bandwidth.classic(10, Refill.intervally(10, Duration.ofMinutes(1)));
          return Bucket.builder().addLimit(limit).build();
        });
  }

  /**
   * Record a connection failure for circuit breaker.
   */
  private void recordFailure() {
    if (!enableCircuitBreaker) {
      return;
    }

    int failures = consecutiveFailures.incrementAndGet();
    if (failures >= failureThreshold && !circuitOpen) {
      openCircuit();
    }
  }

  /**
   * Open the circuit breaker.
   */
  private void openCircuit() {
    circuitOpen = true;
    circuitOpenTime = System.currentTimeMillis();
    LOG.error("Circuit breaker OPENED due to {} consecutive failures", failureThreshold);
  }

  /**
   * Check if circuit breaker is open.
   */
  private boolean isCircuitOpen() {
    if (!enableCircuitBreaker || !circuitOpen) {
      return false;
    }

    // Check if it's time to close the circuit
    if (System.currentTimeMillis() - circuitOpenTime > circuitResetTimeMs) {
      circuitOpen = false;
      consecutiveFailures.set(0);
      LOG.info("Circuit breaker CLOSED after reset period");
      return false;
    }

    return true;
  }

  /**
   * Get current connection stats.
   */
  public ConnectionStats getStats() {
    return ConnectionStats.builder()
        .activeConnections(activeConnections.get())
        .availableConnections(globalConnectionSemaphore.availablePermits())
        .totalUserConnections(userConnections.size())
        .totalOrgConnections(orgConnections.size())
        .circuitBreakerOpen(circuitOpen)
        .consecutiveFailures(consecutiveFailures.get())
        .build();
  }

  @Builder
  @Getter
  public static class ConnectionStats {
    private final int activeConnections;
    private final int availableConnections;
    private final int totalUserConnections;
    private final int totalOrgConnections;
    private final boolean circuitBreakerOpen;
    private final int consecutiveFailures;
  }

  /**
   * Default configuration for production use.
   */
  public static McpConnectionManager createDefault(McpMetrics metrics) {
    return fromAppConfig(metrics);
  }

  /**
   * High-capacity configuration for heavy MCP usage (like Scout24).
   * Can be enabled by setting environment variables or updating app config.
   */
  public static McpConnectionManager createHighCapacity(McpMetrics metrics) {
    return McpConnectionManager.builder()
        .maxGlobalConnections(250)
        .maxUserConnections(20)
        .maxOrgConnections(75)
        .connectionsPerSecond(25.0)
        .enableCircuitBreaker(true)
        .enableRateLimiting(true)
        .metrics(metrics)
        .build();
  }
}
