package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.services.storages.ContainerService;

public class Container extends org.openmetadata.schema.entity.data.Container {
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
  public static org.openmetadata.schema.entity.data.Container create(CreateContainer request) {
    return getClient().containers().create(request);
  }

  public static org.openmetadata.schema.entity.data.Container retrieve(String id) {
    return (org.openmetadata.schema.entity.data.Container) getClient().containers().get(id);
  }

  public static org.openmetadata.schema.entity.data.Container retrieve(String id, String fields) {
    return (org.openmetadata.schema.entity.data.Container) getClient().containers().get(id, fields);
  }

  public static org.openmetadata.schema.entity.data.Container retrieveByName(
      String fullyQualifiedName) {
    return (org.openmetadata.schema.entity.data.Container)
        getClient().containers().getByName(fullyQualifiedName);
  }

  public static org.openmetadata.schema.entity.data.Container retrieveByName(
      String fullyQualifiedName, String fields) {
    return (org.openmetadata.schema.entity.data.Container)
        getClient().containers().getByName(fullyQualifiedName, fields);
  }

  public static ContainerCollection list() {
    return new ContainerCollection(getClient().containers());
  }

  public static ContainerCollection list(ContainerListParams params) {
    return new ContainerCollection(getClient().containers(), params);
  }

  public static org.openmetadata.schema.entity.data.Container update(
      String id, org.openmetadata.schema.entity.data.Container container) {
    return (org.openmetadata.schema.entity.data.Container)
        getClient().containers().update(id, container);
  }

  public static org.openmetadata.schema.entity.data.Container patch(String id, String jsonPatch) {
    try {
      com.fasterxml.jackson.databind.ObjectMapper mapper =
          new com.fasterxml.jackson.databind.ObjectMapper();
      com.fasterxml.jackson.databind.JsonNode patchNode = mapper.readTree(jsonPatch);
      return getClient().containers().patch(id, patchNode);
    } catch (Exception e) {
      throw new org.openmetadata.sdk.exceptions.OpenMetadataException(
          "Failed to parse JSON patch: " + e.getMessage(), e);
    }
  }

  public static void delete(String id) {
    delete(id, false, false);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete) {
    ContainerService service = getClient().containers();
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    service.delete(id, params);
  }

  // Async operations
  public static CompletableFuture<org.openmetadata.schema.entity.data.Container> createAsync(
      CreateContainer request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<org.openmetadata.schema.entity.data.Container> retrieveAsync(
      String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }

  // Instance methods
  public org.openmetadata.schema.entity.data.Container save() {
    if (this.getId() != null) {
      return update(this.getId().toString(), this);
    } else {
      throw new IllegalStateException("Cannot save a container without an ID");
    }
  }

  public void delete() {
    if (this.getId() != null) {
      delete(this.getId().toString());
    } else {
      throw new IllegalStateException("Cannot delete a container without an ID");
    }
  }

  // Collection class with iterator support
  public static class ContainerCollection {
    private final ContainerService service;
    private final ContainerListParams params;

    ContainerCollection(ContainerService service) {
      this(service, null);
    }

    ContainerCollection(ContainerService service, ContainerListParams params) {
      this.service = service;
      this.params = params;
    }

    public Iterable<org.openmetadata.schema.entity.data.Container> autoPagingIterable() {
      return new Iterable<org.openmetadata.schema.entity.data.Container>() {
        @Override
        public Iterator<org.openmetadata.schema.entity.data.Container> iterator() {
          return new ContainerIterator(service, params);
        }
      };
    }
  }

  // List params
  public static class ContainerListParams {
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
      private ContainerListParams params = new ContainerListParams();

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

      public ContainerListParams build() {
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
  private static class ContainerIterator
      implements Iterator<org.openmetadata.schema.entity.data.Container> {
    private final ContainerService service;
    private final ContainerListParams params;
    private Iterator<org.openmetadata.schema.entity.data.Container> currentPage;
    private String nextPageToken;
    private boolean hasMore = true;

    ContainerIterator(ContainerService service, ContainerListParams params) {
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
    public org.openmetadata.schema.entity.data.Container next() {
      if (!hasNext()) {
        throw new java.util.NoSuchElementException();
      }
      return (org.openmetadata.schema.entity.data.Container) currentPage.next();
    }
  }
}
