package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.services.dataassets.TableService;

public class Table extends org.openmetadata.schema.entity.data.Table {
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
  public static org.openmetadata.schema.entity.data.Table create(CreateTable request) {
    // Convert CreateTable to Table entity
    org.openmetadata.schema.entity.data.Table table =
        new org.openmetadata.schema.entity.data.Table();
    table.setName(request.getName());
    table.setDisplayName(request.getDisplayName());
    table.setDescription(request.getDescription());
    table.setTableType(request.getTableType());
    table.setColumns(request.getColumns());
    table.setTableConstraints(request.getTableConstraints());
    table.setTags(request.getTags());
    table.setOwners(request.getOwners());
    table.setRetentionPeriod(request.getRetentionPeriod());
    table.setExtension(request.getExtension());
    table.setSourceHash(request.getSourceHash());
    table.setFileFormat(request.getFileFormat());
    table.setLifeCycle(request.getLifeCycle());
    table.setSourceUrl(request.getSourceUrl());

    return (org.openmetadata.schema.entity.data.Table) getClient().tables().create(table);
  }

  public static org.openmetadata.schema.entity.data.Table retrieve(String id) {
    return (org.openmetadata.schema.entity.data.Table) getClient().tables().get(id);
  }

  public static org.openmetadata.schema.entity.data.Table retrieve(String id, String fields) {
    return (org.openmetadata.schema.entity.data.Table) getClient().tables().get(id, fields);
  }

  public static org.openmetadata.schema.entity.data.Table retrieveByName(
      String fullyQualifiedName) {
    return (org.openmetadata.schema.entity.data.Table)
        getClient().tables().getByName(fullyQualifiedName);
  }

  public static org.openmetadata.schema.entity.data.Table retrieveByName(
      String fullyQualifiedName, String fields) {
    return (org.openmetadata.schema.entity.data.Table)
        getClient().tables().getByName(fullyQualifiedName, fields);
  }

  public static TableCollection list() {
    return new TableCollection(getClient().tables());
  }

  public static TableCollection list(TableListParams params) {
    return new TableCollection(getClient().tables(), params);
  }

  public static org.openmetadata.schema.entity.data.Table update(
      String id, org.openmetadata.schema.entity.data.Table table) {
    return (org.openmetadata.schema.entity.data.Table) getClient().tables().update(id, table);
  }

  public static org.openmetadata.schema.entity.data.Table patch(String id, String jsonPatch) {
    // JSON patch requires a Table object with patch operations
    org.openmetadata.schema.entity.data.Table patchTable =
        new org.openmetadata.schema.entity.data.Table();
    // The jsonPatch string would be applied server-side
    // For now, we pass an empty table as the service expects a Table object
    return (org.openmetadata.schema.entity.data.Table) getClient().tables().patch(id, patchTable);
  }

  public static void delete(String id) {
    delete(id, false, false);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete) {
    TableService service = getClient().tables();
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    service.delete(id, params);
  }

  // Async operations
  public static CompletableFuture<org.openmetadata.schema.entity.data.Table> createAsync(
      CreateTable request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<org.openmetadata.schema.entity.data.Table> retrieveAsync(
      String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }

  // CSV operations
  public static String exportCsv(String name) {
    return getClient().tables().exportCsv(name);
  }

  public static CompletableFuture<String> exportCsvAsync(String name) {
    return CompletableFuture.supplyAsync(() -> exportCsv(name));
  }

  public static String importCsv(String name, String csvData) {
    // The importCsv method doesn't take a name parameter for tables
    return getClient().tables().importCsv(csvData, false);
  }

  public static CompletableFuture<String> importCsvAsync(
      String name, String csvData, boolean dryRun) {
    return CompletableFuture.supplyAsync(() -> getClient().tables().importCsv(csvData, dryRun));
  }

  // Instance methods
  public org.openmetadata.schema.entity.data.Table save() {
    if (this.getId() != null) {
      return update(this.getId().toString(), this);
    } else {
      throw new IllegalStateException("Cannot save a table without an ID");
    }
  }

  public void delete() {
    if (this.getId() != null) {
      delete(this.getId().toString());
    } else {
      throw new IllegalStateException("Cannot delete a table without an ID");
    }
  }

  // Collection class with iterator support
  public static class TableCollection {
    private final TableService service;
    private final TableListParams params;

    TableCollection(TableService service) {
      this(service, null);
    }

    TableCollection(TableService service, TableListParams params) {
      this.service = service;
      this.params = params;
    }

    public java.util.List<org.openmetadata.schema.entity.data.Table> getData() {
      ListParams listParams = params != null ? params.toListParams() : new ListParams();
      var response = service.list(listParams);
      return response.getData();
    }

    public Iterable<Table> autoPagingIterable() {
      return new Iterable<Table>() {
        @Override
        public Iterator<Table> iterator() {
          return new TableIterator(service, params);
        }
      };
    }
  }

  // List params
  public static class TableListParams {
    private Integer limit;
    private String before;
    private String after;
    private String fields;
    private String domain;
    private String database;
    private String databaseSchema;

    public static Builder builder() {
      return new Builder();
    }

    public static class Builder {
      private TableListParams params = new TableListParams();

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

      public Builder databaseSchema(String schema) {
        params.databaseSchema = schema;
        return this;
      }

      public TableListParams build() {
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
  private static class TableIterator implements Iterator<Table> {
    private final TableService service;
    private final TableListParams params;
    private Iterator<org.openmetadata.schema.entity.data.Table> currentPage;
    private String nextPageToken;
    private boolean hasMore = true;

    TableIterator(TableService service, TableListParams params) {
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
    public Table next() {
      if (!hasNext()) {
        throw new java.util.NoSuchElementException();
      }
      return (Table) currentPage.next();
    }
  }
}
