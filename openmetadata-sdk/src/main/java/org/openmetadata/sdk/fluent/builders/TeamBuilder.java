package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating Team entities.
 *
 * <pre>
 * Team team = TeamBuilder.create(client)
 *     .name("team_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class TeamBuilder {
  private final OpenMetadataClient client;
  private final CreateTeam request;

  public TeamBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateTeam();
  }

  /**
   * Set the name (required).
   */
  public TeamBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public TeamBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public TeamBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public TeamBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateTeam request without executing it.
   */
  public CreateTeam build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("Team name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public Team create() {
    CreateTeam createRequest = build();
    // Convert CreateTeam to Team
    Team entity = new Team();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.teams().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public Team createOrUpdate() {
    CreateTeam createRequest = build();
    // Convert CreateTeam to Team
    Team entity = new Team();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.teams().upsert(entity);
  }
}
