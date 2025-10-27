package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating Domain entities.
 *
 * <pre>
 * Domain domain = DomainBuilder.create(client)
 *     .name("domain_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class DomainBuilder {
  private final OpenMetadataClient client;
  private final CreateDomain request;

  public DomainBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateDomain();
  }

  /**
   * Set the name (required).
   */
  public DomainBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public DomainBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public DomainBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public DomainBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateDomain request without executing it.
   */
  public CreateDomain build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("Domain name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public Domain create() {
    CreateDomain createRequest = build();
    // Convert CreateDomain to Domain
    Domain entity = new Domain();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.domains().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public Domain createOrUpdate() {
    CreateDomain createRequest = build();
    // Convert CreateDomain to Domain
    Domain entity = new Domain();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.domains().upsert(entity);
  }
}
