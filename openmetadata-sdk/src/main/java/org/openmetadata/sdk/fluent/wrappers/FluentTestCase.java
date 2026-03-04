package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for TestCase entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * TestCase updated = new FluentTestCase(testCase, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentTestCase {
  private final TestCase testCase;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentTestCase(TestCase testCase, OpenMetadataClient client) {
    this.testCase = testCase;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentTestCase withDescription(String description) {
    testCase.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentTestCase withDisplayName(String displayName) {
    testCase.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentTestCase addTag(String tagFQN) {
    List<TagLabel> tags = testCase.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      testCase.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentTestCase addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentTestCase withExtension(Object extension) {
    testCase.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public TestCase save() {
    if (!modified) {
      return testCase;
    }

    if (testCase.getId() == null) {
      throw new IllegalStateException("TestCase must have an ID to update");
    }

    return client.testCases().update(testCase.getId().toString(), testCase);
  }

  /**
   * Get the underlying entity.
   */
  public TestCase get() {
    return testCase;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
