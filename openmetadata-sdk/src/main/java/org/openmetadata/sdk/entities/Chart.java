package org.openmetadata.sdk.entities;

import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class Chart extends org.openmetadata.schema.entity.data.Chart {

  // Static methods for CRUD operations
  public static Chart create(org.openmetadata.schema.entity.data.Chart chart)
      throws OpenMetadataException {
    return (Chart) OpenMetadata.client().charts().create(chart);
  }

  public static Chart retrieve(String id) throws OpenMetadataException {
    return (Chart) OpenMetadata.client().charts().get(id);
  }

  public static Chart retrieve(String id, String fields) throws OpenMetadataException {
    return (Chart) OpenMetadata.client().charts().get(id, fields);
  }

  public static Chart retrieve(UUID id) throws OpenMetadataException {
    return (Chart) OpenMetadata.client().charts().get(id);
  }

  public static Chart retrieveByName(String name) throws OpenMetadataException {
    return (Chart) OpenMetadata.client().charts().getByName(name);
  }

  public static Chart retrieveByName(String name, String fields) throws OpenMetadataException {
    return (Chart) OpenMetadata.client().charts().getByName(name, fields);
  }

  public static ChartCollection list() throws OpenMetadataException {
    return new ChartCollection(OpenMetadata.client().charts().list());
  }

  public static ChartCollection list(ListParams params) throws OpenMetadataException {
    return new ChartCollection(OpenMetadata.client().charts().list(params));
  }

  public static void delete(String id) throws OpenMetadataException {
    OpenMetadata.client().charts().delete(id);
  }

  public static void delete(UUID id) throws OpenMetadataException {
    OpenMetadata.client().charts().delete(id);
  }

  // Async delete methods
  public static CompletableFuture<Void> deleteAsync(String id) {
    return OpenMetadata.client().charts().deleteAsync(id);
  }

  public static CompletableFuture<Void> deleteAsync(UUID id) {
    return OpenMetadata.client().charts().deleteAsync(id);
  }

  // Export/Import methods
  public static String exportCsv() throws OpenMetadataException {
    return OpenMetadata.client().charts().exportCsv();
  }

  public static String exportCsv(String name) throws OpenMetadataException {
    return OpenMetadata.client().charts().exportCsv(name);
  }

  public static String importCsv(String csvData) throws OpenMetadataException {
    return OpenMetadata.client().charts().importCsv(csvData);
  }

  public static String importCsv(String csvData, boolean dryRun) throws OpenMetadataException {
    return OpenMetadata.client().charts().importCsv(csvData, dryRun);
  }

  // Instance methods
  public Chart save() throws OpenMetadataException {
    if (this.getId() == null) {
      return (Chart) OpenMetadata.client().charts().create(this);
    } else {
      return (Chart) OpenMetadata.client().charts().update(this.getId(), this);
    }
  }

  public Chart update() throws OpenMetadataException {
    if (this.getId() == null) {
      throw new IllegalStateException("Cannot update a chart without an ID");
    }
    return (Chart) OpenMetadata.client().charts().update(this.getId(), this);
  }

  public void delete() throws OpenMetadataException {
    if (this.getId() == null) {
      throw new IllegalStateException("Cannot delete a chart without an ID");
    }
    OpenMetadata.client().charts().delete(this.getId());
  }

  // Fluent API methods
  public Chart addTags(List<org.openmetadata.schema.type.TagLabel> tags) {
    if (this.getTags() == null) {
      this.setTags(tags);
    } else {
      this.getTags().addAll(tags);
    }
    return this;
  }

  public Chart setOwner(org.openmetadata.schema.type.EntityReference owner) {
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
      params.setInclude(include);
      return this;
    }

    public ChartCollection list() throws OpenMetadataException {
      return Chart.list(params);
    }
  }

  public static ListBuilder listBuilder() {
    return new ListBuilder();
  }

  // Collection class with auto-pagination
  public static class ChartCollection
      implements Iterable<org.openmetadata.schema.entity.data.Chart> {
    private final ListResponse<org.openmetadata.schema.entity.data.Chart> response;

    public ChartCollection(ListResponse<org.openmetadata.schema.entity.data.Chart> response) {
      this.response = response;
    }

    public List<org.openmetadata.schema.entity.data.Chart> getData() {
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

    public ChartCollection nextPage() throws OpenMetadataException {
      if (!hasNextPage()) {
        throw new IllegalStateException("No next page available");
      }
      ListParams params = new ListParams().setAfter(response.getPaging().getAfter());
      return Chart.list(params);
    }

    public ChartCollection previousPage() throws OpenMetadataException {
      if (!hasPreviousPage()) {
        throw new IllegalStateException("No previous page available");
      }
      ListParams params = new ListParams().setBefore(response.getPaging().getBefore());
      return Chart.list(params);
    }

    @Override
    public Iterator<org.openmetadata.schema.entity.data.Chart> iterator() {
      return response.getData().iterator();
    }
  }
}
