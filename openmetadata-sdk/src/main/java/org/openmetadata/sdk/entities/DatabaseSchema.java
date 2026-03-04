package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.services.databases.DatabaseSchemaService;

public class DatabaseSchema extends org.openmetadata.schema.entity.data.DatabaseSchema {
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
  public static org.openmetadata.schema.entity.data.DatabaseSchema create(
      CreateDatabaseSchema request) {
    // Pass CreateDatabaseSchema request directly to the API
    return getClient().databaseSchemas().create(request);
  }

  public static org.openmetadata.schema.entity.data.DatabaseSchema retrieve(String id) {
    return (org.openmetadata.schema.entity.data.DatabaseSchema)
        getClient().databaseSchemas().get(id);
  }

  public static org.openmetadata.schema.entity.data.DatabaseSchema retrieve(
      String id, String fields) {
    return (org.openmetadata.schema.entity.data.DatabaseSchema)
        getClient().databaseSchemas().get(id, fields);
  }

  public static org.openmetadata.schema.entity.data.DatabaseSchema retrieveByName(
      String fullyQualifiedName) {
    return (org.openmetadata.schema.entity.data.DatabaseSchema)
        getClient().databaseSchemas().getByName(fullyQualifiedName);
  }

  public static org.openmetadata.schema.entity.data.DatabaseSchema retrieveByName(
      String fullyQualifiedName, String fields) {
    return (org.openmetadata.schema.entity.data.DatabaseSchema)
        getClient().databaseSchemas().getByName(fullyQualifiedName, fields);
  }

  public static DatabaseSchemaCollection list() {
    return new DatabaseSchemaCollection(getClient().databaseSchemas());
  }

  public static DatabaseSchemaCollection list(DatabaseSchemaListParams params) {
    return new DatabaseSchemaCollection(getClient().databaseSchemas(), params);
  }

  public static org.openmetadata.schema.entity.data.DatabaseSchema update(
      String id, org.openmetadata.schema.entity.data.DatabaseSchema databaseSchema) {
    return (org.openmetadata.schema.entity.data.DatabaseSchema)
        getClient().databaseSchemas().update(id, databaseSchema);
  }

  public static org.openmetadata.schema.entity.data.DatabaseSchema patch(
      String id, String jsonPatch) {
    try {
      com.fasterxml.jackson.databind.ObjectMapper mapper =
          new com.fasterxml.jackson.databind.ObjectMapper();
      com.fasterxml.jackson.databind.JsonNode patchNode = mapper.readTree(jsonPatch);
      return getClient().databaseSchemas().patch(id, patchNode);
    } catch (Exception e) {
      throw new org.openmetadata.sdk.exceptions.OpenMetadataException(
          "Failed to parse JSON patch: " + e.getMessage(), e);
    }
  }

  public static void delete(String id) {
    delete(id, false, false);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete) {
    DatabaseSchemaService service = getClient().databaseSchemas();
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    service.delete(id, params);
  }

  // Async operations
  public static CompletableFuture<org.openmetadata.schema.entity.data.DatabaseSchema> createAsync(
      CreateDatabaseSchema request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<org.openmetadata.schema.entity.data.DatabaseSchema> retrieveAsync(
      String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }

  // CSV operations
  public static String exportCsv(String name) {
    return getClient().databaseSchemas().exportCsv(name);
  }

  public static CompletableFuture<String> exportCsvAsync(String name) {
    return CompletableFuture.supplyAsync(() -> exportCsv(name));
  }

  public static String importCsv(String name, String csvData, boolean dryRun) {
    return getClient().databaseSchemas().importCsv(name, csvData, dryRun);
  }

  public static CompletableFuture<String> importCsvAsync(String name, String csvData) {
    return CompletableFuture.supplyAsync(
        () -> getClient().databaseSchemas().importCsvAsync(name, csvData));
  }

  // Instance methods
  public org.openmetadata.schema.entity.data.DatabaseSchema save() {
    if (this.getId() != null) {
      return update(this.getId().toString(), this);
    } else {
      throw new IllegalStateException("Cannot save a database schema without an ID");
    }
  }

  public void delete() {
    if (this.getId() != null) {
      delete(this.getId().toString());
    } else {
      throw new IllegalStateException("Cannot delete a database schema without an ID");
    }
  }

  // Collection class with iterator support
  public static class DatabaseSchemaCollection {
    private final DatabaseSchemaService service;
    private final DatabaseSchemaListParams params;

    DatabaseSchemaCollection(DatabaseSchemaService service) {
      this(service, null);
    }

    DatabaseSchemaCollection(DatabaseSchemaService service, DatabaseSchemaListParams params) {
      this.service = service;
      this.params = params;
    }

    public Iterable<org.openmetadata.schema.entity.data.DatabaseSchema> autoPagingIterable() {
      return new Iterable<org.openmetadata.schema.entity.data.DatabaseSchema>() {
        @Override
        public Iterator<org.openmetadata.schema.entity.data.DatabaseSchema> iterator() {
          return new DatabaseSchemaIterator(service, params);
        }
      };
    }
  }

  // List params
  public static class DatabaseSchemaListParams {
    private Integer limit;
    private String before;
    private String after;
    private String fields;
    private String domain;
    private String database;

    public static Builder builder() {
      return new Builder();
    }

    public static class Builder {
      private DatabaseSchemaListParams params = new DatabaseSchemaListParams();

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

      public Builder database(String database) {
        params.database = database;
        return this;
      }

      public DatabaseSchemaListParams build() {
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
  private static class DatabaseSchemaIterator
      implements Iterator<org.openmetadata.schema.entity.data.DatabaseSchema> {
    private final DatabaseSchemaService service;
    private final DatabaseSchemaListParams params;
    private Iterator<org.openmetadata.schema.entity.data.DatabaseSchema> currentPage;
    private String nextPageToken;
    private boolean hasMore = true;

    DatabaseSchemaIterator(DatabaseSchemaService service, DatabaseSchemaListParams params) {
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
    public org.openmetadata.schema.entity.data.DatabaseSchema next() {
      if (!hasNext()) {
        throw new java.util.NoSuchElementException();
      }
      return (org.openmetadata.schema.entity.data.DatabaseSchema) currentPage.next();
    }
  }
}
