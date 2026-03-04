package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating TestSuite entities.
 *
 * <pre>
 * TestSuite testSuite = TestSuiteBuilder.create(client)
 *     .name("testSuite_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class TestSuiteBuilder {
  private final OpenMetadataClient client;
  private final CreateTestSuite request;

  public TestSuiteBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateTestSuite();
  }

  /**
   * Set the name (required).
   */
  public TestSuiteBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public TestSuiteBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public TestSuiteBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public TestSuiteBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateTestSuite request without executing it.
   */
  public CreateTestSuite build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("TestSuite name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public TestSuite create() {
    CreateTestSuite createRequest = build();
    // Convert CreateTestSuite to TestSuite
    TestSuite entity = new TestSuite();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.testSuites().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public TestSuite createOrUpdate() {
    CreateTestSuite createRequest = build();
    // Convert CreateTestSuite to TestSuite
    TestSuite entity = new TestSuite();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.testSuites().upsert(entity);
  }
}
