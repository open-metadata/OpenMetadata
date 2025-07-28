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

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
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
import org.openmetadata.schema.entity.datacontract.SemanticsValidation;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
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
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;

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
                .withDescription("Logical test suite for Data Contract: " + dataContract.getName())
                .withDataContract(
                    new EntityReference()
                        .withId(dataContract.getId())
                        .withFullyQualifiedName(dataContract.getFullyQualifiedName())
                        .withType(Entity.DATA_CONTRACT));
        TestSuite newTestSuite = testSuiteMapper.createToEntity(createTestSuite, ADMIN_USER_NAME);
        testSuite = testSuiteRepository.create(null, newTestSuite);
      }

      // Collect test case references from quality expectations
      List<UUID> testCaseRefs =
          dataContract.getQualityExpectations().stream().map(EntityReference::getId).toList();

      testCaseRepository.addTestCasesToLogicalTestSuite(testSuite, testCaseRefs);

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
    if (!nullOrEmpty(dataContract.getQualityExpectations())) {
      compileResult(result, ContractExecutionStatus.Running);
      triggerAndDeployDQValidation(dataContract);
    } else {
      compileResult(result, ContractExecutionStatus.Success);
    }

    // Add the result to the data contract and update the time series
    addContractResult(dataContract, result);
    return result;
  }

  public void triggerAndDeployDQValidation(DataContract dataContract) {
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
    pipelineServiceClient.deployPipeline(pipeline, testSuite);
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
    }

    // Update latest result in data contract if it is indeed the latest
    // or if we're updating the same result with a newer status
    if (dataContract.getLatestResult() == null
        || dataContract.getLatestResult().getTimestamp() < result.getTimestamp()
        || dataContract.getLatestResult().getResultId().equals(result.getId())) {
      updateLatestResult(dataContract, result);
    }

    return result;
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
