package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for Domain entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * Domain updated = new FluentDomain(domain, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentDomain {
  private final Domain domain;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentDomain(Domain domain, OpenMetadataClient client) {
    this.domain = domain;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentDomain withDescription(String description) {
    domain.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentDomain withDisplayName(String displayName) {
    domain.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentDomain addTag(String tagFQN) {
    List<TagLabel> tags = domain.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      domain.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentDomain addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentDomain withExtension(Object extension) {
    domain.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public Domain save() {
    if (!modified) {
      return domain;
    }

    if (domain.getId() == null) {
      throw new IllegalStateException("Domain must have an ID to update");
    }

    return client.domains().update(domain.getId().toString(), domain);
  }

  /**
   * Get the underlying entity.
   */
  public Domain get() {
    return domain;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
