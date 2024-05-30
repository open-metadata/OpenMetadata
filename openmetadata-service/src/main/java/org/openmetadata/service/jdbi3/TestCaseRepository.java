package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.schema.type.EventType.ENTITY_FIELDS_CHANGED;
import static org.openmetadata.schema.type.EventType.ENTITY_NO_CHANGE;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.schema.type.EventType.LOGICAL_TEST_CASE_ADDED;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.FIELD_OWNER;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_DEFINITION;
import static org.openmetadata.service.Entity.TEST_SUITE;
import static org.openmetadata.service.Entity.getEntityByName;
import static org.openmetadata.service.Entity.getEntityReferenceByName;
import static org.openmetadata.service.Entity.populateEntityFieldTags;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.security.mask.PIIMasker.maskSampleData;

import com.google.common.collect.ImmutableSet;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameter;
import org.openmetadata.schema.tests.TestCaseParameterValidationRule;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.Resolved;
import org.openmetadata.schema.tests.type.TestCaseFailureReasonType;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.TestCaseParameterValidationRuleType;
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

@Slf4j
public class TestCaseRepository extends EntityRepository<TestCase> {
  private static final String TEST_SUITE_FIELD = "testSuite";
  private static final String TEST_CASE_RESULT_FIELD = "testCaseResult";
  private static final String INCIDENTS_FIELD = "incidentId";
  public static final String COLLECTION_PATH = "/v1/dataQuality/testCases";
  private static final String UPDATE_FIELDS =
      "owner,entityLink,testSuite,testSuites,testDefinition";
  private static final String PATCH_FIELDS =
      "owner,entityLink,testSuite,testDefinition,computePassedFailedRowCount";
  public static final String TESTCASE_RESULT_EXTENSION = "testCase.testCaseResult";
  public static final String FAILED_ROWS_SAMPLE_EXTENSION = "testCase.failedRowsSample";

  public TestCaseRepository() {
    super(
        COLLECTION_PATH,
        TEST_CASE,
        TestCase.class,
        Entity.getCollectionDAO().testCaseDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
    supportsSearch = true;
  }

  @Override
  public void setFields(TestCase test, Fields fields) {
    test.setTestSuites(fields.contains("testSuites") ? getTestSuites(test) : test.getTestSuites());
    test.setTestSuite(fields.contains(TEST_SUITE_FIELD) ? getTestSuite(test) : test.getTestSuite());
    test.setTestDefinition(
        fields.contains(TEST_DEFINITION) ? getTestDefinition(test) : test.getTestDefinition());
    test.setTestCaseResult(
        fields.contains(TEST_CASE_RESULT_FIELD)
            ? getTestCaseResult(test)
            : test.getTestCaseResult());
    test.setIncidentId(
        fields.contains(INCIDENTS_FIELD) ? getIncidentId(test) : test.getIncidentId());
    test.setTags(fields.contains(FIELD_TAGS) ? getTestCaseTags(test) : test.getTags());
  }

  @Override
  public void setInheritedFields(TestCase testCase, Fields fields) {
    EntityLink entityLink = EntityLink.parse(testCase.getEntityLink());
    Table table = Entity.getEntity(entityLink, "owner,domain,tags,columns", ALL);
    inheritOwner(testCase, fields, table);
    inheritDomain(testCase, fields, table);
    inheritTags(testCase, fields, table);
  }

  private void inheritTags(TestCase testCase, Fields fields, Table table) {
    if (fields.contains(FIELD_TAGS)) {
      List<TagLabel> tags = new ArrayList<>();
      EntityLink entityLink = EntityLink.parse(testCase.getEntityLink());
      tags.addAll(table.getTags());
      if (entityLink.getFieldName() != null && entityLink.getFieldName().equals("columns")) {
        // if we have a column test case get the columns tags as well
        table.getColumns().stream()
            .filter(column -> column.getName().equals(entityLink.getArrayFieldName()))
            .findFirst()
            .ifPresent(column -> tags.addAll(column.getTags()));
      }
      testCase.setTags(tags);
    }
  }

  @Override
  public EntityInterface getParentEntity(TestCase entity, String fields) {
    return Entity.getEntity(entity.getTestSuite(), fields, Include.NON_DELETED);
  }

  @Override
  public void clearFields(TestCase test, Fields fields) {
    test.setTestSuites(fields.contains("testSuites") ? test.getTestSuites() : null);
    test.setTestSuite(fields.contains(TEST_SUITE) ? test.getTestSuite() : null);
    test.setTestDefinition(fields.contains(TEST_DEFINITION) ? test.getTestDefinition() : null);
    test.setTestCaseResult(
        fields.contains(TEST_CASE_RESULT_FIELD) ? test.getTestCaseResult() : null);
  }

  public RestUtil.PatchResponse<TestCaseResult> patchTestCaseResults(
      String fqn, Long timestamp, JsonPatch patch) {
    TestCaseResult original =
        JsonUtils.readValue(
            daoCollection
                .dataQualityDataTimeSeriesDao()
                .getExtensionAtTimestamp(fqn, TESTCASE_RESULT_EXTENSION, timestamp),
            TestCaseResult.class);

    TestCaseResult updated = JsonUtils.applyPatch(original, patch, TestCaseResult.class);

    // set the test case result state in the test case entity if the state has changed
    if (!Objects.equals(original, updated)) {
      TestCase testCase =
          Entity.getEntityByName(TEST_CASE, fqn, "testDefinition", Include.NON_DELETED);
      setTestCaseResult(testCase, updated, false);
    }

    return new RestUtil.PatchResponse<>(Response.Status.OK, updated, ENTITY_NO_CHANGE);
  }

  @Override
  public void setFullyQualifiedName(TestCase test) {
    EntityLink entityLink = EntityLink.parse(test.getEntityLink());
    test.setFullyQualifiedName(
        FullyQualifiedName.add(
            entityLink.getFullyQualifiedFieldValue(),
            EntityInterfaceUtil.quoteName(test.getName())));
    test.setEntityFQN(entityLink.getFullyQualifiedFieldValue());
  }

  @Override
  public void prepare(TestCase test, boolean update) {
    EntityLink entityLink = EntityLink.parse(test.getEntityLink());
    EntityUtil.validateEntityLink(entityLink);

    // validate test definition and test suite
    TestSuite testSuite = Entity.getEntity(test.getTestSuite(), "", Include.NON_DELETED);
    test.setTestSuite(testSuite.getEntityReference());

    TestDefinition testDefinition =
        Entity.getEntity(test.getTestDefinition(), "", Include.NON_DELETED);
    test.setTestDefinition(testDefinition.getEntityReference());

    validateTestParameters(test.getParameterValues(), testDefinition.getParameterDefinition());
  }

  private EntityReference getTestSuite(TestCase test) throws EntityNotFoundException {
    // `testSuite` field returns the executable `testSuite` linked to that testCase
    List<CollectionDAO.EntityRelationshipRecord> records =
        findFromRecords(test.getId(), entityType, Relationship.CONTAINS, TEST_SUITE);
    for (CollectionDAO.EntityRelationshipRecord testSuiteId : records) {
      TestSuite testSuite = Entity.getEntity(TEST_SUITE, testSuiteId.getId(), "", Include.ALL);
      if (Boolean.TRUE.equals(testSuite.getExecutable())) {
        return testSuite.getEntityReference();
      }
    }
    throw new EntityNotFoundException(
        String.format(
                "Error occurred when retrieving executable test suite for testCase %s. ",
                test.getName())
            + "No executable test suite was found.");
  }

  private List<TestSuite> getTestSuites(TestCase test) {
    // `testSuites` field returns all the `testSuite` (executable and logical) linked to that
    // testCase
    List<CollectionDAO.EntityRelationshipRecord> records =
        findFromRecords(test.getId(), entityType, Relationship.CONTAINS, TEST_SUITE);
    return records.stream()
        .map(
            testSuiteId ->
                Entity.<TestSuite>getEntity(
                    TEST_SUITE, testSuiteId.getId(), "", Include.ALL, false))
        .toList();
  }

  private EntityReference getTestDefinition(TestCase test) {
    return getFromEntityRef(test.getId(), Relationship.CONTAINS, TEST_DEFINITION, true);
  }

  private void validateTestParameters(
      List<TestCaseParameterValue> parameterValues, List<TestCaseParameter> parameterDefinition) {
    if (parameterValues != null) {

      if (parameterDefinition.isEmpty() && !parameterValues.isEmpty()) {
        throw new IllegalArgumentException(
            "Parameter Values doesn't match Test Definition Parameters");
      }
      Map<String, Object> values = new HashMap<>();

      for (TestCaseParameterValue testCaseParameterValue : parameterValues) {
        values.put(testCaseParameterValue.getName(), testCaseParameterValue.getValue());
      }
      for (TestCaseParameter parameter : parameterDefinition) {
        if (Boolean.TRUE.equals(parameter.getRequired())
            && (!values.containsKey(parameter.getName())
                || values.get(parameter.getName()) == null)) {
          throw new IllegalArgumentException(
              "Required parameter " + parameter.getName() + " is not passed in parameterValues");
        }
        validateParameterRule(parameter, values);
      }
    }
  }

  @Override
  public void storeEntity(TestCase test, boolean update) {
    EntityReference testSuite = test.getTestSuite();
    EntityReference testDefinition = test.getTestDefinition();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on
    // relationships
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
    addRelationship(
        test.getTestSuite().getId(), test.getId(), TEST_SUITE, TEST_CASE, Relationship.CONTAINS);
    // Add relationship from test definition to test
    addRelationship(
        test.getTestDefinition().getId(),
        test.getId(),
        TEST_DEFINITION,
        TEST_CASE,
        Relationship.CONTAINS);
  }

  @Override
  protected void postDelete(TestCase test) {
    // delete test case from test suite summary when test case is deleted
    // from an executable test suite
    List<TestSuite> testSuites = test.getTestSuites();
    if (!testSuites.isEmpty()) {
      for (TestSuite testSuite : testSuites) {
        removeTestCaseFromTestSuiteResultSummary(testSuite.getId(), test.getFullyQualifiedName());
      }
    }

    deleteTestCaseFailedRowsSample(test.getId());
  }

  @Override
  protected void postCreate(TestCase test) {
    super.postCreate(test);
    // Update test suite with new test case in search index
    TestSuiteRepository testSuiteRepository =
        (TestSuiteRepository) Entity.getEntityRepository(Entity.TEST_SUITE);
    TestSuite testSuite = Entity.getEntity(test.getTestSuite(), "*", ALL);
    TestSuite original = testSuiteRepository.copyTestSuite(testSuite);
    testSuiteRepository.postUpdate(original, testSuite);
  }

  public RestUtil.PutResponse<TestCaseResult> addTestCaseResult(
      String updatedBy, UriInfo uriInfo, String fqn, TestCaseResult testCaseResult) {
    // Validate the request content
    TestCase testCase = findByName(fqn, Include.NON_DELETED);
    ArrayList<String> fields =
        new ArrayList<>(List.of("testDefinition", FIELD_OWNER, FIELD_TAGS, TEST_SUITE_FIELD));

    // set the test case resolution status reference if test failed, by either
    // creating a new incident or returning the stateId of an unresolved incident
    // for this test case
    UUID incidentStateId = null;
    if (TestCaseStatus.Failed.equals(testCaseResult.getTestCaseStatus())) {
      incidentStateId = getOrCreateIncidentOnFailure(testCase, updatedBy);
      // Set the incident ID to the test case result to ensure we can link result <> incident when
      // plotting the UI
      // even after the incident has been closed.
      testCaseResult.setIncidentId(incidentStateId);
      // if the test case failed, we'll add the incidentId field to update the testCase entity on ln
      // 293
      fields.add(INCIDENTS_FIELD);
    } else {
      // If the test case passed, we'll remove the incidentId from the test case
      testCase.setIncidentId(null);
    }

    // We add the incidentStateId in the DQ table to quickly link Test Case <> Incident
    // When we Resolve the incident, we'll clean up this incidentId column
    daoCollection
        .dataQualityDataTimeSeriesDao()
        .insert(
            testCase.getFullyQualifiedName(),
            TESTCASE_RESULT_EXTENSION,
            TEST_CASE_RESULT_FIELD,
            JsonUtils.pojoToJson(testCaseResult),
            incidentStateId != null ? incidentStateId.toString() : null);

    setFieldsInternal(testCase, new EntityUtil.Fields(allowedFields, ImmutableSet.copyOf(fields)));
    setTestSuiteSummary(
        testCase, testCaseResult.getTimestamp(), testCaseResult.getTestCaseStatus(), false);
    setTestCaseResult(testCase, testCaseResult, false);
    ChangeDescription change = addTestCaseChangeDescription(testCase.getVersion(), testCaseResult);
    ChangeEvent changeEvent =
        getChangeEvent(
            updatedBy, withHref(uriInfo, testCase), change, entityType, testCase.getVersion());

    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  private UUID getOrCreateIncidentOnFailure(TestCase testCase, String updatedBy) {

    TestCaseResolutionStatusRepository testCaseResolutionStatusRepository =
        (TestCaseResolutionStatusRepository)
            Entity.getEntityTimeSeriesRepository(Entity.TEST_CASE_RESOLUTION_STATUS);

    String json =
        daoCollection
            .testCaseResolutionStatusTimeSeriesDao()
            .getLatestRecord(testCase.getFullyQualifiedName());

    TestCaseResolutionStatus storedTestCaseResolutionStatus =
        json != null ? JsonUtils.readValue(json, TestCaseResolutionStatus.class) : null;

    // if we already have a non resolve status then we'll simply return it
    if (Boolean.TRUE.equals(
        testCaseResolutionStatusRepository.unresolvedIncident(storedTestCaseResolutionStatus))) {
      return storedTestCaseResolutionStatus.getStateId();
    }

    // if the test case resolution is null or resolved then we'll create a new one
    TestCaseResolutionStatus status =
        new TestCaseResolutionStatus()
            .withStateId(UUID.randomUUID())
            .withTimestamp(System.currentTimeMillis())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.New)
            .withUpdatedBy(getEntityReferenceByName(Entity.USER, updatedBy, Include.ALL))
            .withUpdatedAt(System.currentTimeMillis())
            .withTestCaseReference(testCase.getEntityReference());

    testCaseResolutionStatusRepository.createNewRecord(status, testCase.getFullyQualifiedName());
    TestCaseResolutionStatus incident =
        testCaseResolutionStatusRepository.getLatestRecord(testCase.getFullyQualifiedName());

    return incident.getStateId();
  }

  @Transaction
  @Override
  protected void deleteChildren(
      List<CollectionDAO.EntityRelationshipRecord> children, boolean hardDelete, String updatedBy) {
    if (hardDelete) {
      for (CollectionDAO.EntityRelationshipRecord entityRelationshipRecord : children) {
        LOG.info(
            "Recursively {} deleting {} {}",
            hardDelete ? "hard" : "soft",
            entityRelationshipRecord.getType(),
            entityRelationshipRecord.getId());
        TestCaseResolutionStatusRepository testCaseResolutionStatusRepository =
            (TestCaseResolutionStatusRepository)
                Entity.getEntityTimeSeriesRepository(Entity.TEST_CASE_RESOLUTION_STATUS);
        for (CollectionDAO.EntityRelationshipRecord child : children) {
          testCaseResolutionStatusRepository.deleteById(child.getId(), hardDelete);
        }
      }
    }
  }

  public RestUtil.PutResponse<TestCaseResult> deleteTestCaseResult(
      String updatedBy, String fqn, Long timestamp) {
    // Validate the request content
    TestCase testCase =
        Entity.getEntityByName(TEST_CASE, fqn, "testDefinition", Include.NON_DELETED);
    TestCaseResult storedTestCaseResult =
        JsonUtils.readValue(
            daoCollection
                .dataQualityDataTimeSeriesDao()
                .getExtensionAtTimestamp(fqn, TESTCASE_RESULT_EXTENSION, timestamp),
            TestCaseResult.class);

    if (storedTestCaseResult != null) {
      daoCollection
          .dataQualityDataTimeSeriesDao()
          .deleteAtTimestamp(fqn, TESTCASE_RESULT_EXTENSION, timestamp);
      testCase.setTestCaseResult(storedTestCaseResult);
      ChangeDescription change =
          deleteTestCaseChangeDescription(testCase.getVersion(), storedTestCaseResult);
      ChangeEvent changeEvent =
          getChangeEvent(updatedBy, testCase, change, entityType, testCase.getVersion());
      setTestSuiteSummary(testCase, timestamp, storedTestCaseResult.getTestCaseStatus(), true);
      setTestCaseResult(testCase, storedTestCaseResult, true);
      return new RestUtil.PutResponse<>(Response.Status.OK, changeEvent, ENTITY_FIELDS_CHANGED);
    }
    throw new EntityNotFoundException(
        String.format(
            "Failed to find testCase result for %s at %s", testCase.getName(), timestamp));
  }

  private ResultSummary getResultSummary(
      TestCase testCase, Long timestamp, TestCaseStatus testCaseStatus) {
    return new ResultSummary()
        .withTestCaseName(testCase.getFullyQualifiedName())
        .withStatus(testCaseStatus)
        .withTimestamp(timestamp);
  }

  private void setTestSuiteSummary(
      TestCase testCase, Long timestamp, TestCaseStatus testCaseStatus, boolean isDeleted) {
    ResultSummary resultSummary = getResultSummary(testCase, timestamp, testCaseStatus);

    // list all executable and logical test suite linked to the test case
    List<TestSuite> testSuites = getTestSuites(testCase);

    // update the summary for each test suite
    for (TestSuite testSuite : testSuites) {
      testSuite.setSummary(null); // we don't want to store the summary in the database
      List<ResultSummary> resultSummaries = listOrEmpty(testSuite.getTestCaseResultSummary());
      if ((isDeleted) && (resultSummaries.isEmpty())) {
        continue; // if we try to delete the state but not state is set then nothing to do
      }

      ResultSummary storedResultSummary =
          findMatchingResultSummary(resultSummaries, resultSummary.getTestCaseName());

      if (!shouldUpdateResultSummary(storedResultSummary, timestamp)) {
        continue; // if the state should not be updated then nothing to do
      }

      if (storedResultSummary != null) {
        // if the state already exists then we'll remove it before adding the new one
        resultSummaries.removeIf(
            summary -> summary.getTestCaseName().equals(resultSummary.getTestCaseName()));
      }

      updateResultSummaries(testCase, isDeleted, resultSummaries, resultSummary);

      // Update test case result summary attribute for the test suite
      putUpdateTestSuite(testSuite, resultSummaries);
    }
  }

  private void updateResultSummaries(
      TestCase testCase,
      boolean isDeleted,
      List<ResultSummary> resultSummaries,
      ResultSummary resultSummary) {
    if (!isDeleted) {
      resultSummaries.add(resultSummary);
      return;
    }
    // If the result was deleted, we need to update the summary
    // with the latest one from the database (if one exists)
    String json =
        daoCollection
            .dataQualityDataTimeSeriesDao()
            .getLatestExtension(testCase.getFullyQualifiedName(), TESTCASE_RESULT_EXTENSION);
    if (json != null) {
      TestCaseResult testCaseResult = JsonUtils.readValue(json, TestCaseResult.class);
      ResultSummary newResultSummary =
          getResultSummary(
              testCase, testCaseResult.getTimestamp(), testCaseResult.getTestCaseStatus());
      resultSummaries.add(newResultSummary);
    }
  }

  private ResultSummary findMatchingResultSummary(
      List<ResultSummary> resultSummaries, String testCaseNameToMatch) {
    return resultSummaries.stream()
        .filter(summary -> summary.getTestCaseName().equals(testCaseNameToMatch))
        .findFirst()
        .orElse(null);
  }

  private boolean shouldUpdateResultSummary(ResultSummary storedResultSummary, Long timestamp) {
    return storedResultSummary == null || timestamp >= storedResultSummary.getTimestamp();
  }

  // Stores the test case result with the test case entity for the latest execution
  private void setTestCaseResult(
      TestCase testCase, TestCaseResult testCaseResult, boolean isDeleted) {
    boolean shouldUpdateState = compareTestCaseResult(testCase, testCaseResult);
    if (!shouldUpdateState) {
      return;
    }

    if (!isDeleted) {
      // Test case result is updated or created
      testCase.setTestCaseResult(testCaseResult);
    } else {
      TestCaseResult latestTestCaseResult =
          JsonUtils.readValue(
              daoCollection
                  .dataQualityDataTimeSeriesDao()
                  .getLatestExtension(testCase.getFullyQualifiedName(), TESTCASE_RESULT_EXTENSION),
              TestCaseResult
                  .class); // we'll fetch the new latest result to update the test case state
      testCase.setTestCaseResult(latestTestCaseResult);
    }
    // Update test case result attribute for the test case
    Map<String, Object> jsonMap = JsonUtils.getMap(testCase);
    jsonMap.remove("testCaseResult");
    TestCase original = JsonUtils.readOrConvertValue(jsonMap, TestCase.class);
    EntityUpdater testCaseUpdater = getUpdater(original, testCase, Operation.PUT);
    testCaseUpdater.update();
  }

  private boolean compareTestCaseResult(TestCase testCase, TestCaseResult testCaseResult) {
    TestCaseResult savedTestCaseResult = testCase.getTestCaseResult();
    if (savedTestCaseResult == null) {
      return true;
    }

    return testCaseResult.getTimestamp() >= savedTestCaseResult.getTimestamp();
  }

  private ChangeDescription addTestCaseChangeDescription(Double version, Object newValue) {
    FieldChange fieldChange =
        new FieldChange().withName(TEST_CASE_RESULT_FIELD).withNewValue(newValue);
    ChangeDescription change = new ChangeDescription().withPreviousVersion(version);
    change.getFieldsAdded().add(fieldChange);
    return change;
  }

  private ChangeDescription deleteTestCaseChangeDescription(Double version, Object oldValue) {
    FieldChange fieldChange =
        new FieldChange().withName(TEST_CASE_RESULT_FIELD).withOldValue(oldValue);
    ChangeDescription change = new ChangeDescription().withPreviousVersion(version);
    change.getFieldsDeleted().add(fieldChange);
    return change;
  }

  private ChangeEvent getChangeEvent(
      String updatedBy,
      EntityInterface updated,
      ChangeDescription change,
      String entityType,
      Double prevVersion) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEntity(updated)
        .withChangeDescription(change)
        .withEventType(ENTITY_UPDATED)
        .withEntityType(entityType)
        .withEntityId(updated.getId())
        .withEntityFullyQualifiedName(updated.getFullyQualifiedName())
        .withUserName(updatedBy)
        .withTimestamp(System.currentTimeMillis())
        .withCurrentVersion(updated.getVersion())
        .withPreviousVersion(prevVersion);
  }

  private TestCaseResult getTestCaseResult(TestCase testCase) {
    if (testCase.getTestCaseResult() != null) {
      // we'll return the saved state if it exists otherwise we'll fetch it from the database
      return testCase.getTestCaseResult();
    }
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
                    fqn,
                    TESTCASE_RESULT_EXTENSION,
                    startTs,
                    endTs,
                    EntityTimeSeriesDAO.OrderBy.DESC),
            TestCaseResult.class);
    return new ResultList<>(
        testCaseResults, String.valueOf(startTs), String.valueOf(endTs), testCaseResults.size());
  }

  /**
   * Check all the test case results that have an ongoing incident and get the stateId of the
   * incident
   */
  private UUID getIncidentId(TestCase test) {
    UUID ongoingIncident = null;

    String json =
        daoCollection.dataQualityDataTimeSeriesDao().getLatestRecord(test.getFullyQualifiedName());
    TestCaseResult latestTestCaseResult = JsonUtils.readValue(json, TestCaseResult.class);

    if (!nullOrEmpty(latestTestCaseResult)) {
      ongoingIncident = latestTestCaseResult.getIncidentId();
    }

    return ongoingIncident;
  }

  private List<TagLabel> getTestCaseTags(TestCase test) {
    List<TagLabel> tags = new ArrayList<>();
    EntityLink entityLink = EntityLink.parse(test.getEntityLink());
    Table table = Entity.getEntity(entityLink, "tags,columns", ALL);
    tags.addAll(table.getTags());
    if (entityLink.getFieldName() != null && entityLink.getFieldName().equals("columns")) {
      // if we have a column test case get the columns tags as well
      table.getColumns().stream()
          .filter(column -> column.getName().equals(entityLink.getArrayFieldName()))
          .findFirst()
          .ifPresent(column -> tags.addAll(column.getTags()));
    }
    return tags;
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

  @Transaction
  public RestUtil.PutResponse<TestSuite> addTestCasesToLogicalTestSuite(
      TestSuite testSuite, List<UUID> testCaseIds) {
    bulkAddToRelationship(
        testSuite.getId(), testCaseIds, TEST_SUITE, TEST_CASE, Relationship.CONTAINS);
    List<ResultSummary> resultSummaries = listOrEmpty(testSuite.getTestCaseResultSummary());
    for (UUID testCaseId : testCaseIds) {
      TestCase testCase = Entity.getEntity(Entity.TEST_CASE, testCaseId, "*", Include.ALL);
      postUpdate(testCase, testCase);
      // Get the latest result to set the testSuite summary field
      String result =
          daoCollection
              .dataQualityDataTimeSeriesDao()
              .getLatestExtension(testCase.getFullyQualifiedName(), TESTCASE_RESULT_EXTENSION);
      if (result != null) {
        TestCaseResult testCaseResult = JsonUtils.readValue(result, TestCaseResult.class);
        ResultSummary resultSummary =
            getResultSummary(
                testCase, testCaseResult.getTimestamp(), testCaseResult.getTestCaseStatus());
        resultSummaries.removeIf(
            summary -> summary.getTestCaseName().equals(resultSummary.getTestCaseName()));
        resultSummaries.add(resultSummary);
      }
    }
    // Fetch the updated test suite to get the latest tests list associated with it and
    // set test case result summary for logical test suite and update it in the database
    testSuite = Entity.getEntity(TEST_SUITE, testSuite.getId(), "*", Include.ALL, false);
    putUpdateTestSuite(testSuite, resultSummaries);
    return new RestUtil.PutResponse<>(Response.Status.OK, testSuite, LOGICAL_TEST_CASE_ADDED);
  }

  @Transaction
  public RestUtil.DeleteResponse<TestCase> deleteTestCaseFromLogicalTestSuite(
      UUID testSuiteId, UUID testCaseId) {
    TestCase testCase = Entity.getEntity(Entity.TEST_CASE, testCaseId, null, null);
    deleteRelationship(testSuiteId, TEST_SUITE, testCaseId, TEST_CASE, Relationship.CONTAINS);
    // remove test case from logical test suite summary and update test suite
    removeTestCaseFromTestSuiteResultSummary(testSuiteId, testCase.getFullyQualifiedName());
    TestCase updatedTestCase = Entity.getEntity(Entity.TEST_CASE, testCaseId, "*", Include.ALL);
    postUpdate(testCase, updatedTestCase);
    testCase.setTestSuite(updatedTestCase.getTestSuite());
    testCase.setTestSuites(updatedTestCase.getTestSuites());
    return new RestUtil.DeleteResponse<>(testCase, ENTITY_DELETED);
  }

  /**
   * Remove test case from test suite summary and update test suite
   */
  @Transaction
  private void removeTestCaseFromTestSuiteResultSummary(UUID testSuiteId, String testCaseFqn) {
    TestSuite testSuite = Entity.getEntity(TEST_SUITE, testSuiteId, "*", Include.ALL, false);
    testSuite.setSummary(null); // we don't want to store the summary in the database

    // Update the test suite summary
    List<ResultSummary> resultSummaries = testSuite.getTestCaseResultSummary();
    resultSummaries.removeIf(summary -> summary.getTestCaseName().equals(testCaseFqn));

    // Update test case result summary attribute for the test suite
    putUpdateTestSuite(testSuite, resultSummaries);
  }

  @Override
  public EntityUpdater getUpdater(TestCase original, TestCase updated, Operation operation) {
    return new TestUpdater(original, updated, operation);
  }

  @Override
  public FeedRepository.TaskWorkflow getTaskWorkflow(FeedRepository.ThreadContext threadContext) {
    validateTaskThread(threadContext);
    TaskType taskType = threadContext.getThread().getTask().getType();
    if (EntityUtil.isTestCaseFailureResolutionTask(taskType)) {
      return new TestCaseRepository.TestCaseFailureResolutionTaskWorkflow(threadContext);
    }
    return super.getTaskWorkflow(threadContext);
  }

  @Transaction
  public TestCase addFailedRowsSample(TestCase testCase, TableData tableData) {
    EntityLink entityLink = EntityLink.parse(testCase.getEntityLink());
    Table table = Entity.getEntity(entityLink, "owner", ALL);
    // Validate all the columns
    for (String columnName : tableData.getColumns()) {
      validateColumn(table, columnName);
    }
    // Make sure each row has number values for all the columns
    for (List<Object> row : tableData.getRows()) {
      if (row.size() != tableData.getColumns().size()) {
        throw new IllegalArgumentException(
            String.format(
                "Number of columns is %d but row has %d sample values",
                tableData.getColumns().size(), row.size()));
      }
    }
    daoCollection
        .entityExtensionDAO()
        .insert(
            testCase.getId(),
            FAILED_ROWS_SAMPLE_EXTENSION,
            "failedRowsSample",
            JsonUtils.pojoToJson(tableData));
    setFieldsInternal(testCase, Fields.EMPTY_FIELDS);
    return testCase.withFailedRowsSample(tableData);
  }

  @Transaction
  public TestCase addInspectionQuery(UriInfo uri, UUID testCaseId, String sql) {
    TestCase original = get(uri, testCaseId, getFields(PATCH_FIELDS));
    TestCase updated =
        JsonUtils.readValue(JsonUtils.pojoToJson(original), TestCase.class)
            .withInspectionQuery(sql);
    EntityUpdater entityUpdater = getUpdater(original, updated, Operation.PATCH);
    entityUpdater.update();
    return updated;
  }

  @Transaction
  public RestUtil.DeleteResponse<TableData> deleteTestCaseFailedRowsSample(UUID id) {
    daoCollection.entityExtensionDAO().delete(id, FAILED_ROWS_SAMPLE_EXTENSION);
    return new RestUtil.DeleteResponse<>(null, ENTITY_DELETED);
  }

  public static class TestCaseFailureResolutionTaskWorkflow extends FeedRepository.TaskWorkflow {
    final TestCaseResolutionStatusRepository testCaseResolutionStatusRepository;
    final CollectionDAO.DataQualityDataTimeSeriesDAO dataQualityDataTimeSeriesDao;

    TestCaseFailureResolutionTaskWorkflow(FeedRepository.ThreadContext threadContext) {
      super(threadContext);
      this.testCaseResolutionStatusRepository =
          (TestCaseResolutionStatusRepository)
              Entity.getEntityTimeSeriesRepository(Entity.TEST_CASE_RESOLUTION_STATUS);

      this.dataQualityDataTimeSeriesDao = Entity.getCollectionDAO().dataQualityDataTimeSeriesDao();
    }

    /**
     * If the task is resolved, we'll resolve the Incident with the given reason
     */
    @Override
    @Transaction
    public TestCase performTask(String userName, ResolveTask resolveTask) {

      // We need to get the latest test case resolution status to get the state id
      TestCaseResolutionStatus latestTestCaseResolutionStatus =
          testCaseResolutionStatusRepository.getLatestRecord(resolveTask.getTestCaseFQN());

      if (latestTestCaseResolutionStatus == null) {
        throw new EntityNotFoundException(
            String.format(
                "Failed to find test case resolution status for %s", resolveTask.getTestCaseFQN()));
      }
      User user = getEntityByName(Entity.USER, userName, "", Include.ALL);
      TestCaseResolutionStatus testCaseResolutionStatus =
          new TestCaseResolutionStatus()
              .withId(UUID.randomUUID())
              .withStateId(latestTestCaseResolutionStatus.getStateId())
              .withTimestamp(System.currentTimeMillis())
              .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Resolved)
              .withTestCaseResolutionStatusDetails(
                  new Resolved()
                      .withTestCaseFailureComment(resolveTask.getNewValue())
                      .withTestCaseFailureReason(resolveTask.getTestCaseFailureReason())
                      .withResolvedBy(user.getEntityReference()))
              .withUpdatedAt(System.currentTimeMillis())
              .withTestCaseReference(latestTestCaseResolutionStatus.getTestCaseReference())
              .withUpdatedBy(user.getEntityReference());

      EntityReference testCaseReference = testCaseResolutionStatus.getTestCaseReference();
      testCaseResolutionStatus.setTestCaseReference(null);
      Entity.getCollectionDAO()
          .testCaseResolutionStatusTimeSeriesDao()
          .insert(
              testCaseReference.getFullyQualifiedName(),
              Entity.TEST_CASE_RESOLUTION_STATUS,
              JsonUtils.pojoToJson(testCaseResolutionStatus));
      testCaseResolutionStatus.setTestCaseReference(testCaseReference);
      testCaseResolutionStatusRepository.storeRelationship(testCaseResolutionStatus);
      testCaseResolutionStatusRepository.postCreate(testCaseResolutionStatus);

      // Return the TestCase with the StateId to avoid any unnecessary PATCH when resolving the task
      // in the feed repo,
      // since the `threadContext.getAboutEntity()` will give us the task with the `incidentId`
      // informed, which
      // we'll remove here.
      TestCase testCaseEntity =
          Entity.getEntity(testCaseResolutionStatus.getTestCaseReference(), "", Include.ALL);
      return testCaseEntity.withIncidentId(latestTestCaseResolutionStatus.getStateId());
    }

    /**
     * If we close the task, we'll flag the incident as Resolved as a False Positive, if it is not
     * resolved yet. Closing the task means that the incident is not applicable.
     */
    @Override
    @Transaction
    public void closeTask(String userName, CloseTask closeTask) {
      TestCaseResolutionStatus latestTestCaseResolutionStatus =
          testCaseResolutionStatusRepository.getLatestRecord(closeTask.getTestCaseFQN());
      if (latestTestCaseResolutionStatus == null) {
        return;
      }

      if (latestTestCaseResolutionStatus
          .getTestCaseResolutionStatusType()
          .equals(TestCaseResolutionStatusTypes.Resolved)) {
        // if the test case is already resolved then we'll return. We don't need to update the state
        return;
      }

      User user = getEntityByName(Entity.USER, userName, "", Include.ALL);
      TestCaseResolutionStatus testCaseResolutionStatus =
          new TestCaseResolutionStatus()
              .withId(UUID.randomUUID())
              .withStateId(latestTestCaseResolutionStatus.getStateId())
              .withTimestamp(System.currentTimeMillis())
              .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Resolved)
              .withTestCaseResolutionStatusDetails(
                  new Resolved()
                      .withTestCaseFailureComment(closeTask.getComment())
                      // If we close the task directly we won't know the reason
                      .withTestCaseFailureReason(TestCaseFailureReasonType.FalsePositive)
                      .withResolvedBy(user.getEntityReference()))
              .withUpdatedAt(System.currentTimeMillis())
              .withTestCaseReference(latestTestCaseResolutionStatus.getTestCaseReference())
              .withUpdatedBy(user.getEntityReference());

      EntityReference testCaseReference = testCaseResolutionStatus.getTestCaseReference();
      testCaseResolutionStatus.setTestCaseReference(null);
      Entity.getCollectionDAO()
          .testCaseResolutionStatusTimeSeriesDao()
          .insert(
              testCaseReference.getFullyQualifiedName(),
              Entity.TEST_CASE_RESOLUTION_STATUS,
              JsonUtils.pojoToJson(testCaseResolutionStatus));
      testCaseResolutionStatus.setTestCaseReference(testCaseReference);
      testCaseResolutionStatusRepository.storeRelationship(testCaseResolutionStatus);
      testCaseResolutionStatusRepository.postCreate(testCaseResolutionStatus);
    }
  }

  public class TestUpdater extends EntityUpdater {
    public TestUpdater(TestCase original, TestCase updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
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
          Relationship.CONTAINS,
          TEST_CASE,
          updated.getId());
      recordChange("parameterValues", original.getParameterValues(), updated.getParameterValues());
      recordChange("inspectionQuery", original.getInspectionQuery(), updated.getInspectionQuery());
      recordChange(
          "computePassedFailedRowCount",
          original.getComputePassedFailedRowCount(),
          updated.getComputePassedFailedRowCount());
      recordChange("testCaseResult", original.getTestCaseResult(), updated.getTestCaseResult());
    }
  }

  public TableData getSampleData(TestCase testCase, boolean authorizePII) {
    Table table = Entity.getEntity(EntityLink.parse(testCase.getEntityLink()), "owner", ALL);
    // Validate the request content
    TableData sampleData =
        JsonUtils.readValue(
            daoCollection
                .entityExtensionDAO()
                .getExtension(testCase.getId(), FAILED_ROWS_SAMPLE_EXTENSION),
            TableData.class);
    if (sampleData == null) {
      throw new EntityNotFoundException(
          entityNotFound(FAILED_ROWS_SAMPLE_EXTENSION, testCase.getId()));
    }
    // Set the column tags. Will be used to mask the sample data
    if (!authorizePII) {
      populateEntityFieldTags(
          Entity.TABLE, table.getColumns(), table.getFullyQualifiedName(), true);
      List<TagLabel> tags = daoCollection.tagUsageDAO().getTags(table.getFullyQualifiedName());
      table.setTags(tags);
      return maskSampleData(testCase.getFailedRowsSample(), table, table.getColumns());
    }
    return sampleData;
  }

  private void putUpdateTestSuite(TestSuite testSuite, List<ResultSummary> resultSummaries) {
    // Update test case result summary attribute for the test suite
    TestSuiteRepository testSuiteRepository =
        (TestSuiteRepository) Entity.getEntityRepository(Entity.TEST_SUITE);
    testSuite.setSummary(null); // we don't want to store the summary in the database
    TestSuite original =
        TestSuiteRepository.copyTestSuite(
            testSuite); // we'll need the original state to update the test suite
    testSuite.setTestCaseResultSummary(
        resultSummaries != null ? resultSummaries : testSuite.getTestCaseResultSummary());
    EntityRepository<TestSuite>.EntityUpdater testSuiteUpdater =
        testSuiteRepository.getUpdater(original, testSuite, Operation.PUT);
    testSuiteUpdater.update();
  }

  private void validateParameterRule(TestCaseParameter parameter, Map<String, Object> values) {
    if (parameter.getValidationRule() != null) {
      TestCaseParameterValidationRule testCaseParameterValidationRule =
          parameter.getValidationRule();
      String parameterFieldToValidateAgainst =
          testCaseParameterValidationRule.getParameterField(); // parameter name to validate against
      Object valueToValidateAgainst =
          values.get(parameterFieldToValidateAgainst); // value to validate against
      Object valueToValidate = values.get(parameter.getName()); // value to validate

      if (valueToValidateAgainst != null && valueToValidate != null) {
        // we only validate if the value to validate are not null
        compareValue(
            valueToValidate.toString(),
            valueToValidateAgainst.toString(),
            testCaseParameterValidationRule.getRule());
      }
    }
  }

  private void compareValue(
      String valueToValidate,
      String valueToValidateAgainst,
      TestCaseParameterValidationRuleType validationRule) {
    Double valueToValidateDouble = parseStringToDouble(valueToValidate);
    Double valueToValidateAgainstDouble = parseStringToDouble(valueToValidateAgainst);
    if (valueToValidateDouble != null && valueToValidateAgainstDouble != null) {
      compareAndValidateParameterRule(
          validationRule, valueToValidateDouble, valueToValidateAgainstDouble);
    } else {
      LOG.warn(
          "One of the 2 values to compare is not a number. Cannot compare values {} and {}. Skipping parameter validation",
          valueToValidate,
          valueToValidateAgainst);
    }
  }

  private Double parseStringToDouble(String value) {
    try {
      return Double.parseDouble(value);
    } catch (NumberFormatException e) {
      LOG.warn("Failed to parse value {} to double", value, e);
      return null;
    }
  }

  private void compareAndValidateParameterRule(
      TestCaseParameterValidationRuleType validationRule,
      Double valueToValidate,
      Double valueToValidateAgainst) {
    String message = "Value %s %s %s";
    switch (validationRule) {
      case GREATER_THAN_OR_EQUALS -> {
        if (valueToValidate < valueToValidateAgainst) {
          throw new IllegalArgumentException(
              String.format(
                  message, valueToValidate, " is not greater than ", valueToValidateAgainst));
        }
      }
      case LESS_THAN_OR_EQUALS -> {
        if (valueToValidate > valueToValidateAgainst) {
          throw new IllegalArgumentException(
              String.format(
                  message, valueToValidate, " is not less than ", valueToValidateAgainst));
        }
      }
      case EQUALS -> {
        // we'll compare the values with a tolerance of 0.0001 as we are dealing with double values
        if (Math.abs(valueToValidate - valueToValidateAgainst) > 0.0001) {
          throw new IllegalArgumentException(
              String.format(message, valueToValidate, " is not equal to ", valueToValidateAgainst));
        }
      }
      case NOT_EQUALS -> {
        // we'll compare the values with a tolerance of 0.0001 as we are dealing with double values
        if ((Math.abs(valueToValidate - valueToValidateAgainst) < 0.0001)) {
          throw new IllegalArgumentException(
              String.format(message, valueToValidate, " is equal to ", valueToValidateAgainst));
        }
      }
    }
  }
}
