package org.openmetadata.sdk.api;

import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;

/**
 * Static fluent API for search operations.
 * Usage: Search.search("query")
 */
public class Search {
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

  // Basic search
  public static String search(String query) throws OpenMetadataException {
    return getClient().search().search(query);
  }

  public static String search(String query, String index) throws OpenMetadataException {
    return getClient().search().search(query, index);
  }

  public static String search(
      String query, String index, Integer from, Integer size, String sortField, String sortOrder)
      throws OpenMetadataException {
    return getClient().search().search(query, index, from, size, sortField, sortOrder);
  }

  // Suggest
  public static String suggest(String query) throws OpenMetadataException {
    return getClient().search().suggest(query);
  }

  public static String suggest(String query, String index) throws OpenMetadataException {
    return getClient().search().suggest(query, index, null);
  }

  public static String suggest(String query, String index, Integer size) 
      throws OpenMetadataException {
    return getClient().search().suggest(query, index, size);
  }

  // Aggregate
  public static String aggregate(String query) throws OpenMetadataException {
    return getClient().search().aggregate(query, null, null);
  }

  public static String aggregate(String query, String index) throws OpenMetadataException {
    return getClient().search().aggregate(query, index, null);
  }

  public static String aggregate(String query, String index, String field)
      throws OpenMetadataException {
    return getClient().search().aggregate(query, index, field);
  }

  // Advanced search with request body
  public static String searchAdvanced(Map<String, Object> searchRequest)
      throws OpenMetadataException {
    return getClient().search().searchAdvanced(searchRequest);
  }

  // Reindex operations
  public static String reindex(String entityType) throws OpenMetadataException {
    return getClient().search().reindex(entityType);
  }

  public static String reindexAll() throws OpenMetadataException {
    return getClient().search().reindexAll();
  }

  // Async operations
  public static CompletableFuture<String> searchAsync(String query) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return search(query);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  public static CompletableFuture<String> searchAsync(String query, String index) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return search(query, index);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  public static CompletableFuture<String> suggestAsync(String query) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return suggest(query);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  public static CompletableFuture<String> aggregateAsync(String query, String index, String field) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return aggregate(query, index, field);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  public static CompletableFuture<String> reindexAsync(String entityType) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return reindex(entityType);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  public static CompletableFuture<String> reindexAllAsync() {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return reindexAll();
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  // Builder for complex search queries
  public static SearchBuilder builder() {
    return new SearchBuilder();
  }

  public static class SearchBuilder {
    private String query;
    private String index;
    private Integer from;
    private Integer size;
    private String sortField;
    private String sortOrder;

    public SearchBuilder query(String query) {
      this.query = query;
      return this;
    }

    public SearchBuilder index(String index) {
      this.index = index;
      return this;
    }

    public SearchBuilder from(Integer from) {
      this.from = from;
      return this;
    }

    public SearchBuilder size(Integer size) {
      this.size = size;
      return this;
    }

    public SearchBuilder sortField(String sortField) {
      this.sortField = sortField;
      return this;
    }

    public SearchBuilder sortOrder(String sortOrder) {
      this.sortOrder = sortOrder;
      return this;
    }

    public String execute() throws OpenMetadataException {
      return Search.search(query, index, from, size, sortField, sortOrder);
    }

    public CompletableFuture<String> executeAsync() {
      return CompletableFuture.supplyAsync(() -> {
        try {
          return execute();
        } catch (OpenMetadataException e) {
          throw new RuntimeException(e);
        }
      });
    }
  }
}