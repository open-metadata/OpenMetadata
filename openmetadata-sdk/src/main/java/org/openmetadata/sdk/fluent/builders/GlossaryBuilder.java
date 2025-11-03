package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating Glossary entities.
 *
 * <pre>
 * Glossary glossary = GlossaryBuilder.create(client)
 *     .name("glossary_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class GlossaryBuilder {
  private final OpenMetadataClient client;
  private final CreateGlossary request;

  public GlossaryBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateGlossary();
  }

  /**
   * Set the name (required).
   */
  public GlossaryBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public GlossaryBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public GlossaryBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public GlossaryBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateGlossary request without executing it.
   */
  public CreateGlossary build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("Glossary name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public Glossary create() {
    CreateGlossary createRequest = build();
    // Convert CreateGlossary to Glossary
    Glossary entity = new Glossary();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.glossaries().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public Glossary createOrUpdate() {
    CreateGlossary createRequest = build();
    // Convert CreateGlossary to Glossary
    Glossary entity = new Glossary();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.glossaries().upsert(entity);
  }
}
