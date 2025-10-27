package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.data.CreateStoredProcedure;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.services.databases.StoredProcedureService;

public class StoredProcedure extends org.openmetadata.schema.entity.data.StoredProcedure {
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
  public static StoredProcedure create(CreateStoredProcedure request) {
    // Convert CreateStoredProcedure to StoredProcedure entity
    StoredProcedure storedProcedure = new StoredProcedure();
    storedProcedure.setName(request.getName());
    storedProcedure.setDisplayName(request.getDisplayName());
    storedProcedure.setDescription(request.getDescription());
    storedProcedure.setTags(request.getTags());
    storedProcedure.setOwners(request.getOwners());
    // DatabaseSchema is EntityReference, request.getDatabaseSchema() returns String
    storedProcedure.setStoredProcedureCode(request.getStoredProcedureCode());
    storedProcedure.setSourceUrl(request.getSourceUrl());
    // Domain and DataProducts have type mismatches
    storedProcedure.setLifeCycle(request.getLifeCycle());
    storedProcedure.setSourceHash(request.getSourceHash());

    return (StoredProcedure) getClient().storedProcedures().create(storedProcedure);
  }

  public static StoredProcedure retrieve(String id) {
    return (StoredProcedure) getClient().storedProcedures().get(id);
  }

  public static StoredProcedure retrieve(String id, String fields) {
    return (StoredProcedure) getClient().storedProcedures().get(id, fields);
  }

  public static StoredProcedure retrieveByName(String fullyQualifiedName) {
    return (StoredProcedure) getClient().storedProcedures().getByName(fullyQualifiedName);
  }

  public static StoredProcedure retrieveByName(String fullyQualifiedName, String fields) {
    return (StoredProcedure) getClient().storedProcedures().getByName(fullyQualifiedName, fields);
  }

  public static StoredProcedureCollection list() {
    return new StoredProcedureCollection(getClient().storedProcedures());
  }

  public static StoredProcedureCollection list(StoredProcedureListParams params) {
    return new StoredProcedureCollection(getClient().storedProcedures(), params);
  }

  public static StoredProcedure update(String id, StoredProcedure storedProcedure) {
    return (StoredProcedure) getClient().storedProcedures().update(id, storedProcedure);
  }

  public static org.openmetadata.schema.entity.data.StoredProcedure patch(
      String id, String jsonPatch) {
    try {
      com.fasterxml.jackson.databind.ObjectMapper mapper =
          new com.fasterxml.jackson.databind.ObjectMapper();
      com.fasterxml.jackson.databind.JsonNode patchNode = mapper.readTree(jsonPatch);
      return getClient().storedProcedures().patch(id, patchNode);
    } catch (Exception e) {
      throw new org.openmetadata.sdk.exceptions.OpenMetadataException(
          "Failed to parse JSON patch: " + e.getMessage(), e);
    }
  }

  public static void delete(String id) {
    delete(id, false, false);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete) {
    StoredProcedureService service = getClient().storedProcedures();
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    service.delete(id, params);
  }

  // Async operations
  public static CompletableFuture<StoredProcedure> createAsync(CreateStoredProcedure request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<StoredProcedure> retrieveAsync(String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }

  // CSV operations
  public static String exportCsv(String name) {
    return getClient().storedProcedures().exportCsv(name);
  }

  public static CompletableFuture<String> exportCsvAsync(String name) {
    return CompletableFuture.supplyAsync(() -> exportCsv(name));
  }

  public static String importCsv(String name, String csvData, boolean dryRun) {
    return getClient().storedProcedures().importCsv(name, csvData, dryRun);
  }

  public static CompletableFuture<String> importCsvAsync(String name, String csvData) {
    return CompletableFuture.supplyAsync(
        () -> getClient().storedProcedures().importCsvAsync(name, csvData));
  }

  // Instance methods
  public StoredProcedure save() {
    if (this.getId() != null) {
      return update(this.getId().toString(), this);
    } else {
      throw new IllegalStateException("Cannot save a stored procedure without an ID");
    }
  }

  public void delete() {
    if (this.getId() != null) {
      delete(this.getId().toString());
    } else {
      throw new IllegalStateException("Cannot delete a stored procedure without an ID");
    }
  }

  // Collection class with iterator support
  public static class StoredProcedureCollection {
    private final StoredProcedureService service;
    private final StoredProcedureListParams params;

    StoredProcedureCollection(StoredProcedureService service) {
      this(service, null);
    }

    StoredProcedureCollection(StoredProcedureService service, StoredProcedureListParams params) {
      this.service = service;
      this.params = params;
    }

    public Iterable<StoredProcedure> autoPagingIterable() {
      return new Iterable<StoredProcedure>() {
        @Override
        public Iterator<StoredProcedure> iterator() {
          return new StoredProcedureIterator(service, params);
        }
      };
    }
  }

  // List params
  public static class StoredProcedureListParams {
    private Integer limit;
    private String before;
    private String after;
    private String fields;

    public static Builder builder() {
      return new Builder();
    }

    public static class Builder {
      private StoredProcedureListParams params = new StoredProcedureListParams();

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

      public StoredProcedureListParams build() {
        return params;
      }
    }

    public ListParams toListParams() {
      ListParams listParams = new ListParams();
      if (limit != null) listParams.setLimit(limit);
      if (before != null) listParams.setBefore(before);
      if (after != null) listParams.setAfter(after);
      if (fields != null) listParams.setFields(fields);
      return listParams;
    }
  }

  // Iterator for pagination
  private static class StoredProcedureIterator implements Iterator<StoredProcedure> {
    private final StoredProcedureService service;
    private final StoredProcedureListParams params;
    private Iterator<org.openmetadata.schema.entity.data.StoredProcedure> currentPage;
    private String nextPageToken;
    private boolean hasMore = true;

    StoredProcedureIterator(StoredProcedureService service, StoredProcedureListParams params) {
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
    public StoredProcedure next() {
      if (!hasNext()) {
        throw new java.util.NoSuchElementException();
      }
      return (StoredProcedure) currentPage.next();
    }
  }
}
