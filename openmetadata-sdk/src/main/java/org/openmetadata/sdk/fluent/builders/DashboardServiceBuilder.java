package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating DashboardService entities.
 *
 * <pre>
 * DashboardService dashboardService = DashboardServiceBuilder.create(client)
 *     .name("dashboardService_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class DashboardServiceBuilder {
  private final OpenMetadataClient client;
  private final CreateDashboardService request;

  public DashboardServiceBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateDashboardService();
  }

  /**
   * Set the name (required).
   */
  public DashboardServiceBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public DashboardServiceBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public DashboardServiceBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public DashboardServiceBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateDashboardService request without executing it.
   */
  public CreateDashboardService build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("DashboardService name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public DashboardService create() {
    CreateDashboardService createRequest = build();
    // Convert CreateDashboardService to DashboardService
    DashboardService service = new DashboardService();
    service.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      service.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      service.setDescription(createRequest.getDescription());
    // TODO: Map service type
    if (createRequest.getConnection() != null) service.setConnection(createRequest.getConnection());
    return client.dashboardServices().create(service);
  }

  /**
   * Create or update (upsert).
   */
  public DashboardService createOrUpdate() {
    CreateDashboardService createRequest = build();
    // Convert CreateDashboardService to DashboardService
    DashboardService service = new DashboardService();
    service.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      service.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      service.setDescription(createRequest.getDescription());
    // TODO: Map service type
    if (createRequest.getConnection() != null) service.setConnection(createRequest.getConnection());
    return client.dashboardServices().upsert(service);
  }
}
