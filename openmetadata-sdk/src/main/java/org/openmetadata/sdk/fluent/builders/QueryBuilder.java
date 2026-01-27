package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating Query entities.
 *
 * <pre>
 * Query query = QueryBuilder.create(client)
 *     .name("query_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class QueryBuilder {
  private final OpenMetadataClient client;
  private final CreateQuery request;

  public QueryBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateQuery();
  }

  /**
   * Set the name (required).
   */
  public QueryBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public QueryBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public QueryBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public QueryBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateQuery request without executing it.
   */
  public CreateQuery build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("Query name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public Query create() {
    CreateQuery createRequest = build();
    // Convert CreateQuery to Query
    Query entity = new Query();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.queries().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public Query createOrUpdate() {
    CreateQuery createRequest = build();
    // Convert CreateQuery to Query
    Query entity = new Query();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.queries().upsert(entity);
  }
}
