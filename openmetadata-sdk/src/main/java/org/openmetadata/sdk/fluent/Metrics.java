package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for Metric operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.Metrics.*;
 *
 * // Create
 * Metric metric = create()
 *     .name("metric_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * Metric metric = find(metricId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * Metric updated = find(metricId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(metricId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(metric -> process(metric));
 * </pre>
 */
public final class Metrics {
  private static OpenMetadataClient defaultClient;

  private Metrics() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Metrics.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static MetricCreator create() {
    return new MetricCreator(getClient());
  }

  public static Metric create(CreateMetric request) {
    return getClient().metrics().create(request);
  }

  // ==================== Finding/Retrieval ====================

  public static MetricFinder find(String id) {
    return new MetricFinder(getClient(), id);
  }

  public static MetricFinder find(UUID id) {
    return find(id.toString());
  }

  public static MetricFinder findByName(String fqn) {
    return new MetricFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static MetricLister list() {
    return new MetricLister(getClient());
  }

  // ==================== Import/Export ====================

  public static CsvExporter exportCsv(String metricName) {
    return new CsvExporter(getClient(), metricName);
  }

  public static CsvImporter importCsv(String metricName) {
    return new CsvImporter(getClient(), metricName);
  }

  // ==================== Creator ====================

  public static class MetricCreator {
    private final OpenMetadataClient client;
    private final CreateMetric request = new CreateMetric();

    MetricCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public MetricCreator name(String name) {
      request.setName(name);
      return this;
    }

    public MetricCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public MetricCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public Metric execute() {
      return client.metrics().create(request);
    }

    public Metric now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class MetricFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    MetricFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    MetricFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public MetricFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public MetricFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public MetricFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domains"));
      return this;
    }

    public FluentMetric fetch() {
      Metric metric;
      if (includes.isEmpty()) {
        metric = isFqn ? client.metrics().getByName(identifier) : client.metrics().get(identifier);
      } else {
        String fields = String.join(",", includes);
        metric =
            isFqn
                ? client.metrics().getByName(identifier, fields)
                : client.metrics().get(identifier, fields);
      }
      return new FluentMetric(metric, client);
    }

    public MetricDeleter delete() {
      return new MetricDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class MetricDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    MetricDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public MetricDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public MetricDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.metrics().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class MetricLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    MetricLister(OpenMetadataClient client) {
      this.client = client;
    }

    public MetricLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public MetricLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentMetric> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.metrics().list(params);
      List<FluentMetric> items = new ArrayList<>();
      for (Metric item : response.getData()) {
        items.add(new FluentMetric(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentMetric> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentMetric {
    private final Metric metric;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentMetric(Metric metric, OpenMetadataClient client) {
      this.metric = metric;
      this.client = client;
    }

    public Metric get() {
      return metric;
    }

    public FluentMetric withDescription(String description) {
      metric.setDescription(description);
      modified = true;
      return this;
    }

    public FluentMetric withDisplayName(String displayName) {
      metric.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentMetric save() {
      if (modified) {
        Metric updated = client.metrics().update(metric.getId().toString(), metric);
        metric.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public MetricDeleter delete() {
      return new MetricDeleter(client, metric.getId().toString());
    }
  }

  // ==================== CSV Exporter ====================

  public static class CsvExporter {
    private final OpenMetadataClient client;
    private final String metricName;
    private boolean async = false;

    CsvExporter(OpenMetadataClient client, String metricName) {
      this.client = client;
      this.metricName = metricName;
    }

    public CsvExporter async() {
      this.async = true;
      return this;
    }

    public String execute() {
      if (async) {
        return client.metrics().exportCsvAsync(metricName);
      }
      return client.metrics().exportCsv(metricName);
    }

    public String toCsv() {
      return execute();
    }
  }

  // ==================== CSV Importer ====================

  public static class CsvImporter {
    private final OpenMetadataClient client;
    private final String metricName;
    private String csvData;
    private boolean dryRun = false;
    private boolean async = false;

    CsvImporter(OpenMetadataClient client, String metricName) {
      this.client = client;
      this.metricName = metricName;
    }

    public CsvImporter withData(String csvData) {
      this.csvData = csvData;
      return this;
    }

    public CsvImporter fromFile(String filePath) {
      try {
        this.csvData =
            new String(java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(filePath)));
      } catch (Exception e) {
        throw new RuntimeException("Failed to read CSV file: " + filePath, e);
      }
      return this;
    }

    public CsvImporter dryRun() {
      this.dryRun = true;
      return this;
    }

    public CsvImporter async() {
      this.async = true;
      return this;
    }

    public String execute() {
      if (csvData == null || csvData.isEmpty()) {
        throw new IllegalStateException("CSV data not provided. Use withData() or fromFile()");
      }

      if (async) {
        return client.metrics().importCsvAsync(metricName, csvData);
      }
      return client.metrics().importCsv(metricName, csvData, dryRun);
    }

    public String apply() {
      return execute();
    }
  }
}
