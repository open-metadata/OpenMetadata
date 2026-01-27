package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating DataProduct entities.
 *
 * <pre>
 * DataProduct dataProduct = DataProductBuilder.create(client)
 *     .name("dataProduct_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class DataProductBuilder {
  private final OpenMetadataClient client;
  private final CreateDataProduct request;

  public DataProductBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateDataProduct();
  }

  /**
   * Set the name (required).
   */
  public DataProductBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public DataProductBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public DataProductBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public DataProductBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateDataProduct request without executing it.
   */
  public CreateDataProduct build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("DataProduct name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public DataProduct create() {
    CreateDataProduct createRequest = build();
    // Convert CreateDataProduct to DataProduct
    DataProduct entity = new DataProduct();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.dataProducts().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public DataProduct createOrUpdate() {
    CreateDataProduct createRequest = build();
    // Convert CreateDataProduct to DataProduct
    DataProduct entity = new DataProduct();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.dataProducts().upsert(entity);
  }
}
