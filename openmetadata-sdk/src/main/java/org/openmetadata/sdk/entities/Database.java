package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.services.databases.DatabaseService;

public class Database extends org.openmetadata.schema.entity.data.Database {
  private static OpenMetadataClient defaultClient;

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException("Default client not set. Call setDefaultClient() first.");
    }
    return defaultClient;
  }

  // Static CRUD methods - Stripe style
  public static org.openmetadata.schema.entity.data.Database create(CreateDatabase request) {
    // Convert CreateDatabase to Database entity
    org.openmetadata.schema.entity.data.Database database =
        new org.openmetadata.schema.entity.data.Database();
    database.setName(request.getName());
    database.setDisplayName(request.getDisplayName());
    database.setDescription(request.getDescription());
    database.setOwners(request.getOwners());
    database.setRetentionPeriod(request.getRetentionPeriod());
    database.setExtension(request.getExtension());
    database.setSourceHash(request.getSourceHash());
    database.setLifeCycle(request.getLifeCycle());
    database.setSourceUrl(request.getSourceUrl());

    return (org.openmetadata.schema.entity.data.Database) getClient().databases().create(database);
  }

  public static org.openmetadata.schema.entity.data.Database retrieve(String id) {
    return (org.openmetadata.schema.entity.data.Database) getClient().databases().get(id);
  }

  public static org.openmetadata.schema.entity.data.Database retrieve(String id, String fields) {
    return (org.openmetadata.schema.entity.data.Database) getClient().databases().get(id, fields);
  }

  public static org.openmetadata.schema.entity.data.Database retrieveByName(
      String fullyQualifiedName) {
    return (org.openmetadata.schema.entity.data.Database)
        getClient().databases().getByName(fullyQualifiedName);
  }

  public static org.openmetadata.schema.entity.data.Database retrieveByName(
      String fullyQualifiedName, String fields) {
    return (org.openmetadata.schema.entity.data.Database)
        getClient().databases().getByName(fullyQualifiedName, fields);
  }

  public static DatabaseCollection list() {
    return new DatabaseCollection(getClient().databases());
  }

  public static DatabaseCollection list(DatabaseListParams params) {
    return new DatabaseCollection(getClient().databases(), params);
  }

  public static org.openmetadata.schema.entity.data.Database update(
      String id, org.openmetadata.schema.entity.data.Database database) {
    return (org.openmetadata.schema.entity.data.Database)
        getClient().databases().update(id, database);
  }

  public static org.openmetadata.schema.entity.data.Database patch(String id, String jsonPatch) {
    // JSON patch requires a Database object with patch operations
    org.openmetadata.schema.entity.data.Database patchDatabase =
        new org.openmetadata.schema.entity.data.Database();
    // The jsonPatch string would be applied server-side
    // For now, we pass an empty database as the service expects a Database object
    return (org.openmetadata.schema.entity.data.Database)
        getClient().databases().patch(id, patchDatabase);
  }

  public static void delete(String id) {
    delete(id, false, false);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete) {
    DatabaseService service = getClient().databases();
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    service.delete(id, params);
  }

  // Async operations
  public static CompletableFuture<org.openmetadata.schema.entity.data.Database> createAsync(
      CreateDatabase request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<org.openmetadata.schema.entity.data.Database> retrieveAsync(
      String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }

  // CSV operations
  public static String exportCsv(String name) {
    return getClient().databases().exportCsv(name);
  }

  public static CompletableFuture<String> exportCsvAsync(String name) {
    return CompletableFuture.supplyAsync(() -> exportCsv(name));
  }

  public static String importCsv(String csvData, boolean dryRun) {
    return getClient().databases().importCsv(csvData, dryRun);
  }

  public static CompletableFuture<String> importCsvAsync(String csvData, boolean dryRun) {
    return CompletableFuture.supplyAsync(() -> getClient().databases().importCsv(csvData, dryRun));
  }

  // Instance methods
  public org.openmetadata.schema.entity.data.Database save() {
    if (this.getId() != null) {
      return update(this.getId().toString(), this);
    } else {
      throw new IllegalStateException("Cannot save a database without an ID");
    }
  }

  public void delete() {
    if (this.getId() != null) {
      delete(this.getId().toString());
    } else {
      throw new IllegalStateException("Cannot delete a database without an ID");
    }
  }

  // Collection class with iterator support
  public static class DatabaseCollection {
    private final DatabaseService service;
    private final DatabaseListParams params;

    DatabaseCollection(DatabaseService service) {
      this(service, null);
    }

    DatabaseCollection(DatabaseService service, DatabaseListParams params) {
      this.service = service;
      this.params = params;
    }

    public Iterable<org.openmetadata.schema.entity.data.Database> autoPagingIterable() {
      return new Iterable<org.openmetadata.schema.entity.data.Database>() {
        @Override
        public Iterator<org.openmetadata.schema.entity.data.Database> iterator() {
          return new DatabaseIterator(service, params);
        }
      };
    }
  }

  // List params
  public static class DatabaseListParams {
    private Integer limit;
    private String before;
    private String after;
    private String fields;
    private String domain;
    private String service;

    public static Builder builder() {
      return new Builder();
    }

    public static class Builder {
      private DatabaseListParams params = new DatabaseListParams();

      public Builder limit(Integer limit) {
        params.limit = limit;
        return this;
      }

      public Builder before(String before) {
        params.before = before;
        return this;
      }

      public Builder after(String after) {
        params.after = after;
        return this;
      }

      public Builder fields(String fields) {
        params.fields = fields;
        return this;
      }

      public Builder domain(String domain) {
        params.domain = domain;
        return this;
      }

      public Builder service(String service) {
        params.service = service;
        return this;
      }

      public DatabaseListParams build() {
        return params;
      }
    }

    public ListParams toListParams() {
      ListParams listParams = new ListParams();
      if (limit != null) listParams.setLimit(limit);
      if (before != null) listParams.setBefore(before);
      if (after != null) listParams.setAfter(after);
      if (fields != null) listParams.setFields(fields);
      // Additional params can be added to ListParams extensions
      return listParams;
    }
  }

  // Iterator for pagination
  private static class DatabaseIterator
      implements Iterator<org.openmetadata.schema.entity.data.Database> {
    private final DatabaseService service;
    private final DatabaseListParams params;
    private Iterator<org.openmetadata.schema.entity.data.Database> currentPage;
    private String nextPageToken;
    private boolean hasMore = true;

    DatabaseIterator(DatabaseService service, DatabaseListParams params) {
      this.service = service;
      this.params = params;
      loadNextPage();
    }

    private void loadNextPage() {
      if (!hasMore) {
        return;
      }

      ListParams listParams = params != null ? params.toListParams() : new ListParams();
      if (nextPageToken != null) {
        listParams.setAfter(nextPageToken);
      }

      var response = service.list(listParams);
      currentPage = response.getData().iterator();
      nextPageToken = response.getPaging() != null ? response.getPaging().getAfter() : null;
      hasMore = nextPageToken != null;
    }

    @Override
    public boolean hasNext() {
      if (currentPage.hasNext()) {
        return true;
      }
      if (hasMore) {
        loadNextPage();
        return currentPage.hasNext();
      }
      return false;
    }

    @Override
    public org.openmetadata.schema.entity.data.Database next() {
      if (!hasNext()) {
        throw new java.util.NoSuchElementException();
      }
      return (org.openmetadata.schema.entity.data.Database) currentPage.next();
    }
  }
}
