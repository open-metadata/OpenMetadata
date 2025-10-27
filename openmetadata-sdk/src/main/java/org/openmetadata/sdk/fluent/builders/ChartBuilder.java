package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating Chart entities.
 *
 * <pre>
 * Chart chart = ChartBuilder.create(client)
 *     .name("chart_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class ChartBuilder {
  private final OpenMetadataClient client;
  private final CreateChart request;

  public ChartBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateChart();
  }

  /**
   * Set the name (required).
   */
  public ChartBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public ChartBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public ChartBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public ChartBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateChart request without executing it.
   */
  public CreateChart build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("Chart name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public Chart create() {
    CreateChart createRequest = build();
    // Convert CreateChart to Chart
    Chart entity = new Chart();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.charts().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public Chart createOrUpdate() {
    CreateChart createRequest = build();
    // Convert CreateChart to Chart
    Chart entity = new Chart();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.charts().upsert(entity);
  }
}
