package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.services.dataassets.DashboardService;

public class Dashboard extends org.openmetadata.schema.entity.data.Dashboard {
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
  public static org.openmetadata.schema.entity.data.Dashboard create(CreateDashboard request) {
    return getClient().dashboards().create(request);
  }

  public static org.openmetadata.schema.entity.data.Dashboard retrieve(String id) {
    return (org.openmetadata.schema.entity.data.Dashboard) getClient().dashboards().get(id);
  }

  public static org.openmetadata.schema.entity.data.Dashboard retrieve(String id, String fields) {
    return (org.openmetadata.schema.entity.data.Dashboard) getClient().dashboards().get(id, fields);
  }

  public static org.openmetadata.schema.entity.data.Dashboard retrieveByName(
      String fullyQualifiedName) {
    return (org.openmetadata.schema.entity.data.Dashboard)
        getClient().dashboards().getByName(fullyQualifiedName);
  }

  public static org.openmetadata.schema.entity.data.Dashboard retrieveByName(
      String fullyQualifiedName, String fields) {
    return (org.openmetadata.schema.entity.data.Dashboard)
        getClient().dashboards().getByName(fullyQualifiedName, fields);
  }

  public static DashboardCollection list() {
    return new DashboardCollection(getClient().dashboards());
  }

  public static DashboardCollection list(DashboardListParams params) {
    return new DashboardCollection(getClient().dashboards(), params);
  }

  public static org.openmetadata.schema.entity.data.Dashboard update(
      String id, org.openmetadata.schema.entity.data.Dashboard dashboard) {
    return (org.openmetadata.schema.entity.data.Dashboard)
        getClient().dashboards().update(id, dashboard);
  }

  public static org.openmetadata.schema.entity.data.Dashboard patch(String id, String jsonPatch) {
    try {
      com.fasterxml.jackson.databind.ObjectMapper mapper =
          new com.fasterxml.jackson.databind.ObjectMapper();
      com.fasterxml.jackson.databind.JsonNode patchNode = mapper.readTree(jsonPatch);
      return getClient().dashboards().patch(id, patchNode);
    } catch (Exception e) {
      throw new org.openmetadata.sdk.exceptions.OpenMetadataException(
          "Failed to parse JSON patch: " + e.getMessage(), e);
    }
  }

  public static void delete(String id) {
    delete(id, false, false);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete) {
    DashboardService service = getClient().dashboards();
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    service.delete(id, params);
  }

  // Async operations
  public static CompletableFuture<org.openmetadata.schema.entity.data.Dashboard> createAsync(
      CreateDashboard request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<org.openmetadata.schema.entity.data.Dashboard> retrieveAsync(
      String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }

  // Instance methods
  public org.openmetadata.schema.entity.data.Dashboard save() {
    if (this.getId() != null) {
      return update(this.getId().toString(), this);
    } else {
      throw new IllegalStateException("Cannot save a dashboard without an ID");
    }
  }

  public void delete() {
    if (this.getId() != null) {
      delete(this.getId().toString());
    } else {
      throw new IllegalStateException("Cannot delete a dashboard without an ID");
    }
  }

  // Collection class with iterator support
  public static class DashboardCollection {
    private final DashboardService service;
    private final DashboardListParams params;

    DashboardCollection(DashboardService service) {
      this(service, null);
    }

    DashboardCollection(DashboardService service, DashboardListParams params) {
      this.service = service;
      this.params = params;
    }

    public Iterable<org.openmetadata.schema.entity.data.Dashboard> autoPagingIterable() {
      return new Iterable<org.openmetadata.schema.entity.data.Dashboard>() {
        @Override
        public Iterator<org.openmetadata.schema.entity.data.Dashboard> iterator() {
          return new DashboardIterator(service, params);
        }
      };
    }
  }

  // List params
  public static class DashboardListParams {
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
      private DashboardListParams params = new DashboardListParams();

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

      public DashboardListParams build() {
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
  private static class DashboardIterator
      implements Iterator<org.openmetadata.schema.entity.data.Dashboard> {
    private final DashboardService service;
    private final DashboardListParams params;
    private Iterator<org.openmetadata.schema.entity.data.Dashboard> currentPage;
    private String nextPageToken;
    private boolean hasMore = true;

    DashboardIterator(DashboardService service, DashboardListParams params) {
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
    public org.openmetadata.schema.entity.data.Dashboard next() {
      if (!hasNext()) {
        throw new java.util.NoSuchElementException();
      }
      return (org.openmetadata.schema.entity.data.Dashboard) currentPage.next();
    }
  }
}
