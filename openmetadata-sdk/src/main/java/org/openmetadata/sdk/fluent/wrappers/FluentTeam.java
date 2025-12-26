package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for Team entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * Team updated = new FluentTeam(team, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentTeam {
  private final Team team;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentTeam(Team team, OpenMetadataClient client) {
    this.team = team;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentTeam withDescription(String description) {
    team.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentTeam withDisplayName(String displayName) {
    team.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentTeam addTag(String tagFQN) {
    List<TagLabel> tags = team.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      team.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentTeam addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentTeam withExtension(Object extension) {
    team.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public Team save() {
    if (!modified) {
      return team;
    }

    if (team.getId() == null) {
      throw new IllegalStateException("Team must have an ID to update");
    }

    return client.teams().update(team.getId().toString(), team);
  }

  /**
   * Get the underlying entity.
   */
  public Team get() {
    return team;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
