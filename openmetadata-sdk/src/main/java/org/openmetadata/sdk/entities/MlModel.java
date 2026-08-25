package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.services.dataassets.MlModelService;

public class MlModel extends org.openmetadata.schema.entity.data.MlModel {
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
  public static org.openmetadata.schema.entity.data.MlModel create(CreateMlModel request) {
    return getClient().mlModels().create(request);
  }

  public static org.openmetadata.schema.entity.data.MlModel retrieve(String id) {
    return (org.openmetadata.schema.entity.data.MlModel) getClient().mlModels().get(id);
  }

  public static org.openmetadata.schema.entity.data.MlModel retrieve(String id, String fields) {
    return (org.openmetadata.schema.entity.data.MlModel) getClient().mlModels().get(id, fields);
  }

  public static org.openmetadata.schema.entity.data.MlModel retrieveByName(
      String fullyQualifiedName) {
    return (org.openmetadata.schema.entity.data.MlModel)
        getClient().mlModels().getByName(fullyQualifiedName);
  }

  public static org.openmetadata.schema.entity.data.MlModel retrieveByName(
      String fullyQualifiedName, String fields) {
    return (org.openmetadata.schema.entity.data.MlModel)
        getClient().mlModels().getByName(fullyQualifiedName, fields);
  }

  public static MlModelCollection list() {
    return new MlModelCollection(getClient().mlModels());
  }

  public static MlModelCollection list(MlModelListParams params) {
    return new MlModelCollection(getClient().mlModels(), params);
  }

  public static org.openmetadata.schema.entity.data.MlModel update(
      String id, org.openmetadata.schema.entity.data.MlModel mlModel) {
    return (org.openmetadata.schema.entity.data.MlModel) getClient().mlModels().update(id, mlModel);
  }

  public static org.openmetadata.schema.entity.data.MlModel patch(String id, String jsonPatch) {
    try {
      com.fasterxml.jackson.databind.ObjectMapper mapper =
          new com.fasterxml.jackson.databind.ObjectMapper();
      com.fasterxml.jackson.databind.JsonNode patchNode = mapper.readTree(jsonPatch);
      return getClient().mlModels().patch(id, patchNode);
    } catch (Exception e) {
      throw new org.openmetadata.sdk.exceptions.OpenMetadataException(
          "Failed to parse JSON patch: " + e.getMessage(), e);
    }
  }

  public static void delete(String id) {
    delete(id, false, false);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete) {
    MlModelService service = getClient().mlModels();
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    service.delete(id, params);
  }

  // Async operations
  public static CompletableFuture<org.openmetadata.schema.entity.data.MlModel> createAsync(
      CreateMlModel request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<org.openmetadata.schema.entity.data.MlModel> retrieveAsync(
      String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }

  // Instance methods
  public org.openmetadata.schema.entity.data.MlModel save() {
    if (this.getId() != null) {
      return update(this.getId().toString(), this);
    } else {
      throw new IllegalStateException("Cannot save an ML model without an ID");
    }
  }

  public void delete() {
    if (this.getId() != null) {
      delete(this.getId().toString());
    } else {
      throw new IllegalStateException("Cannot delete an ML model without an ID");
    }
  }

  // Collection class with iterator support
  public static class MlModelCollection {
    private final MlModelService service;
    private final MlModelListParams params;

    MlModelCollection(MlModelService service) {
      this(service, null);
    }

    MlModelCollection(MlModelService service, MlModelListParams params) {
      this.service = service;
      this.params = params;
    }

    public Iterable<org.openmetadata.schema.entity.data.MlModel> autoPagingIterable() {
      return new Iterable<org.openmetadata.schema.entity.data.MlModel>() {
        @Override
        public Iterator<org.openmetadata.schema.entity.data.MlModel> iterator() {
          return new MlModelIterator(service, params);
        }
      };
    }
  }

  // List params
  public static class MlModelListParams {
    private Integer limit;
    private String before;
    private String after;
    private String fields;

    public static Builder builder() {
      return new Builder();
    }

    public static class Builder {
      private MlModelListParams params = new MlModelListParams();

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

      public MlModelListParams build() {
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
  private static class MlModelIterator
      implements Iterator<org.openmetadata.schema.entity.data.MlModel> {
    private final MlModelService service;
    private final MlModelListParams params;
    private Iterator<org.openmetadata.schema.entity.data.MlModel> currentPage;
    private String nextPageToken;
    private boolean hasMore = true;

    MlModelIterator(MlModelService service, MlModelListParams params) {
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
    public org.openmetadata.schema.entity.data.MlModel next() {
      if (!hasNext()) {
        throw new java.util.NoSuchElementException();
      }
      return (org.openmetadata.schema.entity.data.MlModel) currentPage.next();
    }
  }
}
