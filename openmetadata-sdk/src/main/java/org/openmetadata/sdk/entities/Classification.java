package org.openmetadata.sdk.entities;

import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class Classification extends org.openmetadata.schema.entity.classification.Classification {

  // Static methods for CRUD operations
  public static Classification create(
      org.openmetadata.schema.entity.classification.Classification classification)
      throws OpenMetadataException {
    return (Classification) OpenMetadata.client().classifications().create(classification);
  }

  public static Classification retrieve(String id) throws OpenMetadataException {
    return (Classification) OpenMetadata.client().classifications().get(id);
  }

  public static Classification retrieve(String id, String fields) throws OpenMetadataException {
    return (Classification) OpenMetadata.client().classifications().get(id, fields);
  }

  public static Classification retrieve(UUID id) throws OpenMetadataException {
    return (Classification) OpenMetadata.client().classifications().get(id);
  }

  public static Classification retrieveByName(String name) throws OpenMetadataException {
    return (Classification) OpenMetadata.client().classifications().getByName(name);
  }

  public static Classification retrieveByName(String name, String fields)
      throws OpenMetadataException {
    return (Classification) OpenMetadata.client().classifications().getByName(name, fields);
  }

  public static ClassificationCollection list() throws OpenMetadataException {
    return new ClassificationCollection(OpenMetadata.client().classifications().list());
  }

  public static ClassificationCollection list(ListParams params) throws OpenMetadataException {
    return new ClassificationCollection(OpenMetadata.client().classifications().list(params));
  }

  public static void delete(String id) throws OpenMetadataException {
    OpenMetadata.client().classifications().delete(id);
  }

  public static void delete(UUID id) throws OpenMetadataException {
    OpenMetadata.client().classifications().delete(id);
  }

  // Async delete methods
  public static CompletableFuture<Void> deleteAsync(String id) {
    return OpenMetadata.client().classifications().deleteAsync(id);
  }

  public static CompletableFuture<Void> deleteAsync(UUID id) {
    return OpenMetadata.client().classifications().deleteAsync(id);
  }

  // Instance methods
  public Classification save() throws OpenMetadataException {
    if (this.getId() == null) {
      return (Classification) OpenMetadata.client().classifications().create(this);
    } else {
      return (Classification) OpenMetadata.client().classifications().update(this.getId(), this);
    }
  }

  public Classification update() throws OpenMetadataException {
    if (this.getId() == null) {
      throw new IllegalStateException("Cannot update a classification without an ID");
    }
    return (Classification) OpenMetadata.client().classifications().update(this.getId(), this);
  }

  public void delete() throws OpenMetadataException {
    if (this.getId() == null) {
      throw new IllegalStateException("Cannot delete a classification without an ID");
    }
    OpenMetadata.client().classifications().delete(this.getId());
  }

  // Static builder methods for list/retrieve params
  public static class ListBuilder {
    private final ListParams params = new ListParams();

    public ListBuilder fields(String fields) {
      params.setFields(fields);
      return this;
    }

    public ListBuilder limit(int limit) {
      params.setLimit(limit);
      return this;
    }

    public ListBuilder before(String before) {
      params.setBefore(before);
      return this;
    }

    public ListBuilder after(String after) {
      params.setAfter(after);
      return this;
    }

    public ListBuilder include(String include) {
      params.setInclude(include);
      return this;
    }

    public ClassificationCollection list() throws OpenMetadataException {
      return Classification.list(params);
    }
  }

  public static ListBuilder listBuilder() {
    return new ListBuilder();
  }

  // Collection class with auto-pagination
  public static class ClassificationCollection
      implements Iterable<org.openmetadata.schema.entity.classification.Classification> {
    private final ListResponse<org.openmetadata.schema.entity.classification.Classification>
        response;

    public ClassificationCollection(
        ListResponse<org.openmetadata.schema.entity.classification.Classification> response) {
      this.response = response;
    }

    public List<org.openmetadata.schema.entity.classification.Classification> getData() {
      return response.getData();
    }

    public boolean hasNextPage() {
      return response.hasNextPage();
    }

    public boolean hasPreviousPage() {
      return response.hasPreviousPage();
    }

    public int getTotal() {
      return response.getTotal();
    }

    public ClassificationCollection nextPage() throws OpenMetadataException {
      if (!hasNextPage()) {
        throw new IllegalStateException("No next page available");
      }
      ListParams params = new ListParams().setAfter(response.getPaging().getAfter());
      return Classification.list(params);
    }

    public ClassificationCollection previousPage() throws OpenMetadataException {
      if (!hasPreviousPage()) {
        throw new IllegalStateException("No previous page available");
      }
      ListParams params = new ListParams().setBefore(response.getPaging().getBefore());
      return Classification.list(params);
    }

    @Override
    public Iterator<org.openmetadata.schema.entity.classification.Classification> iterator() {
      return response.getData().iterator();
    }
  }
}
