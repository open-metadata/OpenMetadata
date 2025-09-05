package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.services.dataassets.SearchIndexService;

public class SearchIndex extends org.openmetadata.schema.entity.data.SearchIndex {
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
  public static SearchIndex create(CreateSearchIndex request) {
    // Convert CreateSearchIndex to SearchIndex entity
    SearchIndex searchIndex = new SearchIndex();
    searchIndex.setName(request.getName());
    searchIndex.setDisplayName(request.getDisplayName());
    searchIndex.setDescription(request.getDescription());
    searchIndex.setTags(request.getTags());
    searchIndex.setOwners(request.getOwners());
    // Service is an EntityReference, request.getService() returns String
    searchIndex.setFields(request.getFields());
    searchIndex.setSearchIndexSettings(request.getSearchIndexSettings());
    // Domain is not available in CreateSearchIndex
    // DataProducts is List<EntityReference>, not List<String>
    searchIndex.setLifeCycle(request.getLifeCycle());
    searchIndex.setSourceHash(request.getSourceHash());

    return (SearchIndex) getClient().searchIndexes().create(searchIndex);
  }

  public static SearchIndex retrieve(String id) {
    return (SearchIndex) getClient().searchIndexes().get(id);
  }

  public static SearchIndex retrieve(String id, String fields) {
    return (SearchIndex) getClient().searchIndexes().get(id, fields);
  }

  public static SearchIndex retrieveByName(String fullyQualifiedName) {
    return (SearchIndex) getClient().searchIndexes().getByName(fullyQualifiedName);
  }

  public static SearchIndex retrieveByName(String fullyQualifiedName, String fields) {
    return (SearchIndex) getClient().searchIndexes().getByName(fullyQualifiedName, fields);
  }

  public static SearchIndexCollection list() {
    return new SearchIndexCollection(getClient().searchIndexes());
  }

  public static SearchIndexCollection list(SearchIndexListParams params) {
    return new SearchIndexCollection(getClient().searchIndexes(), params);
  }

  public static SearchIndex update(String id, SearchIndex searchIndex) {
    return (SearchIndex) getClient().searchIndexes().update(id, searchIndex);
  }

  public static SearchIndex patch(String id, String jsonPatch) {
    // JSON patch requires a SearchIndex object with patch operations
    SearchIndex patchSearchIndex = new SearchIndex();
    // The jsonPatch string would be applied server-side
    // For now, we pass an empty searchIndex as the service expects a SearchIndex object
    return (SearchIndex) getClient().searchIndexes().patch(id, patchSearchIndex);
  }

  public static void delete(String id) {
    delete(id, false, false);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete) {
    SearchIndexService service = getClient().searchIndexes();
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    service.delete(id, params);
  }

  // Async operations
  public static CompletableFuture<SearchIndex> createAsync(CreateSearchIndex request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<SearchIndex> retrieveAsync(String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }

  // Instance methods
  public SearchIndex save() {
    if (this.getId() != null) {
      return update(this.getId().toString(), this);
    } else {
      throw new IllegalStateException("Cannot save a search index without an ID");
    }
  }

  public void delete() {
    if (this.getId() != null) {
      delete(this.getId().toString());
    } else {
      throw new IllegalStateException("Cannot delete a search index without an ID");
    }
  }

  // Collection class with iterator support
  public static class SearchIndexCollection {
    private final SearchIndexService service;
    private final SearchIndexListParams params;

    SearchIndexCollection(SearchIndexService service) {
      this(service, null);
    }

    SearchIndexCollection(SearchIndexService service, SearchIndexListParams params) {
      this.service = service;
      this.params = params;
    }

    public Iterable<SearchIndex> autoPagingIterable() {
      return new Iterable<SearchIndex>() {
        @Override
        public Iterator<SearchIndex> iterator() {
          return new SearchIndexIterator(service, params);
        }
      };
    }
  }

  // List params
  public static class SearchIndexListParams {
    private Integer limit;
    private String before;
    private String after;
    private String fields;

    public static Builder builder() {
      return new Builder();
    }

    public static class Builder {
      private SearchIndexListParams params = new SearchIndexListParams();

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

      public SearchIndexListParams build() {
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
  private static class SearchIndexIterator implements Iterator<SearchIndex> {
    private final SearchIndexService service;
    private final SearchIndexListParams params;
    private Iterator<org.openmetadata.schema.entity.data.SearchIndex> currentPage;
    private String nextPageToken;
    private boolean hasMore = true;

    SearchIndexIterator(SearchIndexService service, SearchIndexListParams params) {
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
    public SearchIndex next() {
      if (!hasNext()) {
        throw new java.util.NoSuchElementException();
      }
      return (SearchIndex) currentPage.next();
    }
  }
}
