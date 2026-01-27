package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating Metric entities.
 *
 * <pre>
 * Metric metric = MetricBuilder.create(client)
 *     .name("metric_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class MetricBuilder {
  private final OpenMetadataClient client;
  private final CreateMetric request;

  public MetricBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateMetric();
  }

  /**
   * Set the name (required).
   */
  public MetricBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public MetricBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public MetricBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public MetricBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateMetric request without executing it.
   */
  public CreateMetric build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("Metric name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public Metric create() {
    CreateMetric createRequest = build();
    // Convert CreateMetric to Metric
    Metric entity = new Metric();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.metrics().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public Metric createOrUpdate() {
    CreateMetric createRequest = build();
    // Convert CreateMetric to Metric
    Metric entity = new Metric();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.metrics().upsert(entity);
  }
}
