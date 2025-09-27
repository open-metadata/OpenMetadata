package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.tests.CreateTestDefinition;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating TestDefinition entities.
 *
 * <pre>
 * TestDefinition testDefinition = TestDefinitionBuilder.create(client)
 *     .name("testDefinition_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class TestDefinitionBuilder {
  private final OpenMetadataClient client;
  private final CreateTestDefinition request;

  public TestDefinitionBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateTestDefinition();
  }

  /**
   * Set the name (required).
   */
  public TestDefinitionBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public TestDefinitionBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public TestDefinitionBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public TestDefinitionBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateTestDefinition request without executing it.
   */
  public CreateTestDefinition build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("TestDefinition name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public TestDefinition create() {
    CreateTestDefinition createRequest = build();
    // Convert CreateTestDefinition to TestDefinition
    TestDefinition entity = new TestDefinition();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.testDefinitions().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public TestDefinition createOrUpdate() {
    CreateTestDefinition createRequest = build();
    // Convert CreateTestDefinition to TestDefinition
    TestDefinition entity = new TestDefinition();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.testDefinitions().upsert(entity);
  }
}
