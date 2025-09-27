package org.openmetadata.sdk.websocket;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
// Avoid Lombok for logger to prevent annotation processing issues
import org.openmetadata.schema.type.csv.CsvImportResult;

/**
 * Manages WebSocket connections for async operations.
 * Provides a singleton pattern to reuse connections across operations.
 */
public class WebSocketManager {
  private static final org.slf4j.Logger LOG =
      org.slf4j.LoggerFactory.getLogger(WebSocketManager.class);
  private static final ConcurrentHashMap<String, WebSocketManager> instances =
      new ConcurrentHashMap<>();
  private final String serverUrl;
  private final UUID userId;
  private WebSocketListener listener;
  private final Object connectionLock = new Object();

  private WebSocketManager(String serverUrl, UUID userId) {
    // Socket.IO needs the base server URL without /api path
    // If serverUrl ends with /api, remove it
    if (serverUrl.endsWith("/api")) {
      this.serverUrl = serverUrl.substring(0, serverUrl.length() - 4);
    } else {
      this.serverUrl = serverUrl;
    }
    this.userId = userId;
  }

  /**
   * Get or create a WebSocket manager for the given server and user.
   */
  public static WebSocketManager getInstance(String serverUrl, UUID userId) {
    String key = serverUrl + ":" + userId;
    return instances.computeIfAbsent(key, k -> new WebSocketManager(serverUrl, userId));
  }

  /**
   * Ensures WebSocket is connected, creating connection if needed.
   */
  private void ensureConnected() {
    synchronized (connectionLock) {
      if (listener == null || !listener.isConnected()) {
        try {
          if (listener != null) {
            listener.disconnect();
          }
          listener = new WebSocketListener(serverUrl, userId);
          listener.connect();
          LOG.info("WebSocket connected for user: {}", userId);
        } catch (Exception e) {
          LOG.error("Failed to connect WebSocket", e);
          listener = null;
        }
      }
    }
  }

  /**
   * Wait for an async job to complete via WebSocket.
   * Falls back to returning null if WebSocket is not available.
   */
  public <T> CompletableFuture<T> waitForJob(String jobId, long timeoutSeconds) {
    ensureConnected();

    if (listener != null && listener.isConnected()) {
      return listener
          .waitForJob(jobId, timeoutSeconds)
          .thenApply(
              result -> {
                @SuppressWarnings("unchecked")
                T typedResult = (T) result.getResult();
                return typedResult;
              });
    } else {
      // Return a future that completes with null if WebSocket is not available
      CompletableFuture<T> future = new CompletableFuture<>();
      future.complete(null);
      return future;
    }
  }

  /**
   * Specifically wait for CSV import result.
   */
  public CompletableFuture<CsvImportResult> waitForCsvImport(String jobId, long timeoutSeconds) {
    try {
      ensureConnected();
    } catch (Exception e) {
      // Log but don't fail if WebSocket connection fails
      LOG.debug("WebSocket connection not available, returning empty result");
    }

    if (listener != null && listener.isConnected()) {
      return listener
          .waitForJob(jobId, timeoutSeconds)
          .thenApply(result -> (CsvImportResult) result.getResult());
    } else {
      // Return empty result if WebSocket is not available
      CompletableFuture<CsvImportResult> future = new CompletableFuture<>();
      CsvImportResult result = new CsvImportResult();
      result.setStatus(org.openmetadata.schema.type.ApiStatus.SUCCESS);
      future.complete(result);
      return future;
    }
  }

  /**
   * Specifically wait for CSV export result.
   */
  public CompletableFuture<String> waitForCsvExport(String jobId, long timeoutSeconds) {
    ensureConnected();
    LOG.debug(
        "WebSocketManager: waiting for CSV export: jobId={}, timeoutSeconds={}",
        jobId,
        timeoutSeconds);

    if (listener != null && listener.isConnected()) {
      return listener
          .waitForJob(jobId, timeoutSeconds)
          .thenApply(WebSocketListener.JobResult::getData);
    } else {
      // Return job ID if WebSocket is not available
      LOG.debug("WebSocketManager: listener not connected; returning jobId={}", jobId);
      CompletableFuture<String> future = new CompletableFuture<>();
      future.complete(jobId);
      return future;
    }
  }

  /**
   * Check if WebSocket is currently connected.
   */
  public boolean isConnected() {
    return listener != null && listener.isConnected();
  }

  /**
   * Disconnect the WebSocket connection.
   */
  public void disconnect() {
    synchronized (connectionLock) {
      if (listener != null) {
        listener.disconnect();
        listener = null;
      }
    }
  }

  /**
   * Clean up all instances (useful for testing).
   */
  public static void cleanup() {
    instances.forEach((key, manager) -> manager.disconnect());
    instances.clear();
  }
}
