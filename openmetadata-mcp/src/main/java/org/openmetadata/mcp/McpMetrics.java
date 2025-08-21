package org.openmetadata.mcp;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.extern.slf4j.Slf4j;

/**
 * MCP (Model Context Protocol) metrics for monitoring SSE connections and performance.
 * Critical for identifying connection exhaustion and resource issues.
 */
@Slf4j
@Singleton
public class McpMetrics {
  // No-op instance for when metrics are disabled
  public static final McpMetrics NO_OP =
      new McpMetrics(new SimpleMeterRegistry()) {
        @Override
        public void connectionOpened(String userId, String orgId, String connectionType) {
          // No-op
        }

        @Override
        public void connectionClosed(String userId, String orgId) {
          // No-op
        }

        @Override
        public void connectionFailed(String reason) {
          // No-op
        }

        @Override
        public void sessionCreated(String sessionId) {
          // No-op
        }

        @Override
        public void sessionDestroyed(String sessionId) {
          // No-op
        }

        @Override
        public void messageReceived(String messageType) {
          // No-op
        }

        @Override
        public void messageSent(String messageType) {
          // No-op
        }

        @Override
        public void messageError(String messageType, String error) {
          // No-op
        }

        @Override
        public Timer.Sample startMessageProcessing() {
          return Timer.start(new SimpleMeterRegistry());
        }

        @Override
        public void endMessageProcessing(Timer.Sample sample) {
          // No-op
        }

        @Override
        public void sseEventPublished() {
          // No-op
        }

        @Override
        public void sseKeepAliveSent() {
          // No-op
        }

        @Override
        public Timer.Sample startSseConnection() {
          return Timer.start(new SimpleMeterRegistry());
        }

        @Override
        public void endSseConnection(Timer.Sample sample) {
          // No-op
        }

        @Override
        public void threadPoolExhausted() {
          // No-op
        }

        @Override
        public Timer.Sample startQueueWait() {
          return Timer.start(new SimpleMeterRegistry());
        }

        @Override
        public void endQueueWait(Timer.Sample sample) {
          // No-op
        }
      };
  private final MeterRegistry meterRegistry;

  // Connection Metrics
  private final AtomicInteger activeSessions = new AtomicInteger(0);
  private final AtomicInteger activeConnections = new AtomicInteger(0);
  private final Counter connectionOpened;
  private final Counter connectionClosed;
  private final Counter connectionFailed;

  // Message Metrics
  private final Counter messagesReceived;
  private final Counter messagesSent;
  private final Counter messagesError;
  private final Timer messageProcessingTime;

  // SSE Specific Metrics
  private final Counter sseEventsPublished;
  private final Counter sseKeepAlivesSent;
  private final Timer sseConnectionDuration;

  // Resource Metrics
  private final Counter threadPoolExhausted;
  private final Timer requestQueueTime;

  // Per-User/Org tracking for rate limiting
  private final Map<String, AtomicInteger> connectionsPerUser = new ConcurrentHashMap<>();
  private final Map<String, AtomicInteger> connectionsPerOrg = new ConcurrentHashMap<>();

  @Inject
  public McpMetrics(MeterRegistry meterRegistry) {
    this.meterRegistry = meterRegistry;

    // Register gauges for active counts
    Gauge.builder("mcp.sessions.active", activeSessions, AtomicInteger::get)
        .description("Number of active MCP sessions")
        .register(meterRegistry);

    Gauge.builder("mcp.connections.active", activeConnections, AtomicInteger::get)
        .description("Number of active MCP connections (SSE + regular)")
        .register(meterRegistry);

    // Connection lifecycle counters
    this.connectionOpened =
        Counter.builder("mcp.connections.opened")
            .description("Total MCP connections opened")
            .register(meterRegistry);

    this.connectionClosed =
        Counter.builder("mcp.connections.closed")
            .description("Total MCP connections closed")
            .register(meterRegistry);

    this.connectionFailed =
        Counter.builder("mcp.connections.failed")
            .description("Total MCP connection failures")
            .register(meterRegistry);

    // Message metrics
    this.messagesReceived =
        Counter.builder("mcp.messages.received")
            .description("Total MCP messages received")
            .register(meterRegistry);

    this.messagesSent =
        Counter.builder("mcp.messages.sent")
            .description("Total MCP messages sent")
            .register(meterRegistry);

    this.messagesError =
        Counter.builder("mcp.messages.errors")
            .description("Total MCP message processing errors")
            .register(meterRegistry);

    this.messageProcessingTime =
        Timer.builder("mcp.message.processing.duration")
            .description("Time to process MCP messages")
            .publishPercentiles(0.5, 0.95, 0.99)
            .register(meterRegistry);

    // SSE specific metrics
    this.sseEventsPublished =
        Counter.builder("mcp.sse.events.published")
            .description("Total SSE events published")
            .register(meterRegistry);

    this.sseKeepAlivesSent =
        Counter.builder("mcp.sse.keepalives")
            .description("Total SSE keepalive messages sent")
            .register(meterRegistry);

    this.sseConnectionDuration =
        Timer.builder("mcp.sse.connection.duration")
            .description("Duration of SSE connections")
            .publishPercentiles(0.5, 0.95, 0.99)
            .register(meterRegistry);

    // Resource exhaustion metrics
    this.threadPoolExhausted =
        Counter.builder("mcp.thread.pool.exhausted")
            .description("Times thread pool was exhausted for MCP")
            .register(meterRegistry);

    this.requestQueueTime =
        Timer.builder("mcp.request.queue.time")
            .description("Time requests spent queued waiting for threads")
            .publishPercentiles(0.5, 0.95, 0.99)
            .register(meterRegistry);

    // Register per-user connection gauge
    Gauge.builder("mcp.connections.per.user.max", connectionsPerUser, this::getMaxUserConnections)
        .description("Maximum connections from a single user")
        .register(meterRegistry);

    // Register per-org connection gauge
    Gauge.builder("mcp.connections.per.org.max", connectionsPerOrg, this::getMaxOrgConnections)
        .description("Maximum connections from a single organization")
        .register(meterRegistry);
  }

  // Connection lifecycle methods
  public void connectionOpened(String userId, String orgId, String connectionType) {
    activeConnections.incrementAndGet();
    connectionOpened.increment();

    // Track per-user connections
    if (userId != null) {
      connectionsPerUser.computeIfAbsent(userId, k -> new AtomicInteger(0)).incrementAndGet();
    }

    // Track per-org connections
    if (orgId != null) {
      connectionsPerOrg.computeIfAbsent(orgId, k -> new AtomicInteger(0)).incrementAndGet();
    }

    LOG.debug(
        "MCP connection opened - Type: {}, User: {}, Org: {}, Active: {}",
        connectionType,
        userId,
        orgId,
        activeConnections.get());
  }

  public void connectionClosed(String userId, String orgId) {
    activeConnections.decrementAndGet();
    connectionClosed.increment();

    // Decrement per-user connections
    if (userId != null && connectionsPerUser.containsKey(userId)) {
      connectionsPerUser.get(userId).decrementAndGet();
    }

    // Decrement per-org connections
    if (orgId != null && connectionsPerOrg.containsKey(orgId)) {
      connectionsPerOrg.get(orgId).decrementAndGet();
    }

    LOG.debug(
        "MCP connection closed - User: {}, Org: {}, Active: {}",
        userId,
        orgId,
        activeConnections.get());
  }

  public void connectionFailed(String reason) {
    connectionFailed.increment();
    LOG.warn("MCP connection failed: {}", reason);
  }

  // Session management
  public void sessionCreated(String sessionId) {
    activeSessions.incrementAndGet();
    LOG.debug("MCP session created: {}, Active sessions: {}", sessionId, activeSessions.get());
  }

  public void sessionDestroyed(String sessionId) {
    activeSessions.decrementAndGet();
    LOG.debug("MCP session destroyed: {}, Active sessions: {}", sessionId, activeSessions.get());
  }

  // Message tracking
  public void messageReceived(String messageType) {
    messagesReceived.increment();
  }

  public void messageSent(String messageType) {
    messagesSent.increment();
  }

  public void messageError(String messageType, String error) {
    messagesError.increment();
    LOG.error("MCP message error - Type: {}, Error: {}", messageType, error);
  }

  public Timer.Sample startMessageProcessing() {
    return Timer.start(meterRegistry);
  }

  public void endMessageProcessing(Timer.Sample sample) {
    sample.stop(messageProcessingTime);
  }

  // SSE specific tracking
  public void sseEventPublished() {
    sseEventsPublished.increment();
  }

  public void sseKeepAliveSent() {
    sseKeepAlivesSent.increment();
  }

  public Timer.Sample startSseConnection() {
    return Timer.start(meterRegistry);
  }

  public void endSseConnection(Timer.Sample sample) {
    sample.stop(sseConnectionDuration);
  }

  // Resource exhaustion tracking
  public void threadPoolExhausted() {
    threadPoolExhausted.increment();
    LOG.error("MCP thread pool exhausted - connections may be rejected");
  }

  public Timer.Sample startQueueWait() {
    return Timer.start(meterRegistry);
  }

  public void endQueueWait(Timer.Sample sample) {
    sample.stop(requestQueueTime);
  }

  // Helper methods
  private int getMaxUserConnections(Map<String, AtomicInteger> map) {
    return map.values().stream().mapToInt(AtomicInteger::get).max().orElse(0);
  }

  private int getMaxOrgConnections(Map<String, AtomicInteger> map) {
    return map.values().stream().mapToInt(AtomicInteger::get).max().orElse(0);
  }

  // Get current metrics for monitoring
  public int getActiveSessions() {
    return activeSessions.get();
  }

  public int getActiveConnections() {
    return activeConnections.get();
  }

  public int getUserConnectionCount(String userId) {
    return connectionsPerUser.getOrDefault(userId, new AtomicInteger(0)).get();
  }

  public int getOrgConnectionCount(String orgId) {
    return connectionsPerOrg.getOrDefault(orgId, new AtomicInteger(0)).get();
  }
}
