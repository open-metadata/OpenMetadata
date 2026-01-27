package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for Dashboard operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.Dashboards.*;
 *
 * // Create
 * Dashboard dashboard = create()
 *     .name("dashboard_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * Dashboard dashboard = find(dashboardId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * Dashboard updated = find(dashboardId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(dashboardId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(dashboard -> process(dashboard));
 * </pre>
 */
public final class Dashboards {
  private static OpenMetadataClient defaultClient;

  private Dashboards() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Dashboards.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static DashboardCreator create() {
    return new DashboardCreator(getClient());
  }

  public static Dashboard create(CreateDashboard request) {
    return getClient().dashboards().create(request);
  }

  // ==================== Finding/Retrieval ====================

  public static DashboardFinder find(String id) {
    return new DashboardFinder(getClient(), id);
  }

  public static DashboardFinder find(UUID id) {
    return find(id.toString());
  }

  public static DashboardFinder findByName(String fqn) {
    return new DashboardFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static DashboardLister list() {
    return new DashboardLister(getClient());
  }

  // ==================== Creator ====================

  public static class DashboardCreator {
    private final OpenMetadataClient client;
    private final CreateDashboard request = new CreateDashboard();

    DashboardCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public DashboardCreator name(String name) {
      request.setName(name);
      return this;
    }

    public DashboardCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public DashboardCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public DashboardCreator in(String service) {
      request.setService(service);
      return this;
    }

    public DashboardCreator withCharts(String... chartIds) {
      request.setCharts(Arrays.asList(chartIds));
      return this;
    }

    public Dashboard execute() {
      return client.dashboards().create(request);
    }

    public Dashboard now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class DashboardFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    DashboardFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    DashboardFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public DashboardFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public DashboardFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public DashboardFinder includeAll() {
      includes.addAll(Arrays.asList("owner", "tags", "followers", "domain"));
      return this;
    }

    public FluentDashboard fetch() {
      Dashboard dashboard;
      if (includes.isEmpty()) {
        dashboard =
            isFqn ? client.dashboards().getByName(identifier) : client.dashboards().get(identifier);
      } else {
        String fields = String.join(",", includes);
        dashboard =
            isFqn
                ? client.dashboards().getByName(identifier, fields)
                : client.dashboards().get(identifier, fields);
      }
      return new FluentDashboard(dashboard, client);
    }

    public DashboardDeleter delete() {
      return new DashboardDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class DashboardDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    DashboardDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public DashboardDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public DashboardDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.dashboards().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class DashboardLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    DashboardLister(OpenMetadataClient client) {
      this.client = client;
    }

    public DashboardLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public DashboardLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentDashboard> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.dashboards().list(params);
      List<FluentDashboard> items = new ArrayList<>();
      for (Dashboard item : response.getData()) {
        items.add(new FluentDashboard(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentDashboard> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentDashboard {
    private final Dashboard dashboard;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentDashboard(Dashboard dashboard, OpenMetadataClient client) {
      this.dashboard = dashboard;
      this.client = client;
    }

    public Dashboard get() {
      return dashboard;
    }

    public FluentDashboard withDescription(String description) {
      dashboard.setDescription(description);
      modified = true;
      return this;
    }

    public FluentDashboard withDisplayName(String displayName) {
      dashboard.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentDashboard save() {
      if (modified) {
        Dashboard updated = client.dashboards().update(dashboard.getId().toString(), dashboard);
        dashboard.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public DashboardDeleter delete() {
      return new DashboardDeleter(client, dashboard.getId().toString());
    }

    public FluentDashboard addChart(String chartId) {
      // Add chart logic
      modified = true;
      return this;
    }
  }
}
