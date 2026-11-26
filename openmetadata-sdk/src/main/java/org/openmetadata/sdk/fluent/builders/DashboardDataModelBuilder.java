package org.openmetadata.sdk.fluent.builders;

import java.util.Arrays;
import java.util.List;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating DashboardDataModel entities.
 *
 * <p>The builder posts the {@link CreateDashboardDataModel} request directly to the server, so the
 * required {@code service}, {@code dataModelType} and {@code columns} fields must be set for the
 * request to satisfy {@code @Valid CreateDashboardDataModel} validation.
 *
 * <pre>
 * DashboardDataModel dashboardDataModel = new DashboardDataModelBuilder(client)
 *     .name("dashboardDataModel_name")
 *     .service("superset")
 *     .dataModelType(DataModelType.SupersetDataModel)
 *     .columns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)))
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
   * Set the fully qualified name of the hosting dashboard service (required).
   */
  public DashboardDataModelBuilder service(String service) {
    request.setService(service);
    return this;
  }

  /**
   * Set the data model type (required).
   */
  public DashboardDataModelBuilder dataModelType(DataModelType dataModelType) {
    request.setDataModelType(dataModelType);
    return this;
  }

  /**
   * Set the columns of the data model (required).
   */
  public DashboardDataModelBuilder columns(List<Column> columns) {
    request.setColumns(columns);
    return this;
  }

  /**
   * Set the columns of the data model (required).
   */
  public DashboardDataModelBuilder columns(Column... columns) {
    request.setColumns(Arrays.asList(columns));
    return this;
  }

  /**
   * Set custom extension data.
   */
  public DashboardDataModelBuilder extension(Object extension) {
    request.setExtension(extension);
    return this;
  }

  /**
   * Build the CreateDashboardDataModel request without executing it.
   */
  public CreateDashboardDataModel build() {
    // Validate required fields (CreateDashboardDataModel schema requires all four)
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("DashboardDataModel name is required");
    }
    if (request.getService() == null || request.getService().isEmpty()) {
      throw new IllegalStateException("DashboardDataModel service is required");
    }
    if (request.getDataModelType() == null) {
      throw new IllegalStateException("DashboardDataModel dataModelType is required");
    }
    if (request.getColumns() == null) {
      throw new IllegalStateException("DashboardDataModel columns is required");
    }

    return request;
  }

  /**
   * Create and return the created entity. The {@link CreateDashboardDataModel} request built by
   * {@link #build()} is posted directly so the server receives all required fields.
   */
  public DashboardDataModel create() {
    return client.dashboardDataModels().create(build());
  }

  /**
   * Create or update (upsert). The {@link CreateDashboardDataModel} request built by {@link
   * #build()} is sent directly so the server receives all required fields.
   */
  public DashboardDataModel createOrUpdate() {
    return client.dashboardDataModels().upsert(build());
  }
}
