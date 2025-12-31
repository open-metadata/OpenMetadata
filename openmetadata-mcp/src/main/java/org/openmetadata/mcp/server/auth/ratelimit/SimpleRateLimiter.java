package org.openmetadata.mcp.server.auth.ratelimit;

import java.time.Instant;
import java.util.Queue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class SimpleRateLimiter {
  private final ConcurrentHashMap<String, Queue<Long>> requestTimestamps =
      new ConcurrentHashMap<>();
  private final int maxRequests;
  private final long windowSeconds;

  public SimpleRateLimiter(int maxRequests, long windowSeconds) {
    this.maxRequests = maxRequests;
    this.windowSeconds = windowSeconds;
  }

  public boolean allowRequest(String key) {
    long now = Instant.now().getEpochSecond();
    Queue<Long> timestamps =
        requestTimestamps.computeIfAbsent(key, k -> new ConcurrentLinkedQueue<>());

    synchronized (timestamps) {
      long cutoff = now - windowSeconds;
      timestamps.removeIf(timestamp -> timestamp < cutoff);

      if (timestamps.size() >= maxRequests) {
        LOG.warn("Rate limit exceeded for key: {}", key);
        return false;
      }

      timestamps.add(now);
      return true;
    }
  }

  public void cleanup() {
    long now = Instant.now().getEpochSecond();
    long cutoff = now - windowSeconds;

    requestTimestamps
        .entrySet()
        .removeIf(
            entry -> {
              Queue<Long> timestamps = entry.getValue();
              synchronized (timestamps) {
                timestamps.removeIf(timestamp -> timestamp < cutoff);
                return timestamps.isEmpty();
              }
            });
  }
}
