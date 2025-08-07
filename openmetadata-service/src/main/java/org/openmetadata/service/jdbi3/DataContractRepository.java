/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_CREATED;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.LatestResult;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.entity.datacontract.FailedRule;
import org.openmetadata.schema.entity.datacontract.QualityValidation;
import org.openmetadata.schema.entity.datacontract.SchemaValidation;
import org.openmetadata.schema.entity.datacontract.SemanticsValidation;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.DataContractValidationException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.data.DataContractResource;
import org.openmetadata.service.resources.dqtests.TestSuiteMapper;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineMapper;
import org.openmetadata.service.rules.RuleEngine;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Repository
public class DataContractRepository extends EntityRepository<DataContract> {

  private static final String DATA_CONTRACT_UPDATE_FIELDS =
      "entity,owners,reviewers,status,schema,qualityExpectations,contractUpdates,semantics,latestResult";
  private static final String DATA_CONTRACT_PATCH_FIELDS =
      "entity,owners,reviewers,status,schema,qualityExpectations,contractUpdates,semantics,latestResult";

  public static final String RESULT_EXTENSION = "dataContract.dataContractResult";
  public static final String RESULT_SCHEMA = "dataContractResult";
  public static final String RESULT_EXTENSION_KEY = "id";

  private final TestSuiteMapper testSuiteMapper = new TestSuiteMapper();
  private final IngestionPipelineMapper ingestionPipelineMapper;
  @Getter @Setter private PipelineServiceClientInterface pipelineServiceClient;
  private final OpenMetadataApplicationConfig openMetadataApplicationConfig;

  private static final List<TestCaseStatus> FAILED_DQ_STATUSES =
      List.of(TestCaseStatus.Failed, TestCaseStatus.Aborted);

  public DataContractRepository(OpenMetadataApplicationConfig config) {
    super(
        DataContractResource.COLLECTION_PATH,
        Entity.DATA_CONTRACT,
        DataContract.class,
        Entity.getCollectionDAO().dataContractDAO(),
        DATA_CONTRACT_PATCH_FIELDS,
        DATA_CONTRACT_UPDATE_FIELDS);
    this.ingestionPipelineMapper = new IngestionPipelineMapper(config);
    this.openMetadataApplicationConfig = config;
  }

  @Override
  public void setFullyQualifiedName(DataContract dataContract) {
    EntityReference entityRef =
        Entity.getEntityReferenceById(
            dataContract.getEntity().getType(),
            dataContract.getEntity().getId(),
            Include.NON_DELETED);
    String entityFQN = entityRef.getFullyQualifiedName();
    String name = dataContract.getName();
    dataContract.setFullyQualifiedName(entityFQN + ".dataContract_" + name);
  }

  @Override
  public void setFields(DataContract dataContract, Fields fields) {}

  @Override
  public void clearFields(DataContract dataContract, Fields fields) {}

  @Override
  public void prepare(DataContract dataContract, boolean update) {
    EntityReference entityRef = dataContract.getEntity();
    // make sure the contract has FQN. We need it for the test suite.
    setFullyQualifiedName(dataContract);

    if (!update) {
      validateEntityReference(entityRef);
    }

    // Validate schema fields and throw exception if there are failures
    SchemaValidation schemaValidation = validateSchemaFieldsAgainstEntity(dataContract, entityRef);
    if (schemaValidation.getFailed() != null && schemaValidation.getFailed() > 0) {
      String failedFieldsStr = String.join(", ", schemaValidation.getFailedFields());
      throw BadRequestException.of(
          String.format(
              "Schema validation failed. The following fields specified in the data contract do not exist in the %s: %s",
              entityRef.getType(), failedFieldsStr));
    }

    if (!nullOrEmpty(dataContract.getOwners())) {
      dataContract.setOwners(EntityUtil.populateEntityReferences(dataContract.getOwners()));
    }
    if (!nullOrEmpty(dataContract.getReviewers())) {
      dataContract.setReviewers(EntityUtil.populateEntityReferences(dataContract.getReviewers()));
    }
    createOrUpdateDataContractTestSuite(dataContract, update);
  }

  // Ensure we have a pipeline after creation if needed
  @Override
  protected void postCreate(DataContract dataContract) {
    super.postCreate(dataContract);
    postCreateOrUpdate(dataContract);
  }

  // If we update the contract adding DQ validation, add the pipeline if needed
  @Override
  protected void postUpdate(DataContract original, DataContract updated) {
    super.postUpdate(original, updated);
    postCreateOrUpdate(updated);
  }

  @Override
  protected void postDelete(DataContract dataContract) {
    super.postDelete(dataContract);
    if (!nullOrEmpty(dataContract.getQualityExpectations())) {
      TestSuite testSuite = getOrCreateTestSuite(dataContract);
      TestSuiteRepository testSuiteRepository =
          (TestSuiteRepository) Entity.getEntityRepository(Entity.TEST_SUITE);
      testSuiteRepository.delete(ADMIN_USER_NAME, testSuite.getId(), true, true);
    }
    // Clean status
    daoCollection
        .entityExtensionTimeSeriesDao()
        .delete(dataContract.getFullyQualifiedName(), RESULT_EXTENSION);
  }

  private void postCreateOrUpdate(DataContract dataContract) {
    if (!nullOrEmpty(dataContract.getQualityExpectations())) {
      TestSuite testSuite = getOrCreateTestSuite(dataContract);
      // Create the ingestion pipeline only if needed
      if (testSuite != null && nullOrEmpty(testSuite.getPipelines())) {
        IngestionPipeline pipeline = createIngestionPipeline(testSuite);
        EntityReference pipelineRef =
            Entity.getEntityReference(
                new EntityReference().withId(pipeline.getId()).withType(Entity.INGESTION_PIPELINE),
                Include.NON_DELETED);
        testSuite.setPipelines(List.of(pipelineRef));
        TestSuiteRepository testSuiteRepository =
            (TestSuiteRepository) Entity.getEntityRepository(Entity.TEST_SUITE);
        testSuiteRepository.createOrUpdate(null, testSuite, ADMIN_USER_NAME);
        if (!pipeline.getDeployed()) {
          prepareAndDeployIngestionPipeline(pipeline, testSuite);
        }
      }
    }
  }

  private SchemaValidation validateSchemaFieldsAgainstEntity(
      DataContract dataContract, EntityReference entityRef) {
    SchemaValidation validation = new SchemaValidation();

    if (dataContract.getSchema() == null || dataContract.getSchema().isEmpty()) {
      return validation.withPassed(0).withFailed(0).withTotal(0);
    }

    String entityType = entityRef.getType();
    List<String> failedFields = new ArrayList<>();

    switch (entityType) {
      case Entity.TABLE:
        failedFields = validateFieldsAgainstTable(dataContract, entityRef);
        break;
      case Entity.TOPIC:
        failedFields = validateFieldsAgainstTopic(dataContract, entityRef);
        break;
      default:
        break;
    }

    int totalFields = dataContract.getSchema().size();
    int failedCount = failedFields.size();
    int passedCount = totalFields - failedCount;

    return validation
        .withPassed(passedCount)
        .withFailed(failedCount)
        .withTotal(totalFields)
        .withFailedFields(failedFields);
  }

  private List<String> validateFieldsAgainstTable(
      DataContract dataContract, EntityReference tableRef) {
    List<String> failedFields = new ArrayList<>();
    org.openmetadata.schema.entity.data.Table table =
        Entity.getEntity(Entity.TABLE, tableRef.getId(), "columns", Include.NON_DELETED);

    if (table.getColumns() == null || table.getColumns().isEmpty()) {
      // If table has no columns, all contract fields fail validation
      return dataContract.getSchema().stream()
          .map(org.openmetadata.schema.type.Column::getName)
          .collect(Collectors.toList());
    }

    Set<String> tableColumnNames =
        table.getColumns().stream().map(Column::getName).collect(Collectors.toSet());

    for (org.openmetadata.schema.type.Column column : dataContract.getSchema()) {
      if (!tableColumnNames.contains(column.getName())) {
        failedFields.add(column.getName());
      }
    }

    return failedFields;
  }

  private List<String> validateFieldsAgainstTopic(
      DataContract dataContract, EntityReference topicRef) {
    List<String> failedFields = new ArrayList<>();
    Topic topic =
        Entity.getEntity(Entity.TOPIC, topicRef.getId(), "messageSchema", Include.NON_DELETED);

    if (topic.getMessageSchema() == null
        || topic.getMessageSchema().getSchemaFields() == null
        || topic.getMessageSchema().getSchemaFields().isEmpty()) {
      // If topic has no schema, all contract fields fail validation
      return dataContract.getSchema().stream()
          .map(org.openmetadata.schema.type.Column::getName)
          .collect(Collectors.toList());
    }

    Set<String> topicFieldNames = extractFieldNames(topic.getMessageSchema().getSchemaFields());

    for (org.openmetadata.schema.type.Column column : dataContract.getSchema()) {
      if (!topicFieldNames.contains(column.getName())) {
        failedFields.add(column.getName());
      }
    }

    return failedFields;
  }

  private Set<String> extractFieldNames(List<org.openmetadata.schema.type.Field> fields) {
    if (fields == null || fields.isEmpty()) {
      return Collections.emptySet();
    }

    Set<String> fieldNames = new HashSet<>();
    for (org.openmetadata.schema.type.Field field : fields) {
      fieldNames.add(field.getName());
      if (field.getChildren() != null && !field.getChildren().isEmpty()) {
        fieldNames.addAll(extractFieldNames(field.getChildren()));
      }
    }
    return fieldNames;
  }

  public static String getTestSuiteName(DataContract dataContract) {
    // return String.format("Data Contract - %s %s", dataContract.getName(),
    // EntityUtil.hash(dataContract.getFullyQualifiedName()));
    return EntityUtil.hash(dataContract.getFullyQualifiedName());
  }

  private TestSuite createOrUpdateDataContractTestSuite(DataContract dataContract, boolean update) {
    try {
      if (update) { // If we're running an update, fetch the existing test suite information
        Optional<DataContract> existing =
            getByNameOrNull(
                null,
                dataContract.getFullyQualifiedName(),
                Fields.EMPTY_FIELDS,
                Include.NON_DELETED,
                false);
        dataContract.setTestSuite(existing.map(DataContract::getTestSuite).orElse(null));
      }

      // If we don't have quality expectations or a test suite, we don't need to create one
      if (nullOrEmpty(dataContract.getQualityExpectations())
          && !contractHasTestSuite(dataContract)) {
        return null;
      }

      // If we had a test suite from older tests, but we removed them, we can delete the suite
      if (nullOrEmpty(dataContract.getQualityExpectations())) {
        deleteTestSuite(dataContract);
        dataContract.setTestSuite(null);
        return null;
      }

      TestSuite testSuite = getOrCreateTestSuite(dataContract);
      updateTestSuiteTests(dataContract, testSuite);

      // Add the test suite to the data contract
      dataContract.setTestSuite(
          new EntityReference()
              .withId(testSuite.getId())
              .withFullyQualifiedName(testSuite.getFullyQualifiedName())
              .withType(Entity.TEST_SUITE));

      return testSuite;

    } catch (Exception e) {
      LOG.error("Error creating/updating test suite for data contract", e);
      throw e;
    }
  }

  private void updateTestSuiteTests(DataContract dataContract, TestSuite testSuite) {
    TestCaseRepository testCaseRepository =
        (TestCaseRepository) Entity.getEntityRepository(Entity.TEST_CASE);

    // Collect test case references from quality expectations
    List<UUID> testCaseRefs =
        dataContract.getQualityExpectations().stream().map(EntityReference::getId).toList();
    List<UUID> currentTests =
        testSuite.getTests() != null
            ? testSuite.getTests().stream().map(EntityReference::getId).toList()
            : Collections.emptyList();

    // Add only new tests to the test suite
    List<UUID> newTestCases =
        testCaseRefs.stream().filter(testCaseRef -> !currentTests.contains(testCaseRef)).toList();
    if (!nullOrEmpty(newTestCases)) {
      testCaseRepository.addTestCasesToLogicalTestSuite(testSuite, newTestCases);
    }

    // Then, remove any tests that are no longer in the quality expectations
    List<UUID> testsToRemove =
        currentTests.stream().filter(testId -> !testCaseRefs.contains(testId)).toList();
    if (!nullOrEmpty(testsToRemove)) {
      testsToRemove.forEach(
          test -> {
            testCaseRepository.deleteTestCaseFromLogicalTestSuite(testSuite.getId(), test);
          });
    }
  }

  private void deleteTestSuite(DataContract dataContract) {
    TestSuiteRepository testSuiteRepository =
        (TestSuiteRepository) Entity.getEntityRepository(Entity.TEST_SUITE);
    TestSuite testSuite = getOrCreateTestSuite(dataContract);
    testSuiteRepository.deleteLogicalTestSuite(ADMIN_USER_NAME, testSuite, true);
  }

  private TestSuite getOrCreateTestSuite(DataContract dataContract) {
    String testSuiteName = getTestSuiteName(dataContract);
    TestSuiteRepository testSuiteRepository =
        (TestSuiteRepository) Entity.getEntityRepository(Entity.TEST_SUITE);

    // Check if test suite already exists
    if (contractHasTestSuite(dataContract)) {
      return Entity.getEntityOrNull(
          dataContract.getTestSuite(), "tests,pipelines", Include.NON_DELETED);
    } else {
      // Create new test suite
      LOG.debug(
          "Test suite [{}] not found when initializing the Data Contract, creating a new one",
          testSuiteName);
      CreateTestSuite createTestSuite =
          new CreateTestSuite()
              .withName(testSuiteName)
              .withDisplayName("Data Contract - " + dataContract.getName())
              .withDescription("Logical test suite for Data Contract: " + dataContract.getName())
              .withDataContract(
                  new EntityReference()
                      .withId(dataContract.getId())
                      .withFullyQualifiedName(dataContract.getFullyQualifiedName())
                      .withType(Entity.DATA_CONTRACT));
      TestSuite newTestSuite = testSuiteMapper.createToEntity(createTestSuite, ADMIN_USER_NAME);
      return testSuiteRepository.create(null, newTestSuite);
    }
  }

  private Boolean contractHasTestSuite(DataContract dataContract) {
    return dataContract.getTestSuite() != null;
  }

  // Prepare the Ingestion Pipeline from the test suite that will handle the execution
  private IngestionPipeline createIngestionPipeline(TestSuite testSuite) {
    IngestionPipelineRepository pipelineRepository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    CreateIngestionPipeline createPipeline =
        new CreateIngestionPipeline()
            .withName(UUID.randomUUID().toString())
            .withDisplayName(testSuite.getDisplayName())
            .withPipelineType(PipelineType.TEST_SUITE)
            .withService(
                new EntityReference().withId(testSuite.getId()).withType(Entity.TEST_SUITE))
            .withSourceConfig(new SourceConfig().withConfig(new TestSuitePipeline()))
            .withLoggerLevel(LogLevels.INFO)
            .withAirflowConfig(new AirflowConfig());

    IngestionPipeline pipeline =
        ingestionPipelineMapper.createToEntity(createPipeline, ADMIN_USER_NAME);

    // Create the Ingestion Pipeline
    return pipelineRepository.create(null, pipeline);
  }

  private void abortRunningValidation(DataContract dataContract) {
    if (dataContract.getLatestResult() != null
        && ContractExecutionStatus.Running.equals(dataContract.getLatestResult().getStatus())) {

      LOG.info(
          "Aborting running validation for data contract: {}",
          dataContract.getFullyQualifiedName());

      try {
        DataContractResult runningResult = getLatestResult(dataContract);
        runningResult
            .withContractExecutionStatus(ContractExecutionStatus.Aborted)
            .withResult(
                runningResult.getResult() != null
                    ? runningResult.getResult() + "; Aborted due to new validation request"
                    : "Aborted due to new validation request");

        addContractResult(dataContract, runningResult);
      } catch (Exception e) {
        LOG.warn(
            "Failed to abort running validation for data contract {}: {}",
            dataContract.getFullyQualifiedName(),
            e.getMessage());
      }
    }
  }

  public DataContractResult validateContract(DataContract dataContract) {
    // Check if there's a running validation and abort it before starting a new one
    abortRunningValidation(dataContract);

    DataContractResult result =
        new DataContractResult()
            .withId(UUID.randomUUID())
            .withDataContractFQN(dataContract.getFullyQualifiedName())
            .withContractExecutionStatus(ContractExecutionStatus.Running)
            .withTimestamp(System.currentTimeMillis());
    addContractResult(dataContract, result);

    // Validate schema fields against the entity
    if (dataContract.getSchema() != null && !dataContract.getSchema().isEmpty()) {
      SchemaValidation schemaValidation =
          validateSchemaFieldsAgainstEntity(dataContract, dataContract.getEntity());
      result.withSchemaValidation(schemaValidation);
    }

    if (!nullOrEmpty(dataContract.getSemantics())) {
      SemanticsValidation semanticsValidation = validateSemantics(dataContract);
      result.withSemanticsValidation(semanticsValidation);
    }

    // If we don't have quality expectations, flag the results based on schema and semantics
    // Otherwise, keep it Running and wait for the DQ results to kick in
    if (!nullOrEmpty(dataContract.getQualityExpectations())) {
      try {
        deployAndTriggerDQValidation(dataContract);
        compileResult(result, ContractExecutionStatus.Running);
      } catch (Exception e) {
        LOG.error(
            "Failed to trigger DQ validation for data contract {}: {}",
            dataContract.getFullyQualifiedName(),
            e.getMessage());
        result
            .withContractExecutionStatus(ContractExecutionStatus.Aborted)
            .withResult("Failed to trigger DQ validation: " + e.getMessage());
        compileResult(result, ContractExecutionStatus.Aborted);
      }
    } else {
      compileResult(result, ContractExecutionStatus.Success);
    }

    // Add the result to the data contract and update the time series
    addContractResult(dataContract, result);
    return result;
  }

  public void deployAndTriggerDQValidation(DataContract dataContract) {
    if (dataContract.getTestSuite() == null) {
      throw DataContractValidationException.byMessage(
          String.format(
              "Data contract %s does not have a test suite defined, cannot trigger DQ validation",
              dataContract.getFullyQualifiedName()));
    }
    TestSuite testSuite =
        Entity.getEntity(dataContract.getTestSuite(), "tests,pipelines", Include.NON_DELETED);

    if (nullOrEmpty(testSuite.getPipelines())) {
      throw DataContractValidationException.byMessage(
          String.format(
              "Test suite %s does not have any pipelines defined, cannot trigger DQ validation",
              testSuite.getFullyQualifiedName()));
    }

    IngestionPipeline pipeline =
        Entity.getEntity(testSuite.getPipelines().get(0), "*", Include.NON_DELETED);

    // ensure pipeline is deployed before running
    // we deploy the pipeline during post create
    if (!pipeline.getDeployed()) {
      prepareAndDeployIngestionPipeline(pipeline, testSuite);
    }
    prepareAndRunIngestionPipeline(pipeline, testSuite);
  }

  private void prepareAndDeployIngestionPipeline(IngestionPipeline pipeline, TestSuite testSuite) {
    OpenMetadataConnection openMetadataServerConnection =
        new OpenMetadataConnectionBuilder(openMetadataApplicationConfig, pipeline).build();
    pipeline.setOpenMetadataServerConnection(
        SecretsManagerFactory.getSecretsManager()
            .encryptOpenMetadataConnection(openMetadataServerConnection, false));

    PipelineServiceClientResponse response =
        pipelineServiceClient.deployPipeline(pipeline, testSuite);
    if (response.getCode() == 200) {
      pipeline.setDeployed(true);
      IngestionPipelineRepository ingestionPipelineRepository =
          (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
      ingestionPipelineRepository.createOrUpdate(null, pipeline, ADMIN_USER_NAME);
    }
  }

  private void prepareAndRunIngestionPipeline(IngestionPipeline pipeline, TestSuite testSuite) {
    OpenMetadataConnection openMetadataServerConnection =
        new OpenMetadataConnectionBuilder(openMetadataApplicationConfig, pipeline).build();
    pipeline.setOpenMetadataServerConnection(
        SecretsManagerFactory.getSecretsManager()
            .encryptOpenMetadataConnection(openMetadataServerConnection, false));

    pipelineServiceClient.runPipeline(pipeline, testSuite);
  }

  private SemanticsValidation validateSemantics(DataContract dataContract) {
    SemanticsValidation validation = new SemanticsValidation();

    try {
      // Get the entity that the contract applies to
      EntityInterface entity =
          Entity.getEntity(
              dataContract.getEntity().getType(),
              dataContract.getEntity().getId(),
              "*",
              Include.NON_DELETED);

      // We don't enforce the contract since we don't want to load it again. We're already passing
      // its rules
      List<SemanticsRule> failedRules =
          RuleEngine.getInstance()
              .evaluateAndReturn(entity, dataContract.getSemantics(), false, false);

      validation
          .withFailed(failedRules.size())
          .withPassed(dataContract.getSemantics().size() - failedRules.size())
          .withTotal(dataContract.getSemantics().size())
          .withFailedRules(
              failedRules.stream()
                  .map(
                      rule ->
                          new FailedRule()
                              .withRuleName(rule.getName())
                              .withReason(rule.getDescription()))
                  .collect(Collectors.toList()));

    } catch (Exception e) {
      LOG.error("Error during semantics validation", e);
    }

    return validation;
  }

  private QualityValidation validateDQ(List<ResultSummary> testSummary) {
    QualityValidation validation = new QualityValidation();
    if (nullOrEmpty(testSummary)) {
      return validation; // return the existing result without updates
    }

    List<ResultSummary> failedTests =
        testSummary.stream().filter(test -> FAILED_DQ_STATUSES.contains(test.getStatus())).toList();

    validation
        .withFailed(failedTests.size())
        .withPassed(testSummary.size() - failedTests.size())
        .withTotal(testSummary.size())
        .withQualityScore(
            (((testSummary.size() - failedTests.size()) / (double) testSummary.size())) * 100);

    return validation;
  }

  public void compileResult(DataContractResult result, ContractExecutionStatus fallbackStatus) {
    result.withContractExecutionStatus(fallbackStatus);

    if (!nullOrEmpty(result.getSchemaValidation())) {
      if (result.getSchemaValidation().getFailed() > 0) {
        result.withContractExecutionStatus(ContractExecutionStatus.Failed);
      }
    }

    if (!nullOrEmpty(result.getSemanticsValidation())) {
      if (result.getSemanticsValidation().getFailed() > 0) {
        result.withContractExecutionStatus(ContractExecutionStatus.Failed);
      }
    }

    if (!nullOrEmpty(result.getQualityValidation())) {
      if (result.getQualityValidation().getFailed() > 0) {
        result.withContractExecutionStatus(ContractExecutionStatus.Failed);
      }
    }
  }

  public RestUtil.PutResponse<DataContractResult> addContractResult(
      DataContract dataContract, DataContractResult result) {
    EntityTimeSeriesDAO timeSeriesDAO = Entity.getCollectionDAO().entityExtensionTimeSeriesDao();

    DataContractResult storedResult =
        JsonUtils.readValue(
            timeSeriesDAO.getLatestExtensionByKey(
                RESULT_EXTENSION_KEY,
                result.getId().toString(),
                dataContract.getFullyQualifiedName(),
                RESULT_EXTENSION),
            DataContractResult.class);

    if (storedResult != null) {
      timeSeriesDAO.updateExtensionByKey(
          RESULT_EXTENSION_KEY,
          result.getId().toString(),
          dataContract.getFullyQualifiedName(),
          RESULT_EXTENSION,
          JsonUtils.pojoToJson(result));
    } else {
      timeSeriesDAO.insert(
          dataContract.getFullyQualifiedName(),
          RESULT_EXTENSION,
          RESULT_SCHEMA,
          JsonUtils.pojoToJson(result));
    }

    // Update latest result in data contract if it is indeed the latest
    // or if we're updating the same result with a newer status
    if (dataContract.getLatestResult() == null
        || dataContract.getLatestResult().getTimestamp() < result.getTimestamp()
        || dataContract.getLatestResult().getResultId().equals(result.getId())) {
      updateLatestResult(dataContract, result);
      return new RestUtil.PutResponse<>(Response.Status.OK, result, ENTITY_UPDATED);
    }

    return new RestUtil.PutResponse<>(Response.Status.CREATED, result, ENTITY_CREATED);
  }

  public DataContractResult updateContractDQResults(
      EntityReference contractReference, TestSuite testSuite) {
    DataContract dataContract = Entity.getEntity(contractReference, "", Include.NON_DELETED);
    if (dataContract == null) {
      throw EntityNotFoundException.byMessage(
          String.format("Data contract not found for Test Suite %s", testSuite.getName()));
    }

    if (nullOrEmpty(dataContract.getQualityExpectations())) {
      throw DataContractValidationException.byMessage(
          String.format(
              "Data contract %s does not have any quality expectations defined, cannot update DQ results",
              dataContract.getFullyQualifiedName()));
    }

    // Get the latest result or throw if none exists
    DataContractResult result = getLatestResult(dataContract);
    QualityValidation validation = validateDQ(testSuite.getTestCaseResultSummary());

    result.withQualityValidation(validation);

    compileResult(result, ContractExecutionStatus.Success);
    // Update the last result in the data contract
    addContractResult(dataContract, result);

    return result;
  }

  public DataContractResult getLatestResult(DataContract dataContract) {
    if (dataContract.getLatestResult() == null
        || dataContract.getLatestResult().getResultId() == null) {
      throw BadRequestException.of(
          String.format(
              "Data contract %s does not have a latest result defined",
              dataContract.getFullyQualifiedName()));
    }

    EntityTimeSeriesDAO timeSeriesDAO = Entity.getCollectionDAO().entityExtensionTimeSeriesDao();
    String resultJson =
        timeSeriesDAO.getLatestExtensionByKey(
            RESULT_EXTENSION_KEY,
            dataContract.getLatestResult().getResultId().toString(),
            dataContract.getFullyQualifiedName(),
            RESULT_EXTENSION);
    return JsonUtils.readValue(resultJson, DataContractResult.class);
  }

  @Override
  public EntityUpdater getUpdater(
      DataContract original, DataContract updated, Operation operation, ChangeSource changeSource) {
    return new DataContractUpdater(original, updated, operation, changeSource);
  }

  public class DataContractUpdater extends EntityUpdater {
    public DataContractUpdater(
        DataContract original,
        DataContract updated,
        Operation operation,
        ChangeSource changeSource) {
      super(original, updated, operation, changeSource);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("latestResult", original.getLatestResult(), updated.getLatestResult());
      recordChange("status", original.getStatus(), updated.getStatus());
      recordChange("testSuite", original.getTestSuite(), updated.getTestSuite());
      updateSchema(original, updated);
      updateQualityExpectations(original, updated);
      updateSemantics(original, updated);
    }

    private void updateSchema(DataContract original, DataContract updated) {
      List<Column> addedColumns = new ArrayList<>();
      List<Column> deletedColumns = new ArrayList<>();
      recordListChange(
          "schema",
          original.getSchema(),
          updated.getSchema(),
          addedColumns,
          deletedColumns,
          EntityUtil.columnMatch);
    }

    private void updateQualityExpectations(DataContract original, DataContract updated) {
      List<EntityReference> addedQualityExpectations = new ArrayList<>();
      List<EntityReference> deletedQualityExpectations = new ArrayList<>();
      recordListChange(
          "qualityExpectations",
          original.getQualityExpectations(),
          updated.getQualityExpectations(),
          addedQualityExpectations,
          deletedQualityExpectations,
          EntityUtil.entityReferenceMatch);
    }

    private void updateSemantics(DataContract original, DataContract updated) {
      List<SemanticsRule> addedSemantics = new ArrayList<>();
      List<SemanticsRule> deletedSemantics = new ArrayList<>();
      recordListChange(
          "semantics",
          original.getSemantics(),
          updated.getSemantics(),
          addedSemantics,
          deletedSemantics,
          this::semanticsRuleMatch);
    }

    private boolean semanticsRuleMatch(SemanticsRule rule1, SemanticsRule rule2) {
      if (rule1 == null || rule2 == null) {
        return false;
      }
      return Objects.equals(rule1.getName(), rule2.getName())
          && Objects.equals(rule1.getRule(), rule2.getRule())
          && Objects.equals(rule1.getDescription(), rule2.getDescription())
          && Objects.equals(rule1.getEnabled(), rule2.getEnabled())
          && Objects.equals(rule1.getEntityType(), rule2.getEntityType())
          && Objects.equals(rule1.getProvider(), rule2.getProvider());
    }
  }

  private void updateLatestResult(DataContract dataContract, DataContractResult result) {
    try {
      DataContract updated = JsonUtils.deepCopy(dataContract, DataContract.class);
      updated.setLatestResult(
          new LatestResult()
              .withTimestamp(result.getTimestamp())
              .withStatus(result.getContractExecutionStatus())
              .withMessage(result.getResult())
              .withResultId(result.getId()));
      EntityRepository.EntityUpdater entityUpdater =
          getUpdater(dataContract, updated, EntityRepository.Operation.PATCH, null);
      entityUpdater.update();
    } catch (Exception e) {
      LOG.error(
          "Failed to update latest result for data contract {}",
          dataContract.getFullyQualifiedName(),
          e);
    }
  }

  public DataContract loadEntityDataContract(EntityReference entity) {
    return JsonUtils.readValue(
        daoCollection
            .dataContractDAO()
            .getContractByEntityId(entity.getId().toString(), entity.getType()),
        DataContract.class);
  }

  public DataContract getEntityDataContractSafely(EntityInterface entity) {
    try {
      return loadEntityDataContract(entity.getEntityReference());
    } catch (Exception e) {
      LOG.debug("Failed to load data contracts for entity {}: {}", entity.getId(), e.getMessage());
      return null;
    }
  }

  @Override
  public void storeEntity(DataContract dataContract, boolean update) {
    store(dataContract, update);
  }

  @Override
  public void storeRelationships(DataContract dataContract) {
    addRelationship(
        dataContract.getEntity().getId(),
        dataContract.getId(),
        dataContract.getEntity().getType(),
        Entity.DATA_CONTRACT,
        Relationship.HAS);

    storeOwners(dataContract, dataContract.getOwners());
    storeReviewers(dataContract, dataContract.getReviewers());
  }

  @Override
  public void restorePatchAttributes(DataContract original, DataContract updated) {
    updated
        .withId(original.getId())
        .withName(original.getName())
        .withFullyQualifiedName(original.getFullyQualifiedName())
        .withUpdatedAt(original.getUpdatedAt())
        .withUpdatedBy(original.getUpdatedBy());
  }

  private void validateEntityReference(EntityReference entity) {
    if (entity == null) {
      throw BadRequestException.of("Entity reference is required for data contract");
    }

    // Check the entity exists
    Entity.getEntityReferenceById(entity.getType(), entity.getId(), Include.NON_DELETED);
    DataContract existingContract = loadEntityDataContract(entity);

    if (existingContract != null) {
      throw BadRequestException.of(
          String.format(
              "A data contract already exists for entity '%s' with ID %s",
              entity.getType(), entity.getId()));
    }
  }
}
