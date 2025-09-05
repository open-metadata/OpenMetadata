package org.openmetadata.sdk.entities;

import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class Tag extends org.openmetadata.schema.entity.classification.Tag {

  // Static methods for CRUD operations
  public static Tag create(org.openmetadata.schema.entity.classification.Tag tag)
      throws OpenMetadataException {
    return (Tag) OpenMetadata.client().tags().create(tag);
  }

  public static Tag retrieve(String id) throws OpenMetadataException {
    return (Tag) OpenMetadata.client().tags().get(id);
  }

  public static Tag retrieve(String id, String fields) throws OpenMetadataException {
    return (Tag) OpenMetadata.client().tags().get(id, fields);
  }

  public static Tag retrieve(UUID id) throws OpenMetadataException {
    return (Tag) OpenMetadata.client().tags().get(id);
  }

  public static Tag retrieveByName(String name) throws OpenMetadataException {
    return (Tag) OpenMetadata.client().tags().getByName(name);
  }

  public static Tag retrieveByName(String name, String fields) throws OpenMetadataException {
    return (Tag) OpenMetadata.client().tags().getByName(name, fields);
  }

  public static TagCollection list() throws OpenMetadataException {
    return new TagCollection(OpenMetadata.client().tags().list());
  }

  public static TagCollection list(ListParams params) throws OpenMetadataException {
    return new TagCollection(OpenMetadata.client().tags().list(params));
  }

  public static void delete(String id) throws OpenMetadataException {
    OpenMetadata.client().tags().delete(id);
  }

  public static void delete(UUID id) throws OpenMetadataException {
    OpenMetadata.client().tags().delete(id);
  }

  // Async delete methods
  public static CompletableFuture<Void> deleteAsync(String id) {
    return OpenMetadata.client().tags().deleteAsync(id);
  }

  public static CompletableFuture<Void> deleteAsync(UUID id) {
    return OpenMetadata.client().tags().deleteAsync(id);
  }

  // Instance methods
  public Tag save() throws OpenMetadataException {
    if (this.getId() == null) {
      return (Tag) OpenMetadata.client().tags().create(this);
    } else {
      return (Tag) OpenMetadata.client().tags().update(this.getId(), this);
    }
  }

  public Tag update() throws OpenMetadataException {
    if (this.getId() == null) {
      throw new IllegalStateException("Cannot update a tag without an ID");
    }
    return (Tag) OpenMetadata.client().tags().update(this.getId(), this);
  }

  public void delete() throws OpenMetadataException {
    if (this.getId() == null) {
      throw new IllegalStateException("Cannot delete a tag without an ID");
    }
    OpenMetadata.client().tags().delete(this.getId());
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

    public TagCollection list() throws OpenMetadataException {
      return Tag.list(params);
    }
  }

  public static ListBuilder listBuilder() {
    return new ListBuilder();
  }

  // Collection class with auto-pagination
  public static class TagCollection
      implements Iterable<org.openmetadata.schema.entity.classification.Tag> {
    private final ListResponse<org.openmetadata.schema.entity.classification.Tag> response;

    public TagCollection(ListResponse<org.openmetadata.schema.entity.classification.Tag> response) {
      this.response = response;
    }

    public List<org.openmetadata.schema.entity.classification.Tag> getData() {
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

    public TagCollection nextPage() throws OpenMetadataException {
      if (!hasNextPage()) {
        throw new IllegalStateException("No next page available");
      }
      ListParams params = new ListParams().setAfter(response.getPaging().getAfter());
      return Tag.list(params);
    }

    public TagCollection previousPage() throws OpenMetadataException {
      if (!hasPreviousPage()) {
        throw new IllegalStateException("No previous page available");
      }
      ListParams params = new ListParams().setBefore(response.getPaging().getBefore());
      return Tag.list(params);
    }

    @Override
    public Iterator<org.openmetadata.schema.entity.classification.Tag> iterator() {
      return response.getData().iterator();
    }
  }
}
