package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for TestSuite entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * TestSuite updated = new FluentTestSuite(testSuite, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentTestSuite {
  private final TestSuite testSuite;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentTestSuite(TestSuite testSuite, OpenMetadataClient client) {
    this.testSuite = testSuite;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentTestSuite withDescription(String description) {
    testSuite.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentTestSuite withDisplayName(String displayName) {
    testSuite.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentTestSuite addTag(String tagFQN) {
    List<TagLabel> tags = testSuite.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      testSuite.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentTestSuite addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentTestSuite withExtension(Object extension) {
    testSuite.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public TestSuite save() {
    if (!modified) {
      return testSuite;
    }

    if (testSuite.getId() == null) {
      throw new IllegalStateException("TestSuite must have an ID to update");
    }

    return client.testSuites().update(testSuite.getId().toString(), testSuite);
  }

  /**
   * Get the underlying entity.
   */
  public TestSuite get() {
    return testSuite;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
