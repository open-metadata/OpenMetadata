package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating DashboardDataModel entities.
 *
 * <pre>
 * DashboardDataModel dashboardDataModel = DashboardDataModelBuilder.create(client)
 *     .name("dashboardDataModel_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class DashboardDataModelBuilder {
  private final OpenMetadataClient client;
  private final CreateDashboardDataModel request;

  public DashboardDataModelBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateDashboardDataModel();
  }

  /**
   * Set the name (required).
   */
  public DashboardDataModelBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public DashboardDataModelBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public DashboardDataModelBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public DashboardDataModelBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateDashboardDataModel request without executing it.
   */
  public CreateDashboardDataModel build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("DashboardDataModel name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public DashboardDataModel create() {
    CreateDashboardDataModel createRequest = build();
    // Convert CreateDashboardDataModel to DashboardDataModel
    DashboardDataModel entity = new DashboardDataModel();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.dashboardDataModels().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public DashboardDataModel createOrUpdate() {
    CreateDashboardDataModel createRequest = build();
    // Convert CreateDashboardDataModel to DashboardDataModel
    DashboardDataModel entity = new DashboardDataModel();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.dashboardDataModels().upsert(entity);
  }
}
