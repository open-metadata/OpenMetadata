package org.openmetadata.sdk.websocket;

import io.socket.client.IO;
import io.socket.client.Socket;
import io.socket.emitter.Emitter;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;

/**
 * WebSocket listener for OpenMetadata async operations.
 * Handles CSV import/export notifications and other async job notifications.
 */
@Slf4j
public class WebSocketListener {
  private Socket socket;
  private final String serverUrl;
  private final UUID userId;
  @Getter private boolean connected = false;

  // Job ID to CompletableFuture mapping for async operations
  private final Map<String, CompletableFuture<JobResult>> pendingJobs = new ConcurrentHashMap<>();

  // Channel constants
  public static final String CSV_EXPORT_CHANNEL = "csvExportChannel";
  public static final String CSV_IMPORT_CHANNEL = "csvImportChannel";
  public static final String BULK_ASSETS_CHANNEL = "bulkAssetsChannel";

  public WebSocketListener(String serverUrl, UUID userId) {
    this.serverUrl = serverUrl;
    this.userId = userId;
  }

  /**
   * Connect to the WebSocket server.
   */
  public void connect() throws Exception {
    if (connected) {
      return;
    }

    IO.Options options = new IO.Options();
    options.path = "/api/v1/push/feed";
    options.query = "userId=" + userId.toString();
    options.transports = new String[] {"websocket"};
    options.reconnection = false;
    options.timeout = 10000;

    // Connect to the default namespace "/"
    socket = IO.socket(serverUrl, options);

    // Setup event handlers
    setupEventHandlers();

    // Connect
    socket.connect();

    // Wait for connection
    int retries = 10;
    while (!connected && retries > 0) {
      Thread.sleep(500);
      retries--;
    }

    if (!connected) {
      throw new Exception("Failed to connect to WebSocket server");
    }
  }

  private void setupEventHandlers() {
    socket.on(
        Socket.EVENT_CONNECT,
        args -> {
          log.info(
              "WebSocket connected successfully for user: {} to server: {}", userId, serverUrl);
          connected = true;
        });

    socket.on(
        Socket.EVENT_DISCONNECT,
        args -> {
          log.info(
              "WebSocket disconnected for user: {} - reason: {}",
              userId,
              args.length > 0 ? args[0] : "unknown");
          connected = false;
        });

    socket.on(
        Socket.EVENT_CONNECT_ERROR,
        args -> {
          String error = args.length > 0 ? args[0].toString() : "unknown error";
          log.error(
              "WebSocket connection error for user {} connecting to {}: {}",
              userId,
              serverUrl,
              error);
          // Log more details about the error
          if (args[0] instanceof Exception) {
            log.error("Connection error details:", (Exception) args[0]);
          }
        });

    // Log any generic message events for debugging
    socket.on(
        "message",
        args -> {
          log.debug("Received message event: {}", args.length > 0 ? args[0] : "empty");
        });

    // CSV Export handler
    socket.on(CSV_EXPORT_CHANNEL, createJobHandler(CSV_EXPORT_CHANNEL));
    log.debug("Registered handler for channel: {}", CSV_EXPORT_CHANNEL);

    // CSV Import handler
    socket.on(CSV_IMPORT_CHANNEL, createJobHandler(CSV_IMPORT_CHANNEL));
    log.debug("Registered handler for channel: {}", CSV_IMPORT_CHANNEL);

    // Bulk Assets handler
    socket.on(BULK_ASSETS_CHANNEL, createJobHandler(BULK_ASSETS_CHANNEL));
    log.debug("Registered handler for channel: {}", BULK_ASSETS_CHANNEL);
  }

  private Emitter.Listener createJobHandler(String channel) {
    return args -> {
      try {
        String messageStr = args[0].toString();
        log.debug("Received message on channel {}: {}", channel, messageStr);

        JSONObject message = new JSONObject(messageStr);
        String jobId = message.getString("jobId");
        String status = message.getString("status");

        CompletableFuture<JobResult> future = pendingJobs.get(jobId);
        if (future != null) {
          JobResult result = new JobResult();
          result.setJobId(jobId);
          result.setStatus(status);
          result.setChannel(channel);

          if ("COMPLETED".equals(status)) {
            if (message.has("data")) {
              result.setData(message.getString("data"));
            }
            if (message.has("result")) {
              result.setResult(message.get("result"));
            }
            log.info("Job {} completed on channel {}", jobId, channel);
            future.complete(result);
            pendingJobs.remove(jobId);
          } else if ("FAILED".equals(status)) {
            String error = message.optString("error", "Operation failed");
            result.setError(error);
            log.error("Job {} failed on channel {}: {}", jobId, channel, error);
            future.completeExceptionally(new Exception(error));
            pendingJobs.remove(jobId);
          } else if ("STARTED".equals(status)) {
            log.debug("Job {} started on channel {}", jobId, channel);
          }
        } else {
          log.debug("No pending future found for job {} on channel {}", jobId, channel);
        }
      } catch (Exception e) {
        log.error("Error handling WebSocket message on channel {}: {}", channel, e.getMessage(), e);
      }
    };
  }

  /**
   * Wait for a job to complete.
   *
   * @param jobId The job ID to wait for
   * @param timeout The timeout in seconds
   * @return The job result
   */
  public CompletableFuture<JobResult> waitForJob(String jobId, long timeout) {
    CompletableFuture<JobResult> future = new CompletableFuture<>();
    pendingJobs.put(jobId, future);

    // Add timeout
    CompletableFuture<JobResult> timeoutFuture = future.orTimeout(timeout, TimeUnit.SECONDS);
    timeoutFuture.exceptionally(
        ex -> {
          if (ex instanceof TimeoutException) {
            pendingJobs.remove(jobId);
            log.error("Job {} timed out after {} seconds", jobId, timeout);
          }
          return null;
        });

    return timeoutFuture;
  }

  /**
   * Disconnect from the WebSocket server.
   */
  public void disconnect() {
    if (socket != null) {
      socket.disconnect();
      socket = null;
      connected = false;
    }
  }

  /**
   * Job result class for async operations.
   */
  @lombok.Data
  public static class JobResult {
    private String jobId;
    private String status;
    private String channel;
    private String data;
    private Object result;
    private String error;
  }
}
