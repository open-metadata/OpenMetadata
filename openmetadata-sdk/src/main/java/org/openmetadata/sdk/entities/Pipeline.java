package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.services.dataassets.PipelineService;

public class Pipeline extends org.openmetadata.schema.entity.data.Pipeline {
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
  public static org.openmetadata.schema.entity.data.Pipeline create(CreatePipeline request) {
    return getClient().pipelines().create(request);
  }

  public static org.openmetadata.schema.entity.data.Pipeline retrieve(String id) {
    return (org.openmetadata.schema.entity.data.Pipeline) getClient().pipelines().get(id);
  }

  public static org.openmetadata.schema.entity.data.Pipeline retrieve(String id, String fields) {
    return (org.openmetadata.schema.entity.data.Pipeline) getClient().pipelines().get(id, fields);
  }

  public static org.openmetadata.schema.entity.data.Pipeline retrieveByName(
      String fullyQualifiedName) {
    return (org.openmetadata.schema.entity.data.Pipeline)
        getClient().pipelines().getByName(fullyQualifiedName);
  }

  public static org.openmetadata.schema.entity.data.Pipeline retrieveByName(
      String fullyQualifiedName, String fields) {
    return (org.openmetadata.schema.entity.data.Pipeline)
        getClient().pipelines().getByName(fullyQualifiedName, fields);
  }

  public static PipelineCollection list() {
    return new PipelineCollection(getClient().pipelines());
  }

  public static PipelineCollection list(PipelineListParams params) {
    return new PipelineCollection(getClient().pipelines(), params);
  }

  public static org.openmetadata.schema.entity.data.Pipeline update(
      String id, org.openmetadata.schema.entity.data.Pipeline pipeline) {
    return (org.openmetadata.schema.entity.data.Pipeline)
        getClient().pipelines().update(id, pipeline);
  }

  public static org.openmetadata.schema.entity.data.Pipeline patch(String id, String jsonPatch) {
    try {
      com.fasterxml.jackson.databind.ObjectMapper mapper =
          new com.fasterxml.jackson.databind.ObjectMapper();
      com.fasterxml.jackson.databind.JsonNode patchNode = mapper.readTree(jsonPatch);
      return getClient().pipelines().patch(id, patchNode);
    } catch (Exception e) {
      throw new org.openmetadata.sdk.exceptions.OpenMetadataException(
          "Failed to parse JSON patch: " + e.getMessage(), e);
    }
  }

  public static void delete(String id) {
    delete(id, false, false);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete) {
    PipelineService service = getClient().pipelines();
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    service.delete(id, params);
  }

  // Async operations
  public static CompletableFuture<org.openmetadata.schema.entity.data.Pipeline> createAsync(
      CreatePipeline request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<org.openmetadata.schema.entity.data.Pipeline> retrieveAsync(
      String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }

  // Instance methods
  public org.openmetadata.schema.entity.data.Pipeline save() {
    if (this.getId() != null) {
      return update(this.getId().toString(), this);
    } else {
      throw new IllegalStateException("Cannot save a pipeline without an ID");
    }
  }

  public void delete() {
    if (this.getId() != null) {
      delete(this.getId().toString());
    } else {
      throw new IllegalStateException("Cannot delete a pipeline without an ID");
    }
  }

  // Collection class with iterator support
  public static class PipelineCollection {
    private final PipelineService service;
    private final PipelineListParams params;

    PipelineCollection(PipelineService service) {
      this(service, null);
    }

    PipelineCollection(PipelineService service, PipelineListParams params) {
      this.service = service;
      this.params = params;
    }

    public Iterable<org.openmetadata.schema.entity.data.Pipeline> autoPagingIterable() {
      return new Iterable<org.openmetadata.schema.entity.data.Pipeline>() {
        @Override
        public Iterator<org.openmetadata.schema.entity.data.Pipeline> iterator() {
          return new PipelineIterator(service, params);
        }
      };
    }
  }

  // List params
  public static class PipelineListParams {
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
      private PipelineListParams params = new PipelineListParams();

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

      public PipelineListParams build() {
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
  private static class PipelineIterator
      implements Iterator<org.openmetadata.schema.entity.data.Pipeline> {
    private final PipelineService service;
    private final PipelineListParams params;
    private Iterator<org.openmetadata.schema.entity.data.Pipeline> currentPage;
    private String nextPageToken;
    private boolean hasMore = true;

    PipelineIterator(PipelineService service, PipelineListParams params) {
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
    public org.openmetadata.schema.entity.data.Pipeline next() {
      if (!hasNext()) {
        throw new java.util.NoSuchElementException();
      }
      return (org.openmetadata.schema.entity.data.Pipeline) currentPage.next();
    }
  }
}
