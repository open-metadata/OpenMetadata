package org.openmetadata.sdk.entities;

import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class Report extends org.openmetadata.schema.entity.data.Report {

  // Static methods for CRUD operations
  public static Report create(org.openmetadata.schema.entity.data.Report report)
      throws OpenMetadataException {
    return (Report) OpenMetadata.client().reports().create(report);
  }

  public static Report retrieve(String id) throws OpenMetadataException {
    return (Report) OpenMetadata.client().reports().get(id);
  }

  public static Report retrieve(String id, String fields) throws OpenMetadataException {
    return (Report) OpenMetadata.client().reports().get(id, fields);
  }

  public static Report retrieve(UUID id) throws OpenMetadataException {
    return (Report) OpenMetadata.client().reports().get(id);
  }

  public static Report retrieveByName(String name) throws OpenMetadataException {
    return (Report) OpenMetadata.client().reports().getByName(name);
  }

  public static Report retrieveByName(String name, String fields) throws OpenMetadataException {
    return (Report) OpenMetadata.client().reports().getByName(name, fields);
  }

  public static ReportCollection list() throws OpenMetadataException {
    return new ReportCollection(OpenMetadata.client().reports().list());
  }

  public static ReportCollection list(ListParams params) throws OpenMetadataException {
    return new ReportCollection(OpenMetadata.client().reports().list(params));
  }

  public static void delete(String id) throws OpenMetadataException {
    OpenMetadata.client().reports().delete(id);
  }

  public static void delete(UUID id) throws OpenMetadataException {
    OpenMetadata.client().reports().delete(id);
  }

  // Async delete methods
  public static CompletableFuture<Void> deleteAsync(String id) {
    return OpenMetadata.client().reports().deleteAsync(id);
  }

  public static CompletableFuture<Void> deleteAsync(UUID id) {
    return OpenMetadata.client().reports().deleteAsync(id);
  }

  // Export/Import methods
  public static String exportCsv(String name) throws OpenMetadataException {
    return OpenMetadata.client().reports().exportCsv(name);
  }

  public static String importCsv(String name, String csvData) throws OpenMetadataException {
    return OpenMetadata.client().reports().importCsv(name, csvData);
  }

  public static String importCsv(String name, String csvData, boolean dryRun)
      throws OpenMetadataException {
    return OpenMetadata.client().reports().importCsv(name, csvData, dryRun);
  }

  // Instance methods
  public Report save() throws OpenMetadataException {
    if (this.getId() == null) {
      return (Report) OpenMetadata.client().reports().create(this);
    } else {
      return (Report) OpenMetadata.client().reports().update(this.getId(), this);
    }
  }

  public Report update() throws OpenMetadataException {
    if (this.getId() == null) {
      throw new IllegalStateException("Cannot update a report without an ID");
    }
    return (Report) OpenMetadata.client().reports().update(this.getId(), this);
  }

  public void delete() throws OpenMetadataException {
    if (this.getId() == null) {
      throw new IllegalStateException("Cannot delete a report without an ID");
    }
    OpenMetadata.client().reports().delete(this.getId());
  }

  // Fluent API methods
  public Report addTags(List<org.openmetadata.schema.type.TagLabel> tags) {
    if (this.getTags() == null) {
      this.setTags(tags);
    } else {
      this.getTags().addAll(tags);
    }
    return this;
  }

  public Report setOwner(org.openmetadata.schema.type.EntityReference owner) {
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

    public ReportCollection list() throws OpenMetadataException {
      return Report.list(params);
    }
  }

  public static ListBuilder listBuilder() {
    return new ListBuilder();
  }

  // Collection class with auto-pagination
  public static class ReportCollection
      implements Iterable<org.openmetadata.schema.entity.data.Report> {
    private final ListResponse<org.openmetadata.schema.entity.data.Report> response;

    public ReportCollection(ListResponse<org.openmetadata.schema.entity.data.Report> response) {
      this.response = response;
    }

    public List<org.openmetadata.schema.entity.data.Report> getData() {
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

    public ReportCollection nextPage() throws OpenMetadataException {
      if (!hasNextPage()) {
        throw new IllegalStateException("No next page available");
      }
      ListParams params = new ListParams().setAfter(response.getPaging().getAfter());
      return Report.list(params);
    }

    public ReportCollection previousPage() throws OpenMetadataException {
      if (!hasPreviousPage()) {
        throw new IllegalStateException("No previous page available");
      }
      ListParams params = new ListParams().setBefore(response.getPaging().getBefore());
      return Report.list(params);
    }

    @Override
    public Iterator<org.openmetadata.schema.entity.data.Report> iterator() {
      return response.getData().iterator();
    }
  }
}
