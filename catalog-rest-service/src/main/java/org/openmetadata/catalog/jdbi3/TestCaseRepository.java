package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.Entity.TEST_CASE;
import static org.openmetadata.catalog.Entity.TEST_DEFINITION;
import static org.openmetadata.catalog.Entity.TEST_SUITE;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.dqtests.TestSuiteResource;
import org.openmetadata.catalog.resources.feeds.MessageParser;
import org.openmetadata.catalog.test.TestCaseParameter;
import org.openmetadata.catalog.test.TestCaseParameterValue;
import org.openmetadata.catalog.tests.TestCase;
import org.openmetadata.catalog.tests.TestDefinition;
import org.openmetadata.catalog.tests.type.TestCaseResult;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.FullyQualifiedName;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;

public class TestCaseRepository extends EntityRepository<TestCase> {
  private static final String UPDATE_FIELDS = "owner,entityLink,testSuite,testDefinition";
  private static final String PATCH_FIELDS = "owner,entityLink,testSuite,testDefinition";
  public static final String TESTCASE_RESULT_EXTENSION = "testCase.testCaseResult";

  public TestCaseRepository(CollectionDAO dao) {
    super(
        TestSuiteResource.COLLECTION_PATH,
        TEST_CASE,
        TestCase.class,
        dao.testCaseDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public TestCase setFields(TestCase test, EntityUtil.Fields fields) throws IOException {
    test.setTestSuite(fields.contains("testSuite") ? getTestSuite(test) : null);
    test.setTestDefinition(fields.contains("testDefinition") ? getTestDefinition(test) : null);
    test.setTestCaseResult(fields.contains("testCaseResult") ? getTestCaseResult(test) : null);
    test.setOwner(fields.contains("owner") ? getOwner(test) : null);
    return test;
  }

  @Override
  public void prepare(TestCase test) throws IOException {
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(test.getEntityLink());
    EntityUtil.validateEntityLink(entityLink);
    // validate test definition and test suite
    Entity.getEntityReferenceById(Entity.TEST_DEFINITION, test.getTestDefinition().getId(), Include.NON_DELETED);
    Entity.getEntityReferenceById(Entity.TEST_SUITE, test.getTestSuite().getId(), Include.NON_DELETED);
    TestDefinition testDefinition =
        Entity.getEntity(test.getTestDefinition(), EntityUtil.Fields.EMPTY_FIELDS, Include.NON_DELETED);
    validateTestParameters(test.getParameterValues(), testDefinition.getParameterDefinition());
    test.setFullyQualifiedName(FullyQualifiedName.add(entityLink.getFullyQualifiedFieldValue(), test.getName()));
    test.setEntityFQN(entityLink.getFullyQualifiedFieldValue());
  }

  private EntityReference getTestSuite(TestCase test) throws IOException {
    return getFromEntityRef(test.getId(), Relationship.HAS, null, true);
  }

  private EntityReference getTestDefinition(TestCase test) throws IOException {
    return getFromEntityRef(test.getId(), Relationship.APPLIED_TO, TEST_DEFINITION, true);
  }

  private void validateTestParameters(
      List<TestCaseParameterValue> parameterValues, List<TestCaseParameter> parameterDefinition) {
    if (parameterDefinition.isEmpty() && !parameterValues.isEmpty()) {
      throw new IllegalArgumentException("Parameter Values doesn't match Test Definition Parameters");
    }
    Map<String, Object> values = new HashMap<>();
    for (TestCaseParameterValue testCaseParameterValue : parameterValues) {
      values.put(testCaseParameterValue.getName(), testCaseParameterValue.getValue());
    }
    for (TestCaseParameter parameter : parameterDefinition) {
      if (parameter.getRequired()
          && (!values.containsKey(parameter.getName()) || values.get(parameter.getName()) == null)) {
        throw new IllegalArgumentException(
            "Required parameter " + parameter.getName() + " is not passed in parameterValues");
      }
    }
  }

  @Override
  public void storeEntity(TestCase test, boolean update) throws IOException {
    EntityReference owner = test.getOwner();
    EntityReference testSuite = test.getTestSuite();
    EntityReference testDefinition = test.getTestDefinition();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    test.withOwner(null).withHref(null).withTestSuite(null).withTestDefinition(null);
    store(test.getId(), test, update);

    // Restore the relationships
    test.withOwner(owner).withTestSuite(testSuite).withTestDefinition(testDefinition);
  }

  @Override
  public void storeRelationships(TestCase test) {
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(test.getEntityLink());
    EntityReference tableRef = EntityUtil.validateEntityLink(entityLink);
    // Add relationship from testSuite to test
    addRelationship(test.getTestSuite().getId(), test.getId(), TEST_SUITE, TEST_CASE, Relationship.HAS);
    // Add relationship from entity to test
    addRelationship(tableRef.getId(), test.getId(), tableRef.getType(), TEST_CASE, Relationship.CONTAINS);
    // Add relationship from test definition to test
    addRelationship(
        test.getTestDefinition().getId(), test.getId(), TEST_DEFINITION, TEST_CASE, Relationship.APPLIED_TO);
    // Add test owner relationship
    storeOwner(test, test.getOwner());
  }

  @Transaction
  public TestCase addTestCaseResult(UUID testCaseId, TestCaseResult testCaseResult) throws IOException {
    // Validate the request content
    TestCase testCase = dao.findEntityById(testCaseId);

    TestCaseResult storedTestCaseResult =
        JsonUtils.readValue(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .getExtensionAtTimestamp(
                    testCaseId.toString(), TESTCASE_RESULT_EXTENSION, testCaseResult.getTimestamp()),
            TestCaseResult.class);
    if (storedTestCaseResult != null) {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .update(
              testCaseId.toString(),
              TESTCASE_RESULT_EXTENSION,
              JsonUtils.pojoToJson(testCaseResult),
              testCaseResult.getTimestamp());
    } else {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .insert(
              testCaseId.toString(),
              testCase.getFullyQualifiedName(),
              TESTCASE_RESULT_EXTENSION,
              "testCaseResult",
              JsonUtils.pojoToJson(testCaseResult));
      setFields(testCase, EntityUtil.Fields.EMPTY_FIELDS);
    }
    return testCase.withTestCaseResult(testCaseResult);
  }

  @Transaction
  public TestCase deleteTestCaseResult(UUID testCaseId, Long timestamp) throws IOException {
    // Validate the request content
    TestCase testCase = dao.findEntityById(testCaseId);
    TestCaseResult storedTestCaseResult =
        JsonUtils.readValue(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .getExtensionAtTimestamp(testCaseId.toString(), TESTCASE_RESULT_EXTENSION, timestamp),
            TestCaseResult.class);
    if (storedTestCaseResult != null) {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .deleteAtTimestamp(testCaseId.toString(), TESTCASE_RESULT_EXTENSION, timestamp);
      testCase.setTestCaseResult(storedTestCaseResult);
      return testCase;
    }
    throw new EntityNotFoundException(
        String.format("Failed to find testCase result for %s at %s", testCase.getName(), timestamp));
  }

  private TestCaseResult getTestCaseResult(TestCase testCase) throws IOException {
    return JsonUtils.readValue(
        daoCollection
            .entityExtensionTimeSeriesDao()
            .getLatestExtension(testCase.getId().toString(), TESTCASE_RESULT_EXTENSION),
        TestCaseResult.class);
  }

  public ResultList<TestCaseResult> getTestCaseResults(ListFilter filter, String before, String after, int limit)
      throws IOException {
    List<TestCaseResult> testCaseResults;
    int total;
    // Here timestamp is used for page marker since table profiles are sorted by timestamp
    long time = Long.MAX_VALUE;

    if (before != null) { // Reverse paging
      time = Long.parseLong(RestUtil.decodeCursor(before));
      testCaseResults =
          JsonUtils.readObjects(
              daoCollection.entityExtensionTimeSeriesDao().listBefore(filter, limit + 1, time), TestCaseResult.class);
    } else { // Forward paging or first page
      if (after != null) {
        time = Long.parseLong(RestUtil.decodeCursor(after));
      }
      testCaseResults =
          JsonUtils.readObjects(
              daoCollection.entityExtensionTimeSeriesDao().listAfter(filter, limit + 1, time), TestCaseResult.class);
    }
    total = daoCollection.entityExtensionTimeSeriesDao().listCount(filter);
    String beforeCursor = null;
    String afterCursor = null;
    if (before != null) {
      if (testCaseResults.size() > limit) { // If extra result exists, then previous page exists - return before cursor
        testCaseResults.remove(0);
        beforeCursor = testCaseResults.get(0).getTimestamp().toString();
      }
      afterCursor = testCaseResults.get(testCaseResults.size() - 1).getTimestamp().toString();
    } else {
      beforeCursor = after == null ? null : testCaseResults.get(0).getTimestamp().toString();
      if (testCaseResults.size() > limit) { // If extra result exists, then next page exists - return after cursor
        testCaseResults.remove(limit);
        afterCursor = testCaseResults.get(limit - 1).getTimestamp().toString();
      }
    }
    return new ResultList<>(testCaseResults, beforeCursor, afterCursor, total);
  }

  @Override
  public EntityUpdater getUpdater(TestCase original, TestCase updated, Operation operation) {
    return new TestUpdater(original, updated, operation);
  }

  public class TestUpdater extends EntityUpdater {
    public TestUpdater(TestCase original, TestCase updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      MessageParser.EntityLink origEntityLink = MessageParser.EntityLink.parse(original.getEntityLink());
      EntityReference origTableRef = EntityUtil.validateEntityLink(origEntityLink);

      MessageParser.EntityLink updatedEntityLink = MessageParser.EntityLink.parse(updated.getEntityLink());
      EntityReference updatedTableRef = EntityUtil.validateEntityLink(updatedEntityLink);

      updateFromRelationships(
          "entity",
          updatedTableRef.getType(),
          new ArrayList<>(List.of(origTableRef)),
          new ArrayList<>(List.of(updatedTableRef)),
          Relationship.CONTAINS,
          TEST_CASE,
          updated.getId());
      updateFromRelationships(
          "testSuite",
          TEST_SUITE,
          new ArrayList<>(List.of(original.getTestSuite())),
          new ArrayList<>(List.of(updated.getTestSuite())),
          Relationship.HAS,
          TEST_CASE,
          updated.getId());
      updateFromRelationships(
          "testDefinition",
          TEST_DEFINITION,
          new ArrayList<>(List.of(original.getTestDefinition())),
          new ArrayList<>(List.of(updated.getTestDefinition())),
          Relationship.APPLIED_TO,
          TEST_CASE,
          updated.getId());
      recordChange("parameterValues", original.getParameterValues(), updated.getParameterValues());
    }
  }
}
