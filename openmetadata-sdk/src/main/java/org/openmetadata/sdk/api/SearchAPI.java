package org.openmetadata.sdk.api;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;

public class SearchAPI {

  public static class SearchResult {
    public List<Object> hits;
    public long totalHits;
    public Map<String, Object> aggregations;
  }

  public static class SearchParams {
    public String query;
    public String index;
    public List<String> filters;
    public int from;
    public int size;
    public List<String> sortBy;
    public boolean includeDeleted;

    public static SearchParams builder() {
      return new SearchParams();
    }

    public SearchParams withQuery(String query) {
      this.query = query;
      return this;
    }

    public SearchParams withIndex(String index) {
      this.index = index;
      return this;
    }

    public SearchParams withFilters(List<String> filters) {
      this.filters = filters;
      return this;
    }

    public SearchParams withPagination(int from, int size) {
      this.from = from;
      this.size = size;
      return this;
    }
  }

  public static String search(String query) throws OpenMetadataException {
    return OpenMetadata.client().search().search(query);
  }

  public static String search(String query, String index) throws OpenMetadataException {
    return OpenMetadata.client().search().search(query, index);
  }

  public static String searchAdvanced(
      String query, String index, Integer from, Integer size, String sortField, String sortOrder)
      throws OpenMetadataException {
    return OpenMetadata.client().search().search(query, index, from, size, sortField, sortOrder);
  }

  public static String suggest(String query) throws OpenMetadataException {
    return OpenMetadata.client().search().suggest(query);
  }

  public static String suggest(String query, String index, Integer size)
      throws OpenMetadataException {
    return OpenMetadata.client().search().suggest(query, index, size);
  }

  public static String aggregate(String query, String index, String field)
      throws OpenMetadataException {
    return OpenMetadata.client().search().aggregate(query, index, field);
  }

  public static CompletableFuture<String> searchAsync(String query) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            return search(query);
          } catch (OpenMetadataException e) {
            throw new RuntimeException(e);
          }
        });
  }

  public static CompletableFuture<String> suggestAsync(String query) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            return suggest(query);
          } catch (OpenMetadataException e) {
            throw new RuntimeException(e);
          }
        });
  }

  public static String searchAdvanced(Map<String, Object> searchRequest)
      throws OpenMetadataException {
    return OpenMetadata.client().search().searchAdvanced(searchRequest);
  }

  public static String reindex(String entityType) throws OpenMetadataException {
    return OpenMetadata.client().search().reindex(entityType);
  }

  public static String reindexAll() throws OpenMetadataException {
    return OpenMetadata.client().search().reindexAll();
  }
}
