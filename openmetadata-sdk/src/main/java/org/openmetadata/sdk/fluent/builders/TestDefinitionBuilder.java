package org.openmetadata.sdk.fluent.builders;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.api.tests.CreateTestDefinition;
import org.openmetadata.schema.tests.TestCaseParameter;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating TestDefinition entities.
 *
 * <pre>
 * TestDefinition testDefinition = TestDefinitionBuilder.create(client)
 *     .name("table_column_value_to_be_not_null")
 *     .description("Test that column values are not null")
 *     .entityType(TestDefinitionEntityType.COLUMN)
 *     .testPlatforms(List.of(TestPlatform.OPEN_METADATA))
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
   * Create a new TestDefinitionBuilder with the given client.
   */
  public static TestDefinitionBuilder create(final OpenMetadataClient client) {
    return new TestDefinitionBuilder(client);
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
   * Set the entity type the test definition applies to (required).
   */
  public TestDefinitionBuilder entityType(final TestDefinitionEntityType entityType) {
    request.setEntityType(entityType);
    return this;
  }

  /**
   * Set the platforms where the test runs (required, non-empty). The supplied list is copied into a
   * builder-owned mutable list so {@link #testPlatform(TestPlatform)} can append to it.
   */
  public TestDefinitionBuilder testPlatforms(final List<TestPlatform> testPlatforms) {
    request.setTestPlatforms(new ArrayList<>(testPlatforms));
    return this;
  }

  /**
   * Add a single test platform to the builder-owned platform list.
   */
  public TestDefinitionBuilder testPlatform(final TestPlatform testPlatform) {
    if (request.getTestPlatforms() == null) {
      request.setTestPlatforms(new ArrayList<>());
    }
    request.getTestPlatforms().add(testPlatform);
    return this;
  }

  /**
   * Set the owners.
   */
  public TestDefinitionBuilder owners(final List<EntityReference> owners) {
    request.setOwners(owners);
    return this;
  }

  /**
   * Set a single owner.
   */
  public TestDefinitionBuilder owner(final EntityReference owner) {
    request.setOwners(List.of(owner));
    return this;
  }

  /**
   * Set the supported column data types.
   */
  public TestDefinitionBuilder supportedDataTypes(final List<ColumnDataType> supportedDataTypes) {
    request.setSupportedDataTypes(supportedDataTypes);
    return this;
  }

  /**
   * Set the provider type.
   */
  public TestDefinitionBuilder provider(final ProviderType provider) {
    request.setProvider(provider);
    return this;
  }

  /**
   * Set the parameter definitions.
   */
  public TestDefinitionBuilder parameterDefinition(
      final List<TestCaseParameter> parameterDefinition) {
    request.setParameterDefinition(parameterDefinition);
    return this;
  }

  /**
   * Set the data quality dimension.
   */
  public TestDefinitionBuilder dataQualityDimension(final String dataQualityDimension) {
    request.setDataQualityDimension(dataQualityDimension);
    return this;
  }

  /**
   * Set the supported services.
   */
  public TestDefinitionBuilder supportedServices(final List<String> supportedServices) {
    request.setSupportedServices(supportedServices);
    return this;
  }

  /**
   * Set the domains.
   */
  public TestDefinitionBuilder domains(final List<String> domains) {
    request.setDomains(domains);
    return this;
  }

  /**
   * Set the SQL expression template.
   */
  public TestDefinitionBuilder sqlExpression(final String sqlExpression) {
    request.setSqlExpression(sqlExpression);
    return this;
  }

  /**
   * Set the validator class.
   */
  public TestDefinitionBuilder validatorClass(final String validatorClass) {
    request.setValidatorClass(validatorClass);
    return this;
  }

  /**
   * Build the CreateTestDefinition request without executing it.
   */
  public CreateTestDefinition build() {
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("TestDefinition name is required");
    }
    if (request.getEntityType() == null) {
      throw new IllegalStateException("TestDefinition entityType is required");
    }
    if (nullOrEmpty(request.getTestPlatforms())) {
      throw new IllegalStateException(
          "TestDefinition testPlatforms is required and must not be empty");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public TestDefinition create() {
    return client.testDefinitions().create(build());
  }

  /**
   * Create or update (upsert).
   */
  public TestDefinition createOrUpdate() {
    return client.testDefinitions().upsert(build());
  }
}
