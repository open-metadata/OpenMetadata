package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_DEFINITION;
import static org.openmetadata.service.Entity.TEST_SUITE;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameter;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

public class TestCaseRepository extends EntityRepository<TestCase> {
  public static final String COLLECTION_PATH = "/v1/dataQuality/testCases";
  private static final String UPDATE_FIELDS = "owner,entityLink,testSuite,testDefinition";
  private static final String PATCH_FIELDS = "owner,entityLink,testSuite,testDefinition";
  public static final String TESTCASE_RESULT_EXTENSION = "testCase.testCaseResult";

  public TestCaseRepository(CollectionDAO dao) {
    super(COLLECTION_PATH, TEST_CASE, TestCase.class, dao.testCaseDAO(), dao, PATCH_FIELDS, UPDATE_FIELDS);
  }

  @Override
  public TestCase setFields(TestCase test, EntityUtil.Fields fields) throws IOException {
    test.setTestSuite(fields.contains("testSuite") ? getTestSuite(test) : null);
    test.setTestDefinition(fields.contains("testDefinition") ? getTestDefinition(test) : null);
    return test.withTestCaseResult(fields.contains("testCaseResult") ? getTestCaseResult(test) : null);
  }

  @Override
  public void setFullyQualifiedName(TestCase test) {
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(test.getEntityLink());
    test.setFullyQualifiedName(FullyQualifiedName.add(entityLink.getFullyQualifiedFieldValue(), test.getName()));
    test.setEntityFQN(entityLink.getFullyQualifiedFieldValue());
  }

  @Override
  public void prepare(TestCase test) throws IOException {
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(test.getEntityLink());
    EntityUtil.validateEntityLink(entityLink);

    // validate test definition and test suite
    TestSuite testSuite = Entity.getEntity(test.getTestSuite(), "", Include.NON_DELETED);
    test.setTestSuite(testSuite.getEntityReference());

    TestDefinition testDefinition = Entity.getEntity(test.getTestDefinition(), "", Include.NON_DELETED);
    test.setTestDefinition(testDefinition.getEntityReference());

    validateTestParameters(test.getParameterValues(), testDefinition.getParameterDefinition());
  }

  private EntityReference getTestSuite(TestCase test) throws IOException {
    return getFromEntityRef(test.getId(), Relationship.CONTAINS, TEST_SUITE, true);
  }

  private EntityReference getTestDefinition(TestCase test) throws IOException {
    return getFromEntityRef(test.getId(), Relationship.APPLIED_TO, TEST_DEFINITION, true);
  }

  private void validateTestParameters(
      List<TestCaseParameterValue> parameterValues, List<TestCaseParameter> parameterDefinition) {
    if (parameterValues != null) {

      if (parameterDefinition.isEmpty() && !parameterValues.isEmpty()) {
        throw new IllegalArgumentException("Parameter Values doesn't match Test Definition Parameters");
      }
      Map<String, Object> values = new HashMap<>();

      for (TestCaseParameterValue testCaseParameterValue : parameterValues) {
        values.put(testCaseParameterValue.getName(), testCaseParameterValue.getValue());
      }
      for (TestCaseParameter parameter : parameterDefinition) {
        if (Boolean.TRUE.equals(parameter.getRequired())
            && (!values.containsKey(parameter.getName()) || values.get(parameter.getName()) == null)) {
          throw new IllegalArgumentException(
              "Required parameter " + parameter.getName() + " is not passed in parameterValues");
        }
      }
    }
  }

  @Override
  public void storeEntity(TestCase test, boolean update) throws IOException {
    EntityReference testSuite = test.getTestSuite();
    EntityReference testDefinition = test.getTestDefinition();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    test.withTestSuite(null).withTestDefinition(null);
    store(test, update);

    // Restore the relationships
    test.withTestSuite(testSuite).withTestDefinition(testDefinition);
  }

  @Override
  public void storeRelationships(TestCase test) {
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(test.getEntityLink());
    EntityReference tableRef = EntityUtil.validateEntityLink(entityLink);
    // Add relationship from testSuite to test
    addRelationship(test.getTestSuite().getId(), test.getId(), TEST_SUITE, TEST_CASE, Relationship.CONTAINS);
    // Add relationship from entity to test
    addRelationship(tableRef.getId(), test.getId(), tableRef.getType(), TEST_CASE, Relationship.CONTAINS);
    // Add relationship from test definition to test
    addRelationship(
        test.getTestDefinition().getId(), test.getId(), TEST_DEFINITION, TEST_CASE, Relationship.APPLIED_TO);
    // Add test owner relationship
    storeOwner(test, test.getOwner());
  }

  @Transaction
  public RestUtil.PutResponse<?> addTestCaseResult(
      String updatedBy, UriInfo uriInfo, String fqn, TestCaseResult testCaseResult) throws IOException {
    // Validate the request content
    TestCase testCase = dao.findEntityByName(fqn);

    TestCaseResult storedTestCaseResult =
        JsonUtils.readValue(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .getExtensionAtTimestamp(
                    testCase.getFullyQualifiedName(), TESTCASE_RESULT_EXTENSION, testCaseResult.getTimestamp()),
            TestCaseResult.class);
    if (storedTestCaseResult != null) {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .update(
              testCase.getFullyQualifiedName(),
              TESTCASE_RESULT_EXTENSION,
              JsonUtils.pojoToJson(testCaseResult),
              testCaseResult.getTimestamp());
    } else {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .insert(
              testCase.getFullyQualifiedName(),
              TESTCASE_RESULT_EXTENSION,
              "testCaseResult",
              JsonUtils.pojoToJson(testCaseResult));
    }
    setFieldsInternal(testCase, new EntityUtil.Fields(allowedFields, "testSuite"));
    ChangeDescription change =
        addTestCaseChangeDescription(testCase.getVersion(), testCaseResult, storedTestCaseResult);
    ChangeEvent changeEvent =
        getChangeEvent(updatedBy, withHref(uriInfo, testCase), change, entityType, testCase.getVersion());

    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
  }

  @Transaction
  public RestUtil.PutResponse<?> deleteTestCaseResult(String updatedBy, String fqn, Long timestamp) throws IOException {
    // Validate the request content
    TestCase testCase = dao.findEntityByName(fqn);
    TestCaseResult storedTestCaseResult =
        JsonUtils.readValue(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .getExtensionAtTimestamp(fqn, TESTCASE_RESULT_EXTENSION, timestamp),
            TestCaseResult.class);
    if (storedTestCaseResult != null) {
      daoCollection.entityExtensionTimeSeriesDao().deleteAtTimestamp(fqn, TESTCASE_RESULT_EXTENSION, timestamp);
      testCase.setTestCaseResult(storedTestCaseResult);
      ChangeDescription change = deleteTestCaseChangeDescription(testCase.getVersion(), storedTestCaseResult);
      ChangeEvent changeEvent = getChangeEvent(updatedBy, testCase, change, entityType, testCase.getVersion());
      return new RestUtil.PutResponse<>(Response.Status.OK, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
    }
    throw new EntityNotFoundException(
        String.format("Failed to find testCase result for %s at %s", testCase.getName(), timestamp));
  }

  private ChangeDescription addTestCaseChangeDescription(Double version, Object newValue, Object oldValue) {
    FieldChange fieldChange =
        new FieldChange().withName("testCaseResult").withNewValue(newValue).withOldValue(oldValue);
    ChangeDescription change = new ChangeDescription().withPreviousVersion(version);
    change.getFieldsUpdated().add(fieldChange);
    return change;
  }

  private ChangeDescription deleteTestCaseChangeDescription(Double version, Object oldValue) {
    FieldChange fieldChange = new FieldChange().withName("testCaseResult").withOldValue(oldValue);
    ChangeDescription change = new ChangeDescription().withPreviousVersion(version);
    change.getFieldsDeleted().add(fieldChange);
    return change;
  }

  private ChangeEvent getChangeEvent(
      String updatedBy, EntityInterface updated, ChangeDescription change, String entityType, Double prevVersion) {
    return new ChangeEvent()
        .withEntity(updated)
        .withChangeDescription(change)
        .withEventType(EventType.ENTITY_UPDATED)
        .withEntityType(entityType)
        .withEntityId(updated.getId())
        .withEntityFullyQualifiedName(updated.getFullyQualifiedName())
        .withUserName(updatedBy)
        .withTimestamp(System.currentTimeMillis())
        .withCurrentVersion(updated.getVersion())
        .withPreviousVersion(prevVersion);
  }

  private TestCaseResult getTestCaseResult(TestCase testCase) throws IOException {
    return JsonUtils.readValue(
        daoCollection
            .entityExtensionTimeSeriesDao()
            .getLatestExtension(testCase.getFullyQualifiedName(), TESTCASE_RESULT_EXTENSION),
        TestCaseResult.class);
  }

  public ResultList<TestCaseResult> getTestCaseResults(String fqn, Long startTs, Long endTs) throws IOException {
    List<TestCaseResult> testCaseResults;
    testCaseResults =
        JsonUtils.readObjects(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .listBetweenTimestamps(fqn, TESTCASE_RESULT_EXTENSION, startTs, endTs),
            TestCaseResult.class);

    return new ResultList<>(testCaseResults, String.valueOf(startTs), String.valueOf(endTs), testCaseResults.size());
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

      updateFromRelationship(
          "entity",
          updatedTableRef.getType(),
          origTableRef,
          updatedTableRef,
          Relationship.CONTAINS,
          TEST_CASE,
          updated.getId());
      updateFromRelationship(
          "testSuite",
          TEST_SUITE,
          original.getTestSuite(),
          updated.getTestSuite(),
          Relationship.HAS,
          TEST_CASE,
          updated.getId());
      updateFromRelationship(
          "testDefinition",
          TEST_DEFINITION,
          original.getTestDefinition(),
          updated.getTestDefinition(),
          Relationship.APPLIED_TO,
          TEST_CASE,
          updated.getId());
      recordChange("parameterValues", original.getParameterValues(), updated.getParameterValues());
    }
  }
}
