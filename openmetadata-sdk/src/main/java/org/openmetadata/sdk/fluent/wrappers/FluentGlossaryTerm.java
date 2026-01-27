package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for GlossaryTerm entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * GlossaryTerm updated = new FluentGlossaryTerm(glossaryTerm, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentGlossaryTerm {
  private final GlossaryTerm glossaryTerm;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentGlossaryTerm(GlossaryTerm glossaryTerm, OpenMetadataClient client) {
    this.glossaryTerm = glossaryTerm;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentGlossaryTerm withDescription(String description) {
    glossaryTerm.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentGlossaryTerm withDisplayName(String displayName) {
    glossaryTerm.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentGlossaryTerm addTag(String tagFQN) {
    List<TagLabel> tags = glossaryTerm.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      glossaryTerm.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentGlossaryTerm addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentGlossaryTerm withExtension(Object extension) {
    glossaryTerm.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public GlossaryTerm save() {
    if (!modified) {
      return glossaryTerm;
    }

    if (glossaryTerm.getId() == null) {
      throw new IllegalStateException("GlossaryTerm must have an ID to update");
    }

    return client.glossaryTerms().update(glossaryTerm.getId().toString(), glossaryTerm);
  }

  /**
   * Get the underlying entity.
   */
  public GlossaryTerm get() {
    return glossaryTerm;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
