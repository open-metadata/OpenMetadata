package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_DEFINITION;
import static org.openmetadata.service.Entity.TEST_SUITE;
import static org.openmetadata.service.util.RestUtil.ENTITY_NO_CHANGE;
import static org.openmetadata.service.util.RestUtil.ENTITY_UPDATED;
import static org.openmetadata.service.util.RestUtil.LOGICAL_TEST_CASES_ADDED;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.json.JsonPatch;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameter;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

public class TestCaseRepository extends EntityRepository<TestCase> {
  private static final String TEST_SUITE_FIELD = "testSuite";
  private static final String TEST_CASE_RESULT_FIELD = "testCaseResult";
  public static final String COLLECTION_PATH = "/v1/dataQuality/testCases";
  private static final String UPDATE_FIELDS = "entityLink,testSuite,testDefinition";
  private static final String PATCH_FIELDS = "entityLink,testSuite,testDefinition";
  public static final String TESTCASE_RESULT_EXTENSION = "testCase.testCaseResult";

  public TestCaseRepository(CollectionDAO dao) {
    super(COLLECTION_PATH, TEST_CASE, TestCase.class, dao.testCaseDAO(), dao, PATCH_FIELDS, UPDATE_FIELDS);
  }

  @Override
  public TestCase setFields(TestCase test, Fields fields) {
    test.setTestSuites(fields.contains("testSuites") ? getTestSuites(test) : test.getTestSuites());
    test.setTestSuite(fields.contains(TEST_SUITE_FIELD) ? getTestSuite(test) : test.getTestSuite());
    test.setTestDefinition(fields.contains(TEST_DEFINITION) ? getTestDefinition(test) : test.getTestDefinition());
    return test.withTestCaseResult(
        fields.contains(TEST_CASE_RESULT_FIELD) ? getTestCaseResult(test) : test.getTestCaseResult());
  }

  @Override
  public TestCase clearFields(TestCase test, Fields fields) {
    test.setTestSuites(fields.contains("testSuites") ? test.getTestSuites() : null);
    test.setTestSuite(fields.contains(TEST_SUITE) ? test.getTestSuite() : null);
    test.setTestDefinition(fields.contains(TEST_DEFINITION) ? test.getTestDefinition() : null);
    return test.withTestCaseResult(fields.contains(TEST_CASE_RESULT_FIELD) ? test.getTestCaseResult() : null);
  }

  public RestUtil.PatchResponse<TestCaseResult> patchTestCaseResults(
      String fqn, Long timestamp, String user, JsonPatch patch) {
    String change = ENTITY_NO_CHANGE;
    TestCaseResult original =
        JsonUtils.readValue(
            daoCollection
                .dataQualityDataTimeSeriesDao()
                .getExtensionAtTimestamp(fqn, TESTCASE_RESULT_EXTENSION, timestamp),
            TestCaseResult.class);

    TestCaseResult updated = JsonUtils.applyPatch(original, patch, TestCaseResult.class);

    if (!Objects.equals(original.getTestCaseFailureStatus(), updated.getTestCaseFailureStatus())) {
      updated.getTestCaseFailureStatus().setUpdatedBy(user);
      updated.getTestCaseFailureStatus().setUpdatedAt(System.currentTimeMillis());
      daoCollection
          .dataQualityDataTimeSeriesDao()
          .update(fqn, TESTCASE_RESULT_EXTENSION, JsonUtils.pojoToJson(updated), timestamp);
      change = ENTITY_UPDATED;
    }
    return new RestUtil.PatchResponse<>(Response.Status.OK, updated, change);
  }

  @Override
  public void setFullyQualifiedName(TestCase test) {
    EntityLink entityLink = EntityLink.parse(test.getEntityLink());
    test.setFullyQualifiedName(
        FullyQualifiedName.add(
            entityLink.getFullyQualifiedFieldValue(), EntityInterfaceUtil.quoteName(test.getName())));
    test.setEntityFQN(entityLink.getFullyQualifiedFieldValue());
  }

  @Override
  public void prepare(TestCase test, boolean update) {
    EntityLink entityLink = EntityLink.parse(test.getEntityLink());
    EntityUtil.validateEntityLink(entityLink);

    // validate test definition and test suite
    TestSuite testSuite = Entity.getEntity(test.getTestSuite(), "", Include.NON_DELETED);
    test.setTestSuite(testSuite.getEntityReference());

    TestDefinition testDefinition = Entity.getEntity(test.getTestDefinition(), "", Include.NON_DELETED);
    test.setTestDefinition(testDefinition.getEntityReference());

    validateTestParameters(test.getParameterValues(), testDefinition.getParameterDefinition());
  }

  private EntityReference getTestSuite(TestCase test) {
    // `testSuite` field returns the executable `testSuite` linked to that testCase
    List<CollectionDAO.EntityRelationshipRecord> records =
        findFromRecords(test.getId(), entityType, Relationship.CONTAINS, TEST_SUITE);
    ensureSingleRelationship(entityType, test.getId(), records, Relationship.CONTAINS.value(), true);
    for (CollectionDAO.EntityRelationshipRecord testSuiteId : records) {
      TestSuite testSuite = Entity.getEntity(TEST_SUITE, testSuiteId.getId(), "", Include.ALL);
      if (Boolean.TRUE.equals(testSuite.getExecutable())) {
        return testSuite.getEntityReference();
      }
    }
    return null;
  }

  private List<TestSuite> getTestSuites(TestCase test) {
    // `testSuites` field returns all the `testSuite` (executable and logical) linked to that testCase
    List<CollectionDAO.EntityRelationshipRecord> records =
        findFromRecords(test.getId(), entityType, Relationship.CONTAINS, TEST_SUITE);
    ensureSingleRelationship(entityType, test.getId(), records, Relationship.CONTAINS.value(), true);
    return records.stream()
        .map(testSuiteId -> Entity.<TestSuite>getEntity(TEST_SUITE, testSuiteId.getId(), "", Include.ALL))
        .collect(Collectors.toList());
  }

  private EntityReference getTestDefinition(TestCase test) {
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
  public void storeEntity(TestCase test, boolean update) {
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
    EntityLink entityLink = EntityLink.parse(test.getEntityLink());
    EntityUtil.validateEntityLink(entityLink);
    // Add relationship from testSuite to test
    addRelationship(test.getTestSuite().getId(), test.getId(), TEST_SUITE, TEST_CASE, Relationship.CONTAINS);
    // Add relationship from test definition to test
    addRelationship(
        test.getTestDefinition().getId(), test.getId(), TEST_DEFINITION, TEST_CASE, Relationship.APPLIED_TO);
  }

  @Transaction
  public RestUtil.PutResponse<?> addTestCaseResult(
      String updatedBy, UriInfo uriInfo, String fqn, TestCaseResult testCaseResult) {
    // Validate the request content
    TestCase testCase = dao.findEntityByName(fqn);

    daoCollection
        .dataQualityDataTimeSeriesDao()
        .insert(
            testCase.getFullyQualifiedName(),
            TESTCASE_RESULT_EXTENSION,
            TEST_CASE_RESULT_FIELD,
            JsonUtils.pojoToJson(testCaseResult));

    setFieldsInternal(testCase, new EntityUtil.Fields(allowedFields, TEST_SUITE_FIELD));
    setTestSuiteSummary(testCase, testCaseResult.getTimestamp(), testCaseResult.getTestCaseStatus());
    ChangeDescription change = addTestCaseChangeDescription(testCase.getVersion(), testCaseResult);
    ChangeEvent changeEvent =
        getChangeEvent(updatedBy, withHref(uriInfo, testCase), change, entityType, testCase.getVersion());

    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
  }

  @Transaction
  public RestUtil.PutResponse<?> deleteTestCaseResult(String updatedBy, String fqn, Long timestamp) {
    // Validate the request content
    TestCase testCase = dao.findEntityByName(fqn);
    TestCaseResult storedTestCaseResult =
        JsonUtils.readValue(
            daoCollection
                .dataQualityDataTimeSeriesDao()
                .getExtensionAtTimestamp(fqn, TESTCASE_RESULT_EXTENSION, timestamp),
            TestCaseResult.class);

    if (storedTestCaseResult != null) {
      daoCollection.dataQualityDataTimeSeriesDao().deleteAtTimestamp(fqn, TESTCASE_RESULT_EXTENSION, timestamp);
      testCase.setTestCaseResult(storedTestCaseResult);
      ChangeDescription change = deleteTestCaseChangeDescription(testCase.getVersion(), storedTestCaseResult);
      ChangeEvent changeEvent = getChangeEvent(updatedBy, testCase, change, entityType, testCase.getVersion());
      return new RestUtil.PutResponse<>(Response.Status.OK, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
    }
    throw new EntityNotFoundException(
        String.format("Failed to find testCase result for %s at %s", testCase.getName(), timestamp));
  }

  private void setTestSuiteSummary(TestCase testCase, Long timestamp, TestCaseStatus testCaseStatus) {
    ResultSummary resultSummary =
        new ResultSummary()
            .withTestCaseName(testCase.getFullyQualifiedName())
            .withStatus(testCaseStatus)
            .withTimestamp(timestamp);
    EntityReference ref = testCase.getTestSuite();
    TestSuite testSuite = Entity.getEntity(ref.getType(), ref.getId(), "", Include.ALL, false);
    List<ResultSummary> resultSummaries = listOrEmpty(testSuite.getTestCaseResultSummary());
    if (resultSummaries.isEmpty()) {
      resultSummaries.add(resultSummary);
    } else {
      // We'll remove the existing summary for this test case and add the new one
      resultSummaries.removeIf(summary -> summary.getTestCaseName().equals(resultSummary.getTestCaseName()));
      resultSummaries.add(resultSummary);
    }

    testSuite.setTestCaseResultSummary(resultSummaries);
    daoCollection
        .testSuiteDAO()
        .update(testSuite.getId(), testSuite.getFullyQualifiedName(), JsonUtils.pojoToJson(testSuite));
  }

  private ChangeDescription addTestCaseChangeDescription(Double version, Object newValue) {
    FieldChange fieldChange = new FieldChange().withName(TEST_CASE_RESULT_FIELD).withNewValue(newValue);
    ChangeDescription change = new ChangeDescription().withPreviousVersion(version);
    change.getFieldsAdded().add(fieldChange);
    return change;
  }

  private ChangeDescription deleteTestCaseChangeDescription(Double version, Object oldValue) {
    FieldChange fieldChange = new FieldChange().withName(TEST_CASE_RESULT_FIELD).withOldValue(oldValue);
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

  private TestCaseResult getTestCaseResult(TestCase testCase) {
    return JsonUtils.readValue(
        daoCollection
            .dataQualityDataTimeSeriesDao()
            .getLatestExtension(testCase.getFullyQualifiedName(), TESTCASE_RESULT_EXTENSION),
        TestCaseResult.class);
  }

  public ResultList<TestCaseResult> getTestCaseResults(String fqn, Long startTs, Long endTs) {
    List<TestCaseResult> testCaseResults;
    testCaseResults =
        JsonUtils.readObjects(
            daoCollection
                .dataQualityDataTimeSeriesDao()
                .listBetweenTimestampsByOrder(
                    fqn, TESTCASE_RESULT_EXTENSION, startTs, endTs, EntityTimeSeriesDAO.OrderBy.DESC),
            TestCaseResult.class);
    return new ResultList<>(testCaseResults, String.valueOf(startTs), String.valueOf(endTs), testCaseResults.size());
  }

  public int getTestCaseCount(List<UUID> testCaseIds) {
    return daoCollection.testCaseDAO().countOfTestCases(testCaseIds);
  }

  public void isTestSuiteExecutable(String testSuiteFqn) {
    TestSuite testSuite = Entity.getEntityByName(Entity.TEST_SUITE, testSuiteFqn, null, null);
    if (Boolean.FALSE.equals(testSuite.getExecutable())) {
      throw new IllegalArgumentException(
          "Test suite "
              + testSuite.getName()
              + " is not executable. Cannot create test cases for non-executable test suites.");
    }
  }

  public RestUtil.PutResponse<TestSuite> addTestCasesToLogicalTestSuite(TestSuite testSuite, List<UUID> testCaseIds) {
    bulkAddToRelationship(testSuite.getId(), testCaseIds, TEST_SUITE, TEST_CASE, Relationship.CONTAINS);
    List<EntityReference> testCasesEntityReferences = new ArrayList<>();
    for (UUID testCaseId : testCaseIds) {
      TestCase testCase = Entity.getEntity(Entity.TEST_CASE, testCaseId, "", Include.ALL);
      testCasesEntityReferences.add(
          new EntityReference()
              .withId(testCase.getId())
              .withName(testCase.getName())
              .withFullyQualifiedName(testCase.getFullyQualifiedName())
              .withDescription(testCase.getDescription())
              .withDisplayName(testCase.getDisplayName())
              .withHref(testCase.getHref())
              .withDeleted(testCase.getDeleted()));
    }
    testSuite.setTests(testCasesEntityReferences);
    return new RestUtil.PutResponse<>(Response.Status.OK, testSuite, LOGICAL_TEST_CASES_ADDED);
  }

  public RestUtil.DeleteResponse<TestCase> deleteTestCaseFromLogicalTestSuite(UUID testSuiteId, UUID testCaseId) {
    TestCase testCase = Entity.getEntity(Entity.TEST_CASE, testCaseId, null, null);
    deleteRelationship(testSuiteId, TEST_SUITE, testCaseId, TEST_CASE, Relationship.CONTAINS);
    EntityReference entityReference = Entity.getEntityReferenceById(TEST_SUITE, testSuiteId, Include.ALL);
    testCase.setTestSuite(entityReference);
    return new RestUtil.DeleteResponse<>(testCase, RestUtil.ENTITY_DELETED);
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
    public void entitySpecificUpdate() {
      EntityLink origEntityLink = EntityLink.parse(original.getEntityLink());
      EntityReference origTableRef = EntityUtil.validateEntityLink(origEntityLink);

      EntityLink updatedEntityLink = EntityLink.parse(updated.getEntityLink());
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
          TEST_SUITE_FIELD,
          TEST_SUITE,
          original.getTestSuite(),
          updated.getTestSuite(),
          Relationship.HAS,
          TEST_CASE,
          updated.getId());
      updateFromRelationship(
          TEST_DEFINITION,
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
