package org.openmetadata.mcp;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@DisplayName("MCP Connection Manager Tests")
class McpConnectionManagerTest {

  private McpMetrics metrics;
  private McpConnectionManager connectionManager;

  @BeforeEach
  void setUp() {
    MeterRegistry meterRegistry = new SimpleMeterRegistry();
    metrics = new McpMetrics(meterRegistry);
    connectionManager =
        McpConnectionManager.builder()
            .maxGlobalConnections(10)
            .maxUserConnections(3)
            .maxOrgConnections(5)
            .connectionsPerSecond(1000.0) // Very high rate limit to avoid blocking tests
            .enableCircuitBreaker(true)
            .enableRateLimiting(true) // Keep rate limiting enabled but with high limit
            .metrics(metrics)
            .build();
  }

  @Test
  @DisplayName("Should accept connection within global limit")
  void testAcceptConnectionWithinGlobalLimit() {
    // Given
    String userId = "user1";
    String orgId = "org1";

    // When
    boolean result = connectionManager.tryAcquireConnection(userId, orgId, "SSE");

    // Then
    assertTrue(result);
    assertEquals(1, connectionManager.getStats().getActiveConnections());

    // Cleanup
    connectionManager.releaseConnection(userId, orgId);
  }

  @Test
  @DisplayName("Should reject connection when global limit exceeded")
  void testRejectConnectionWhenGlobalLimitExceeded() {
    // Given
    int maxConnections = 10;

    // When - acquire max connections
    for (int i = 0; i < maxConnections; i++) {
      assertTrue(connectionManager.tryAcquireConnection("user" + i, "org1", "SSE"));
    }

    // Then - next connection should be rejected
    assertFalse(connectionManager.tryAcquireConnection("userExtra", "org1", "SSE"));
    assertEquals(maxConnections, connectionManager.getStats().getActiveConnections());

    // Cleanup
    for (int i = 0; i < maxConnections; i++) {
      connectionManager.releaseConnection("user" + i, "org1");
    }
  }

  @Test
  @DisplayName("Should enforce per-user connection limit")
  void testPerUserConnectionLimit() {
    // Given
    String userId = "heavyUser";
    String orgId = "org1";
    int maxUserConnections = 3;

    // When - acquire max user connections
    for (int i = 0; i < maxUserConnections; i++) {
      assertTrue(connectionManager.tryAcquireConnection(userId, orgId, "SSE"));
    }

    // Then - next connection for same user should be rejected
    assertFalse(connectionManager.tryAcquireConnection(userId, orgId, "SSE"));

    // But connection for different user should be accepted
    assertTrue(connectionManager.tryAcquireConnection("anotherUser", orgId, "SSE"));

    // Cleanup
    for (int i = 0; i < maxUserConnections; i++) {
      connectionManager.releaseConnection(userId, orgId);
    }
    connectionManager.releaseConnection("anotherUser", orgId);
  }

  @Test
  @DisplayName("Should enforce per-organization connection limit")
  void testPerOrgConnectionLimit() {
    // Given
    String orgId = "heavyOrg";
    int maxOrgConnections = 5;

    // When - acquire max org connections
    for (int i = 0; i < maxOrgConnections; i++) {
      assertTrue(connectionManager.tryAcquireConnection("user" + i, orgId, "SSE"));
    }

    // Then - next connection for same org should be rejected
    assertFalse(connectionManager.tryAcquireConnection("userExtra", orgId, "SSE"));

    // But connection for different org should be accepted
    assertTrue(connectionManager.tryAcquireConnection("userDiffOrg", "org2", "SSE"));

    // Cleanup
    for (int i = 0; i < maxOrgConnections; i++) {
      connectionManager.releaseConnection("user" + i, orgId);
    }
    connectionManager.releaseConnection("userDiffOrg", "org2");
  }

  @Test
  @DisplayName("Should enforce global rate limit")
  void testGlobalRateLimit() throws InterruptedException {
    // Given - create a new connection manager with lower rate limit for this test
    McpConnectionManager rateLimitedManager =
        McpConnectionManager.builder()
            .maxGlobalConnections(20)
            .maxUserConnections(10)
            .maxOrgConnections(15)
            .connectionsPerSecond(5.0) // 5 connections per second
            .enableCircuitBreaker(false)
            .enableRateLimiting(true)
            .metrics(metrics)
            .build();

    AtomicInteger accepted = new AtomicInteger(0);
    AtomicInteger rejected = new AtomicInteger(0);

    // When - try to acquire 10 connections quickly
    for (int i = 0; i < 10; i++) {
      if (rateLimitedManager.tryAcquireConnection("user" + i, "org1", "SSE")) {
        accepted.incrementAndGet();
      } else {
        rejected.incrementAndGet();
      }
    }

    // Then - some should be rate limited (RateLimiter starts with 0 permits)
    assertTrue(rejected.get() > 0, "Some connections should be rate limited");
    assertTrue(accepted.get() <= 6, "Should not accept more than rate limit + buffer");

    // Cleanup
    for (int i = 0; i < accepted.get(); i++) {
      rateLimitedManager.releaseConnection("user" + i, "org1");
    }
  }

  @Test
  @DisplayName("Should trigger circuit breaker after consecutive failures")
  void testCircuitBreaker() {
    // Given - fill up connection pool
    for (int i = 0; i < 10; i++) {
      connectionManager.tryAcquireConnection("user" + i, "org1", "SSE");
    }

    // When - try many connections that will fail
    for (int i = 0; i < 15; i++) {
      assertFalse(connectionManager.tryAcquireConnection("failUser" + i, "org1", "SSE"));
    }

    // Release all connections
    for (int i = 0; i < 10; i++) {
      connectionManager.releaseConnection("user" + i, "org1");
    }

    // Then - circuit breaker should be open, rejecting even valid connections
    // Note: Circuit breaker opens after 10 consecutive failures
    assertFalse(connectionManager.tryAcquireConnection("validUser", "org1", "SSE"));
  }

  @Test
  @DisplayName("Should properly release connections")
  void testConnectionRelease() {
    // Given
    String userId = "user1";
    String orgId = "org1";

    // When
    assertTrue(connectionManager.tryAcquireConnection(userId, orgId, "SSE"));
    assertEquals(1, connectionManager.getStats().getActiveConnections());

    connectionManager.releaseConnection(userId, orgId);

    // Then
    assertEquals(0, connectionManager.getStats().getActiveConnections());
    assertEquals(10, connectionManager.getStats().getAvailableConnections());
  }

  @Test
  @DisplayName("Should handle concurrent connection requests")
  void testConcurrentConnections() throws InterruptedException {
    // Given
    int threadCount = 20;
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch endLatch = new CountDownLatch(threadCount);
    AtomicInteger successCount = new AtomicInteger(0);
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);

    // When
    for (int i = 0; i < threadCount; i++) {
      final int userId = i;
      executor.submit(
          () -> {
            try {
              startLatch.await();
              if (connectionManager.tryAcquireConnection("user" + userId, "org1", "SSE")) {
                successCount.incrementAndGet();
                Thread.sleep(100); // Hold connection briefly
                connectionManager.releaseConnection("user" + userId, "org1");
              }
            } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
            } finally {
              endLatch.countDown();
            }
          });
    }

    startLatch.countDown(); // Start all threads simultaneously
    assertTrue(endLatch.await(5, TimeUnit.SECONDS));

    // Then
    assertTrue(successCount.get() <= 10, "Should not exceed max connections");
    assertEquals(
        0,
        connectionManager.getStats().getActiveConnections(),
        "All connections should be released");

    executor.shutdown();
  }

  @Test
  @DisplayName("Should provide accurate statistics")
  void testConnectionStatistics() {
    // Given
    connectionManager.tryAcquireConnection("user1", "org1", "SSE");
    connectionManager.tryAcquireConnection("user2", "org1", "SSE");
    connectionManager.tryAcquireConnection("user3", "org2", "SSE");

    // When
    McpConnectionManager.ConnectionStats stats = connectionManager.getStats();

    // Then
    assertEquals(3, stats.getActiveConnections());
    assertEquals(7, stats.getAvailableConnections());
    assertEquals(3, stats.getTotalUserConnections());
    assertEquals(2, stats.getTotalOrgConnections()); // org1 and org2
    assertFalse(stats.isCircuitBreakerOpen());

    // Cleanup
    connectionManager.releaseConnection("user1", "org1");
    connectionManager.releaseConnection("user2", "org1");
    connectionManager.releaseConnection("user3", "org2");
  }

  @ParameterizedTest
  @ValueSource(strings = {"SSE", "STREAMABLE", "WEBSOCKET"})
  @DisplayName("Should handle different connection types")
  void testDifferentConnectionTypes(String connectionType) {
    // Given
    String userId = "user1";
    String orgId = "org1";

    // When
    boolean result = connectionManager.tryAcquireConnection(userId, orgId, connectionType);

    // Then
    assertTrue(result);
    assertEquals(1, connectionManager.getStats().getActiveConnections());

    // Cleanup
    connectionManager.releaseConnection(userId, orgId);
  }

  @Test
  @DisplayName("Should handle null user and org IDs")
  void testNullUserAndOrgIds() {
    // When
    boolean result = connectionManager.tryAcquireConnection(null, null, "SSE");

    // Then
    assertTrue(result);
    assertEquals(1, connectionManager.getStats().getActiveConnections());

    // Cleanup
    connectionManager.releaseConnection(null, null);
    assertEquals(0, connectionManager.getStats().getActiveConnections());
  }

  @Test
  @DisplayName("Should create default configuration")
  void testDefaultConfiguration() {
    // Given
    McpMetrics mockMetrics = mock(McpMetrics.class);

    // When
    McpConnectionManager defaultManager = McpConnectionManager.createDefault(mockMetrics);

    // Then
    assertNotNull(defaultManager);
    // Default values from app config
    assertTrue(defaultManager.getMaxGlobalConnections() > 0);
    assertTrue(defaultManager.getMaxUserConnections() > 0);
    assertTrue(defaultManager.getMaxOrgConnections() > 0);
  }

  @Test
  @DisplayName("Should create high capacity configuration")
  void testHighCapacityConfiguration() {
    // Given
    McpMetrics mockMetrics = mock(McpMetrics.class);

    // When
    McpConnectionManager highCapManager = McpConnectionManager.createHighCapacity(mockMetrics);

    // Then
    assertNotNull(highCapManager);
    assertEquals(250, highCapManager.getMaxGlobalConnections());
    assertEquals(20, highCapManager.getMaxUserConnections());
    assertEquals(75, highCapManager.getMaxOrgConnections());
    assertEquals(25.0, highCapManager.getConnectionsPerSecond());
    assertTrue(highCapManager.isEnableCircuitBreaker());
  }

  @Test
  @DisplayName("Should handle rapid connection acquire and release")
  void testRapidAcquireRelease() throws InterruptedException {
    // Given
    String userId = "rapidUser";
    String orgId = "org1";
    int cycles = 100;

    // When - rapidly acquire and release connections
    for (int i = 0; i < cycles; i++) {
      assertTrue(connectionManager.tryAcquireConnection(userId, orgId, "SSE"));
      connectionManager.releaseConnection(userId, orgId);
    }

    // Then
    assertEquals(0, connectionManager.getStats().getActiveConnections());
    assertEquals(10, connectionManager.getStats().getAvailableConnections());
  }
}
