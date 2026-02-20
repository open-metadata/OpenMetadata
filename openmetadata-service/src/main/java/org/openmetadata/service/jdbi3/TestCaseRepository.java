package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.CsvUtil.addGlossaryTerms;
import static org.openmetadata.csv.CsvUtil.addTagLabels;
import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.schema.type.EventType.LOGICAL_TEST_CASE_ADDED;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.FIELD_ENTITY_STATUS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.INGESTION_BOT_NAME;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;
import static org.openmetadata.service.Entity.TEST_DEFINITION;
import static org.openmetadata.service.Entity.TEST_SUITE;
import static org.openmetadata.service.Entity.getEntityByName;
import static org.openmetadata.service.Entity.getEntityTimeSeriesRepository;
import static org.openmetadata.service.Entity.populateEntityFieldTags;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notReviewer;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.security.mask.PIIMasker.maskSampleData;

import com.google.gson.Gson;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
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
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.csv.CsvExportProgressCallback;
import org.openmetadata.csv.CsvImportProgressCallback;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameter;
import org.openmetadata.schema.tests.TestCaseParameterValidationRule;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.Resolved;
import org.openmetadata.schema.tests.type.TestCaseFailureReasonType;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.TestCaseParameterValidationRuleType;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.resources.dqtests.TestCaseResource;
import org.openmetadata.service.resources.dqtests.TestSuiteMapper;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.EntityFieldUtils;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.WebsocketNotificationHandler;

@Slf4j
public class TestCaseRepository extends EntityRepository<TestCase> {
  private static final String TEST_SUITE_FIELD = "testSuite";
  private static final String INCIDENTS_FIELD = "incidentId";
  private static final String UPDATE_FIELDS =
      "owners,entityLink,testSuite,testSuites,testDefinition,dimensionColumns";
  private static final String PATCH_FIELDS =
      "owners,entityLink,testSuite,testSuites,testDefinition,computePassedFailedRowCount,useDynamicAssertion,dimensionColumns";
  public static final String FAILED_ROWS_SAMPLE_EXTENSION = "testCase.failedRowsSample";
  private final ExecutorService asyncExecutor = Executors.newFixedThreadPool(1);

  public TestCaseRepository() {
    super(
        TestCaseResource.COLLECTION_PATH,
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
  public void setFields(TestCase test, Fields fields, RelationIncludes relationIncludes) {
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
    for (CollectionDAO.EntityRelationshipObject testRecord : testDefinitionRecords) {
      UUID testCaseId = UUID.fromString(testRecord.getToId());
      EntityReference testDefRef =
          Entity.getEntityReferenceById(
              TEST_DEFINITION, UUID.fromString(testRecord.getFromId()), Include.ALL);
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
    for (CollectionDAO.EntityRelationshipObject testSuite : testSuiteRecords) {
      UUID testCaseId = UUID.fromString(testSuite.getToId());
      EntityReference testSuiteRef =
          Entity.getEntityReferenceById(
              TEST_SUITE, UUID.fromString(testSuite.getFromId()), Include.ALL);
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
          testCase.setTestSuite(testSuiteRefs.getFirst());
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
                  "owners,domains",
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
    // Inherit from the table/column
    EntityInterface tableOrColumn =
        Entity.getEntity(
            EntityLink.parse(testCase.getEntityLink()),
            "owners,domains,tags,columns,followers",
            ALL);
    if (tableOrColumn != null) {
      inheritOwners(testCase, fields, tableOrColumn);
      inheritDomains(testCase, fields, tableOrColumn);
      if (tableOrColumn instanceof Table) {
        inheritTags(testCase, fields, (Table) tableOrColumn);
        inheritFollowers(testCase, fields, (Table) tableOrColumn);
      }
    }

    // Inherit reviewers from logical test suites
    if (fields.contains(FIELD_REVIEWERS)) {
      List<TestSuite> testSuites = getTestSuites(testCase);
      for (TestSuite testSuite : testSuites) {
        inheritReviewers(testCase, fields, testSuite);
      }
    }
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
      // Parent is a table (or other entity) via entityLink
      EntityLink entityLink = EntityLink.parse(entity.getEntityLink());
      String filteredFields = EntityUtil.getFilteredFields(entityLink.getEntityType(), fields);
      return Entity.getEntity(entityLink, filteredFields, ALL);
    } else {
      // Parent is a test suite
      String filteredFields = EntityUtil.getFilteredFields(TEST_SUITE, fields);
      return Entity.getEntity(testSuite, filteredFields, ALL);
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

    // Validate that the test definition is enabled (only for new test cases, not updates)
    if (!update && Boolean.FALSE.equals(testDefinition.getEnabled())) {
      throw new IllegalArgumentException(
          String.format(
              "Test definition '%s' is disabled and cannot be used to create test cases",
              testDefinition.getName()));
    }

    validateTestParameters(
        test.getParameterValues(),
        testDefinition.getParameterDefinition(),
        testDefinition.getTestPlatforms(),
        testDefinition);
    validateColumnTestCase(entityLink, testDefinition.getEntityType());
    validateDimensionColumns(test, entityLink);
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
                        TEST_SUITE,
                        testSuiteId.getId(),
                        "owners,domains,reviewers",
                        Include.ALL,
                        false)
                    .withInherited(true)
                    .withChangeDescription(null))
        .toList();
  }

  private EntityReference getTestDefinition(TestCase test) {
    return getFromEntityRef(test.getId(), Relationship.CONTAINS, TEST_DEFINITION, true);
  }

  private void validateTestParameters(
      List<TestCaseParameterValue> parameterValues,
      List<TestCaseParameter> parameterDefinition,
      List<TestPlatform> testPlatforms,
      TestDefinition testDefinition) {
    if (parameterValues != null) {

      if (parameterDefinition.isEmpty() && !parameterValues.isEmpty()) {
        throw new IllegalArgumentException(
            "Parameter Values doesn't match Test Definition Parameters");
      }

      if (!testPlatforms.contains(TestPlatform.GREAT_EXPECTATIONS)
          && !testDefinition.getName().equals("tableDiff")) {
        Set<String> definedParameterNames =
            parameterDefinition.stream()
                .map(TestCaseParameter::getName)
                .collect(Collectors.toSet());

        Map<String, Object> values = getParameterValuesMap(parameterValues, definedParameterNames);
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
  }

  private @NotNull Map<String, Object> getParameterValuesMap(
      List<TestCaseParameterValue> parameterValues, Set<String> definedParameterNames) {
    Map<String, Object> values = new HashMap<>();

    for (TestCaseParameterValue testCaseParameterValue : parameterValues) {
      String parameterName = testCaseParameterValue.getName();

      if (!definedParameterNames.contains(parameterName)) {
        throw new IllegalArgumentException(
            String.format(
                "Parameter '%s' is not defined in the test definition. Defined parameters are: %s",
                parameterName, definedParameterNames));
      }

      values.put(parameterName, testCaseParameterValue.getValue());
    }
    return values;
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

      // Validate that the referenced column actually exists in the table
      if (entityLink.getArrayFieldName() != null) {
        Table table = Entity.getEntity(entityLink, "columns", ALL);
        validateColumn(table, entityLink.getArrayFieldName(), Boolean.FALSE);
      }
    }
  }

  private void validateDimensionColumns(TestCase test, EntityLink entityLink) {
    if (test.getDimensionColumns() != null && !test.getDimensionColumns().isEmpty()) {
      // Get the table referenced by the entityLink to validate dimension columns exist
      Table table = Entity.getEntity(entityLink, "columns", ALL);

      // Validate each dimension column exists in the table
      for (String dimensionColumn : test.getDimensionColumns()) {
        validateColumn(table, dimensionColumn, Boolean.FALSE);
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
  protected void clearEntitySpecificRelationshipsForMany(List<TestCase> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(TestCase::getId).toList();
    deleteToMany(ids, Entity.TEST_CASE, Relationship.CONTAINS, Entity.TEST_SUITE);
    deleteToMany(ids, Entity.TEST_CASE, Relationship.CONTAINS, Entity.TEST_DEFINITION);
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
  protected void postDelete(TestCase testCase, boolean hardDelete) {
    super.postDelete(testCase, hardDelete);
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

    // Handle test case failure resolution tasks
    if (EntityUtil.isTestCaseFailureResolutionTask(taskType)) {
      return new TestCaseRepository.TestCaseFailureResolutionTaskWorkflow(threadContext);
    }

    // Handle description tasks
    if (EntityUtil.isDescriptionTask(taskType)) {
      return new DescriptionTaskWorkflow(threadContext);
    }

    // Handle tag tasks
    if (EntityUtil.isTagTask(taskType)) {
      return new TagTaskWorkflow(threadContext);
    }

    // Handle approval tasks (RequestApproval, etc.)
    if (EntityUtil.isApprovalTask(taskType)) {
      return new ApprovalTaskWorkflow(threadContext);
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
        validateColumn(table, columnName, Boolean.FALSE);
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

  public static class ApprovalTaskWorkflow extends FeedRepository.TaskWorkflow {
    ApprovalTaskWorkflow(FeedRepository.ThreadContext threadContext) {
      super(threadContext);
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      TestCase testCase = (TestCase) threadContext.getAboutEntity();
      checkUpdatedByReviewer(testCase, user);

      UUID taskId = threadContext.getThread().getId();
      Map<String, Object> variables = new HashMap<>();
      variables.put(RESULT_VARIABLE, resolveTask.getNewValue().equalsIgnoreCase("approved"));
      variables.put(UPDATED_BY_VARIABLE, user);
      WorkflowHandler workflowHandler = WorkflowHandler.getInstance();
      boolean workflowSuccess =
          workflowHandler.resolveTask(
              taskId, workflowHandler.transformToNodeVariables(taskId, variables));

      // If workflow failed (corrupted Flowable task), apply the status directly
      if (!workflowSuccess) {
        LOG.warn(
            "[GlossaryTerm] Workflow failed for taskId='{}', applying status directly", taskId);
        Boolean approved = (Boolean) variables.get(RESULT_VARIABLE);
        String entityStatus = (approved != null && approved) ? "Approved" : "Rejected";
        EntityFieldUtils.setEntityField(
            testCase, TEST_CASE, user, FIELD_ENTITY_STATUS, entityStatus, true);
      }

      return testCase;
    }
  }

  public class TestUpdater extends EntityUpdater {
    public TestUpdater(TestCase original, TestCase updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void updateReviewers() {
      super.updateReviewers();
      // adding the reviewer should add the person as assignee to the task
      if (original.getReviewers() != null
          && updated.getReviewers() != null
          && !original.getReviewers().equals(updated.getReviewers())) {
        updateTaskWithNewReviewers(updated);
      }
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
      recordChange(
          "dimensionColumns", original.getDimensionColumns(), updated.getDimensionColumns());
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

  @Override
  public void postUpdate(TestCase original, TestCase updated) {
    super.postUpdate(original, updated);
    if (EntityStatus.IN_REVIEW.equals(original.getEntityStatus())) {
      if (EntityStatus.APPROVED.equals(updated.getEntityStatus())) {
        closeApprovalTask(updated, "Approved the test case");
      } else if (EntityStatus.REJECTED.equals(updated.getEntityStatus())) {
        closeApprovalTask(updated, "Rejected the test case");
      }
    }

    // TODO: It might happen that a task went from DRAFT to IN_REVIEW to DRAFT fairly quickly
    // Due to ChangesConsolidation, the postUpdate will be called as from DRAFT to DRAFT, but there
    // will be a Task created.
    // This if handles this case scenario, by guaranteeing that we close any Approval Task if the
    // TestCase goes back to DRAFT.
    if (EntityStatus.DRAFT.equals(updated.getEntityStatus())) {
      try {
        closeApprovalTask(updated, "Closed due to test case going back to DRAFT.");
      } catch (EntityNotFoundException ignored) {
      } // No ApprovalTask is present, and thus we don't need to worry about this.
    }
  }

  @Override
  protected void preDelete(TestCase entity, String deletedBy) {
    // A test case in `IN_REVIEW` state can only be deleted by the reviewers
    if (EntityStatus.IN_REVIEW.equals(entity.getEntityStatus())) {
      checkUpdatedByReviewer(entity, deletedBy);
    }
  }

  private void closeApprovalTask(TestCase entity, String comment) {
    MessageParser.EntityLink about =
        new MessageParser.EntityLink(TEST_CASE, entity.getFullyQualifiedName());
    FeedRepository feedRepository = Entity.getFeedRepository();

    // Skip closing tasks if updatedBy is null (e.g., during tests)
    if (entity.getUpdatedBy() == null) {
      LOG.debug(
          "Skipping task closure for test case {} - updatedBy is null",
          entity.getFullyQualifiedName());
      return;
    }

    // Close User Tasks
    try {
      Thread taskThread = feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      feedRepository.closeTask(
          taskThread, entity.getUpdatedBy(), new CloseTask().withComment(comment));
    } catch (EntityNotFoundException ex) {
      LOG.info("No approval task found for test case {}", entity.getFullyQualifiedName());
    }
  }

  protected void updateTaskWithNewReviewers(TestCase testCase) {
    try {
      MessageParser.EntityLink about =
          new MessageParser.EntityLink(TEST_CASE, testCase.getFullyQualifiedName());
      FeedRepository feedRepository = Entity.getFeedRepository();
      Thread originalTask =
          feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      testCase =
          Entity.getEntityByName(
              Entity.TEST_CASE,
              testCase.getFullyQualifiedName(),
              "id,fullyQualifiedName,reviewers",
              Include.ALL);

      Thread updatedTask = JsonUtils.deepCopy(originalTask, Thread.class);
      updatedTask.getTask().withAssignees(new ArrayList<>(testCase.getReviewers()));
      JsonPatch patch = JsonUtils.getJsonPatch(originalTask, updatedTask);
      RestUtil.PatchResponse<Thread> thread =
          feedRepository.patchThread(null, originalTask.getId(), updatedTask.getUpdatedBy(), patch);

      // Send WebSocket Notification
      WebsocketNotificationHandler.handleTaskNotification(thread.entity());
    } catch (EntityNotFoundException e) {
      LOG.info(
          "{} Task not found for test case {}",
          TaskType.RequestApproval,
          testCase.getFullyQualifiedName());
    }
  }

  public static void checkUpdatedByReviewer(TestCase testCase, String updatedBy) {
    // Only list of allowed reviewers can change the status from DRAFT to APPROVED
    List<EntityReference> reviewers = testCase.getReviewers();
    if (!nullOrEmpty(reviewers)) {
      // Updating user must be one of the reviewers
      boolean isReviewer =
          reviewers.stream()
              .anyMatch(
                  e -> {
                    if (e.getType().equals(TEAM)) {
                      Team team =
                          Entity.getEntityByName(TEAM, e.getName(), "users", Include.NON_DELETED);
                      return team.getUsers().stream()
                          .anyMatch(
                              u ->
                                  u.getName().equals(updatedBy)
                                      || u.getFullyQualifiedName().equals(updatedBy));
                    } else {
                      return e.getName().equals(updatedBy)
                          || e.getFullyQualifiedName().equals(updatedBy);
                    }
                  });
      if (!isReviewer) {
        throw new AuthorizationException(notReviewer(updatedBy));
      }
    }
  }

  @Override
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    return exportToCsv(name, user, recursive, null);
  }

  @Override
  public String exportToCsv(
      String name, String user, boolean recursive, CsvExportProgressCallback callback)
      throws IOException {
    List<TestCase> testCases = getTestCasesForExport(name, recursive);
    return new TestCaseCsv(user, null).exportCsv(testCases, callback);
  }

  @Override
  public CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) throws IOException {
    throw new IllegalArgumentException(
        "TestCase CSV import requires 'targetEntityType' parameter. "
            + "Specify 'table' when importing from a table context, or 'testSuite' when importing from a Bundle Suite Context.");
  }

  @Override
  public CsvImportResult importFromCsv(
      String name,
      String csv,
      boolean dryRun,
      String user,
      boolean recursive,
      CsvImportProgressCallback callback)
      throws IOException {
    // if we end up here it means we are importing test cases from the obs page
    return new TestCaseCsv(user, null).importCsv(csv, dryRun);
  }

  @Override
  public CsvImportResult importFromCsv(
      String name,
      String csv,
      boolean dryRun,
      String user,
      boolean recursive,
      String targetEntityType)
      throws IOException {
    TestSuite targetBundleSuite =
        TEST_SUITE.equals(targetEntityType)
            ? Entity.getEntityByName(TEST_SUITE, name, "", Include.ALL)
            : null;
    return new TestCaseCsv(user, targetBundleSuite).importCsv(csv, dryRun);
  }

  @Override
  public CsvImportResult importFromCsv(
      String name,
      String csv,
      boolean dryRun,
      String user,
      boolean recursive,
      String targetEntityType,
      CsvImportProgressCallback callback)
      throws IOException {
    TestSuite targetBundleSuite =
        TEST_SUITE.equals(targetEntityType)
            ? Entity.getEntityByName(TEST_SUITE, name, "", Include.ALL)
            : null;
    return new TestCaseCsv(user, targetBundleSuite).importCsv(csv, dryRun);
  }

  private List<TestCase> getTestCasesForExport(String name, boolean recursive) {
    // The name parameter can be:
    // 1. A table FQN - export test cases for that table
    // 2. A test suite FQN - export test cases in that test suite
    // 3. "*" - export all test cases (platform-wide)

    if ("*".equals(name)) {
      // Platform-wide export
      return listAll(new Fields(allowedFields, "testDefinition,testSuite"), new ListFilter());
    }

    // Try to determine if name is a table or test suite
    try {
      // Try as table first
      Table table = Entity.getEntityByName(TABLE, name, "", Include.NON_DELETED);
      return getTestCasesForTable(table.getFullyQualifiedName());
    } catch (EntityNotFoundException e) {
      // Not a table, try as test suite
      try {
        TestSuite testSuite = Entity.getEntityByName(TEST_SUITE, name, "", Include.NON_DELETED);
        return getTestCasesForTestSuite(testSuite.getId());
      } catch (EntityNotFoundException ex) {
        throw new IllegalArgumentException(
            String.format(
                "Entity '%s' not found. Please provide a valid table FQN, test suite FQN, or '*' for platform-wide export.",
                name));
      }
    }
  }

  private List<TestCase> getTestCasesForTable(String tableFqn) {
    // Get table-level test cases using database filter
    ListFilter filter = new ListFilter(ALL);
    filter.addQueryParam("entityFQN", tableFqn);
    filter.addQueryParam("includeAllTests", "true");
    List<TestCase> testCases =
        new ArrayList<>(listAll(new Fields(allowedFields, "testDefinition,testSuite"), filter));

    return testCases;
  }

  private List<TestCase> getTestCasesForTestSuite(UUID testSuiteId) {
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    filter.addQueryParam("testSuiteId", testSuiteId.toString());
    return listAll(new Fields(allowedFields, "testDefinition,testSuite"), filter);
  }

  public static class TestCaseCsv extends EntityCsv<TestCase> {
    public static final CsvDocumentation DOCUMENTATION = getCsvDocumentation(TEST_CASE, false);
    public static final List<CsvHeader> HEADERS = DOCUMENTATION.getHeaders();
    private final TestSuite targetBundleSuite;
    private final List<UUID> importedTestCaseIds = new ArrayList<>();
    private final Map<String, UUID> importedTestSuiteIds = new HashMap<>();
    private final EntityRepository<EntityInterface> versioningRepo =
        (EntityRepository<EntityInterface>) Entity.getEntityRepository(TEST_SUITE);

    TestCaseCsv(String user, TestSuite targetBundleSuite) {
      super(TEST_CASE, HEADERS, user);
      this.targetBundleSuite = targetBundleSuite;
    }

    @Override
    protected void createEntity(CSVPrinter printer, List<CSVRecord> csvRecords) throws IOException {
      // Process each test case record using getNextRecord to increment recordIndex
      while (recordIndex < csvRecords.size()) {
        CSVRecord csvRecord = getNextRecord(printer, csvRecords);
        if (csvRecord == null) {
          return; // Error has already been logged by getNextRecord
        }

        try {
          // Parse CSV record
          String name = csvRecord.get(0);
          String displayName = nullOrEmpty(csvRecord.get(1)) ? null : csvRecord.get(1);
          String description = nullOrEmpty(csvRecord.get(2)) ? null : csvRecord.get(2);
          String testDefinitionFqn = csvRecord.get(3);
          String entityFQN = csvRecord.get(4);
          String testSuiteFqn = nullOrEmpty(csvRecord.get(5)) ? null : csvRecord.get(5);
          String parameterValuesStr = nullOrEmpty(csvRecord.get(6)) ? null : csvRecord.get(6);
          String computePassedFailedRowCountStr =
              nullOrEmpty(csvRecord.get(7)) ? null : csvRecord.get(7);
          String useDynamicAssertionStr = nullOrEmpty(csvRecord.get(8)) ? null : csvRecord.get(8);
          String inspectionQuery = nullOrEmpty(csvRecord.get(9)) ? null : csvRecord.get(9);

          // Convert entityFQN to EntityLink
          String entityLink = convertFQNToEntityLink(entityFQN);

          // Get test definition
          TestDefinition testDefinition =
              Entity.getEntityByName(TEST_DEFINITION, testDefinitionFqn, "", Include.NON_DELETED);

          // Parse parameter values
          List<TestCaseParameterValue> parameterValues = parseParameterValues(parameterValuesStr);

          // Create test case
          TestCase testCase = new TestCase();
          testCase.withName(name);
          testCase.withDisplayName(displayName);
          testCase.withDescription(description);
          testCase.withTestDefinition(testDefinition.getEntityReference());
          testCase.withEntityLink(entityLink);
          testCase.withParameterValues(parameterValues);

          if (computePassedFailedRowCountStr != null) {
            testCase.withComputePassedFailedRowCount(
                Boolean.parseBoolean(computePassedFailedRowCountStr));
          }
          if (useDynamicAssertionStr != null) {
            testCase.withUseDynamicAssertion(Boolean.parseBoolean(useDynamicAssertionStr));
          }
          if (inspectionQuery != null) {
            testCase.withInspectionQuery(inspectionQuery);
          }

          // Parse and set tags and glossary terms
          List<TagLabel> tagLabels =
              getTagLabels(
                  printer,
                  csvRecord,
                  List.of(
                      Pair.of(10, TagLabel.TagSource.CLASSIFICATION),
                      Pair.of(11, TagLabel.TagSource.GLOSSARY)));
          testCase.withTags(tagLabels);

          // Get repository instance first
          TestCaseRepository repository =
              (TestCaseRepository) Entity.getEntityRepository(TEST_CASE);

          // Get test suite if provided, otherwise get or create default test suite
          if (testSuiteFqn != null && !testSuiteFqn.trim().isEmpty()) {
            try {
              TestSuite testSuite =
                  Entity.getEntityByName(TEST_SUITE, testSuiteFqn, "", Include.NON_DELETED);
              testCase.withTestSuite(testSuite.getEntityReference());
              importedTestSuiteIds.putIfAbsent(
                  testSuite.getFullyQualifiedName(), testSuite.getId());
            } catch (EntityNotFoundException e) {
              importFailure(
                  printer, String.format("Test suite '%s' not found", testSuiteFqn), csvRecord);
              importResult.withStatus(ApiStatus.ABORTED);
              continue;
            }
          } else {
            // No test suite provided - get or create the default basic test suite
            EntityReference testSuite = repository.getOrCreateTestSuite(testCase);
            testCase.withTestSuite(testSuite);
            importedTestSuiteIds.putIfAbsent(testSuite.getFullyQualifiedName(), testSuite.getId());
          }

          // Compute and set FQN manually (same logic as setFullyQualifiedName)
          EntityLink parsedLink = EntityLink.parse(entityLink);
          String testCaseFqn =
              FullyQualifiedName.add(
                  parsedLink.getFullyQualifiedFieldValue(), EntityInterfaceUtil.quoteName(name));
          testCase.setFullyQualifiedName(testCaseFqn);
          testCase.setEntityFQN(parsedLink.getFullyQualifiedFieldValue());

          // Set required fields for new entities - createOrUpdateForImport doesn't call
          // prepareInternal which would normally set these
          if (testCase.getId() == null) {
            testCase.setId(UUID.randomUUID());
          }
          if (testCase.getUpdatedAt() == null) {
            testCase.setUpdatedAt(System.currentTimeMillis());
          }
          if (testCase.getUpdatedBy() == null) {
            testCase.setUpdatedBy(importedBy);
          }

          if (!importResult.getDryRun()) {
            // Use createOrUpdateForImport which handles both create and update
            RestUtil.PutResponse<TestCase> response =
                repository.createOrUpdateForImport(null, testCase, importedBy);
            if (targetBundleSuite != null) {
              importedTestCaseIds.add(response.getEntity().getId());
            }
            if (response.getStatus() == Response.Status.CREATED) {
              importSuccess(printer, csvRecord, ENTITY_CREATED);
            } else {
              importSuccess(printer, csvRecord, ENTITY_UPDATED);
            }
          } else {
            // Dry run - just validate
            repository.prepareInternal(testCase, true);
            importSuccess(printer, csvRecord, ENTITY_CREATED);
          }

        } catch (Exception ex) {
          importFailure(printer, ex.getMessage(), csvRecord);
          importResult.withStatus(ApiStatus.FAILURE);
        }
      }

      if (targetBundleSuite != null
          && !importedTestCaseIds.isEmpty()
          && !importResult.getDryRun()) {
        try {
          TestCaseRepository repository =
              (TestCaseRepository) Entity.getEntityRepository(TEST_CASE);
          repository.addTestCasesToLogicalTestSuite(targetBundleSuite, importedTestCaseIds);
          LOG.info(
              "Attached {} test cases to Bundle Suite '{}'",
              importedTestCaseIds.size(),
              targetBundleSuite.getFullyQualifiedName());
        } catch (Exception e) {
          LOG.error(
              "Failed to attach test cases to Bundle Suite '{}': {}",
              targetBundleSuite.getFullyQualifiedName(),
              e.getMessage());
          throw new IllegalStateException(
              String.format(
                  "%d test cases were imported successfully, but failed to attach them to Bundle suite '%s': %s. "
                      + "The test cases exist and can be manually added to the Bundle Suite.",
                  importedTestCaseIds.size(), targetBundleSuite.getName(), e.getMessage()),
              e);
        }
      }

      if (!importResult.getDryRun()
          && importResult.getStatus() != ApiStatus.ABORTED
          && importResult.getNumberOfRowsProcessed() > 1) {
        List<UUID> affectedTestSuiteIds = new ArrayList<>(importedTestSuiteIds.values());
        for (UUID affectedTestSuiteId : affectedTestSuiteIds) {
          try {
            versioningRepo.createChangeEventForBulkOperation(
                versioningRepo.get(
                    null,
                    affectedTestSuiteId,
                    new Fields(versioningRepo.getAllowedFields(), ""),
                    NON_DELETED,
                    false),
                importResult,
                importedBy);
          } catch (Exception e) {
            LOG.error(
                "Failed to update version for Test Suite with id '{}': {}",
                affectedTestSuiteId,
                e.getMessage());
          }
        }
      }
    }

    @Override
    protected void addRecord(CsvFile csvFile, TestCase testCase) {
      // Headers: name, displayName, description, testDefinition, entityFQN, testSuite,
      // parameterValues, computePassedFailedRowCount, useDynamicAssertion, inspectionQuery,
      // tags, glossaryTerms
      List<String> recordList = new ArrayList<>();

      // Basic fields
      addField(recordList, testCase.getName());
      addField(recordList, testCase.getDisplayName());
      addField(recordList, testCase.getDescription());

      // Test definition
      addField(
          recordList,
          testCase.getTestDefinition() != null
              ? testCase.getTestDefinition().getFullyQualifiedName()
              : "");

      // Use entityFQN if available, otherwise convert EntityLink to FQN
      String entityFQN =
          testCase.getEntityFQN() != null
              ? testCase.getEntityFQN()
              : convertEntityLinkToFQN(testCase.getEntityLink());
      addField(recordList, entityFQN);

      // Test suite
      addField(
          recordList,
          testCase.getTestSuite() != null ? testCase.getTestSuite().getFullyQualifiedName() : "");

      // Parameter values - serialize as JSON objects separated by ';'
      String parameterValuesStr = serializeParameterValues(testCase.getParameterValues());
      addField(recordList, parameterValuesStr);

      // Boolean flags
      addField(
          recordList,
          testCase.getComputePassedFailedRowCount() != null
              ? testCase.getComputePassedFailedRowCount().toString()
              : "");
      addField(
          recordList,
          testCase.getUseDynamicAssertion() != null
              ? testCase.getUseDynamicAssertion().toString()
              : "");

      // Inspection query
      addField(recordList, testCase.getInspectionQuery());

      // Tags and glossary terms
      addTagLabels(recordList, testCase.getTags());
      addGlossaryTerms(recordList, testCase.getTags());

      // Add record to CSV
      addRecord(csvFile, recordList);
    }

    private String convertEntityLinkToFQN(String entityLink) {
      // Convert EntityLink format to simple FQN
      // <#E::table::service.database.schema.table> -> service.database.schema.table
      // <#E::table::service.database.schema.table::columns::column> ->
      // service.database.schema.table.column
      if (entityLink == null) {
        return "";
      }

      EntityLink link = EntityLink.parse(entityLink);
      String fqn = link.getEntityFQN();

      if (link.getFieldName() != null && link.getFieldName().equals("columns")) {
        // Column test case - use FQN utility to properly handle quoting
        fqn = FullyQualifiedName.add(fqn, link.getArrayFieldName());
      }

      return fqn;
    }

    private String convertFQNToEntityLink(String fqn) {
      // Convert simple FQN to EntityLink format
      // service.database.schema.table -> <#E::table::service.database.schema.table>
      // service.database.schema.table.column ->
      // <#E::table::service.database.schema.table::columns::column>

      // First, try to find if this is a table or column
      try {
        // Try as table first
        Table table = Entity.getEntityByName(TABLE, fqn, "", Include.NON_DELETED);
        return String.format("<#E::table::%s>", table.getFullyQualifiedName());
      } catch (EntityNotFoundException e) {
        // Not a table, try as column
        // Parse FQN to extract table FQN and column name using FQN parser
        String tableFqn = FullyQualifiedName.getTableFQN(fqn);
        String columnName = FullyQualifiedName.getColumnName(fqn);

        // Validate that the table and column exist
        Table table = Entity.getEntityByName(TABLE, tableFqn, "columns", Include.NON_DELETED);
        validateColumn(table, columnName, Boolean.FALSE);

        return String.format(
            "<#E::table::%s::columns::%s>", table.getFullyQualifiedName(), columnName);
      }
    }

    private String serializeParameterValues(List<TestCaseParameterValue> parameterValues) {
      if (nullOrEmpty(parameterValues)) {
        return "";
      }
      return parameterValues.stream().map(JsonUtils::pojoToJson).collect(Collectors.joining(";"));
    }

    private List<TestCaseParameterValue> parseParameterValues(String parameterValuesStr) {
      if (nullOrEmpty(parameterValuesStr)) {
        return new ArrayList<>();
      }

      String normalized = RestUtil.normalizeQuotes(parameterValuesStr.trim());
      List<String> jsonObjects = RestUtil.extractJsonObjects(normalized);

      return jsonObjects.stream()
          .map(json -> JsonUtils.readValue(json, TestCaseParameterValue.class))
          .collect(Collectors.toList());
    }
  }
}
