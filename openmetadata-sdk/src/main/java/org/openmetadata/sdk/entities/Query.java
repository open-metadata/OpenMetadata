package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.services.dataassets.QueryService;

public class Query extends org.openmetadata.schema.entity.data.Query {
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
  public static org.openmetadata.schema.entity.data.Query create(CreateQuery request) {
    return getClient().queries().create(request);
  }

  public static org.openmetadata.schema.entity.data.Query retrieve(String id) {
    return (org.openmetadata.schema.entity.data.Query) getClient().queries().get(id);
  }

  public static org.openmetadata.schema.entity.data.Query retrieve(String id, String fields) {
    return (org.openmetadata.schema.entity.data.Query) getClient().queries().get(id, fields);
  }

  public static org.openmetadata.schema.entity.data.Query retrieveByName(
      String fullyQualifiedName) {
    return (org.openmetadata.schema.entity.data.Query)
        getClient().queries().getByName(fullyQualifiedName);
  }

  public static org.openmetadata.schema.entity.data.Query retrieveByName(
      String fullyQualifiedName, String fields) {
    return (org.openmetadata.schema.entity.data.Query)
        getClient().queries().getByName(fullyQualifiedName, fields);
  }

  public static QueryCollection list() {
    return new QueryCollection(getClient().queries());
  }

  public static QueryCollection list(QueryListParams params) {
    return new QueryCollection(getClient().queries(), params);
  }

  public static org.openmetadata.schema.entity.data.Query update(
      String id, org.openmetadata.schema.entity.data.Query query) {
    return (org.openmetadata.schema.entity.data.Query) getClient().queries().update(id, query);
  }

  public static org.openmetadata.schema.entity.data.Query patch(String id, String jsonPatch) {
    try {
      com.fasterxml.jackson.databind.ObjectMapper mapper =
          new com.fasterxml.jackson.databind.ObjectMapper();
      com.fasterxml.jackson.databind.JsonNode patchNode = mapper.readTree(jsonPatch);
      return getClient().queries().patch(id, patchNode);
    } catch (Exception e) {
      throw new org.openmetadata.sdk.exceptions.OpenMetadataException(
          "Failed to parse JSON patch: " + e.getMessage(), e);
    }
  }

  public static void delete(String id) {
    delete(id, false, false);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete) {
    QueryService service = getClient().queries();
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    service.delete(id, params);
  }

  // Async operations
  public static CompletableFuture<org.openmetadata.schema.entity.data.Query> createAsync(
      CreateQuery request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<org.openmetadata.schema.entity.data.Query> retrieveAsync(
      String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }

  // Instance methods
  public org.openmetadata.schema.entity.data.Query save() {
    if (this.getId() != null) {
      return update(this.getId().toString(), this);
    } else {
      throw new IllegalStateException("Cannot save a query without an ID");
    }
  }

  public void delete() {
    if (this.getId() != null) {
      delete(this.getId().toString());
    } else {
      throw new IllegalStateException("Cannot delete a query without an ID");
    }
  }

  // Collection class with iterator support
  public static class QueryCollection {
    private final QueryService service;
    private final QueryListParams params;

    QueryCollection(QueryService service) {
      this(service, null);
    }

    QueryCollection(QueryService service, QueryListParams params) {
      this.service = service;
      this.params = params;
    }

    public Iterable<org.openmetadata.schema.entity.data.Query> autoPagingIterable() {
      return new Iterable<org.openmetadata.schema.entity.data.Query>() {
        @Override
        public Iterator<org.openmetadata.schema.entity.data.Query> iterator() {
          return new QueryIterator(service, params);
        }
      };
    }
  }

  // List params
  public static class QueryListParams {
    private Integer limit;
    private String before;
    private String after;
    private String fields;

    public static Builder builder() {
      return new Builder();
    }

    public static class Builder {
      private QueryListParams params = new QueryListParams();

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

      public QueryListParams build() {
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
  private static class QueryIterator
      implements Iterator<org.openmetadata.schema.entity.data.Query> {
    private final QueryService service;
    private final QueryListParams params;
    private Iterator<org.openmetadata.schema.entity.data.Query> currentPage;
    private String nextPageToken;
    private boolean hasMore = true;

    QueryIterator(QueryService service, QueryListParams params) {
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
    public org.openmetadata.schema.entity.data.Query next() {
      if (!hasNext()) {
        throw new java.util.NoSuchElementException();
      }
      return (org.openmetadata.schema.entity.data.Query) currentPage.next();
    }
  }
}
