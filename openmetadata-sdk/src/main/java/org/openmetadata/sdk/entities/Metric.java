package org.openmetadata.sdk.entities;

import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class Metric extends org.openmetadata.schema.entity.data.Metric {

  // Static methods for CRUD operations
  public static Metric create(org.openmetadata.schema.entity.data.Metric metric)
      throws OpenMetadataException {
    return (Metric) OpenMetadata.client().metrics().create(metric);
  }

  public static Metric retrieve(String id) throws OpenMetadataException {
    return (Metric) OpenMetadata.client().metrics().get(id);
  }

  public static Metric retrieve(String id, String fields) throws OpenMetadataException {
    return (Metric) OpenMetadata.client().metrics().get(id, fields);
  }

  public static Metric retrieve(UUID id) throws OpenMetadataException {
    return (Metric) OpenMetadata.client().metrics().get(id);
  }

  public static Metric retrieveByName(String name) throws OpenMetadataException {
    return (Metric) OpenMetadata.client().metrics().getByName(name);
  }

  public static Metric retrieveByName(String name, String fields) throws OpenMetadataException {
    return (Metric) OpenMetadata.client().metrics().getByName(name, fields);
  }

  public static MetricCollection list() throws OpenMetadataException {
    return new MetricCollection(OpenMetadata.client().metrics().list());
  }

  public static MetricCollection list(ListParams params) throws OpenMetadataException {
    return new MetricCollection(OpenMetadata.client().metrics().list(params));
  }

  public static void delete(String id) throws OpenMetadataException {
    OpenMetadata.client().metrics().delete(id);
  }

  public static void delete(UUID id) throws OpenMetadataException {
    OpenMetadata.client().metrics().delete(id);
  }

  // Async delete methods
  public static CompletableFuture<Void> deleteAsync(String id) {
    return OpenMetadata.client().metrics().deleteAsync(id);
  }

  public static CompletableFuture<Void> deleteAsync(UUID id) {
    return OpenMetadata.client().metrics().deleteAsync(id);
  }

  // Export/Import methods
  public static String exportCsv(String name) throws OpenMetadataException {
    return OpenMetadata.client().metrics().exportCsv(name);
  }

  public static String importCsv(String name, String csvData) throws OpenMetadataException {
    return OpenMetadata.client().metrics().importCsv(name, csvData);
  }

  public static String importCsv(String name, String csvData, boolean dryRun)
      throws OpenMetadataException {
    return OpenMetadata.client().metrics().importCsv(name, csvData, dryRun);
  }

  // Instance methods
  public Metric save() throws OpenMetadataException {
    if (this.getId() == null) {
      return (Metric) OpenMetadata.client().metrics().create(this);
    } else {
      return (Metric) OpenMetadata.client().metrics().update(this.getId(), this);
    }
  }

  public Metric update() throws OpenMetadataException {
    if (this.getId() == null) {
      throw new IllegalStateException("Cannot update a metric without an ID");
    }
    return (Metric) OpenMetadata.client().metrics().update(this.getId(), this);
  }

  public void delete() throws OpenMetadataException {
    if (this.getId() == null) {
      throw new IllegalStateException("Cannot delete a metric without an ID");
    }
    OpenMetadata.client().metrics().delete(this.getId());
  }

  // Fluent API methods
  public Metric addTags(List<org.openmetadata.schema.type.TagLabel> tags) {
    if (this.getTags() == null) {
      this.setTags(tags);
    } else {
      this.getTags().addAll(tags);
    }
    return this;
  }

  public Metric setOwner(org.openmetadata.schema.type.EntityReference owner) {
    this.setOwner(owner);
    return this;
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
      params.setFields(include);
      return this;
    }

    public MetricCollection list() throws OpenMetadataException {
      return Metric.list(params);
    }
  }

  public static ListBuilder listBuilder() {
    return new ListBuilder();
  }

  // Collection class with auto-pagination
  public static class MetricCollection
      implements Iterable<org.openmetadata.schema.entity.data.Metric> {
    private final ListResponse<org.openmetadata.schema.entity.data.Metric> response;

    public MetricCollection(ListResponse<org.openmetadata.schema.entity.data.Metric> response) {
      this.response = response;
    }

    public List<org.openmetadata.schema.entity.data.Metric> getData() {
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

    public MetricCollection nextPage() throws OpenMetadataException {
      if (!hasNextPage()) {
        throw new IllegalStateException("No next page available");
      }
      ListParams params = new ListParams().setAfter(response.getPaging().getAfter());
      return Metric.list(params);
    }

    public MetricCollection previousPage() throws OpenMetadataException {
      if (!hasPreviousPage()) {
        throw new IllegalStateException("No previous page available");
      }
      ListParams params = new ListParams().setBefore(response.getPaging().getBefore());
      return Metric.list(params);
    }

    @Override
    public Iterator<org.openmetadata.schema.entity.data.Metric> iterator() {
      return response.getData().iterator();
    }
  }
}
