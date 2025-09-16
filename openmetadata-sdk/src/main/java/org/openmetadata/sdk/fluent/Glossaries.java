package org.openmetadata.sdk.fluent;

import java.util.*;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.collections.GlossaryCollection;
import org.openmetadata.sdk.websocket.WebSocketManager;

/**
 * Pure Fluent API for Glossary operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.Glossaries.*;
 *
 * // Create
 * Glossary glossary = create()
 *     .name("glossary_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * Glossary glossary = find(glossaryId)
 *     .includeOwner()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * Glossary updated = find(glossaryId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(glossaryId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(glossary -> process(glossary));
 * </pre>
 */
public final class Glossaries {
  private static OpenMetadataClient defaultClient;

  private Glossaries() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Glossaries.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static GlossaryCreator create() {
    return new GlossaryCreator(getClient());
  }

  public static Glossary create(CreateGlossary request) {
    return getClient().glossaries().create(request);
  }

  // ==================== Finding/Retrieval ====================

  public static GlossaryFinder find(String id) {
    return new GlossaryFinder(getClient(), id);
  }

  public static GlossaryFinder find(UUID id) {
    return find(id.toString());
  }

  public static GlossaryFinder findByName(String fqn) {
    return new GlossaryFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static GlossaryLister list() {
    return new GlossaryLister(getClient());
  }

  public static GlossaryCollection collection() {
    return new GlossaryCollection(getClient());
  }

  // ==================== Import/Export ====================

  public static CsvExporter exportCsv(String glossaryName) {
    return new CsvExporter(getClient(), glossaryName);
  }

  public static CsvImporter importCsv(String glossaryName) {
    return new CsvImporter(getClient(), glossaryName);
  }

  // ==================== Creator ====================

  public static class GlossaryCreator {
    private final OpenMetadataClient client;
    private final CreateGlossary request = new CreateGlossary();

    GlossaryCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public GlossaryCreator name(String name) {
      request.setName(name);
      return this;
    }

    public GlossaryCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public GlossaryCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public Glossary execute() {
      return client.glossaries().create(request);
    }

    public Glossary now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class GlossaryFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    GlossaryFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    GlossaryFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public GlossaryFinder includeOwner() {
      includes.add("owner");
      return this;
    }

    public GlossaryFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public GlossaryFinder includeAll() {
      includes.addAll(Arrays.asList("owner", "tags", "followers", "domain"));
      return this;
    }

    public FluentGlossary fetch() {
      Glossary glossary;
      if (includes.isEmpty()) {
        glossary =
            isFqn ? client.glossaries().getByName(identifier) : client.glossaries().get(identifier);
      } else {
        String fields = String.join(",", includes);
        glossary =
            isFqn
                ? client.glossaries().getByName(identifier, fields)
                : client.glossaries().get(identifier, fields);
      }
      return new FluentGlossary(glossary, client);
    }

    public GlossaryDeleter delete() {
      return new GlossaryDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class GlossaryDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    GlossaryDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public GlossaryDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public GlossaryDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.glossaries().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class GlossaryLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    GlossaryLister(OpenMetadataClient client) {
      this.client = client;
    }

    public GlossaryLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public GlossaryLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentGlossary> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.glossaries().list(params);
      List<FluentGlossary> items = new ArrayList<>();
      for (Glossary item : response.getData()) {
        items.add(new FluentGlossary(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentGlossary> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentGlossary {
    private final Glossary glossary;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentGlossary(Glossary glossary, OpenMetadataClient client) {
      this.glossary = glossary;
      this.client = client;
    }

    public Glossary get() {
      return glossary;
    }

    public FluentGlossary withDescription(String description) {
      glossary.setDescription(description);
      modified = true;
      return this;
    }

    public FluentGlossary withDisplayName(String displayName) {
      glossary.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentGlossary save() {
      if (modified) {
        Glossary updated = client.glossaries().update(glossary.getId().toString(), glossary);
        glossary.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public GlossaryDeleter delete() {
      return new GlossaryDeleter(client, glossary.getId().toString());
    }
  }

  // ==================== CSV Exporter ====================

  public static class CsvExporter {
    private final OpenMetadataClient client;
    private final String glossaryName;
    private boolean async = false;
    private Consumer<String> onComplete;
    private Consumer<Throwable> onError;
    private boolean waitForCompletion = false;
    private long timeoutSeconds = 60;

    CsvExporter(OpenMetadataClient client, String glossaryName) {
      this.client = client;
      this.glossaryName = glossaryName;
    }

    public CsvExporter async() {
      this.async = true;
      return this;
    }

    public CsvExporter waitForCompletion() {
      this.waitForCompletion = true;
      return this;
    }

    public CsvExporter waitForCompletion(long timeoutSeconds) {
      this.waitForCompletion = true;
      this.timeoutSeconds = timeoutSeconds;
      return this;
    }

    public CsvExporter onComplete(Consumer<String> callback) {
      this.onComplete = callback;
      return this;
    }

    public CsvExporter onError(Consumer<Throwable> callback) {
      this.onError = callback;
      return this;
    }

    public String execute() {
      if (async) {
        return client.glossaries().exportCsvAsync(glossaryName);
      }
      return client.glossaries().exportCsv(glossaryName);
    }

    public CompletableFuture<String> executeAsync() {
      String jobId = client.glossaries().exportCsvAsync(glossaryName);

      if (waitForCompletion) {
        // Get WebSocket manager for async monitoring
        UUID userId = client.getCurrentUserId();
        String wsUrl = client.getWebSocketUrl();

        if (userId != null && wsUrl != null) {
          WebSocketManager wsManager = WebSocketManager.getInstance(wsUrl, userId);
          return wsManager
              .waitForCsvExport(jobId, timeoutSeconds)
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
                    throw new RuntimeException("CSV export failed", ex);
                  });
        }
      }

      // Return job ID immediately if not waiting for completion
      CompletableFuture<String> future = new CompletableFuture<>();
      future.complete(jobId);
      if (onComplete != null) {
        onComplete.accept(jobId);
      }
      return future;
    }

    public String toCsv() {
      return execute();
    }
  }

  // ==================== CSV Importer ====================

  @Slf4j
  public static class CsvImporter {
    private final OpenMetadataClient client;
    private final String glossaryName;
    private String csvData;
    private boolean dryRun = false;
    private boolean async = false;
    private Consumer<CsvImportResult> onComplete;
    private Consumer<Throwable> onError;
    private boolean waitForCompletion = false;
    private long timeoutSeconds = 60;

    CsvImporter(OpenMetadataClient client, String glossaryName) {
      this.client = client;
      this.glossaryName = glossaryName;
    }

    public CsvImporter withData(String csvData) {
      this.csvData = csvData;
      return this;
    }

    public CsvImporter fromFile(String filePath) {
      // Read CSV from file
      try {
        this.csvData =
            new String(java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(filePath)));
      } catch (Exception e) {
        throw new RuntimeException("Failed to read CSV file: " + filePath, e);
      }
      return this;
    }

    public CsvImporter dryRun() {
      this.dryRun = true;
      return this;
    }

    public CsvImporter dryRun(boolean dryRun) {
      this.dryRun = dryRun;
      return this;
    }

    public CsvImporter async() {
      this.async = true;
      return this;
    }

    public CsvImporter waitForCompletion() {
      this.waitForCompletion = true;
      return this;
    }

    public CsvImporter waitForCompletion(long timeoutSeconds) {
      this.waitForCompletion = true;
      this.timeoutSeconds = timeoutSeconds;
      return this;
    }

    public CsvImporter onComplete(Consumer<CsvImportResult> callback) {
      this.onComplete = callback;
      return this;
    }

    public CsvImporter onError(Consumer<Throwable> callback) {
      this.onError = callback;
      return this;
    }

    public String execute() {
      if (csvData == null || csvData.isEmpty()) {
        throw new IllegalStateException("CSV data not provided. Use withData() or fromFile()");
      }

      if (async) {
        return client.glossaries().importCsvAsync(glossaryName, csvData, dryRun);
      }
      return client.glossaries().importCsv(glossaryName, csvData, dryRun);
    }

    public CompletableFuture<CsvImportResult> executeAsync() {
      if (csvData == null || csvData.isEmpty()) {
        throw new IllegalStateException("CSV data not provided. Use withData() or fromFile()");
      }

      // Always execute the async import
      String jobId = client.glossaries().importCsvAsync(glossaryName, csvData, dryRun);

      if (waitForCompletion) {
        // Try to use WebSocket for monitoring if available
        UUID userId = client.getCurrentUserId();
        String wsUrl = client.getWebSocketUrl();

        if (userId != null && wsUrl != null) {
          try {
            WebSocketManager wsManager = WebSocketManager.getInstance(wsUrl, userId);
            CompletableFuture<CsvImportResult> wsFuture =
                wsManager.waitForCsvImport(jobId, timeoutSeconds);

            // Check if WebSocket actually connected
            if (!wsFuture.isCompletedExceptionally() && wsManager.isConnected()) {
              return wsFuture
                  .thenApply(
                      result -> {
                        if (onComplete != null) {
                          onComplete.accept(result);
                        }
                        return result;
                      })
                  .exceptionally(
                      ex -> {
                        // WebSocket failed, but import was still executed
                        // Return a result indicating the job was started
                        CsvImportResult result = new CsvImportResult();
                        result.setStatus(ApiStatus.SUCCESS);
                        result.setDryRun(dryRun);
                        if (onComplete != null) {
                          onComplete.accept(result);
                        }
                        return result;
                      });
            }
          } catch (Exception e) {
            // Log but don't fail if WebSocket is not available
            log.debug("WebSocket not available for monitoring async import: {}", e.getMessage());
          }
        }

        // WebSocket not available, but import was executed
        // Return a result indicating the job was started
        CompletableFuture<CsvImportResult> future = new CompletableFuture<>();
        CsvImportResult startedResult = new CsvImportResult();
        startedResult.setStatus(ApiStatus.SUCCESS);
        startedResult.setDryRun(dryRun);
        future.complete(startedResult);
        if (onComplete != null) {
          onComplete.accept(startedResult);
        }
        return future;
      }

      // Not waiting for completion - return minimal result with job ID
      CompletableFuture<CsvImportResult> future = new CompletableFuture<>();
      CsvImportResult jobResult = new CsvImportResult();
      jobResult.setStatus(ApiStatus.SUCCESS);
      future.complete(jobResult);
      if (onComplete != null) {
        onComplete.accept(jobResult);
      }
      return future;
    }

    public String apply() {
      return execute();
    }
  }
}
