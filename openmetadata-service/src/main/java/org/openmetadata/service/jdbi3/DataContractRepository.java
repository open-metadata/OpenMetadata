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
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.getEntityReferenceById;

import jakarta.json.JsonPatch;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.entity.datacontract.FailedRule;
import org.openmetadata.schema.entity.datacontract.SemanticsValidation;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.QualityExpectation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.data.DataContractResource;
import org.openmetadata.service.resources.dqtests.TestSuiteMapper;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineMapper;
import org.openmetadata.service.rules.RuleEngine;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
@Repository
public class DataContractRepository extends EntityRepository<DataContract> {

  private static final String DATA_CONTRACT_UPDATE_FIELDS =
      "entity,owners,reviewers,status,schema,qualityExpectations,contractUpdates,semantics";
  private static final String DATA_CONTRACT_PATCH_FIELDS =
      "entity,owners,reviewers,status,schema,qualityExpectations,contractUpdates,semantics";

  public static final String RESULT_EXTENSION = "dataContract.dataContractResult";
  public static final String RESULT_SCHEMA = "dataContractResult";
  public static final String RESULT_EXTENSION_KEY = "id";

  private final TestSuiteMapper testSuiteMapper = new TestSuiteMapper();
  private final IngestionPipelineMapper ingestionPipelineMapper;
  @Setter private PipelineServiceClientInterface pipelineServiceClient;

  public DataContractRepository(OpenMetadataApplicationConfig config) {
    super(
        DataContractResource.COLLECTION_PATH,
        Entity.DATA_CONTRACT,
        DataContract.class,
        Entity.getCollectionDAO().dataContractDAO(),
        DATA_CONTRACT_PATCH_FIELDS,
        DATA_CONTRACT_UPDATE_FIELDS);
    this.ingestionPipelineMapper = new IngestionPipelineMapper(config);
  }

  @Override
  public void setFullyQualifiedName(DataContract dataContract) {
    String entityFQN = dataContract.getEntity().getFullyQualifiedName();
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

    if (!update) {
      validateEntityReference(entityRef);
    }
    validateSchemaFieldsAgainstEntity(dataContract, entityRef);
    if (dataContract.getOwners() != null) {
      dataContract.setOwners(EntityUtil.populateEntityReferences(dataContract.getOwners()));
    }
    if (dataContract.getReviewers() != null) {
      dataContract.setReviewers(EntityUtil.populateEntityReferences(dataContract.getReviewers()));
    }

    TestSuite testSuite = createOrUpdateDataContractTestSuite(dataContract);
    // Create the ingestion pipeline only if needed
    if (testSuite != null && nullOrEmpty(testSuite.getPipelines())) {
      createIngestionPipeline(testSuite);
    }
  }

  private void validateSchemaFieldsAgainstEntity(
      DataContract dataContract, EntityReference entityRef) {
    if (dataContract.getSchema() == null || dataContract.getSchema().isEmpty()) {
      return;
    }

    String entityType = entityRef.getType();

    switch (entityType) {
      case Entity.TABLE:
        validateFieldsAgainstTable(dataContract, entityRef);
        break;
      case Entity.TOPIC:
        validateFieldsAgainstTopic(dataContract, entityRef);
        break;
      default:
        break;
    }
  }

  private void validateFieldsAgainstTable(DataContract dataContract, EntityReference tableRef) {
    org.openmetadata.schema.entity.data.Table table =
        Entity.getEntity(Entity.TABLE, tableRef.getId(), "columns", Include.NON_DELETED);

    if (table.getColumns() == null || table.getColumns().isEmpty()) {
      return;
    }

    Set<String> tableColumnNames =
        table.getColumns().stream().map(Column::getName).collect(Collectors.toSet());

    for (org.openmetadata.schema.type.Column column : dataContract.getSchema()) {
      if (!tableColumnNames.contains(column.getName())) {
        throw BadRequestException.of(
            String.format(
                "Field '%s' specified in the data contract does not exist in table '%s'",
                column.getName(), table.getName()));
      }
    }
  }

  private void validateFieldsAgainstTopic(DataContract dataContract, EntityReference topicRef) {
    Topic topic =
        Entity.getEntity(Entity.TOPIC, topicRef.getId(), "messageSchema", Include.NON_DELETED);

    if (topic.getMessageSchema() == null
        || topic.getMessageSchema().getSchemaFields() == null
        || topic.getMessageSchema().getSchemaFields().isEmpty()) {
      return;
    }

    Set<String> topicFieldNames = extractFieldNames(topic.getMessageSchema().getSchemaFields());

    for (org.openmetadata.schema.type.Column column : dataContract.getSchema()) {
      if (!topicFieldNames.contains(column.getName())) {
        throw BadRequestException.of(
            String.format(
                "Field '%s' specified in the data contract does not exist in topic '%s'",
                column.getName(), topic.getName()));
      }
    }
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

  private TestSuite createOrUpdateDataContractTestSuite(DataContract dataContract) {
    if (nullOrEmpty(dataContract.getQualityExpectations())) {
      return null; // No quality expectations, no test suite needed
    }
    try {
      String testSuiteName = dataContract.getName() + " - Data Contract Expectations";
      TestSuiteRepository testSuiteRepository =
          (TestSuiteRepository) Entity.getEntityRepository(Entity.TEST_SUITE);
      TestCaseRepository testCaseRepository =
          (TestCaseRepository) Entity.getEntityRepository(Entity.TEST_CASE);

      // Check if test suite already exists
      TestSuite testSuite = null;
      try {
        testSuite =
            testSuiteRepository.getByName(
                null,
                testSuiteName,
                testSuiteRepository.getFields("tests,pipelines"),
                Include.NON_DELETED,
                false);
      } catch (EntityNotFoundException e) {
        LOG.debug(
            "Test suite [{}] not found when initializing the Data Contract, creating a new one",
            testSuiteName);
      }

      if (testSuite == null) {
        // Create new test suite
        CreateTestSuite createTestSuite =
            new CreateTestSuite()
                .withName(testSuiteName)
                .withDisplayName(testSuiteName)
                .withDescription("Logical test suite for Data Contract: " + dataContract.getName());
        TestSuite newTestSuite = testSuiteMapper.createToEntity(createTestSuite, ADMIN_USER_NAME);
        testSuite = testSuiteRepository.create(null, newTestSuite);
      }

      // Collect test case references from quality expectations
      List<UUID> testCaseRefs =
          dataContract.getQualityExpectations().stream()
              .map(QualityExpectation::getTestCase)
              .map(EntityReference::getId)
              .toList();

      testCaseRepository.addTestCasesToLogicalTestSuite(testSuite, testCaseRefs);

      // Add the test suite to the data contract
      dataContract.setTestSuite(
          getEntityReferenceById(Entity.TEST_SUITE, testSuite.getId(), Include.NON_DELETED));

      return testSuite;

    } catch (Exception e) {
      LOG.error("Error creating/updating test suite for data contract", e);
      throw e;
    }
  }

  // Prepare the Ingestion Pipeline from the test suite that will handle the execution
  private void createIngestionPipeline(TestSuite testSuite) {
    IngestionPipelineRepository pipelineRepository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    CreateIngestionPipeline createPipeline =
        new CreateIngestionPipeline()
            .withName(testSuite.getName())
            .withDisplayName(testSuite.getDisplayName())
            .withPipelineType(PipelineType.TEST_SUITE)
            .withService(
                new EntityReference().withId(testSuite.getId()).withType(Entity.TEST_SUITE))
            .withSourceConfig(new SourceConfig().withConfig(new TestSuitePipeline()));

    IngestionPipeline pipeline =
        ingestionPipelineMapper.createToEntity(createPipeline, ADMIN_USER_NAME);

    // Create the Ingestion Pipeline
    pipelineRepository.create(null, pipeline);
  }

  public DataContractResult validateContract(DataContract dataContract) {
    DataContractResult result =
        new DataContractResult()
            .withId(UUID.randomUUID())
            .withDataContractFQN(dataContract.getFullyQualifiedName())
            .withContractExecutionStatus(ContractExecutionStatus.Running)
            .withTimestamp(System.currentTimeMillis());
    addContractResult(dataContract, result);

    if (!nullOrEmpty(dataContract.getSemantics())) {
      SemanticsValidation semanticsValidation = validateSemantics(dataContract);
      result.withSemanticsValidation(semanticsValidation);
    }

    // If we don't have quality expectations, just flag the results based on semantics validation
    // Otherwise, keep it Running and wait for the DQ results to kick in
    if (nullOrEmpty(dataContract.getQualityExpectations())) {
      compileResult(result, ContractExecutionStatus.Success);
    } else {
      compileResult(result, ContractExecutionStatus.Running);
    }

    return result;
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

      List<SemanticsRule> failedRules =
          RuleEngine.getInstance().evaluateAndReturn(entity, dataContract.getSemantics(), true);

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

  public void compileResult(DataContractResult result, ContractExecutionStatus fallbackStatus) {
    result.withContractExecutionStatus(fallbackStatus);

    if (!nullOrEmpty(result.getSemanticsValidation())) {
      if (result.getSemanticsValidation().getFailed() > 0) {
        result
            .withContractExecutionStatus(ContractExecutionStatus.Failed)
            .withResult("Semantics validation failed");
      }
    }

    if (!nullOrEmpty(result.getQualityValidation())) {
      if (result.getQualityValidation().getFailed() > 0) {
        result
            .withContractExecutionStatus(ContractExecutionStatus.Failed)
            .withResult(
                result.getResult() != null
                    ? result.getResult() + "; Quality validation failed"
                    : "Quality validation failed");
      }
    }
  }

  public DataContractResult addContractResult(
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

      // Update latest result in data contract
      updateLatestResult(dataContract, result);
    }

    return result;
  }

  private void updateLatestResult(DataContract dataContract, DataContractResult result) {
    try {
      jakarta.json.JsonPatchBuilder patchBuilder = jakarta.json.Json.createPatchBuilder();

      jakarta.json.JsonObjectBuilder latestResultBuilder =
          jakarta.json.Json.createObjectBuilder()
              .add("timestamp", result.getTimestamp())
              .add("status", result.getContractExecutionStatus().value())
              .add("message", result.getResult() != null ? result.getResult() : "")
              .add("resultId", result.getId().toString());
      patchBuilder.add("/latestResult", latestResultBuilder.build());
      JsonPatch patch = patchBuilder.build();
      patch(null, dataContract.getId(), null, patch, ChangeSource.DERIVED);
    } catch (Exception e) {
      LOG.error(
          "Failed to update latest result for data contract {}",
          dataContract.getFullyQualifiedName(),
          e);
    }
  }

  /*
  public DataContractResult validateContract(DataContract dataContract) {
    long startTime = System.currentTimeMillis();
    DataContractResult result = new DataContractResult()
        .withId(UUID.randomUUID())
        .withDataContractFQN(dataContract.getFullyQualifiedName())
        .withTimestamp(System.currentTimeMillis());

    List<String> messages = new ArrayList<>();
    boolean allValidationsPassed = true;

    try {
      // 1. Validate Semantics Rules using RuleEngine
      SemanticsValidation semanticsValidation = validateSemantics(dataContract);
      result.withSemanticsValidation(semanticsValidation);
      if (!semanticsValidation.getPassed()) {
        allValidationsPassed = false;
        messages.add("Semantics validation failed: " + semanticsValidation.getMessage());
      }

      // 2. Create/Update Test Suite for Quality Expectations
      TestSuite testSuite = createOrUpdateDataContractTestSuite(dataContract);

      // 3. Trigger Quality Tests Execution if test suite has tests
      QualityValidation qualityValidation = null;
      if (testSuite != null && !nullOrEmpty(testSuite.getTests())) {
        qualityValidation = executeQualityTests(dataContract, testSuite);
        result.withQualityValidation(qualityValidation);
        if (!qualityValidation.getPassed()) {
          allValidationsPassed = false;
          messages.add("Quality validation failed: " + qualityValidation.getMessage());
        }
      } else {
        // No quality tests to run
        qualityValidation = new QualityValidation()
            .withPassed(true)
            .withMessage("No quality tests defined");
        result.withQualityValidation(qualityValidation);
      }

      // Set overall status
      if (allValidationsPassed) {
        result.withContractExecutionStatus(ContractExecutionStatus.Success)
            .withResult("All validations passed successfully");
      } else {
        result.withContractExecutionStatus(ContractExecutionStatus.Failed)
            .withResult(String.join("; ", messages));
      }

    } catch (Exception e) {
      log.error("Error validating data contract: {}", dataContract.getFullyQualifiedName(), e);
      result.withContractExecutionStatus(ContractExecutionStatus.Aborted)
          .withResult("Validation aborted due to error: " + e.getMessage());
    }

    long executionTime = System.currentTimeMillis() - startTime;
    result.withExecutionTime(executionTime);

    return result;
  }



  private QualityValidation executeQualityTests(DataContract dataContract, TestSuite testSuite) {
    QualityValidation validation = new QualityValidation();

    try {
      // Create ingestion pipeline for test suite execution
      IngestionPipelineRepository pipelineRepository =
          (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

      String pipelineName = testSuite.getName() + "_validation_" + System.currentTimeMillis();

      // Create pipeline configuration for test suite
      IngestionPipelineConfig pipelineConfig = new IngestionPipelineConfig()
          .withType(PipelineType.TestSuite);

      CreateIngestionPipeline createPipeline = new CreateIngestionPipeline()
          .withName(pipelineName)
          .withDisplayName("Data Contract Validation - " + dataContract.getName())
          .withPipelineType(PipelineType.TestSuite)
          .withService(new EntityReference()
              .withId(testSuite.getId())
              .withType(Entity.TEST_SUITE))
          .withSourceConfig(pipelineConfig);

      // Create and trigger the pipeline
      IngestionPipeline pipeline = pipelineRepository.createEntity(null, createPipeline);

      // Trigger pipeline execution
      pipelineRepository.triggerIngestion(pipeline.getId(), null);

      // Wait for pipeline completion (with timeout)
      long timeout = 300000; // 5 minutes timeout
      long startTime = System.currentTimeMillis();
      IngestionPipelineState pipelineState = null;

      while (System.currentTimeMillis() - startTime < timeout) {
        Thread.sleep(5000); // Check every 5 seconds
        pipeline = pipelineRepository.get(null, pipeline.getId(),
            new Fields(Set.of("pipelineStatuses")), Include.NON_DELETED);

        if (pipeline.getPipelineStatuses() != null && !pipeline.getPipelineStatuses().isEmpty()) {
          pipelineState = pipeline.getPipelineStatuses().get(0);
          if (pipelineState.getState() != null &&
              (pipelineState.getState().equals("success") ||
               pipelineState.getState().equals("failed"))) {
            break;
          }
        }
      }

      // Check test results
      if (pipelineState != null && "success".equals(pipelineState.getState())) {
        // Get test case results
        TestCaseRepository testCaseRepository =
            (TestCaseRepository) Entity.getEntityRepository(Entity.TEST_CASE);

        int totalTests = testSuite.getTests().size();
        int passedTests = 0;
        List<String> failedTestNames = new ArrayList<>();

        for (EntityReference testRef : testSuite.getTests()) {
          TestCase testCase = testCaseRepository.get(null, testRef.getId(),
              new Fields(Set.of("testCaseResult")), Include.NON_DELETED);

          if (testCase.getTestCaseResult() != null &&
              "Success".equals(testCase.getTestCaseResult().getTestCaseStatus())) {
            passedTests++;
          } else {
            failedTestNames.add(testCase.getName());
          }
        }

        if (passedTests == totalTests) {
          validation.withPassed(true)
              .withMessage(String.format("All %d quality tests passed", totalTests));
        } else {
          validation.withPassed(false)
              .withMessage(String.format("%d/%d tests failed: %s",
                  totalTests - passedTests, totalTests,
                  String.join(", ", failedTestNames)));
        }
      } else {
        validation.withPassed(false)
            .withMessage("Quality test execution failed or timed out");
      }

    } catch (Exception e) {
      log.error("Error during quality test execution", e);
      validation.withPassed(false).withMessage("Quality test execution error: " + e.getMessage());
    }

    return validation;
  }
   */

  public DataContract loadEntityDataContract(EntityReference entity) {
    return JsonUtils.readValue(
        daoCollection
            .dataContractDAO()
            .getContractByEntityId(entity.getId().toString(), entity.getType()),
        DataContract.class);
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
