package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating Dashboard entities.
 *
 * <pre>
 * Dashboard dashboard = DashboardBuilder.create(client)
 *     .name("dashboard_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class DashboardBuilder {
  private final OpenMetadataClient client;
  private final CreateDashboard request;

  public DashboardBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateDashboard();
  }

  /**
   * Set the name (required).
   */
  public DashboardBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public DashboardBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public DashboardBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public DashboardBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateDashboard request without executing it.
   */
  public CreateDashboard build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("Dashboard name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public Dashboard create() {
    CreateDashboard createRequest = build();
    // Convert CreateDashboard to Dashboard
    Dashboard entity = new Dashboard();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.dashboards().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public Dashboard createOrUpdate() {
    CreateDashboard createRequest = build();
    // Convert CreateDashboard to Dashboard
    Dashboard entity = new Dashboard();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.dashboards().upsert(entity);
  }
}
