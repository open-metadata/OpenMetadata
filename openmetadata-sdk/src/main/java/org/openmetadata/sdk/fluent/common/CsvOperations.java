package org.openmetadata.sdk.fluent.common;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
// Avoid Lombok to keep logging provider-agnostic
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.websocket.WebSocketManager;

/**
 * Common CSV operations with WebSocket support for all entities.
 * Provides reusable CSV import/export functionality with real-time notifications.
 */
public class CsvOperations {

  /**
   * Base class for CSV Export operations with WebSocket support.
   */
  public abstract static class BaseCsvExporter {
    private static final org.slf4j.Logger LOG =
        org.slf4j.LoggerFactory.getLogger(BaseCsvExporter.class);
    protected final OpenMetadataClient client;
    protected final String entityName;
    protected boolean async = false;
    protected Consumer<String> onComplete;
    protected Consumer<Throwable> onError;
    protected boolean waitForCompletion = false;
    protected long timeoutSeconds = 60;
    protected boolean useWebSocket = false;

    protected BaseCsvExporter(OpenMetadataClient client, String entityName) {
      this.client = client;
      this.entityName = entityName;
    }

    public BaseCsvExporter async() {
      this.async = true;
      return this;
    }

    public BaseCsvExporter waitForCompletion() {
      this.waitForCompletion = true;
      return this;
    }

    public BaseCsvExporter waitForCompletion(long timeoutSeconds) {
      this.waitForCompletion = true;
      this.timeoutSeconds = timeoutSeconds;
      return this;
    }

    public BaseCsvExporter withWebSocket() {
      this.useWebSocket = true;
      return this;
    }

    public BaseCsvExporter onComplete(Consumer<String> callback) {
      this.onComplete = callback;
      return this;
    }

    public BaseCsvExporter onError(Consumer<Throwable> callback) {
      this.onError = callback;
      return this;
    }

    protected abstract String performSyncExport();

    protected abstract String performAsyncExport();

    public String execute() {
      if (async) {
        return performAsyncExport();
      }
      return performSyncExport();
    }

    public CompletableFuture<String> executeAsync() {
      String jobId = performAsyncExport();
      LOG.debug("CSV export initiated: entity={}, jobId={}", entityName, jobId);

      // If WebSocket is enabled and waiting for completion, use WebSocket for notifications
      if (useWebSocket && waitForCompletion) {
        try {
          String serverUrl = client.getServerUrl();
          if (serverUrl != null) {
            UUID userId = client.getUserId();
            if (userId != null) {
              LOG.debug("Using WebSocket for async export monitoring with user ID: {}", userId);

              WebSocketManager wsManager = WebSocketManager.getInstance(serverUrl, userId);
              LOG.debug(
                  "Waiting for CSV export via WebSocket: jobId={}, timeoutSeconds={}",
                  jobId,
                  timeoutSeconds);
              return wsManager
                  .waitForCsvExport(jobId, timeoutSeconds)
                  .thenCompose(
                      result -> {
                        // Some backends may emit a JSON status on completion; if so, fetch final
                        // CSV
                        if (!isLikelyCsv(result)) {
                          try {
                            String status = client.importExport().getExportStatus(jobId);
                            String csv = tryExtractCsv(status);
                            if (csv != null) {
                              if (onComplete != null) onComplete.accept(csv);
                              return CompletableFuture.completedFuture(csv);
                            }
                          } catch (Exception e) {
                            LOG.debug(
                                "Failed fetching final CSV after WS completion: {}",
                                e.getMessage());
                          }
                        }

                        if (onComplete != null) {
                          onComplete.accept(result);
                        }
                        return CompletableFuture.completedFuture(result); // CSV content
                      })
                  .exceptionally(
                      ex -> {
                        if (onError != null) {
                          onError.accept(ex);
                        }
                        throw new RuntimeException("CSV export failed", ex);
                      });
            }
          }
        } catch (Exception e) {
          LOG.debug("WebSocket not available; returning job id immediately: {}", e.getMessage());
        }
        // WebSocket requested but not available: do NOT poll; return job id now
        return CompletableFuture.supplyAsync(
            () -> {
              if (onComplete != null) onComplete.accept(jobId);
              return jobId;
            });
      }

      // If waiting for completion without WebSocket, poll the export status
      if (waitForCompletion /* && !useWebSocket */) {
        return CompletableFuture.supplyAsync(
                () -> {
                  long deadline = System.currentTimeMillis() + (timeoutSeconds * 1000L);
                  String last = null;
                  while (System.currentTimeMillis() < deadline) {
                    try {
                      String status = client.importExport().getExportStatus(jobId);
                      if (status != null && !status.isEmpty()) {
                        last = status;
                        String csv = tryExtractCsv(status);
                        if (csv != null) {
                          if (onComplete != null) onComplete.accept(csv);
                          return csv; // Completed CSV
                        }
                      }
                    } catch (Exception e) {
                      LOG.debug("Polling export status failed: {}", e.getMessage());
                    }
                    try {
                      Thread.sleep(1000);
                    } catch (InterruptedException ie) {
                      Thread.currentThread().interrupt();
                      break;
                    }
                  }
                  // Timeout: return last known status or job id
                  if (onComplete != null) onComplete.accept(last != null ? last : jobId);
                  return last != null ? last : jobId;
                })
            .exceptionally(
                ex -> {
                  if (onError != null) onError.accept(ex);
                  throw new RuntimeException("CSV export failed", ex);
                });
      }

      // No waiting requested: return job id immediately
      LOG.debug("CSV export: no waiting requested; returning jobId immediately: jobId={}", jobId);
      CompletableFuture<String> future =
          CompletableFuture.supplyAsync(
              () -> {
                if (onComplete != null) {
                  onComplete.accept(jobId);
                }
                return jobId;
              });

      return future.exceptionally(
          ex -> {
            if (onError != null) {
              onError.accept(ex);
            }
            throw new RuntimeException("CSV export failed", ex);
          });
    }

    private String tryExtractCsv(String statusJson) {
      try {
        org.json.JSONObject obj = new org.json.JSONObject(statusJson);
        String st = obj.optString("status", obj.optString("state", ""));
        if (st != null && !st.isEmpty() && "COMPLETED".equalsIgnoreCase(st)) {
          if (obj.has("data")) {
            Object data = obj.get("data");
            if (data instanceof String) return (String) data;
            if (data instanceof org.json.JSONObject json && json.has("csv")) {
              return json.optString("csv", null);
            }
          }
          if (obj.has("result")) {
            Object res = obj.get("result");
            if (res instanceof String) return (String) res;
            if (res instanceof org.json.JSONObject json && json.has("csv")) {
              return json.optString("csv", null);
            }
          }
        }
      } catch (Exception ignore) {
        // Not JSON or unexpected shape; keep polling
      }
      return null;
    }

    private boolean isLikelyCsv(String s) {
      if (s == null || s.isEmpty()) return false;
      // JSON starts with '{' or '['; treat as not CSV
      char c = s.charAt(0);
      if (c == '{' || c == '[') return false;
      // Heuristic: CSV typically contains commas and newlines
      return (s.indexOf(',') >= 0) && (s.indexOf('\n') >= 0);
    }

    public String toCsv() {
      return execute();
    }
  }

  /**
   * Base class for CSV Import operations with WebSocket support.
   */
  public abstract static class BaseCsvImporter {
    private static final org.slf4j.Logger LOG =
        org.slf4j.LoggerFactory.getLogger(BaseCsvImporter.class);
    protected final OpenMetadataClient client;
    protected final String entityName;
    protected String csvData;
    protected boolean dryRun = false;
    protected boolean async = false;
    protected Consumer<CsvImportResult> onComplete;
    protected Consumer<Throwable> onError;
    protected boolean waitForCompletion = false;
    protected long timeoutSeconds = 60;
    protected boolean useWebSocket = false;

    protected BaseCsvImporter(OpenMetadataClient client, String entityName) {
      this.client = client;
      this.entityName = entityName;
    }

    public BaseCsvImporter withData(String csvData) {
      this.csvData = csvData;
      return this;
    }

    public BaseCsvImporter fromFile(String filePath) {
      try {
        this.csvData =
            new String(java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(filePath)));
      } catch (Exception e) {
        throw new RuntimeException("Failed to read CSV file: " + filePath, e);
      }
      return this;
    }

    public BaseCsvImporter dryRun() {
      this.dryRun = true;
      return this;
    }

    public BaseCsvImporter dryRun(boolean dryRun) {
      this.dryRun = dryRun;
      return this;
    }

    public BaseCsvImporter async() {
      this.async = true;
      return this;
    }

    public BaseCsvImporter waitForCompletion() {
      this.waitForCompletion = true;
      return this;
    }

    public BaseCsvImporter waitForCompletion(long timeoutSeconds) {
      this.waitForCompletion = true;
      this.timeoutSeconds = timeoutSeconds;
      return this;
    }

    public BaseCsvImporter withWebSocket() {
      this.useWebSocket = true;
      return this;
    }

    public BaseCsvImporter onComplete(Consumer<CsvImportResult> callback) {
      this.onComplete = callback;
      return this;
    }

    public BaseCsvImporter onError(Consumer<Throwable> callback) {
      this.onError = callback;
      return this;
    }

    protected abstract String performSyncImport();

    protected abstract String performAsyncImport();

    public String execute() {
      if (csvData == null || csvData.isEmpty()) {
        throw new IllegalStateException("CSV data not provided. Use withData() or fromFile()");
      }

      if (async) {
        return performAsyncImport();
      }
      return performSyncImport();
    }

    public CompletableFuture<CsvImportResult> executeAsync() {
      if (csvData == null || csvData.isEmpty()) {
        throw new IllegalStateException("CSV data not provided. Use withData() or fromFile()");
      }

      String jobId = performAsyncImport();

      // If WebSocket is enabled and waiting for completion, use WebSocket for notifications
      if (useWebSocket && waitForCompletion) {
        try {
          String serverUrl = client.getServerUrl();
          if (serverUrl != null) {
            UUID userId = client.getUserId();
            if (userId != null) {
              LOG.debug("Using WebSocket for async import monitoring with user ID: {}", userId);

              WebSocketManager wsManager = WebSocketManager.getInstance(serverUrl, userId);
              return wsManager
                  .waitForCsvImport(jobId, timeoutSeconds)
                  .thenApply(
                      result -> {
                        if (onComplete != null) {
                          onComplete.accept(result);
                        }
                        return result;
                      })
                  .exceptionally(
                      ex -> {
                        if (onError != null) {
                          onError.accept(ex);
                        }
                        throw new RuntimeException("CSV import failed", ex);
                      });
            } else {
              LOG.debug("User ID not available, falling back to polling");
            }
          }
        } catch (Exception e) {
          LOG.debug("WebSocket not available, falling back to polling: {}", e.getMessage());
        }
      }

      // Fallback to simple async completion
      CompletableFuture<CsvImportResult> future =
          CompletableFuture.supplyAsync(
              () -> {
                CsvImportResult result = new CsvImportResult();
                result.setStatus(ApiStatus.SUCCESS);
                result.setDryRun(dryRun);

                if (waitForCompletion && timeoutSeconds > 0) {
                  try {
                    Thread.sleep(Math.min(2000, timeoutSeconds * 1000));
                  } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                  }
                }

                if (onComplete != null) {
                  onComplete.accept(result);
                }
                return result;
              });

      return future.exceptionally(
          ex -> {
            if (onError != null) {
              onError.accept(ex);
            }
            throw new RuntimeException("CSV import failed", ex);
          });
    }

    public String apply() {
      return execute();
    }
  }
}
