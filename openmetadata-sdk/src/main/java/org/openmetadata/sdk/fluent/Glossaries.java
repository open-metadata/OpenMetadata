package org.openmetadata.sdk.fluent;

import java.util.*;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.collections.GlossaryCollection;

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
 *     .includeOwners()
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

    public GlossaryFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public GlossaryFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public GlossaryFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domains"));
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

  public static class CsvExporter
      extends org.openmetadata.sdk.fluent.common.CsvOperations.BaseCsvExporter {
    private final String glossaryName;

    CsvExporter(OpenMetadataClient client, String glossaryName) {
      super(client, "glossary");
      this.glossaryName = glossaryName;
    }

    @Override
    protected String performSyncExport() {
      return client.glossaries().exportCsv(glossaryName);
    }

    @Override
    protected String performAsyncExport() {
      return client.glossaries().exportCsvAsync(glossaryName);
    }
  }

  // ==================== CSV Importer ====================

  public static class CsvImporter {
    private static final org.slf4j.Logger LOG =
        org.slf4j.LoggerFactory.getLogger(CsvImporter.class);
    private final OpenMetadataClient client;
    private final String glossaryName;
    private String csvData;
    private boolean dryRun = false;
    private boolean async = false;
    private Consumer<CsvImportResult> onComplete;
    private Consumer<Throwable> onError;
    private boolean waitForCompletion = false;
    private long timeoutSeconds = 60;
    private boolean useWebSocket = false;

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

    public CsvImporter withWebSocket() {
      this.useWebSocket = true;
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

      // If WebSocket is enabled and waiting for completion, use WebSocket for notifications
      if (useWebSocket && waitForCompletion) {
        try {
          String serverUrl = client.getServerUrl();
          if (serverUrl != null) {
            // Only fetch user ID when WebSocket is actually needed
            UUID userId = client.getUserId();
            if (userId != null) {
              LOG.debug("Using WebSocket for async import monitoring with user ID: {}", userId);

              org.openmetadata.sdk.websocket.WebSocketManager wsManager =
                  org.openmetadata.sdk.websocket.WebSocketManager.getInstance(serverUrl, userId);

              // Wait for the CSV import result via WebSocket
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

                // If waiting for completion, add a delay to allow async processing
                if (waitForCompletion && timeoutSeconds > 0) {
                  try {
                    // Give the async import time to process (at least 2 seconds)
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
