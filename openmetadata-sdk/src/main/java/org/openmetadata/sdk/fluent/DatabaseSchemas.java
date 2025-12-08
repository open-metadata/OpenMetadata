package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.collections.DatabaseSchemaCollection;

/**
 * Pure Fluent API for DatabaseSchema operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.DatabaseSchemas.*;
 *
 * // Create
 * DatabaseSchema databaseSchema = create()
 *     .name("databaseSchema_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * DatabaseSchema databaseSchema = find(databaseSchemaId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * DatabaseSchema updated = find(databaseSchemaId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(databaseSchemaId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(databaseSchema -> process(databaseSchema));
 * </pre>
 */
public final class DatabaseSchemas {
  private static OpenMetadataClient defaultClient;

  private DatabaseSchemas() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call DatabaseSchemas.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static DatabaseSchemaCreator create() {
    return new DatabaseSchemaCreator(getClient());
  }

  public static DatabaseSchema create(CreateDatabaseSchema request) {
    return getClient().databaseSchemas().create(request);
  }

  // ==================== Finding/Retrieval ====================

  public static DatabaseSchemaFinder find(String id) {
    return new DatabaseSchemaFinder(getClient(), id);
  }

  public static DatabaseSchemaFinder find(UUID id) {
    return find(id.toString());
  }

  public static DatabaseSchemaFinder findByName(String fqn) {
    return new DatabaseSchemaFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static DatabaseSchemaLister list() {
    return new DatabaseSchemaLister(getClient());
  }

  public static DatabaseSchemaCollection collection() {
    return new DatabaseSchemaCollection(getClient());
  }

  // ==================== Import/Export ====================

  public static CsvExporter exportCsv(String databaseSchemaName) {
    return new CsvExporter(getClient(), databaseSchemaName);
  }

  public static CsvImporter importCsv(String databaseSchemaName) {
    return new CsvImporter(getClient(), databaseSchemaName);
  }

  // ==================== Creator ====================

  public static class DatabaseSchemaCreator {
    private final OpenMetadataClient client;
    private final CreateDatabaseSchema request = new CreateDatabaseSchema();

    DatabaseSchemaCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public DatabaseSchemaCreator name(String name) {
      request.setName(name);
      return this;
    }

    public DatabaseSchemaCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public DatabaseSchemaCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public DatabaseSchemaCreator in(String database) {
      request.setDatabase(database);
      return this;
    }

    public DatabaseSchema execute() {
      return client.databaseSchemas().create(request);
    }

    public DatabaseSchema now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class DatabaseSchemaFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    DatabaseSchemaFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    DatabaseSchemaFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public DatabaseSchemaFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public DatabaseSchemaFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public DatabaseSchemaFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domains", "dataProducts"));
      return this;
    }

    public FluentDatabaseSchema fetch() {
      DatabaseSchema databaseSchema;
      if (includes.isEmpty()) {
        databaseSchema =
            isFqn
                ? client.databaseSchemas().getByName(identifier)
                : client.databaseSchemas().get(identifier);
      } else {
        String fields = String.join(",", includes);
        databaseSchema =
            isFqn
                ? client.databaseSchemas().getByName(identifier, fields)
                : client.databaseSchemas().get(identifier, fields);
      }
      return new FluentDatabaseSchema(databaseSchema, client);
    }

    public DatabaseSchemaDeleter delete() {
      return new DatabaseSchemaDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class DatabaseSchemaDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    DatabaseSchemaDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public DatabaseSchemaDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public DatabaseSchemaDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.databaseSchemas().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class DatabaseSchemaLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    DatabaseSchemaLister(OpenMetadataClient client) {
      this.client = client;
    }

    public DatabaseSchemaLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public DatabaseSchemaLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentDatabaseSchema> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.databaseSchemas().list(params);
      List<FluentDatabaseSchema> items = new ArrayList<>();
      for (DatabaseSchema item : response.getData()) {
        items.add(new FluentDatabaseSchema(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentDatabaseSchema> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentDatabaseSchema {
    private final DatabaseSchema databaseSchema;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentDatabaseSchema(DatabaseSchema databaseSchema, OpenMetadataClient client) {
      this.databaseSchema = databaseSchema;
      this.client = client;
    }

    public DatabaseSchema get() {
      return databaseSchema;
    }

    public FluentDatabaseSchema withOwners(List<EntityReference> owners) {
      databaseSchema.setOwners(owners);
      modified = true;
      return this;
    }

    public FluentDatabaseSchema withDescription(String description) {
      databaseSchema.setDescription(description);
      modified = true;
      return this;
    }

    public FluentDatabaseSchema withDisplayName(String displayName) {
      databaseSchema.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentDatabaseSchema withTags(List<TagLabel> tags) {
      databaseSchema.setTags(tags);
      modified = true;
      return this;
    }

    public FluentDatabaseSchema withDomains(List<EntityReference> domain) {
      databaseSchema.setDomains(domain);
      modified = true;
      return this;
    }

    public FluentDatabaseSchema withDataProducts(List<EntityReference> dataProducts) {
      databaseSchema.setDataProducts(dataProducts);
      modified = true;
      return this;
    }

    public FluentDatabaseSchema save() {
      if (modified) {
        DatabaseSchema updated =
            client.databaseSchemas().update(databaseSchema.getId().toString(), databaseSchema);
        databaseSchema.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public DatabaseSchemaDeleter delete() {
      return new DatabaseSchemaDeleter(client, databaseSchema.getId().toString());
    }
  }

  // ==================== CSV Exporter ====================

  public static class CsvExporter
      extends org.openmetadata.sdk.fluent.common.CsvOperations.BaseCsvExporter {
    private final String databaseSchemaName;

    CsvExporter(OpenMetadataClient client, String databaseSchemaName) {
      super(client, "databaseSchema");
      this.databaseSchemaName = databaseSchemaName;
    }

    @Override
    protected String performSyncExport() {
      return client.databaseSchemas().exportCsv(databaseSchemaName);
    }

    @Override
    protected String performAsyncExport() {
      return client.databaseSchemas().exportCsvAsync(databaseSchemaName);
    }
  }

  // ==================== CSV Importer ====================

  public static class CsvImporter
      extends org.openmetadata.sdk.fluent.common.CsvOperations.BaseCsvImporter {
    private final String databaseSchemaName;

    CsvImporter(OpenMetadataClient client, String databaseSchemaName) {
      super(client, "databaseSchema");
      this.databaseSchemaName = databaseSchemaName;
    }

    @Override
    protected String performSyncImport() {
      return client.databaseSchemas().importCsv(databaseSchemaName, csvData, dryRun);
    }

    @Override
    protected String performAsyncImport() {
      return client.databaseSchemas().importCsvAsync(databaseSchemaName, csvData, dryRun);
    }
  }
}
