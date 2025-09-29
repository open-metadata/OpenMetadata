package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for DashboardDataModel operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.DashboardDataModels.*;
 *
 * // Create
 * DashboardDataModel dashboardDataModel = create()
 *     .name("dashboardDataModel_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * DashboardDataModel dashboardDataModel = find(dashboardDataModelId)
 *     .includeOwner()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * DashboardDataModel updated = find(dashboardDataModelId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(dashboardDataModelId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(dashboardDataModel -> process(dashboardDataModel));
 * </pre>
 */
public final class DashboardDataModels {
  private static OpenMetadataClient defaultClient;

  private DashboardDataModels() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call DashboardDataModels.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static DashboardDataModelCreator create() {
    return new DashboardDataModelCreator(getClient());
  }

  public static DashboardDataModel create(CreateDashboardDataModel request) {
    return getClient().dashboardDataModels().create(request);
  }

  // ==================== Finding/Retrieval ====================

  public static DashboardDataModelFinder find(String id) {
    return new DashboardDataModelFinder(getClient(), id);
  }

  public static DashboardDataModelFinder find(UUID id) {
    return find(id.toString());
  }

  public static DashboardDataModelFinder findByName(String fqn) {
    return new DashboardDataModelFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static DashboardDataModelLister list() {
    return new DashboardDataModelLister(getClient());
  }

  // ==================== Creator ====================

  public static class DashboardDataModelCreator {
    private final OpenMetadataClient client;
    private final CreateDashboardDataModel request = new CreateDashboardDataModel();

    DashboardDataModelCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public DashboardDataModelCreator name(String name) {
      request.setName(name);
      return this;
    }

    public DashboardDataModelCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public DashboardDataModelCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public DashboardDataModelCreator in(String service) {
      request.setService(service);
      return this;
    }

    public DashboardDataModel execute() {
      return client.dashboardDataModels().create(request);
    }

    public DashboardDataModel now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class DashboardDataModelFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    DashboardDataModelFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    DashboardDataModelFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public DashboardDataModelFinder includeOwner() {
      includes.add("owner");
      return this;
    }

    public DashboardDataModelFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public DashboardDataModelFinder includeAll() {
      includes.addAll(Arrays.asList("owner", "tags", "followers", "domain"));
      return this;
    }

    public FluentDashboardDataModel fetch() {
      DashboardDataModel dashboardDataModel;
      if (includes.isEmpty()) {
        dashboardDataModel =
            isFqn
                ? client.dashboardDataModels().getByName(identifier)
                : client.dashboardDataModels().get(identifier);
      } else {
        String fields = String.join(",", includes);
        dashboardDataModel =
            isFqn
                ? client.dashboardDataModels().getByName(identifier, fields)
                : client.dashboardDataModels().get(identifier, fields);
      }
      return new FluentDashboardDataModel(dashboardDataModel, client);
    }

    public DashboardDataModelDeleter delete() {
      return new DashboardDataModelDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class DashboardDataModelDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    DashboardDataModelDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public DashboardDataModelDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public DashboardDataModelDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.dashboardDataModels().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class DashboardDataModelLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    DashboardDataModelLister(OpenMetadataClient client) {
      this.client = client;
    }

    public DashboardDataModelLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public DashboardDataModelLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentDashboardDataModel> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.dashboardDataModels().list(params);
      List<FluentDashboardDataModel> items = new ArrayList<>();
      for (DashboardDataModel item : response.getData()) {
        items.add(new FluentDashboardDataModel(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentDashboardDataModel> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentDashboardDataModel {
    private final DashboardDataModel dashboardDataModel;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentDashboardDataModel(
        DashboardDataModel dashboardDataModel, OpenMetadataClient client) {
      this.dashboardDataModel = dashboardDataModel;
      this.client = client;
    }

    public DashboardDataModel get() {
      return dashboardDataModel;
    }

    public FluentDashboardDataModel withDescription(String description) {
      dashboardDataModel.setDescription(description);
      modified = true;
      return this;
    }

    public FluentDashboardDataModel withDisplayName(String displayName) {
      dashboardDataModel.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentDashboardDataModel save() {
      if (modified) {
        DashboardDataModel updated =
            client
                .dashboardDataModels()
                .update(dashboardDataModel.getId().toString(), dashboardDataModel);
        dashboardDataModel.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public DashboardDataModelDeleter delete() {
      return new DashboardDataModelDeleter(client, dashboardDataModel.getId().toString());
    }
  }
}
