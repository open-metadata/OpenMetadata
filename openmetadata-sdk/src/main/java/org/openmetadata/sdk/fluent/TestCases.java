package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Pure Fluent API for TestCase operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.TestCases.*;
 *
 * // Create
 * TestCase testCase = create()
 *     .name("test_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * TestCase testCase = find(testCaseId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * TestCase updated = find(testCaseId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(testCaseId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(testCase -> process(testCase));
 * </pre>
 */
public final class TestCases {
  private static OpenMetadataClient defaultClient;

  private TestCases() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call TestCases.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static TestCaseCreator create() {
    return new TestCaseCreator(getClient());
  }

  public static TestCase create(TestCase request) {
    return getClient().testCases().create(request);
  }

  // ==================== Finding/Retrieval ====================

  public static TestCaseFinder find(String id) {
    return new TestCaseFinder(getClient(), id);
  }

  public static TestCaseFinder find(UUID id) {
    return find(id.toString());
  }

  public static TestCaseFinder findByName(String fqn) {
    return new TestCaseFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static TestCaseLister list() {
    return new TestCaseLister(getClient());
  }

  // ==================== Creator ====================

  public static class TestCaseCreator {
    private final OpenMetadataClient client;
    private final TestCase request = new TestCase();

    TestCaseCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public TestCaseCreator name(String name) {
      request.setName(name);
      return this;
    }

    public TestCaseCreator displayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public TestCaseCreator description(String description) {
      request.setDescription(description);
      return this;
    }

    public TestCase execute() {
      return client.testCases().create(request);
    }
  }

  // ==================== Finder ====================

  public static class TestCaseFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final List<String> includes = new ArrayList<>();

    TestCaseFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    TestCaseFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public TestCaseFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public TestCaseFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public TestCaseFinder includeTestCaseResults() {
      includes.add("testCaseResults");
      return this;
    }

    public TestCaseFinder includeAll() {
      includes.add("all");
      return this;
    }

    public FluentTestCase fetch() {
      String fields = includes.isEmpty() ? null : String.join(",", includes);
      TestCase testCase =
          isFqn
              ? client.testCases().getByName(identifier, fields)
              : client.testCases().get(identifier, fields);
      return new FluentTestCase(client, testCase);
    }

    public DeleteOperation delete() {
      return new DeleteOperation(client, identifier);
    }
  }

  // ==================== FluentTestCase ====================

  public static class FluentTestCase {
    private final OpenMetadataClient client;
    private final TestCase testCase;

    FluentTestCase(OpenMetadataClient client, TestCase testCase) {
      this.client = client;
      this.testCase = testCase;
    }

    public FluentTestCase withDescription(String description) {
      testCase.setDescription(description);
      return this;
    }

    public FluentTestCase withDisplayName(String displayName) {
      testCase.setDisplayName(displayName);
      return this;
    }

    public TestCase save() {
      return client.testCases().update(testCase.getId().toString(), testCase);
    }

    public TestCase get() {
      return testCase;
    }
  }

  // ==================== Lister ====================

  public static class TestCaseLister {
    private final OpenMetadataClient client;
    private final ListParams params = new ListParams();

    TestCaseLister(OpenMetadataClient client) {
      this.client = client;
    }

    public TestCaseLister limit(int limit) {
      params.setLimit(limit);
      return this;
    }

    public TestCaseLister before(String before) {
      params.setBefore(before);
      return this;
    }

    public TestCaseLister after(String after) {
      params.setAfter(after);
      return this;
    }

    public TestCaseLister fields(String fields) {
      params.setFields(fields);
      return this;
    }

    public ListResponse<TestCase> execute() {
      return client.testCases().list(params);
    }

    public void forEach(java.util.function.Consumer<TestCase> action) {
      ListResponse<TestCase> response = execute();
      response.getData().forEach(action);
    }
  }

  // ==================== Delete Operation ====================

  public static class DeleteOperation {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    DeleteOperation(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public DeleteOperation recursively() {
      this.recursive = true;
      return this;
    }

    public DeleteOperation permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.testCases().delete(id, params.isEmpty() ? null : params);
    }
  }
}
