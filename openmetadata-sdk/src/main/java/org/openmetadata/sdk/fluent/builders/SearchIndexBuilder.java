package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating SearchIndex entities.
 *
 * <pre>
 * SearchIndex searchIndex = SearchIndexBuilder.create(client)
 *     .name("searchIndex_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class SearchIndexBuilder {
  private final OpenMetadataClient client;
  private final CreateSearchIndex request;

  public SearchIndexBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateSearchIndex();
  }

  /**
   * Set the name (required).
   */
  public SearchIndexBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public SearchIndexBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public SearchIndexBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public SearchIndexBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateSearchIndex request without executing it.
   */
  public CreateSearchIndex build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("SearchIndex name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public SearchIndex create() {
    CreateSearchIndex createRequest = build();
    // Convert CreateSearchIndex to SearchIndex
    SearchIndex entity = new SearchIndex();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.searchIndexes().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public SearchIndex createOrUpdate() {
    CreateSearchIndex createRequest = build();
    // Convert CreateSearchIndex to SearchIndex
    SearchIndex entity = new SearchIndex();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.searchIndexes().upsert(entity);
  }
}
