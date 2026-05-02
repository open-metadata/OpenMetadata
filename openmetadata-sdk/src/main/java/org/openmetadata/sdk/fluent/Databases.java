package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.collections.DatabaseCollection;

/**
 * Pure Fluent API for Database operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.Databases.*;
 *
 * // Create
 * Database database = create()
 *     .name("database_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * Database database = find(databaseId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * Database updated = find(databaseId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(databaseId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(database -> process(database));
 * </pre>
 */
public final class Databases {
  private static OpenMetadataClient defaultClient;

  private Databases() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Databases.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static DatabaseCreator create() {
    return new DatabaseCreator(getClient());
  }

  public static Database create(CreateDatabase request) {
    return getClient().databases().create(request);
  }

  // ==================== Direct Access Methods ====================

  public static Database get(String id) {
    return getClient().databases().get(id);
  }

  public static Database get(String id, String fields) {
    return getClient().databases().get(id, fields);
  }

  public static Database get(String id, String fields, String include) {
    return getClient().databases().get(id, fields, include);
  }

  public static Database getByName(String fqn) {
    return getClient().databases().getByName(fqn);
  }

  public static Database getByName(String fqn, String fields) {
    return getClient().databases().getByName(fqn, fields);
  }

  public static Database update(String id, Database entity) {
    return getClient().databases().update(id, entity);
  }

  public static void delete(String id) {
    getClient().databases().delete(id);
  }

  public static void delete(String id, java.util.Map<String, String> params) {
    getClient().databases().delete(id, params);
  }

  public static void restore(String id) {
    getClient().databases().restore(id);
  }

  public static org.openmetadata.sdk.models.ListResponse<Database> list(
      org.openmetadata.sdk.models.ListParams params) {
    return getClient().databases().list(params);
  }

  public static org.openmetadata.schema.type.EntityHistory getVersionList(java.util.UUID id) {
    return getClient().databases().getVersionList(id);
  }

  public static Database getVersion(String id, Double version) {
    return getClient().databases().getVersion(id, version);
  }

  // ==================== Finding/Retrieval ====================

  public static DatabaseFinder find(String id) {
    return new DatabaseFinder(getClient(), id);
  }

  public static DatabaseFinder find(UUID id) {
    return find(id.toString());
  }

  public static DatabaseFinder findByName(String fqn) {
    return new DatabaseFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static DatabaseLister list() {
    return new DatabaseLister(getClient());
  }

  public static DatabaseCollection collection() {
    return new DatabaseCollection(getClient());
  }

  // ==================== Import/Export ====================

  public static CsvExporter exportCsv(String databaseName) {
    return new CsvExporter(getClient(), databaseName);
  }

  public static CsvImporter importCsv(String databaseName) {
    return new CsvImporter(getClient(), databaseName);
  }

  // ==================== Creator ====================

  public static class DatabaseCreator {
    private final OpenMetadataClient client;
    private final CreateDatabase request = new CreateDatabase();

    DatabaseCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public DatabaseCreator name(String name) {
      request.setName(name);
      return this;
    }

    public DatabaseCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public DatabaseCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public DatabaseCreator in(String service) {
      request.setService(service);
      return this;
    }

    public Database execute() {
      return client.databases().create(request);
    }

    public Database now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class DatabaseFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    DatabaseFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    DatabaseFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public DatabaseFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public DatabaseFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public DatabaseFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domains", "dataProducts"));
      return this;
    }

    public FluentDatabase fetch() {
      Database database;
      if (includes.isEmpty()) {
        database =
            isFqn ? client.databases().getByName(identifier) : client.databases().get(identifier);
      } else {
        String fields = String.join(",", includes);
        database =
            isFqn
                ? client.databases().getByName(identifier, fields)
                : client.databases().get(identifier, fields);
      }
      return new FluentDatabase(database, client);
    }

    public DatabaseDeleter delete() {
      return new DatabaseDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class DatabaseDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    DatabaseDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public DatabaseDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public DatabaseDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.databases().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class DatabaseLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    DatabaseLister(OpenMetadataClient client) {
      this.client = client;
    }

    public DatabaseLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public DatabaseLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentDatabase> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.databases().list(params);
      List<FluentDatabase> items = new ArrayList<>();
      for (Database item : response.getData()) {
        items.add(new FluentDatabase(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentDatabase> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentDatabase {
    private final Database database;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentDatabase(Database database, OpenMetadataClient client) {
      this.database = database;
      this.client = client;
    }

    public Database get() {
      return database;
    }

    public FluentDatabase withDescription(String description) {
      database.setDescription(description);
      modified = true;
      return this;
    }

    public FluentDatabase withDisplayName(String displayName) {
      database.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentDatabase withOwners(List<EntityReference> owners) {
      database.setOwners(owners);
      modified = true;
      return this;
    }

    public FluentDatabase withTags(List<TagLabel> tags) {
      database.setTags(tags);
      modified = true;
      return this;
    }

    public FluentDatabase withDomains(List<EntityReference> domain) {
      database.setDomains(domain);
      modified = true;
      return this;
    }

    public FluentDatabase withDataProducts(List<EntityReference> dataProducts) {
      database.setDataProducts(dataProducts);
      modified = true;
      return this;
    }

    public FluentDatabase save() {
      if (modified) {
        Database updated = client.databases().update(database.getId().toString(), database);
        database.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public DatabaseDeleter delete() {
      return new DatabaseDeleter(client, database.getId().toString());
    }
  }

  // ==================== CSV Exporter ====================

  public static class CsvExporter
      extends org.openmetadata.sdk.fluent.common.CsvOperations.BaseCsvExporter {
    private final String databaseName;

    CsvExporter(OpenMetadataClient client, String databaseName) {
      super(client, "database");
      this.databaseName = databaseName;
    }

    @Override
    protected String performSyncExport() {
      return client.databases().exportCsv(databaseName);
    }

    @Override
    protected String performAsyncExport() {
      return client.databases().exportCsvAsync(databaseName);
    }
  }

  // ==================== CSV Importer ====================

  public static class CsvImporter
      extends org.openmetadata.sdk.fluent.common.CsvOperations.BaseCsvImporter {
    private final String databaseName;

    CsvImporter(OpenMetadataClient client, String databaseName) {
      super(client, "database");
      this.databaseName = databaseName;
    }

    @Override
    protected String performSyncImport() {
      return client.databases().importCsv(databaseName, csvData, dryRun);
    }

    @Override
    protected String performAsyncImport() {
      return client.databases().importCsvAsync(databaseName, csvData, dryRun);
    }
  }
}
