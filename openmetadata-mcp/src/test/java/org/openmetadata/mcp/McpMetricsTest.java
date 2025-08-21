package org.openmetadata.mcp;

import static org.junit.jupiter.api.Assertions.*;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("MCP Metrics Tests")
class McpMetricsTest {

  private MeterRegistry meterRegistry;
  private McpMetrics mcpMetrics;

  @BeforeEach
  void setUp() {
    meterRegistry = new SimpleMeterRegistry();
    mcpMetrics = new McpMetrics(meterRegistry);
  }

  @Test
  @DisplayName("Should track active sessions")
  void testSessionTracking() {
    // Given
    String sessionId1 = "session-1";
    String sessionId2 = "session-2";

    // When
    mcpMetrics.sessionCreated(sessionId1);
    mcpMetrics.sessionCreated(sessionId2);

    // Then
    assertEquals(2, mcpMetrics.getActiveSessions());

    // When
    mcpMetrics.sessionDestroyed(sessionId1);

    // Then
    assertEquals(1, mcpMetrics.getActiveSessions());
  }

  @Test
  @DisplayName("Should track active connections")
  void testConnectionTracking() {
    // Given
    String userId1 = "user1";
    String userId2 = "user2";
    String orgId = "org1";

    // When
    mcpMetrics.connectionOpened(userId1, orgId, "SSE");
    mcpMetrics.connectionOpened(userId2, orgId, "STREAMABLE");

    // Then
    assertEquals(2, mcpMetrics.getActiveConnections());
    assertEquals(1, mcpMetrics.getUserConnectionCount(userId1));
    assertEquals(1, mcpMetrics.getUserConnectionCount(userId2));
    assertEquals(2, mcpMetrics.getOrgConnectionCount(orgId));

    // When
    mcpMetrics.connectionClosed(userId1, orgId);

    // Then
    assertEquals(1, mcpMetrics.getActiveConnections());
    assertEquals(0, mcpMetrics.getUserConnectionCount(userId1));
    assertEquals(1, mcpMetrics.getOrgConnectionCount(orgId));
  }

  @Test
  @DisplayName("Should track connection failures")
  void testConnectionFailures() {
    // When
    mcpMetrics.connectionFailed("rate_limit_exceeded");
    mcpMetrics.connectionFailed("user_limit_exceeded");
    mcpMetrics.connectionFailed("circuit_breaker_open");

    // Then
    double failureCount = meterRegistry.counter("mcp.connections.failed").count();
    assertEquals(3.0, failureCount);
  }

  @Test
  @DisplayName("Should track messages")
  void testMessageTracking() {
    // When
    mcpMetrics.messageReceived("request");
    mcpMetrics.messageReceived("request");
    mcpMetrics.messageSent("response");
    mcpMetrics.messageError("request", "timeout");

    // Then
    assertEquals(2.0, meterRegistry.counter("mcp.messages.received").count());
    assertEquals(1.0, meterRegistry.counter("mcp.messages.sent").count());
    assertEquals(1.0, meterRegistry.counter("mcp.messages.errors").count());
  }

  @Test
  @DisplayName("Should track message processing time")
  void testMessageProcessingTime() throws InterruptedException {
    // When
    Timer.Sample sample = mcpMetrics.startMessageProcessing();
    Thread.sleep(100); // Simulate processing
    mcpMetrics.endMessageProcessing(sample);

    // Then
    Timer timer = meterRegistry.timer("mcp.message.processing.duration");
    assertEquals(1, timer.count());
    assertTrue(timer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS) >= 100);
  }

  @Test
  @DisplayName("Should track SSE events")
  void testSseEventTracking() {
    // When
    mcpMetrics.sseEventPublished();
    mcpMetrics.sseEventPublished();
    mcpMetrics.sseKeepAliveSent();

    // Then
    assertEquals(2.0, meterRegistry.counter("mcp.sse.events.published").count());
    assertEquals(1.0, meterRegistry.counter("mcp.sse.keepalives").count());
  }

  @Test
  @DisplayName("Should track SSE connection duration")
  void testSseConnectionDuration() throws InterruptedException {
    // When
    Timer.Sample sample = mcpMetrics.startSseConnection();
    Thread.sleep(50);
    mcpMetrics.endSseConnection(sample);

    // Then
    Timer timer = meterRegistry.timer("mcp.sse.connection.duration");
    assertEquals(1, timer.count());
    assertTrue(timer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS) >= 50);
  }

  @Test
  @DisplayName("Should track thread pool exhaustion")
  void testThreadPoolExhaustion() {
    // When
    mcpMetrics.threadPoolExhausted();
    mcpMetrics.threadPoolExhausted();

    // Then
    assertEquals(2.0, meterRegistry.counter("mcp.thread.pool.exhausted").count());
  }

  @Test
  @DisplayName("Should track request queue time")
  void testRequestQueueTime() throws InterruptedException {
    // When
    Timer.Sample sample = mcpMetrics.startQueueWait();
    Thread.sleep(25);
    mcpMetrics.endQueueWait(sample);

    // Then
    Timer timer = meterRegistry.timer("mcp.request.queue.time");
    assertEquals(1, timer.count());
    assertTrue(timer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS) >= 25);
  }

  @Test
  @DisplayName("Should track per-user connections correctly")
  void testPerUserConnectionTracking() {
    // Given
    String user1 = "alice";
    String user2 = "bob";
    String org = "acme";

    // When - multiple connections for user1
    mcpMetrics.connectionOpened(user1, org, "SSE");
    mcpMetrics.connectionOpened(user1, org, "SSE");
    mcpMetrics.connectionOpened(user2, org, "SSE");

    // Then
    assertEquals(2, mcpMetrics.getUserConnectionCount(user1));
    assertEquals(1, mcpMetrics.getUserConnectionCount(user2));
    assertEquals(3, mcpMetrics.getOrgConnectionCount(org));

    // When - close one connection for user1
    mcpMetrics.connectionClosed(user1, org);

    // Then
    assertEquals(1, mcpMetrics.getUserConnectionCount(user1));
    assertEquals(1, mcpMetrics.getUserConnectionCount(user2));
    assertEquals(2, mcpMetrics.getOrgConnectionCount(org));
  }

  @Test
  @DisplayName("Should handle null user and org gracefully")
  void testNullUserAndOrg() {
    // When
    mcpMetrics.connectionOpened(null, null, "SSE");

    // Then
    assertEquals(1, mcpMetrics.getActiveConnections());
    assertEquals(0, mcpMetrics.getUserConnectionCount(null));
    assertEquals(0, mcpMetrics.getOrgConnectionCount(null));

    // When
    mcpMetrics.connectionClosed(null, null);

    // Then
    assertEquals(0, mcpMetrics.getActiveConnections());
  }

  @Test
  @DisplayName("NO_OP instance should not throw exceptions")
  void testNoOpInstance() {
    // Given
    McpMetrics noOpMetrics = McpMetrics.NO_OP;

    // When/Then - all operations should be safe
    assertDoesNotThrow(
        () -> {
          noOpMetrics.connectionOpened("user", "org", "SSE");
          noOpMetrics.connectionClosed("user", "org");
          noOpMetrics.connectionFailed("test");
          noOpMetrics.sessionCreated("session1");
          noOpMetrics.sessionDestroyed("session1");
          noOpMetrics.messageReceived("test");
          noOpMetrics.messageSent("test");
          noOpMetrics.messageError("test", "error");

          Timer.Sample sample = noOpMetrics.startMessageProcessing();
          noOpMetrics.endMessageProcessing(sample);

          noOpMetrics.sseEventPublished();
          noOpMetrics.sseKeepAliveSent();

          Timer.Sample sseSample = noOpMetrics.startSseConnection();
          noOpMetrics.endSseConnection(sseSample);

          noOpMetrics.threadPoolExhausted();

          Timer.Sample queueSample = noOpMetrics.startQueueWait();
          noOpMetrics.endQueueWait(queueSample);
        });

    // All getters should return 0
    assertEquals(0, noOpMetrics.getActiveSessions());
    assertEquals(0, noOpMetrics.getActiveConnections());
    assertEquals(0, noOpMetrics.getUserConnectionCount("any"));
    assertEquals(0, noOpMetrics.getOrgConnectionCount("any"));
  }
}
