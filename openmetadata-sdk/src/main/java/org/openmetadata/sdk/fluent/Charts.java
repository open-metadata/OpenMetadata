package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for Chart operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.Charts.*;
 *
 * // Create
 * Chart chart = create()
 *     .name("chart_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * Chart chart = find(chartId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * Chart updated = find(chartId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(chartId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(chart -> process(chart));
 * </pre>
 */
public final class Charts {
  private static OpenMetadataClient defaultClient;

  private Charts() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Charts.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static ChartCreator create() {
    return new ChartCreator(getClient());
  }

  public static Chart create(CreateChart request) {
    return getClient().charts().create(request);
  }

  // ==================== Finding/Retrieval ====================

  public static ChartFinder find(String id) {
    return new ChartFinder(getClient(), id);
  }

  public static ChartFinder find(UUID id) {
    return find(id.toString());
  }

  public static ChartFinder findByName(String fqn) {
    return new ChartFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static ChartLister list() {
    return new ChartLister(getClient());
  }

  // ==================== Creator ====================

  public static class ChartCreator {
    private final OpenMetadataClient client;
    private final CreateChart request = new CreateChart();

    ChartCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public ChartCreator name(String name) {
      request.setName(name);
      return this;
    }

    public ChartCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public ChartCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public ChartCreator in(String service) {
      request.setService(service);
      return this;
    }

    public Chart execute() {
      return client.charts().create(request);
    }

    public Chart now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class ChartFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    ChartFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    ChartFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public ChartFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public ChartFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public ChartFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domains"));
      return this;
    }

    public FluentChart fetch() {
      Chart chart;
      if (includes.isEmpty()) {
        chart = isFqn ? client.charts().getByName(identifier) : client.charts().get(identifier);
      } else {
        String fields = String.join(",", includes);
        chart =
            isFqn
                ? client.charts().getByName(identifier, fields)
                : client.charts().get(identifier, fields);
      }
      return new FluentChart(chart, client);
    }

    public ChartDeleter delete() {
      return new ChartDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class ChartDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    ChartDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public ChartDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public ChartDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.charts().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class ChartLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    ChartLister(OpenMetadataClient client) {
      this.client = client;
    }

    public ChartLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public ChartLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentChart> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.charts().list(params);
      List<FluentChart> items = new ArrayList<>();
      for (Chart item : response.getData()) {
        items.add(new FluentChart(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentChart> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentChart {
    private final Chart chart;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentChart(Chart chart, OpenMetadataClient client) {
      this.chart = chart;
      this.client = client;
    }

    public Chart get() {
      return chart;
    }

    public FluentChart withDescription(String description) {
      chart.setDescription(description);
      modified = true;
      return this;
    }

    public FluentChart withDisplayName(String displayName) {
      chart.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentChart save() {
      if (modified) {
        Chart updated = client.charts().update(chart.getId().toString(), chart);
        chart.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public ChartDeleter delete() {
      return new ChartDeleter(client, chart.getId().toString());
    }
  }
}
