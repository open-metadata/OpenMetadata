package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating TestCase entities.
 *
 * <pre>
 * TestCase testCase = TestCaseBuilder.create(client)
 *     .name("testCase_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class TestCaseBuilder {
  private final OpenMetadataClient client;
  private final CreateTestCase request;

  public TestCaseBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateTestCase();
  }

  /**
   * Set the name (required).
   */
  public TestCaseBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public TestCaseBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public TestCaseBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public TestCaseBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateTestCase request without executing it.
   */
  public CreateTestCase build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("TestCase name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public TestCase create() {
    CreateTestCase createRequest = build();
    // Convert CreateTestCase to TestCase
    TestCase entity = new TestCase();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.testCases().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public TestCase createOrUpdate() {
    CreateTestCase createRequest = build();
    // Convert CreateTestCase to TestCase
    TestCase entity = new TestCase();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.testCases().upsert(entity);
  }
}
