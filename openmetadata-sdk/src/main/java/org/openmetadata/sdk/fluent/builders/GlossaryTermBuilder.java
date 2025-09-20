package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating GlossaryTerm entities.
 *
 * <pre>
 * GlossaryTerm glossaryTerm = GlossaryTermBuilder.create(client)
 *     .name("glossaryTerm_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class GlossaryTermBuilder {
  private final OpenMetadataClient client;
  private final CreateGlossaryTerm request;

  public GlossaryTermBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateGlossaryTerm();
  }

  /**
   * Set the name (required).
   */
  public GlossaryTermBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public GlossaryTermBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public GlossaryTermBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public GlossaryTermBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateGlossaryTerm request without executing it.
   */
  public CreateGlossaryTerm build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("GlossaryTerm name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public GlossaryTerm create() {
    CreateGlossaryTerm createRequest = build();
    // Convert CreateGlossaryTerm to GlossaryTerm
    GlossaryTerm entity = new GlossaryTerm();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.glossaryTerms().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public GlossaryTerm createOrUpdate() {
    CreateGlossaryTerm createRequest = build();
    // Convert CreateGlossaryTerm to GlossaryTerm
    GlossaryTerm entity = new GlossaryTerm();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.glossaryTerms().upsert(entity);
  }
}
