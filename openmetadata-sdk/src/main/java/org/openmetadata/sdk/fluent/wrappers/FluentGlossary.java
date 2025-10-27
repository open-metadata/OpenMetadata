package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for Glossary entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * Glossary updated = new FluentGlossary(glossary, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentGlossary {
  private final Glossary glossary;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentGlossary(Glossary glossary, OpenMetadataClient client) {
    this.glossary = glossary;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentGlossary withDescription(String description) {
    glossary.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentGlossary withDisplayName(String displayName) {
    glossary.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentGlossary addTag(String tagFQN) {
    List<TagLabel> tags = glossary.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      glossary.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentGlossary addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentGlossary withExtension(Object extension) {
    glossary.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public Glossary save() {
    if (!modified) {
      return glossary;
    }

    if (glossary.getId() == null) {
      throw new IllegalStateException("Glossary must have an ID to update");
    }

    return client.glossaries().update(glossary.getId().toString(), glossary);
  }

  /**
   * Get the underlying entity.
   */
  public Glossary get() {
    return glossary;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
