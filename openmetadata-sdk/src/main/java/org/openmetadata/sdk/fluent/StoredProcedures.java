package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.CreateStoredProcedure;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for StoredProcedure operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.StoredProcedures.*;
 *
 * // Create
 * StoredProcedure storedProcedure = create()
 *     .name("storedProcedure_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * StoredProcedure storedProcedure = find(storedProcedureId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * StoredProcedure updated = find(storedProcedureId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(storedProcedureId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(storedProcedure -> process(storedProcedure));
 * </pre>
 */
public final class StoredProcedures {
  private static OpenMetadataClient defaultClient;

  private StoredProcedures() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call StoredProcedures.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static StoredProcedureCreator create() {
    return new StoredProcedureCreator(getClient());
  }

  public static StoredProcedure create(CreateStoredProcedure request) {
    return getClient().storedProcedures().create(request);
  }

  // ==================== Finding/Retrieval ====================

  public static StoredProcedureFinder find(String id) {
    return new StoredProcedureFinder(getClient(), id);
  }

  public static StoredProcedureFinder find(UUID id) {
    return find(id.toString());
  }

  public static StoredProcedureFinder findByName(String fqn) {
    return new StoredProcedureFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static StoredProcedureLister list() {
    return new StoredProcedureLister(getClient());
  }

  // ==================== Import/Export ====================

  public static CsvExporter exportCsv(String storedProcedureName) {
    return new CsvExporter(getClient(), storedProcedureName);
  }

  public static CsvImporter importCsv(String storedProcedureName) {
    return new CsvImporter(getClient(), storedProcedureName);
  }

  // ==================== Creator ====================

  public static class StoredProcedureCreator {
    private final OpenMetadataClient client;
    private final CreateStoredProcedure request = new CreateStoredProcedure();

    StoredProcedureCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public StoredProcedureCreator name(String name) {
      request.setName(name);
      return this;
    }

    public StoredProcedureCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public StoredProcedureCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public StoredProcedureCreator in(String databaseSchema) {
      request.setDatabaseSchema(databaseSchema);
      return this;
    }

    public StoredProcedure execute() {
      return client.storedProcedures().create(request);
    }

    public StoredProcedure now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class StoredProcedureFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    StoredProcedureFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    StoredProcedureFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public StoredProcedureFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public StoredProcedureFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public StoredProcedureFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domains"));
      return this;
    }

    public FluentStoredProcedure fetch() {
      StoredProcedure storedProcedure;
      if (includes.isEmpty()) {
        storedProcedure =
            isFqn
                ? client.storedProcedures().getByName(identifier)
                : client.storedProcedures().get(identifier);
      } else {
        String fields = String.join(",", includes);
        storedProcedure =
            isFqn
                ? client.storedProcedures().getByName(identifier, fields)
                : client.storedProcedures().get(identifier, fields);
      }
      return new FluentStoredProcedure(storedProcedure, client);
    }

    public StoredProcedureDeleter delete() {
      return new StoredProcedureDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class StoredProcedureDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    StoredProcedureDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public StoredProcedureDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public StoredProcedureDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.storedProcedures().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class StoredProcedureLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    StoredProcedureLister(OpenMetadataClient client) {
      this.client = client;
    }

    public StoredProcedureLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public StoredProcedureLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentStoredProcedure> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.storedProcedures().list(params);
      List<FluentStoredProcedure> items = new ArrayList<>();
      for (StoredProcedure item : response.getData()) {
        items.add(new FluentStoredProcedure(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentStoredProcedure> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentStoredProcedure {
    private final StoredProcedure storedProcedure;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentStoredProcedure(StoredProcedure storedProcedure, OpenMetadataClient client) {
      this.storedProcedure = storedProcedure;
      this.client = client;
    }

    public StoredProcedure get() {
      return storedProcedure;
    }

    public FluentStoredProcedure withDescription(String description) {
      storedProcedure.setDescription(description);
      modified = true;
      return this;
    }

    public FluentStoredProcedure withDisplayName(String displayName) {
      storedProcedure.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentStoredProcedure save() {
      if (modified) {
        StoredProcedure updated =
            client.storedProcedures().update(storedProcedure.getId().toString(), storedProcedure);
        storedProcedure.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public StoredProcedureDeleter delete() {
      return new StoredProcedureDeleter(client, storedProcedure.getId().toString());
    }
  }

  // ==================== CSV Exporter ====================

  public static class CsvExporter {
    private final OpenMetadataClient client;
    private final String storedProcedureName;
    private boolean async = false;

    CsvExporter(OpenMetadataClient client, String storedProcedureName) {
      this.client = client;
      this.storedProcedureName = storedProcedureName;
    }

    public CsvExporter async() {
      this.async = true;
      return this;
    }

    public String execute() {
      if (async) {
        return client.storedProcedures().exportCsvAsync(storedProcedureName);
      }
      return client.storedProcedures().exportCsv(storedProcedureName);
    }

    public String toCsv() {
      return execute();
    }
  }

  // ==================== CSV Importer ====================

  public static class CsvImporter {
    private final OpenMetadataClient client;
    private final String storedProcedureName;
    private String csvData;
    private boolean dryRun = false;
    private boolean async = false;

    CsvImporter(OpenMetadataClient client, String storedProcedureName) {
      this.client = client;
      this.storedProcedureName = storedProcedureName;
    }

    public CsvImporter withData(String csvData) {
      this.csvData = csvData;
      return this;
    }

    public CsvImporter fromFile(String filePath) {
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

    public CsvImporter async() {
      this.async = true;
      return this;
    }

    public String execute() {
      if (csvData == null || csvData.isEmpty()) {
        throw new IllegalStateException("CSV data not provided. Use withData() or fromFile()");
      }

      if (async) {
        return client.storedProcedures().importCsvAsync(storedProcedureName, csvData);
      }
      return client.storedProcedures().importCsv(storedProcedureName, csvData, dryRun);
    }

    public String apply() {
      return execute();
    }
  }
}
