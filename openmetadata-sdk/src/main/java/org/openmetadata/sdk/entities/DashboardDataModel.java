package org.openmetadata.sdk.entities;

import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class DashboardDataModel extends org.openmetadata.schema.entity.data.DashboardDataModel {

  // Static methods for CRUD operations
  public static DashboardDataModel create(
      org.openmetadata.schema.entity.data.DashboardDataModel dashboardDataModel)
      throws OpenMetadataException {
    return (DashboardDataModel)
        OpenMetadata.client().dashboardDataModels().create(dashboardDataModel);
  }

  public static DashboardDataModel retrieve(String id) throws OpenMetadataException {
    return (DashboardDataModel) OpenMetadata.client().dashboardDataModels().get(id);
  }

  public static DashboardDataModel retrieve(String id, String fields) throws OpenMetadataException {
    return (DashboardDataModel) OpenMetadata.client().dashboardDataModels().get(id, fields);
  }

  public static DashboardDataModel retrieve(UUID id) throws OpenMetadataException {
    return (DashboardDataModel) OpenMetadata.client().dashboardDataModels().get(id);
  }

  public static DashboardDataModel retrieveByName(String name) throws OpenMetadataException {
    return (DashboardDataModel) OpenMetadata.client().dashboardDataModels().getByName(name);
  }

  public static DashboardDataModel retrieveByName(String name, String fields)
      throws OpenMetadataException {
    return (DashboardDataModel) OpenMetadata.client().dashboardDataModels().getByName(name, fields);
  }

  public static DashboardDataModelCollection list() throws OpenMetadataException {
    return new DashboardDataModelCollection(OpenMetadata.client().dashboardDataModels().list());
  }

  public static DashboardDataModelCollection list(ListParams params) throws OpenMetadataException {
    return new DashboardDataModelCollection(
        OpenMetadata.client().dashboardDataModels().list(params));
  }

  public static void delete(String id) throws OpenMetadataException {
    OpenMetadata.client().dashboardDataModels().delete(id);
  }

  public static void delete(UUID id) throws OpenMetadataException {
    OpenMetadata.client().dashboardDataModels().delete(id);
  }

  // Async delete methods
  public static CompletableFuture<Void> deleteAsync(String id) {
    return OpenMetadata.client().dashboardDataModels().deleteAsync(id);
  }

  public static CompletableFuture<Void> deleteAsync(UUID id) {
    return OpenMetadata.client().dashboardDataModels().deleteAsync(id);
  }

  // Export/Import methods
  public static String exportCsv() throws OpenMetadataException {
    return OpenMetadata.client().dashboardDataModels().exportCsv();
  }

  public static String exportCsv(String name) throws OpenMetadataException {
    return OpenMetadata.client().dashboardDataModels().exportCsv(name);
  }

  public static String importCsv(String csvData) throws OpenMetadataException {
    return OpenMetadata.client().dashboardDataModels().importCsv(csvData);
  }

  public static String importCsv(String csvData, boolean dryRun) throws OpenMetadataException {
    return OpenMetadata.client().dashboardDataModels().importCsv(csvData, dryRun);
  }

  // Instance methods
  public DashboardDataModel save() throws OpenMetadataException {
    if (this.getId() == null) {
      return (DashboardDataModel) OpenMetadata.client().dashboardDataModels().create(this);
    } else {
      return (DashboardDataModel)
          OpenMetadata.client().dashboardDataModels().update(this.getId(), this);
    }
  }

  public DashboardDataModel update() throws OpenMetadataException {
    if (this.getId() == null) {
      throw new IllegalStateException("Cannot update a dashboard data model without an ID");
    }
    return (DashboardDataModel)
        OpenMetadata.client().dashboardDataModels().update(this.getId(), this);
  }

  public void delete() throws OpenMetadataException {
    if (this.getId() == null) {
      throw new IllegalStateException("Cannot delete a dashboard data model without an ID");
    }
    OpenMetadata.client().dashboardDataModels().delete(this.getId());
  }

  // Fluent API methods
  public DashboardDataModel addTags(List<org.openmetadata.schema.type.TagLabel> tags) {
    if (this.getTags() == null) {
      this.setTags(tags);
    } else {
      this.getTags().addAll(tags);
    }
    return this;
  }

  public DashboardDataModel setOwner(org.openmetadata.schema.type.EntityReference owner) {
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

    public DashboardDataModelCollection list() throws OpenMetadataException {
      return DashboardDataModel.list(params);
    }
  }

  public static ListBuilder listBuilder() {
    return new ListBuilder();
  }

  // Collection class with auto-pagination
  public static class DashboardDataModelCollection
      implements Iterable<org.openmetadata.schema.entity.data.DashboardDataModel> {
    private final ListResponse<org.openmetadata.schema.entity.data.DashboardDataModel> response;

    public DashboardDataModelCollection(
        ListResponse<org.openmetadata.schema.entity.data.DashboardDataModel> response) {
      this.response = response;
    }

    public List<org.openmetadata.schema.entity.data.DashboardDataModel> getData() {
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

    public DashboardDataModelCollection nextPage() throws OpenMetadataException {
      if (!hasNextPage()) {
        throw new IllegalStateException("No next page available");
      }
      ListParams params = new ListParams().setAfter(response.getPaging().getAfter());
      return DashboardDataModel.list(params);
    }

    public DashboardDataModelCollection previousPage() throws OpenMetadataException {
      if (!hasPreviousPage()) {
        throw new IllegalStateException("No previous page available");
      }
      ListParams params = new ListParams().setBefore(response.getPaging().getBefore());
      return DashboardDataModel.list(params);
    }

    @Override
    public Iterator<org.openmetadata.schema.entity.data.DashboardDataModel> iterator() {
      return response.getData().iterator();
    }
  }
}
