package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.schema.type.EventType.LOGICAL_TEST_CASE_ADDED;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.INGESTION_BOT_NAME;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;
import static org.openmetadata.service.Entity.TEST_DEFINITION;
import static org.openmetadata.service.Entity.TEST_SUITE;
import static org.openmetadata.service.Entity.getEntityByName;
import static org.openmetadata.service.Entity.getEntityTimeSeriesRepository;
import static org.openmetadata.service.Entity.populateEntityFieldTags;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.security.mask.PIIMasker.maskSampleData;

import com.google.gson.Gson;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.User;
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
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.TestCaseParameterValidationRuleType;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.dqtests.TestSuiteMapper;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class TestCaseRepository extends EntityRepository<TestCase> {
  private static final String TEST_SUITE_FIELD = "testSuite";
  private static final String INCIDENTS_FIELD = "incidentId";
  public static final String COLLECTION_PATH = "/v1/dataQuality/testCases";
  private static final String UPDATE_FIELDS =
      "owners,entityLink,testSuite,testSuites,testDefinition";
  private static final String PATCH_FIELDS =
      "owners,entityLink,testSuite,testSuites,testDefinition,computePassedFailedRowCount,useDynamicAssertion";
  public static final String FAILED_ROWS_SAMPLE_EXTENSION = "testCase.failedRowsSample";
  private final ExecutorService asyncExecutor = Executors.newFixedThreadPool(1);

  public TestCaseRepository() {
    super(
        COLLECTION_PATH,
        TEST_CASE,
        TestCase.class,
        Entity.getCollectionDAO().testCaseDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
    supportsSearch = true;
    // Add the canonical name for test case results
    // As test case result` does not have its own repository
    EntityTimeSeriesInterface.CANONICAL_ENTITY_NAME_MAP.put(
        Entity.TEST_CASE_RESULT.toLowerCase(Locale.ROOT), Entity.TEST_CASE_RESULT);
  }

  @Override
  public void setFields(TestCase test, Fields fields) {
    test.setTestSuites(
        fields.contains(Entity.FIELD_TEST_SUITES) ? getTestSuites(test) : test.getTestSuites());
    test.setTestSuite(
        fields.contains(TEST_SUITE_FIELD)
            ? getTestSuite(test.getId(), entityType, TEST_SUITE, Direction.FROM)
            : test.getTestSuite());
    test.setTestDefinition(
        fields.contains(TEST_DEFINITION) ? getTestDefinition(test) : test.getTestDefinition());
    test.setTestCaseResult(
        fields.contains(TEST_CASE_RESULT) ? getTestCaseResult(test) : test.getTestCaseResult());
    test.setIncidentId(
        fields.contains(INCIDENTS_FIELD) ? getIncidentId(test) : test.getIncidentId());
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<TestCase> testCases) {
    if (testCases == null || testCases.isEmpty()) {
      return;
    }

    if (fields.contains(TEST_DEFINITION)) {
      fetchAndSetTestDefinitions(testCases);
    }

    if (fields.contains(TEST_SUITE_FIELD)) {
      fetchAndSetTestSuites(testCases);
    }

    if (fields.contains(Entity.FIELD_TEST_SUITES)) {
      fetchAndSetAllTestSuites(testCases);
    }

    if (fields.contains(TEST_CASE_RESULT)) {
      fetchAndSetTestCaseResults(testCases);
    }

    // Fetch and set incident IDs in bulk if requested
    if (fields.contains(INCIDENTS_FIELD)) {
      fetchAndSetIncidentIds(testCases);
    }

    // Fetch and set tags in bulk if requested
    if (fields.contains(FIELD_TAGS)) {
      fetchAndSetTags(testCases);
    }

    // For all other fields, use the parent implementation which calls setFields individually
    // This ensures we don't break existing functionality
    super.setFieldsInBulk(fields, testCases);
  }

  private void fetchAndSetTestDefinitions(List<TestCase> testCases) {
    List<String> testCaseIds =
        testCases.stream().map(TestCase::getId).map(UUID::toString).distinct().toList();

    // Bulk fetch test definitions
    // Test definition CONTAINS test case, so we need to find relationships FROM test definition TO
    // test cases
    List<CollectionDAO.EntityRelationshipObject> testDefinitionRecords =
        daoCollection
            .relationshipDAO()
            .findFromBatch(
                testCaseIds, Relationship.CONTAINS.ordinal(), TEST_DEFINITION, TEST_CASE);

    // Create a map of test case ID to test definition reference
    Map<UUID, EntityReference> testDefinitionMap = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : testDefinitionRecords) {
      UUID testCaseId = UUID.fromString(record.getToId());
      EntityReference testDefRef =
          Entity.getEntityReferenceById(
              TEST_DEFINITION, UUID.fromString(record.getFromId()), Include.ALL);
      testDefinitionMap.put(testCaseId, testDefRef);
    }

    // Set test definitions on test cases
    for (TestCase testCase : testCases) {
      EntityReference testDefRef = testDefinitionMap.get(testCase.getId());
      testCase.setTestDefinition(testDefRef);
    }
  }

  private void fetchAndSetTestSuites(List<TestCase> testCases) {
    List<String> testCaseIds =
        testCases.stream().map(TestCase::getId).map(UUID::toString).distinct().toList();

    // Bulk fetch test suites
    // Test suite CONTAINS test case, so we need to find FROM test suite TO test case
    List<CollectionDAO.EntityRelationshipObject> testSuiteRecords =
        daoCollection
            .relationshipDAO()
            .findFromBatch(testCaseIds, Relationship.CONTAINS.ordinal(), TEST_SUITE, TEST_CASE);

    // Create a map of test case ID to test suite references (can have multiple)
    Map<UUID, List<EntityReference>> testCaseToTestSuites = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : testSuiteRecords) {
      UUID testCaseId = UUID.fromString(record.getToId());
      EntityReference testSuiteRef =
          Entity.getEntityReferenceById(
              TEST_SUITE, UUID.fromString(record.getFromId()), Include.ALL);
      testCaseToTestSuites.computeIfAbsent(testCaseId, k -> new ArrayList<>()).add(testSuiteRef);
    }

    // Set test suites on test cases - find the basic/executable test suite
    for (TestCase testCase : testCases) {
      List<EntityReference> testSuiteRefs = testCaseToTestSuites.get(testCase.getId());
      if (testSuiteRefs != null && !testSuiteRefs.isEmpty()) {
        // Find the basic test suite among the references
        for (EntityReference ref : testSuiteRefs) {
          TestSuite testSuite = Entity.getEntity(TEST_SUITE, ref.getId(), "", Include.ALL);
          if (Boolean.TRUE.equals(testSuite.getBasic())) {
            testCase.setTestSuite(testSuite.getEntityReference());
            break;
          }
        }
        // If no basic test suite found, use the first one
        if (testCase.getTestSuite() == null) {
          testCase.setTestSuite(testSuiteRefs.get(0));
        }
      }
    }
  }

  private void fetchAndSetAllTestSuites(List<TestCase> testCases) {
    List<String> testCaseIds =
        testCases.stream().map(TestCase::getId).map(UUID::toString).distinct().toList();

    List<CollectionDAO.EntityRelationshipObject> testSuiteRecords =
        daoCollection
            .relationshipDAO()
            .findFromBatch(testCaseIds, Relationship.CONTAINS.ordinal(), TEST_SUITE, TEST_CASE);

    Map<UUID, List<TestSuite>> testCaseToTestSuites = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : testSuiteRecords) {
      UUID testCaseId = UUID.fromString(record.getToId());
      TestSuite testSuite =
          Entity.<TestSuite>getEntity(
                  TEST_SUITE,
                  UUID.fromString(record.getFromId()),
                  "owners,domain",
                  Include.ALL,
                  false)
              .withInherited(true)
              .withChangeDescription(null);
      testCaseToTestSuites.computeIfAbsent(testCaseId, k -> new ArrayList<>()).add(testSuite);
    }

    for (TestCase testCase : testCases) {
      List<TestSuite> testSuiteList = testCaseToTestSuites.get(testCase.getId());
      testCase.setTestSuites(testSuiteList != null ? testSuiteList : new ArrayList<>());
    }
  }

  private void fetchAndSetTestCaseResults(List<TestCase> testCases) {
    // For test case results, we need to fetch the latest result for each test case
    // This requires looking at the time series data
    Map<UUID, TestCaseResult> testCaseIdToResult = new HashMap<>();

    for (TestCase testCase : testCases) {
      if (testCase.getTestCaseResult() != null) {
        // If already set, use the existing value
        continue;
      }

      try {
        // Get the latest test case result from the time series database
        String json =
            daoCollection
                .dataQualityDataTimeSeriesDao()
                .getLatestRecord(testCase.getFullyQualifiedName());

        if (json != null) {
          TestCaseResult result = JsonUtils.readValue(json, TestCaseResult.class);
          if (result != null) {
            testCaseIdToResult.put(testCase.getId(), result);
          }
        }
      } catch (Exception e) {
        LOG.warn(
            "Failed to fetch test case result for {}: {}",
            testCase.getFullyQualifiedName(),
            e.getMessage());
      }
    }

    // Set the results on test cases
    for (TestCase testCase : testCases) {
      TestCaseResult result = testCaseIdToResult.get(testCase.getId());
      testCase.setTestCaseResult(result);
    }
  }

  private void fetchAndSetIncidentIds(List<TestCase> testCases) {
    // Incident IDs are stored in the latest test case result
    Map<UUID, UUID> testCaseIdToIncidentId = new HashMap<>();

    for (TestCase testCase : testCases) {
      try {
        String json =
            daoCollection
                .dataQualityDataTimeSeriesDao()
                .getLatestRecord(testCase.getFullyQualifiedName());

        if (json != null) {
          TestCaseResult latestResult = JsonUtils.readValue(json, TestCaseResult.class);
          if (latestResult != null && latestResult.getIncidentId() != null) {
            testCaseIdToIncidentId.put(testCase.getId(), latestResult.getIncidentId());
          }
        }
      } catch (Exception e) {
        LOG.warn(
            "Failed to fetch incident ID for {}: {}",
            testCase.getFullyQualifiedName(),
            e.getMessage());
      }
    }

    // Set the incident IDs on test cases
    for (TestCase testCase : testCases) {
      UUID incidentId = testCaseIdToIncidentId.get(testCase.getId());
      testCase.setIncidentId(incidentId);
    }
  }

  private void fetchAndSetTags(List<TestCase> testCases) {
    // Tags are inherited from the linked entity (table or column)
    Map<UUID, List<TagLabel>> testCaseIdToTags = new HashMap<>();

    for (TestCase testCase : testCases) {
      try {
        EntityLink entityLink = EntityLink.parse(testCase.getEntityLink());
        Table table = Entity.getEntity(entityLink, "tags,columns", ALL);
        List<TagLabel> tags = new ArrayList<>(table.getTags());

        if (entityLink.getFieldName() != null && entityLink.getFieldName().equals("columns")) {
          // If we have a column test case, get the column's tags as well
          table.getColumns().stream()
              .filter(column -> column.getName().equals(entityLink.getArrayFieldName()))
              .findFirst()
              .ifPresent(column -> tags.addAll(column.getTags()));
        }

        testCaseIdToTags.put(testCase.getId(), tags);
      } catch (Exception e) {
        LOG.warn("Failed to fetch tags for test case {}: {}", testCase.getId(), e.getMessage());
      }
    }

    // Set the tags on test cases
    for (TestCase testCase : testCases) {
      List<TagLabel> tags = testCaseIdToTags.get(testCase.getId());
      testCase.setTags(tags != null ? tags : new ArrayList<>());
    }
  }

  @Override
  public void setInheritedFields(TestCase testCase, Fields fields) {
    EntityLink entityLink = EntityLink.parse(testCase.getEntityLink());
    Table table = Entity.getEntity(entityLink, "owners,domain,tags,columns", ALL);
    inheritOwners(testCase, fields, table);
    inheritDomain(testCase, fields, table);
    inheritTags(testCase, fields, table);
  }

  private void inheritTags(TestCase testCase, Fields fields, Table table) {
    if (fields.contains(FIELD_TAGS)) {
      EntityLink entityLink = EntityLink.parse(testCase.getEntityLink());
      List<TagLabel> testCaseTags =
          testCase.getTags() != null ? new ArrayList<>(testCase.getTags()) : new ArrayList<>();
      List<TagLabel> tableTags =
          table.getTags() != null ? new ArrayList<>(table.getTags()) : new ArrayList<>();
      EntityUtil.mergeTags(testCaseTags, tableTags);
      if (entityLink.getFieldName() != null && entityLink.getFieldName().equals("columns")) {
        // if we have a column test case inherit the columns tags as well
        table.getColumns().stream()
            .filter(column -> column.getName().equals(entityLink.getArrayFieldName()))
            .findFirst()
            .ifPresent(column -> EntityUtil.mergeTags(testCaseTags, column.getTags()));
      }
      testCase.setTags(testCaseTags);
    }
  }

  @Override
  public EntityInterface getParentEntity(TestCase entity, String fields) {
    EntityReference testSuite = entity.getTestSuite();
    if (testSuite == null) {
      EntityLink entityLink = EntityLink.parse(entity.getEntityLink());
      return Entity.getEntity(entityLink, fields, ALL);
    } else {
      return Entity.getEntity(testSuite, fields, ALL);
    }
  }

  @Override
  public void clearFields(TestCase test, Fields fields) {
    test.setTestSuites(fields.contains(Entity.FIELD_TEST_SUITES) ? test.getTestSuites() : null);
    test.setTestSuite(fields.contains(TEST_SUITE_FIELD) ? test.getTestSuite() : null);
    test.setTestDefinition(fields.contains(TEST_DEFINITION) ? test.getTestDefinition() : null);
    test.setTestCaseResult(fields.contains(TEST_CASE_RESULT) ? test.getTestCaseResult() : null);
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

    // Get existing basic test suite or create a new one if it doesn't exist
    EntityReference testSuite = getOrCreateTestSuite(test);
    test.setTestSuite(testSuite);

    // validate test definition
    TestDefinition testDefinition =
        Entity.getEntity(test.getTestDefinition(), "", Include.NON_DELETED);
    test.setTestDefinition(testDefinition.getEntityReference());

    validateTestParameters(test.getParameterValues(), testDefinition.getParameterDefinition());
    validateColumnTestCase(entityLink, testDefinition.getEntityType());
  }

  /*
   * Get the test suite for a test case. We'll use the entity linked to the test case
   * to find the basic test suite. If it doesn't exist, create a new one.
   */
  private EntityReference getOrCreateTestSuite(TestCase test) {
    EntityReference entityReference = null;
    try {
      EntityLink entityLink = EntityLink.parse(test.getEntityLink());
      EntityInterface entity = Entity.getEntity(entityLink, "", ALL);
      return getTestSuite(entity.getId(), TEST_SUITE, TABLE, Direction.TO);
    } catch (EntityNotFoundException e) {
      // If the test suite is not found, we'll create a new one
      EntityLink entityLink = EntityLink.parse(test.getEntityLink());
      TestSuiteRepository testSuiteRepository =
          (TestSuiteRepository) Entity.getEntityRepository(Entity.TEST_SUITE);
      TestSuiteMapper mapper = new TestSuiteMapper();
      CreateTestSuite createTestSuite =
          new CreateTestSuite()
              .withName(entityLink.getEntityFQN() + ".testSuite")
              .withBasicEntityReference(entityLink.getEntityFQN());
      TestSuite testSuite = mapper.createToEntity(createTestSuite, INGESTION_BOT_NAME);
      testSuite.setBasic(true);
      testSuiteRepository.create(null, testSuite);
      entityReference = testSuite.getEntityReference();
    }
    return entityReference;
  }

  private EntityReference getTestSuite(UUID id, String to, String from, Direction direction)
      throws EntityNotFoundException {
    // `testSuite` field returns the executable `testSuite` linked to that testCase
    List<CollectionDAO.EntityRelationshipRecord> records = new ArrayList<>();
    switch (direction) {
      case FROM -> records = findFromRecords(id, to, Relationship.CONTAINS, from);
      case TO -> records = findToRecords(id, from, Relationship.CONTAINS, to);
    }
    for (CollectionDAO.EntityRelationshipRecord testSuiteId : records) {
      TestSuite testSuite = Entity.getEntity(TEST_SUITE, testSuiteId.getId(), "", Include.ALL);
      if (Boolean.TRUE.equals(testSuite.getBasic())) {
        return testSuite.getEntityReference();
      }
    }
    throw new EntityNotFoundException(
        String.format(
                "Error occurred when retrieving executable test suite for testCase %s. ",
                id.toString())
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
                        TEST_SUITE, testSuiteId.getId(), "owners,domain", Include.ALL, false)
                    .withInherited(true)
                    .withChangeDescription(null))
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
      
      // Create sets of parameter names for validation
      Set<String> definedParameterNames = parameterDefinition.stream()
          .map(TestCaseParameter::getName)
          .collect(Collectors.toSet());
      
      Map<String, Object> values = new HashMap<>();

      for (TestCaseParameterValue testCaseParameterValue : parameterValues) {
        String parameterName = testCaseParameterValue.getName();
        
        // Validate that the parameter name exists in the test definition
        if (!definedParameterNames.contains(parameterName)) {
          throw new IllegalArgumentException(
              String.format("Parameter '%s' is not defined in the test definition. Defined parameters are: %s", 
                  parameterName, definedParameterNames));
        }
        
        values.put(parameterName, testCaseParameterValue.getValue());
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

  private void validateColumnTestCase(
      EntityLink entityLink, TestDefinitionEntityType testDefinitionEntityType) {
    if (testDefinitionEntityType.equals(TestDefinitionEntityType.COLUMN)) {
      if (entityLink.getFieldName() == null) {
        throw new IllegalArgumentException(
            "Column test case must have a field name and an array field name in the entity link."
                + " e.g. <#E::table::{entityFqn}::columns::{columnName}>");
      }
      // Validate that the field name is a valid column name
      if (!entityLink.getFieldName().equals("columns")) {
        throw new IllegalArgumentException(
            String.format(
                "Invalid field name '%s' for column test case. It should be 'columns'."
                    + " e.g. <#E::table::{entityFqn}::columns::{columnName}>",
                entityLink.getFieldName()));
      }
    }
  }

  @Override
  public void storeEntity(TestCase test, boolean update) {
    EntityReference testSuite = test.getTestSuite();
    EntityReference testDefinition = test.getTestDefinition();
    TestCaseResult testCaseResult = test.getTestCaseResult();
    List<TestSuite> testSuites = test.getTestSuites();

    // Don't store testCaseResult, owner, database, href and tags as JSON.
    // Build it on the fly based on relationships
    test.withTestSuite(null).withTestSuites(null).withTestDefinition(null).withTestCaseResult(null);
    store(test, update);

    // Restore the relationships
    test.withTestSuite(testSuite)
        .withTestSuites(testSuites)
        .withTestDefinition(testDefinition)
        .withTestCaseResult(testCaseResult);
  }

  @Override
  public void storeEntities(List<TestCase> testCases) {
    List<TestCase> testCasesToStore = new ArrayList<>();
    Gson gson = new Gson();
    for (TestCase testCase : testCases) {
      EntityReference testSuite = testCase.getTestSuite();
      EntityReference testDefinition = testCase.getTestDefinition();
      TestCaseResult testCaseResult = testCase.getTestCaseResult();
      List<TestSuite> testSuites = testCase.getTestSuites();

      String jsonCopy =
          gson.toJson(
              testCase
                  .withTestSuite(null)
                  .withTestSuites(null)
                  .withTestDefinition(null)
                  .withTestCaseResult(null));
      testCasesToStore.add(gson.fromJson(jsonCopy, TestCase.class));

      // restore the relationships
      testCase
          .withTestSuite(testSuite)
          .withTestSuites(testSuites)
          .withTestDefinition(testDefinition)
          .withTestCaseResult(testCaseResult);
    }
    storeMany(testCasesToStore);
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
  protected void postDelete(TestCase testCase) {
    super.postDelete(testCase);
    updateTestSuite(testCase);
  }

  @Override
  protected void postCreate(TestCase testCase) {
    super.postCreate(testCase);
    updateTestSuite(testCase);
  }

  private void updateTestSuite(TestCase testCase) {
    // Update test suite with updated test case in search index
    TestSuiteRepository testSuiteRepository =
        (TestSuiteRepository) Entity.getEntityRepository(Entity.TEST_SUITE);
    TestSuite testSuite = Entity.getEntity(testCase.getTestSuite(), "*", ALL);
    TestSuite original = TestSuiteRepository.copyTestSuite(testSuite);
    testSuiteRepository.postUpdate(original, testSuite);
  }

  private void updateLogicalTestSuite(UUID testSuiteId) {
    TestSuiteRepository testSuiteRepository =
        (TestSuiteRepository) Entity.getEntityRepository(Entity.TEST_SUITE);
    TestSuite testSuite = Entity.getEntity(Entity.TEST_SUITE, testSuiteId, "*", ALL);
    TestSuite original = TestSuiteRepository.copyTestSuite(testSuite);
    testSuiteRepository.postUpdate(original, testSuite);
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

  @Override
  protected void entitySpecificCleanup(TestCase entityInterface) {
    deleteAllTestCaseResults(entityInterface.getFullyQualifiedName());
  }

  private void deleteAllTestCaseResults(String fqn) {
    TestCaseResultRepository testCaseResultRepository =
        (TestCaseResultRepository) Entity.getEntityTimeSeriesRepository(TEST_CASE_RESULT);
    testCaseResultRepository.deleteAllTestCaseResults(fqn);
    asyncExecutor.submit(
        () -> {
          try {
            testCaseResultRepository.deleteAllTestCaseResults(fqn);
          } catch (Exception e) {
            LOG.error("Error deleting test case results for test case {}", fqn, e);
          }
        });
  }

  @SneakyThrows
  private TestCaseResult getTestCaseResult(TestCase testCase) {
    TestCaseResult testCaseResult = null;
    if (testCase.getTestCaseResult() != null) {
      // we'll return the saved state if it exists otherwise we'll fetch it from the database
      // Should be the case if listing from the search repo. as the test case result
      // is stored with the test case entity (denormalized)
      return testCase.getTestCaseResult();
    }
    SearchListFilter searchListFilter = new SearchListFilter();
    searchListFilter.addQueryParam("testCaseFQN", testCase.getFullyQualifiedName());
    TestCaseResultRepository timeSeriesRepository =
        (TestCaseResultRepository) getEntityTimeSeriesRepository(TEST_CASE_RESULT);
    try {
      testCaseResult =
          timeSeriesRepository.latestFromSearch(Fields.EMPTY_FIELDS, searchListFilter, null);
    } catch (Exception e) {
      LOG.debug(
          "Error fetching test case result from search. Fetching from test case results from database",
          e);
    }
    if (nullOrEmpty(testCaseResult)) {
      testCaseResult =
          timeSeriesRepository.listLastTestCaseResult(testCase.getFullyQualifiedName());
    }
    return testCaseResult;
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

  public int getTestCaseCount(List<UUID> testCaseIds) {
    return daoCollection.testCaseDAO().countOfTestCases(testCaseIds);
  }

  public void isTestSuiteBasic(String testSuiteFqn) {
    if (testSuiteFqn == null) {
      // If the test suite FQN is not provided, we'll assume it's a basic test suite
      return;
    }

    TestSuite testSuite = Entity.getEntityByName(Entity.TEST_SUITE, testSuiteFqn, null, null);
    if (Boolean.FALSE.equals(testSuite.getBasic())) {
      throw new IllegalArgumentException(
          "Test suite "
              + testSuite.getName()
              + " is not basic. Cannot create test cases for non-basic test suites.");
    }
  }

  @Transaction
  public RestUtil.PutResponse<TestSuite> addTestCasesToLogicalTestSuite(
      TestSuite testSuite, List<UUID> testCaseIds) {
    bulkAddToRelationship(
        testSuite.getId(), testCaseIds, TEST_SUITE, TEST_CASE, Relationship.CONTAINS);
    for (UUID testCaseId : testCaseIds) {
      TestCase testCase = Entity.getEntity(Entity.TEST_CASE, testCaseId, "*", Include.ALL);
      ChangeDescription change =
          new ChangeDescription()
              .withFieldsUpdated(
                  List.of(
                      new FieldChange()
                          .withName("testSuites")
                          .withNewValue(testCase.getTestSuites())));
      testCase.setChangeDescription(change);
      postUpdate(testCase, testCase);
    }
    updateLogicalTestSuite(testSuite.getId());
    return new RestUtil.PutResponse<>(Response.Status.OK, testSuite, LOGICAL_TEST_CASE_ADDED);
  }

  @Transaction
  public RestUtil.DeleteResponse<TestCase> deleteTestCaseFromLogicalTestSuite(
      UUID testSuiteId, UUID testCaseId) {
    TestCase testCase = Entity.getEntity(Entity.TEST_CASE, testCaseId, null, null);
    deleteRelationship(testSuiteId, TEST_SUITE, testCaseId, TEST_CASE, Relationship.CONTAINS);
    TestCase updatedTestCase = Entity.getEntity(Entity.TEST_CASE, testCaseId, "*", Include.ALL);
    ChangeDescription change =
        new ChangeDescription()
            .withFieldsUpdated(
                List.of(
                    new FieldChange()
                        .withName("testSuites")
                        .withNewValue(updatedTestCase.getTestSuites())));
    updatedTestCase.setChangeDescription(change);

    postUpdate(testCase, updatedTestCase);
    updateLogicalTestSuite(testSuiteId);
    testCase.setTestSuite(updatedTestCase.getTestSuite());
    testCase.setTestSuites(updatedTestCase.getTestSuites());
    return new RestUtil.DeleteResponse<>(testCase, ENTITY_DELETED);
  }

  @Override
  public EntityRepository<TestCase>.EntityUpdater getUpdater(
      TestCase original, TestCase updated, Operation operation, ChangeSource changeSource) {
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
  public TestCase addFailedRowsSample(
      TestCase testCase, TableData tableData, boolean validateColumns) {
    EntityLink entityLink = EntityLink.parse(testCase.getEntityLink());
    Table table = Entity.getEntity(entityLink, FIELD_OWNERS, ALL);
    // Validate all the columns
    if (validateColumns) {
      for (String columnName : tableData.getColumns()) {
        validateColumn(table, columnName);
      }
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
    // deep copy the test case to avoid updating the cached entity
    testCase = JsonUtils.deepCopy(testCase, TestCase.class);
    return testCase.withFailedRowsSample(tableData);
  }

  @Transaction
  public TestCase addInspectionQuery(UriInfo uri, UUID testCaseId, String sql) {
    TestCase original = get(uri, testCaseId, getFields("*"));
    TestCase updated =
        JsonUtils.readValue(JsonUtils.pojoToJson(original), TestCase.class)
            .withInspectionQuery(sql);
    EntityUpdater entityUpdater = getUpdater(original, updated, Operation.PATCH, null);
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

    @Override
    protected boolean consolidateChanges(TestCase original, TestCase updated, Operation operation) {
      return false;
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
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
      recordChange(
          "useDynamicAssertion",
          original.getUseDynamicAssertion(),
          updated.getUseDynamicAssertion());
      recordChange("testCaseStatus", original.getTestCaseStatus(), updated.getTestCaseStatus());
      recordChange("testCaseResult", original.getTestCaseResult(), updated.getTestCaseResult());
    }
  }

  public TableData getSampleData(TestCase testCase, boolean authorizePII) {
    Table table = Entity.getEntity(EntityLink.parse(testCase.getEntityLink()), FIELD_OWNERS, ALL);
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
      populateEntityFieldTags(TABLE, table.getColumns(), table.getFullyQualifiedName(), true);
      List<TagLabel> tags = daoCollection.tagUsageDAO().getTags(table.getFullyQualifiedName());
      table.setTags(tags);
      return maskSampleData(sampleData, table, table.getColumns());
    }
    return sampleData;
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

  private enum Direction {
    TO,
    FROM
  }
}
