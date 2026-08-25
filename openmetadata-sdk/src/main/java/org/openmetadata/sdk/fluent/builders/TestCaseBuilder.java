package org.openmetadata.sdk.fluent.builders;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating TestCase entities.
 *
 * <pre>
 * TestCase testCase = TestCaseBuilder.create(client)
 *     .name("row_count_test")
 *     .forTable(table)
 *     .testDefinition("tableRowCountToEqual")
 *     .parameter("value", "100")
 *     .description("Test row count equals 100")
 *     .create();
 *
 * // Column-level test
 * TestCase columnTest = TestCaseBuilder.create(client)
 *     .name("not_null_test")
 *     .forColumn(table, "id")
 *     .testDefinition("columnValuesToBeNotNull")
 *     .create();
 * </pre>
 */
public class TestCaseBuilder {
  private final OpenMetadataClient client;
  private final CreateTestCase request;
  private final List<TestCaseParameterValue> parameters = new ArrayList<>();

  public TestCaseBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateTestCase();
  }

  public static TestCaseBuilder create(OpenMetadataClient client) {
    return new TestCaseBuilder(client);
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
   * Set the entity link for a table-level test (required).
   */
  public TestCaseBuilder forTable(Table table) {
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    return this;
  }

  /**
   * Set the entity link for a table-level test using FQN (required).
   */
  public TestCaseBuilder forTable(String tableFqn) {
    request.setEntityLink("<#E::table::" + tableFqn + ">");
    return this;
  }

  /**
   * Set the entity link for a column-level test (required).
   */
  public TestCaseBuilder forColumn(Table table, String columnName) {
    request.setEntityLink(
        "<#E::table::" + table.getFullyQualifiedName() + "::columns::" + columnName + ">");
    return this;
  }

  /**
   * Set the entity link for a column-level test using FQN (required).
   */
  public TestCaseBuilder forColumn(String tableFqn, String columnName) {
    request.setEntityLink("<#E::table::" + tableFqn + "::columns::" + columnName + ">");
    return this;
  }

  /**
   * Set the entity link directly (required).
   */
  public TestCaseBuilder entityLink(String entityLink) {
    request.setEntityLink(entityLink);
    return this;
  }

  /**
   * Set the test definition name (required).
   */
  public TestCaseBuilder testDefinition(String testDefinitionName) {
    request.setTestDefinition(testDefinitionName);
    return this;
  }

  /**
   * Add a parameter value for the test.
   */
  public TestCaseBuilder parameter(String name, String value) {
    parameters.add(new TestCaseParameterValue().withName(name).withValue(value));
    return this;
  }

  /**
   * Set all parameter values at once.
   */
  public TestCaseBuilder parameters(List<TestCaseParameterValue> params) {
    parameters.clear();
    parameters.addAll(params);
    return this;
  }

  /**
   * Set the owners.
   */
  public TestCaseBuilder owners(List<EntityReference> owners) {
    request.setOwners(owners);
    return this;
  }

  /**
   * Set a single owner.
   */
  public TestCaseBuilder owner(EntityReference owner) {
    request.setOwners(List.of(owner));
    return this;
  }

  /**
   * Set computePassedFailedRowCount flag.
   */
  public TestCaseBuilder computePassedFailedRowCount(boolean value) {
    request.setComputePassedFailedRowCount(value);
    return this;
  }

  /**
   * Set useDynamicAssertion flag.
   */
  public TestCaseBuilder useDynamicAssertion(boolean value) {
    request.setUseDynamicAssertion(value);
    return this;
  }

  /**
   * Build the CreateTestCase request without executing it.
   */
  public CreateTestCase build() {
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("TestCase name is required");
    }
    if (request.getEntityLink() == null || request.getEntityLink().isEmpty()) {
      throw new IllegalStateException(
          "TestCase entityLink is required (use forTable() or forColumn())");
    }
    if (request.getTestDefinition() == null || request.getTestDefinition().isEmpty()) {
      throw new IllegalStateException("TestCase testDefinition is required");
    }

    if (!parameters.isEmpty()) {
      request.setParameterValues(parameters);
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public TestCase create() {
    return client.testCases().create(build());
  }

  /**
   * Create or update (upsert).
   */
  public TestCase createOrUpdate() {
    return client.testCases().upsert(build());
  }
}
