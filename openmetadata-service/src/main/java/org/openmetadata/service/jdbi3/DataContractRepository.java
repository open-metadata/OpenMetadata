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
import static org.openmetadata.service.Entity.DATA_CONTRACT;
import static org.openmetadata.service.Entity.FIELD_ENTITY_STATUS;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notReviewer;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;

import com.google.gson.Gson;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.ContractSecurity;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.LatestResult;
import org.openmetadata.schema.entity.data.TermsOfUse;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.datacontract.ContractValidation;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.entity.datacontract.FailedRule;
import org.openmetadata.schema.entity.datacontract.QualityValidation;
import org.openmetadata.schema.entity.datacontract.SchemaValidation;
import org.openmetadata.schema.entity.datacontract.SemanticsValidation;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.DataContractValidationException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.formatter.util.FormatterUtil;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.resources.data.DataContractResource;
import org.openmetadata.service.resources.dqtests.TestSuiteMapper;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineMapper;
import org.openmetadata.service.rules.RuleEngine;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.EntityFieldUtils;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ValidatorUtil;
import org.openmetadata.service.util.WebsocketNotificationHandler;

@Slf4j
@Repository
public class DataContractRepository extends EntityRepository<DataContract> {

  private static final String DATA_CONTRACT_UPDATE_FIELDS =
      "entity,owners,reviewers,entityStatus,schema,qualityExpectations,contractUpdates,semantics,termsOfUse,security,sla,latestResult,extension,odcsQualityRules";
  private static final String DATA_CONTRACT_PATCH_FIELDS =
      "entity,owners,reviewers,entityStatus,schema,qualityExpectations,contractUpdates,semantics,termsOfUse,security,sla,latestResult,extension,odcsQualityRules";

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
  public void setFields(
      DataContract dataContract, Fields fields, RelationIncludes relationIncludes) {}

  @Override
  public void clearFields(DataContract dataContract, Fields fields) {}

  @Override
  public void prepare(DataContract dataContract, boolean update) {
    EntityReference entityRef = dataContract.getEntity();

    validateEntitySpecificConstraints(dataContract, entityRef);

    if (!update) {
      validateEntityReference(entityRef);
      dataContract.setCreatedAt(dataContract.getUpdatedAt());
      dataContract.setCreatedBy(dataContract.getUpdatedBy());
    }

    // Validate schema fields and throw exception if there are failures
    SchemaValidation schemaValidation = validateSchemaFieldsAgainstEntity(dataContract, entityRef);
    List<String> errors = new ArrayList<>();

    if (!nullOrEmpty(schemaValidation.getDuplicateFields())) {
      errors.add(
          String.format(
              "Duplicate column names in contract schema: %s",
              String.join(", ", schemaValidation.getDuplicateFields())));
    }

    if (!nullOrEmpty(schemaValidation.getFailedFields())) {
      errors.add(
          String.format(
              "The following fields specified in the data contract do not exist in the %s: %s",
              entityRef.getType(), String.join(", ", schemaValidation.getFailedFields())));
    }

    // Note: Type mismatches are tracked for informational purposes but do not block contract
    // creation.
    // ODCS contracts define data expectations, not necessarily matching physical schema exactly.
    // Type mismatches can be viewed via schema validation results but are non-blocking.

    if (!errors.isEmpty()) {
      throw BadRequestException.of(
          String.format("Schema validation failed. %s", String.join(". ", errors)));
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
    if (original.getEntityStatus() == EntityStatus.IN_REVIEW) {
      if (updated.getEntityStatus() == EntityStatus.APPROVED) {
        closeApprovalTask(updated, "Approved the data contract");
      } else if (updated.getEntityStatus() == EntityStatus.REJECTED) {
        closeApprovalTask(updated, "Rejected the data contract");
      }
    }

    // TODO: It might happen that a task went from DRAFT to IN_REVIEW to DRAFT fairly quickly
    // Due to ChangesConsolidation, the postUpdate will be called as from DRAFT to DRAFT, but there
    // will be a Task created.
    // This if handles this case scenario, by guaranteeing that we are any Approval Task if the
    // Data Contract goes back to DRAFT.
    if (updated.getEntityStatus() == EntityStatus.DRAFT) {
      try {
        closeApprovalTask(updated, "Closed due to data contract going back to DRAFT.");
      } catch (EntityNotFoundException ignored) {
      } // No ApprovalTask is present, and thus we don't need to worry about this.
    }

    postCreateOrUpdate(updated);
  }

  @Override
  protected void postDelete(DataContract dataContract, boolean hardDelete) {
    super.postDelete(dataContract, hardDelete);
    if (!nullOrEmpty(dataContract.getQualityExpectations())) {
      deleteTestSuite(dataContract);
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

  /**
   * Public method to validate a data contract's schema against an entity without creating the
   * contract. This is useful for pre-validation during ODCS import preview.
   */
  public SchemaValidation validateContractSchema(
      DataContract dataContract, EntityReference entityRef) {
    return validateSchemaFieldsAgainstEntity(dataContract, entityRef);
  }

  /**
   * Comprehensive validation that collects all errors without throwing exceptions.
   * Performs validation logic without side effects (no test suite creation).
   *
   * @param dataContract The data contract to validate (from CreateDataContract conversion)
   * @return ContractValidation with comprehensive error reporting
   */
  public ContractValidation validateContractWithoutThrowing(DataContract dataContract) {
    ContractValidation validation = new ContractValidation();
    validation.setValid(true);
    List<String> entityErrors = new ArrayList<>();
    List<String> constraintErrors = new ArrayList<>();

    // First, run Jakarta Bean Validation to catch schema-level errors
    // (e.g., name too long, invalid pattern, required fields)
    String beanViolations = ValidatorUtil.validate(dataContract);
    if (beanViolations != null) {
      validation.setValid(false);
      // Parse the violations string "[field1 message1, field2 message2]" into individual errors
      String violations = beanViolations.substring(1, beanViolations.length() - 1);
      for (String violation : violations.split(", ")) {
        entityErrors.add(violation.trim());
      }
    }

    // Run domain-specific validation WITHOUT side effects (no test suite creation)
    // This validates entity constraints and schema fields only
    try {
      prepareForValidation(dataContract);
    } catch (Exception e) {
      validation.setValid(false);
      constraintErrors.add(e.getMessage());
    }

    // Get schema validation results (prepareForValidation already validated but we want the
    // details)
    SchemaValidation schemaValidation =
        validateSchemaFieldsAgainstEntity(dataContract, dataContract.getEntity());
    validation.setSchemaValidation(schemaValidation);

    validation.setEntityErrors(entityErrors.isEmpty() ? null : entityErrors);
    validation.setConstraintErrors(constraintErrors.isEmpty() ? null : constraintErrors);

    return validation;
  }

  /**
   * Validation-only version of prepare() that validates without creating any entities.
   * This is used for ODCS import preview and contract validation endpoints.
   * Unlike prepare(), this method has NO side effects (no test suite or pipeline creation).
   */
  private void prepareForValidation(DataContract dataContract) {
    EntityReference entityRef = dataContract.getEntity();

    validateEntitySpecificConstraints(dataContract, entityRef);

    // Validate schema fields and throw exception if there are failures
    SchemaValidation schemaValidation = validateSchemaFieldsAgainstEntity(dataContract, entityRef);
    List<String> errors = new ArrayList<>();

    if (!nullOrEmpty(schemaValidation.getDuplicateFields())) {
      errors.add(
          String.format(
              "Duplicate column names in contract schema: %s",
              String.join(", ", schemaValidation.getDuplicateFields())));
    }

    if (!nullOrEmpty(schemaValidation.getFailedFields())) {
      errors.add(
          String.format(
              "The following fields specified in the data contract do not exist in the %s: %s",
              entityRef.getType(), String.join(", ", schemaValidation.getFailedFields())));
    }

    if (!errors.isEmpty()) {
      throw BadRequestException.of(
          String.format("Schema validation failed. %s", String.join(". ", errors)));
    }

    // Validate owners and reviewers references exist (without populating)
    if (!nullOrEmpty(dataContract.getOwners())) {
      for (EntityReference owner : dataContract.getOwners()) {
        Entity.getEntityReferenceById(owner.getType(), owner.getId(), Include.NON_DELETED);
      }
    }
    if (!nullOrEmpty(dataContract.getReviewers())) {
      for (EntityReference reviewer : dataContract.getReviewers()) {
        Entity.getEntityReferenceById(reviewer.getType(), reviewer.getId(), Include.NON_DELETED);
      }
    }
  }

  private SchemaValidation validateSchemaFieldsAgainstEntity(
      DataContract dataContract, EntityReference entityRef) {
    SchemaValidation validation = new SchemaValidation();

    if (dataContract.getSchema() == null || dataContract.getSchema().isEmpty()) {
      return validation.withPassed(0).withFailed(0).withTotal(0);
    }

    // Check for duplicate column names in the contract schema
    List<String> duplicateFields = findDuplicateColumnNames(dataContract);
    validation.setDuplicateFields(duplicateFields.isEmpty() ? null : duplicateFields);

    String entityType = entityRef.getType();
    List<String> failedFields = new ArrayList<>();
    List<String> typeMismatchFields = new ArrayList<>();

    switch (entityType) {
      case Entity.TABLE:
        SchemaValidationResult tableResult = validateFieldsAgainstTable(dataContract, entityRef);
        failedFields = tableResult.failedFields;
        typeMismatchFields = tableResult.typeMismatchFields;
        break;
      case Entity.TOPIC:
        failedFields = validateFieldsAgainstTopic(dataContract, entityRef);
        break;
      case Entity.API_ENDPOINT:
        failedFields = validateFieldsAgainstApiEndpoint(dataContract, entityRef);
        break;
      case Entity.DASHBOARD_DATA_MODEL:
        SchemaValidationResult dataModelResult =
            validateFieldsAgainstDashboardDataModel(dataContract, entityRef);
        failedFields = dataModelResult.failedFields;
        typeMismatchFields = dataModelResult.typeMismatchFields;
        break;
      default:
        break;
    }

    validation.setTypeMismatchFields(typeMismatchFields.isEmpty() ? null : typeMismatchFields);

    int totalFields = dataContract.getSchema().size();
    // Note: Type mismatches are tracked for informational purposes but don't count as failures.
    // Only missing fields and duplicates are counted as failures.
    int failedCount = failedFields.size() + duplicateFields.size();
    int passedCount = Math.max(0, totalFields - failedCount);

    return validation
        .withPassed(passedCount)
        .withFailed(failedCount)
        .withTotal(totalFields)
        .withFailedFields(failedFields.isEmpty() ? null : failedFields);
  }

  private List<String> findDuplicateColumnNames(DataContract dataContract) {
    List<String> duplicates = new ArrayList<>();
    Set<String> seen = new HashSet<>();

    for (Column column : dataContract.getSchema()) {
      String name = column.getName();
      if (!seen.add(name)) {
        if (!duplicates.contains(name)) {
          duplicates.add(name);
        }
      }
    }
    return duplicates;
  }

  private static class SchemaValidationResult {
    List<String> failedFields = new ArrayList<>();
    List<String> typeMismatchFields = new ArrayList<>();
  }

  private SchemaValidationResult validateFieldsAgainstTable(
      DataContract dataContract, EntityReference tableRef) {
    SchemaValidationResult result = new SchemaValidationResult();
    org.openmetadata.schema.entity.data.Table table =
        Entity.getEntity(Entity.TABLE, tableRef.getId(), "columns", Include.NON_DELETED);

    if (table.getColumns() == null || table.getColumns().isEmpty()) {
      result.failedFields = getAllContractFieldNames(dataContract);
      return result;
    }

    Map<String, Column> tableColumnMap = buildColumnMap(table.getColumns());

    for (Column contractColumn : dataContract.getSchema()) {
      String columnName = contractColumn.getName();
      Column entityColumn = tableColumnMap.get(columnName);

      if (entityColumn == null) {
        result.failedFields.add(columnName);
      } else if (contractColumn.getDataType() != null
          && !areTypesCompatible(contractColumn.getDataType(), entityColumn.getDataType())) {
        result.typeMismatchFields.add(
            String.format(
                "%s: expected %s, got %s",
                columnName, entityColumn.getDataType(), contractColumn.getDataType()));
      }
    }

    return result;
  }

  private List<String> validateFieldsAgainstTopic(
      DataContract dataContract, EntityReference topicRef) {
    Topic topic =
        Entity.getEntity(Entity.TOPIC, topicRef.getId(), "messageSchema", Include.NON_DELETED);

    if (topic.getMessageSchema() == null
        || topic.getMessageSchema().getSchemaFields() == null
        || topic.getMessageSchema().getSchemaFields().isEmpty()) {
      return getAllContractFieldNames(dataContract);
    }

    Set<String> topicFieldNames = extractFieldNames(topic.getMessageSchema().getSchemaFields());

    return validateContractFieldsAgainstNames(dataContract, topicFieldNames);
  }

  private List<String> validateFieldsAgainstApiEndpoint(
      DataContract dataContract, EntityReference apiEndpointRef) {
    org.openmetadata.schema.entity.data.APIEndpoint apiEndpoint =
        Entity.getEntity(
            Entity.API_ENDPOINT,
            apiEndpointRef.getId(),
            "requestSchema,responseSchema",
            Include.NON_DELETED);

    Set<String> apiFieldNames = new HashSet<>();

    if (apiEndpoint.getRequestSchema() != null
        && apiEndpoint.getRequestSchema().getSchemaFields() != null
        && !apiEndpoint.getRequestSchema().getSchemaFields().isEmpty()) {
      apiFieldNames.addAll(extractFieldNames(apiEndpoint.getRequestSchema().getSchemaFields()));
    }

    if (apiEndpoint.getResponseSchema() != null
        && apiEndpoint.getResponseSchema().getSchemaFields() != null
        && !apiEndpoint.getResponseSchema().getSchemaFields().isEmpty()) {
      apiFieldNames.addAll(extractFieldNames(apiEndpoint.getResponseSchema().getSchemaFields()));
    }

    if (apiFieldNames.isEmpty()) {
      return getAllContractFieldNames(dataContract);
    }

    return validateContractFieldsAgainstNames(dataContract, apiFieldNames);
  }

  private SchemaValidationResult validateFieldsAgainstDashboardDataModel(
      DataContract dataContract, EntityReference dashboardDataModelRef) {
    SchemaValidationResult result = new SchemaValidationResult();
    org.openmetadata.schema.entity.data.DashboardDataModel dashboardDataModel =
        Entity.getEntity(
            Entity.DASHBOARD_DATA_MODEL,
            dashboardDataModelRef.getId(),
            "columns",
            Include.NON_DELETED);

    if (dashboardDataModel.getColumns() == null || dashboardDataModel.getColumns().isEmpty()) {
      result.failedFields = getAllContractFieldNames(dataContract);
      return result;
    }

    Map<String, Column> columnMap = buildColumnMap(dashboardDataModel.getColumns());

    for (Column contractColumn : dataContract.getSchema()) {
      String columnName = contractColumn.getName();
      Column entityColumn = columnMap.get(columnName);

      if (entityColumn == null) {
        result.failedFields.add(columnName);
      } else if (contractColumn.getDataType() != null
          && !areTypesCompatible(contractColumn.getDataType(), entityColumn.getDataType())) {
        result.typeMismatchFields.add(
            String.format(
                "%s: expected %s, got %s",
                columnName, entityColumn.getDataType(), contractColumn.getDataType()));
      }
    }

    return result;
  }

  private List<String> getAllContractFieldNames(DataContract dataContract) {
    return dataContract.getSchema().stream()
        .map(org.openmetadata.schema.type.Column::getName)
        .collect(Collectors.toList());
  }

  private List<String> validateContractFieldsAgainstNames(
      DataContract dataContract, Set<String> entityFieldNames) {
    List<String> failedFields = new ArrayList<>();
    for (org.openmetadata.schema.type.Column column : dataContract.getSchema()) {
      if (!entityFieldNames.contains(column.getName())) {
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

  private Set<String> extractColumnNames(List<Column> columns) {
    if (columns == null || columns.isEmpty()) {
      return Collections.emptySet();
    }

    Set<String> columnNames = new HashSet<>();
    for (Column column : columns) {
      columnNames.add(column.getName());
      if (column.getChildren() != null && !column.getChildren().isEmpty()) {
        columnNames.addAll(extractColumnNames(column.getChildren()));
      }
    }
    return columnNames;
  }

  private Map<String, Column> buildColumnMap(List<Column> columns) {
    if (columns == null || columns.isEmpty()) {
      return Collections.emptyMap();
    }

    Map<String, Column> columnMap = new HashMap<>();
    for (Column column : columns) {
      columnMap.put(column.getName(), column);
      if (column.getChildren() != null && !column.getChildren().isEmpty()) {
        columnMap.putAll(buildColumnMap(column.getChildren()));
      }
    }
    return columnMap;
  }

  /**
   * Checks if two column data types are compatible. Types are considered compatible
   * if they belong to the same type family. This allows ODCS contracts (which use
   * logical types like STRING, INTEGER) to validate against tables with specific
   * types (VARCHAR, BIGINT, etc.).
   *
   * Type families:
   * - String types: STRING, VARCHAR, CHAR, TEXT, MEDIUMTEXT, NTEXT, CLOB
   * - Integer types: INT, BIGINT, SMALLINT, TINYINT, BYTEINT, LONG
   * - Decimal types: DECIMAL, NUMERIC, NUMBER, DOUBLE, FLOAT, MONEY
   * - Boolean types: BOOLEAN
   * - Date/Time types: DATE, DATETIME, TIMESTAMP, TIMESTAMPZ, TIME
   * - Binary types: BINARY, VARBINARY, BLOB, BYTEA, BYTES, LONGBLOB, MEDIUMBLOB
   * - Complex types: ARRAY, MAP, STRUCT, JSON
   */
  private boolean areTypesCompatible(ColumnDataType type1, ColumnDataType type2) {
    if (type1 == null || type2 == null) {
      return true;
    }
    if (type1.equals(type2)) {
      return true;
    }

    Set<ColumnDataType> stringTypes =
        Set.of(
            ColumnDataType.STRING,
            ColumnDataType.VARCHAR,
            ColumnDataType.CHAR,
            ColumnDataType.TEXT,
            ColumnDataType.MEDIUMTEXT,
            ColumnDataType.NTEXT,
            ColumnDataType.CLOB);

    Set<ColumnDataType> integerTypes =
        Set.of(
            ColumnDataType.INT,
            ColumnDataType.BIGINT,
            ColumnDataType.SMALLINT,
            ColumnDataType.TINYINT,
            ColumnDataType.BYTEINT,
            ColumnDataType.LONG);

    Set<ColumnDataType> decimalTypes =
        Set.of(
            ColumnDataType.DECIMAL,
            ColumnDataType.NUMERIC,
            ColumnDataType.NUMBER,
            ColumnDataType.DOUBLE,
            ColumnDataType.FLOAT,
            ColumnDataType.MONEY);

    Set<ColumnDataType> booleanTypes = Set.of(ColumnDataType.BOOLEAN);

    Set<ColumnDataType> dateTimeTypes =
        Set.of(
            ColumnDataType.DATE,
            ColumnDataType.DATETIME,
            ColumnDataType.TIMESTAMP,
            ColumnDataType.TIMESTAMPZ,
            ColumnDataType.TIME);

    Set<ColumnDataType> binaryTypes =
        Set.of(
            ColumnDataType.BINARY,
            ColumnDataType.VARBINARY,
            ColumnDataType.BLOB,
            ColumnDataType.BYTEA,
            ColumnDataType.BYTES,
            ColumnDataType.LONGBLOB,
            ColumnDataType.MEDIUMBLOB);

    Set<ColumnDataType> complexTypes =
        Set.of(
            ColumnDataType.ARRAY, ColumnDataType.MAP, ColumnDataType.STRUCT, ColumnDataType.JSON);

    if (stringTypes.contains(type1) && stringTypes.contains(type2)) {
      return true;
    }
    if (integerTypes.contains(type1) && integerTypes.contains(type2)) {
      return true;
    }
    if (decimalTypes.contains(type1) && decimalTypes.contains(type2)) {
      return true;
    }
    if (booleanTypes.contains(type1) && booleanTypes.contains(type2)) {
      return true;
    }
    if (dateTimeTypes.contains(type1) && dateTimeTypes.contains(type2)) {
      return true;
    }
    if (binaryTypes.contains(type1) && binaryTypes.contains(type2)) {
      return true;
    }
    if (complexTypes.contains(type1) && complexTypes.contains(type2)) {
      return true;
    }

    return false;
  }

  /**
   * Validates entity-specific constraints for data contracts based on entity type.
   * Throws BadRequestException if any constraints are violated.
   *
   * Supported entities: table, storedProcedure, database, databaseSchema, dashboard,
   * dashboardDataModel, pipeline, topic, searchIndex, apiCollection, apiEndpoint, api,
   * mlmodel, container, directory, file, spreadsheet, worksheet
   *
   * Validation support by entity type:
   * - All entities: Support semantics validation
   * - Schema validation: table, topic, apiEndpoint, dashboardDataModel
   * - Quality expectations (DQ): table only
   */
  private void validateEntitySpecificConstraints(
      DataContract dataContract, EntityReference entityRef) {
    String entityType = entityRef.getType();
    List<String> violations = new ArrayList<>();

    // First, check if the entity type is supported for data contracts
    if (!isSupportedEntityType(entityType)) {
      violations.add(
          String.format("Entity type '%s' is not supported for data contracts", entityType));
    } else {
      // Validate schema constraints
      if (!nullOrEmpty(dataContract.getSchema()) && !supportsSchemaValidation(entityType)) {
        violations.add(
            String.format(
                "Schema validation is not supported for %s entities. Only table, topic, "
                    + "apiEndpoint, and dashboardDataModel entities support schema validation",
                entityType));
      }

      // Validate quality expectations constraints
      if (!nullOrEmpty(dataContract.getQualityExpectations())
          && !supportsQualityValidation(entityType)) {
        violations.add(
            String.format(
                "Quality expectations are not supported for %s entities. Only table entities "
                    + "support quality expectations",
                entityType));
      }
    }

    if (!violations.isEmpty()) {
      throw BadRequestException.of(
          String.format(
              "Data contract validation failed for %s entity: %s",
              entityType, String.join("; ", violations)));
    }
  }

  /**
   * Checks if the given entity type is supported for data contracts.
   */
  private boolean isSupportedEntityType(String entityType) {
    return Set.of(
            Entity.TABLE,
            Entity.STORED_PROCEDURE,
            Entity.DATABASE,
            Entity.DATABASE_SCHEMA,
            Entity.DASHBOARD,
            Entity.CHART,
            Entity.DASHBOARD_DATA_MODEL,
            Entity.PIPELINE,
            Entity.TOPIC,
            Entity.SEARCH_INDEX,
            Entity.API_COLLECTION,
            Entity.API_ENDPOINT,
            Entity.API,
            Entity.MLMODEL,
            Entity.CONTAINER,
            Entity.DIRECTORY,
            Entity.FILE,
            Entity.SPREADSHEET,
            Entity.WORKSHEET,
            Entity.DATA_PRODUCT)
        .contains(entityType);
  }

  /**
   * Checks if the given entity type supports schema validation.
   * Only table, topic, apiEndpoint, and dashboardDataModel support schema validation.
   */
  private boolean supportsSchemaValidation(String entityType) {
    return Set.of(Entity.TABLE, Entity.TOPIC, Entity.API_ENDPOINT, Entity.DASHBOARD_DATA_MODEL)
        .contains(entityType);
  }

  /**
   * Checks if the given entity type supports quality expectations (DQ validation).
   * Only table entities support quality expectations.
   */
  private boolean supportsQualityValidation(String entityType) {
    return Entity.TABLE.equals(entityType);
  }

  public static String getTestSuiteName(DataContract dataContract) {
    return dataContract.getId().toString();
  }

  private TestSuite createOrUpdateDataContractTestSuite(DataContract dataContract, boolean update) {
    try {
      if (update) { // If we're running an update, fetch the existing test suite information
        restoreExistingDataContract(dataContract);
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

  private void restoreExistingDataContract(DataContract dataContract) {
    setFullyQualifiedName(dataContract);
    Optional<DataContract> existing =
        getByNameOrNull(
            null,
            dataContract.getFullyQualifiedName(),
            Fields.EMPTY_FIELDS,
            Include.NON_DELETED,
            false);
    dataContract.setTestSuite(existing.map(DataContract::getTestSuite).orElse(null));
    dataContract.setLatestResult(existing.map(DataContract::getLatestResult).orElse(null));
    dataContract.setId(existing.map(DataContract::getId).orElse(dataContract.getId()));
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
    testSuiteRepository.deleteFromSearch(testSuite, true);
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

  public RestUtil.PutResponse<DataContractResult> validateContract(DataContract dataContract) {
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
        // Don't compile result yet - keep status as "Running"
        // Final compilation will happen in updateContractDQResults() with complete data
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
    return addContractResult(dataContract, result);
  }

  /**
   * Materialize an empty contract for an entity that currently only has an inherited contract.
   * This allows the entity to have its own contract to store validation results, while still
   * inheriting properties from the Data Product contract.
   *
   * @param entity The entity to create the contract for
   * @param dataProductContractName The name of the Data Product contract being inherited from
   * @param user The user creating the contract
   */
  public DataContract materializeInheritedContract(
      EntityInterface entity, String dataProductContractName, String user) {
    // Name format: "<Data Product Contract> - <entity name>"
    String contractName = dataProductContractName + " - " + entity.getName();
    String contractFqn = entity.getFullyQualifiedName() + ".contract";

    DataContract newContract =
        new DataContract()
            .withId(UUID.randomUUID())
            .withName(contractName)
            .withFullyQualifiedName(contractFqn)
            .withEntity(entity.getEntityReference())
            .withEntityStatus(EntityStatus.DRAFT)
            .withUpdatedBy(user)
            .withUpdatedAt(System.currentTimeMillis());

    return createInternal(newContract);
  }

  /**
   * Validate a contract using the effective contract rules (which may include inherited properties)
   * but store the results against the provided contract entity.
   */
  public RestUtil.PutResponse<DataContractResult> validateContractWithEffective(
      DataContract contractForResults, DataContract effectiveContract) {
    // Check if there's a running validation and abort it
    abortRunningValidation(contractForResults);

    DataContractResult result =
        new DataContractResult()
            .withId(UUID.randomUUID())
            .withDataContractFQN(contractForResults.getFullyQualifiedName())
            .withContractExecutionStatus(ContractExecutionStatus.Running)
            .withTimestamp(System.currentTimeMillis());
    addContractResult(contractForResults, result);

    // Validate schema using effective contract's schema (if any)
    if (effectiveContract.getSchema() != null && !effectiveContract.getSchema().isEmpty()) {
      SchemaValidation schemaValidation =
          validateSchemaFieldsAgainstEntity(effectiveContract, effectiveContract.getEntity());
      result.withSchemaValidation(schemaValidation);
    }

    // Validate semantics using effective contract's rules (includes inherited rules)
    if (!nullOrEmpty(effectiveContract.getSemantics())) {
      SemanticsValidation semanticsValidation = validateSemantics(effectiveContract);
      result.withSemanticsValidation(semanticsValidation);
    }

    // Handle quality expectations
    if (!nullOrEmpty(effectiveContract.getQualityExpectations())) {
      try {
        deployAndTriggerDQValidation(effectiveContract);
      } catch (Exception e) {
        LOG.error(
            "Failed to trigger DQ validation for data contract {}: {}",
            contractForResults.getFullyQualifiedName(),
            e.getMessage());
        result
            .withContractExecutionStatus(ContractExecutionStatus.Aborted)
            .withResult("Failed to trigger DQ validation: " + e.getMessage());
        compileResult(result, ContractExecutionStatus.Aborted);
      }
    } else {
      compileResult(result, ContractExecutionStatus.Success);
    }

    // Store results against the entity's own contract
    return addContractResult(contractForResults, result);
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

  private QualityValidation validateDQ(TestSuite testSuite) {
    QualityValidation validation = new QualityValidation();
    if (nullOrEmpty(testSuite.getTestCaseResultSummary())) {
      return validation; // return the existing result without updates
    }

    List<String> currentTests =
        testSuite.getTests().stream().map(EntityReference::getFullyQualifiedName).toList();
    List<ResultSummary> testSummary =
        testSuite.getTestCaseResultSummary().stream()
            .filter(
                test -> {
                  return currentTests.contains(test.getTestCaseName());
                })
            .toList();

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
    DataContract dataContract =
        Entity.getEntity(contractReference, "entity,owners,reviewers", Include.NON_DELETED);
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
    QualityValidation validation = validateDQ(testSuite);

    result.withQualityValidation(validation);

    compileResult(result, ContractExecutionStatus.Success);
    // Update the last result in the data contract
    addContractResult(dataContract, result);

    // Sync the in-memory latestResult to reflect the updated status
    dataContract.setLatestResult(
        new LatestResult()
            .withTimestamp(result.getTimestamp())
            .withStatus(result.getContractExecutionStatus())
            .withMessage(result.getResult())
            .withResultId(result.getId()));

    // Enrich the entity reference with fullyQualifiedName for notification template URL building
    if (dataContract.getEntity() != null) {
      EntityReference fullEntityRef =
          Entity.getEntityReferenceById(
              dataContract.getEntity().getType(),
              dataContract.getEntity().getId(),
              Include.NON_DELETED);
      dataContract.setEntity(fullEntityRef);
    }

    ChangeEvent changeEvent =
        FormatterUtil.getDataContractResultEvent(result, ADMIN_USER_NAME, ENTITY_UPDATED);
    changeEvent.setEntity(JsonUtils.pojoToMaskedJson(dataContract));
    Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToJson(changeEvent));

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
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("latestResult", original.getLatestResult(), updated.getLatestResult());
      recordChange("status", original.getEntityStatus(), updated.getEntityStatus());
      recordChange("testSuite", original.getTestSuite(), updated.getTestSuite());
      recordChange("termsOfUse", original.getTermsOfUse(), updated.getTermsOfUse());
      recordChange("security", original.getSecurity(), updated.getSecurity());
      recordChange("sla", original.getSla(), updated.getSla());
      updateSchema(original, updated);
      updateQualityExpectations(original, updated);
      updateSemantics(original, updated);
      // Preserve immutable creation fields
      updated.setCreatedAt(original.getCreatedAt());
      updated.setCreatedBy(original.getCreatedBy());
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

  public DataContract getEffectiveDataContract(EntityInterface entity) {
    DataContract entityContract = getEntityDataContractSafely(entity);

    List<EntityReference> dataProducts = entity.getDataProducts();
    if (nullOrEmpty(dataProducts)) {
      return entityContract;
    }

    // If entity belongs to multiple data products, we cannot determine which contract to inherit
    // Return only the entity's own contract
    if (dataProducts.size() > 1) {
      LOG.debug(
          "Entity {} belongs to {} data products. Skipping contract inheritance to avoid ambiguity.",
          entity.getId(),
          dataProducts.size());
      return entityContract;
    }

    DataContract dataProductContract = null;
    EntityReference dataProductRef = dataProducts.get(0);
    try {
      dataProductContract = loadEntityDataContract(dataProductRef);
      if (dataProductContract != null
          && dataProductContract.getEntityStatus() != EntityStatus.APPROVED) {
        dataProductContract = null;
      }
    } catch (Exception e) {
      LOG.debug(
          "No contract found for data product {}: {}", dataProductRef.getId(), e.getMessage());
    }

    if (dataProductContract == null) {
      return entityContract;
    }

    if (entityContract == null) {
      return inheritFromDataProductContract(entity, dataProductContract);
    }

    return mergeContracts(entityContract, dataProductContract);
  }

  private DataContract inheritFromDataProductContract(
      EntityInterface entity, DataContract dataProductContract) {
    DataContract inherited = JsonUtils.deepCopy(dataProductContract, DataContract.class);

    // Update the entity reference to point to the actual entity, not the data product
    inherited.setEntity(entity.getEntityReference());

    // Clear entity-specific fields that should not be inherited
    inherited.setQualityExpectations(null);
    inherited.setSchema(null);
    inherited.setTestSuite(null);

    // Clear execution-related fields - inherited contracts have no execution history
    inherited.setLatestResult(null);
    inherited.setContractUpdates(null);
    inherited.setEntityStatus(EntityStatus.DRAFT);

    // Mark all fields as inherited
    if (inherited.getTermsOfUse() != null) {
      inherited.getTermsOfUse().setInherited(true);
    }
    if (inherited.getSecurity() != null) {
      inherited.getSecurity().setInherited(true);
    }
    if (inherited.getSla() != null) {
      inherited.getSla().setInherited(true);
    }

    // Mark semantic rules as inherited
    if (inherited.getSemantics() != null) {
      for (SemanticsRule rule : inherited.getSemantics()) {
        rule.setInherited(true);
      }
    }

    // Mark the entire contract as inherited (asset has no contract of its own)
    inherited.setInherited(true);

    return inherited;
  }

  private DataContract mergeContracts(
      DataContract entityContract, DataContract dataProductContract) {
    DataContract merged = JsonUtils.deepCopy(entityContract, DataContract.class);

    // Inherit terms of use if not defined in entity
    if (merged.getTermsOfUse() == null && dataProductContract.getTermsOfUse() != null) {
      merged.setTermsOfUse(
          JsonUtils.deepCopy(dataProductContract.getTermsOfUse(), TermsOfUse.class));
      if (merged.getTermsOfUse() != null) {
        merged.getTermsOfUse().setInherited(true);
      }
    }

    // Merge semantics - inherited rules from Data Product + entity's own rules
    if (dataProductContract.getSemantics() != null) {
      List<SemanticsRule> mergedSemantics = new ArrayList<>();

      // Collect entity rule names to avoid duplicates
      Set<String> entityRuleNames =
          merged.getSemantics() != null
              ? merged.getSemantics().stream()
                  .map(SemanticsRule::getName)
                  .collect(Collectors.toSet())
              : Collections.emptySet();

      // Add Data Product semantics and mark as inherited (skip if entity already has the rule)
      for (SemanticsRule dpRule : dataProductContract.getSemantics()) {
        if (!entityRuleNames.contains(dpRule.getName())) {
          SemanticsRule inheritedRule = JsonUtils.deepCopy(dpRule, SemanticsRule.class);
          inheritedRule.setInherited(true);
          mergedSemantics.add(inheritedRule);
        }
      }

      // Add entity's own semantics (not inherited)
      if (merged.getSemantics() != null) {
        for (SemanticsRule entityRule : merged.getSemantics()) {
          // Keep the inherited flag as-is from the entity rule (should be false/null for native
          // rules)
          mergedSemantics.add(entityRule);
        }
      }

      merged.setSemantics(mergedSemantics);
    }

    // Inherit security if not defined in entity
    if (merged.getSecurity() == null && dataProductContract.getSecurity() != null) {
      merged.setSecurity(
          JsonUtils.deepCopy(dataProductContract.getSecurity(), ContractSecurity.class));
      if (merged.getSecurity() != null) {
        merged.getSecurity().setInherited(true);
      }
    }

    // Inherit SLA if not defined in entity
    if (merged.getSla() == null && dataProductContract.getSla() != null) {
      merged.setSla(JsonUtils.deepCopy(dataProductContract.getSla(), ContractSLA.class));
      if (merged.getSla() != null) {
        merged.getSla().setInherited(true);
      }
    }

    return merged;
  }

  @Override
  public void storeEntity(DataContract dataContract, boolean update) {
    store(dataContract, update);
  }

  @Override
  public void storeEntities(List<DataContract> entities) {
    List<DataContract> entitiesToStore = new ArrayList<>();
    Gson gson = new Gson();
    for (DataContract entity : entities) {
      String jsonCopy = gson.toJson(entity);
      entitiesToStore.add(gson.fromJson(jsonCopy, DataContract.class));
    }
    storeMany(entitiesToStore);
  }

  @Override
  public void storeRelationships(DataContract dataContract) {
    addRelationship(
        dataContract.getEntity().getId(),
        dataContract.getId(),
        dataContract.getEntity().getType(),
        Entity.DATA_CONTRACT,
        Relationship.CONTAINS);

    storeOwners(dataContract, dataContract.getOwners());
    storeReviewers(dataContract, dataContract.getReviewers());
  }

  @Override
  public void restorePatchAttributes(DataContract original, DataContract updated) {
    updated
        .withId(original.getId())
        .withName(original.getName())
        .withFullyQualifiedName(original.getFullyQualifiedName())
        .withCreatedAt(original.getCreatedAt())
        .withCreatedBy(original.getCreatedBy());
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

  @Override
  public FeedRepository.TaskWorkflow getTaskWorkflow(FeedRepository.ThreadContext threadContext) {
    validateTaskThread(threadContext);
    TaskType taskType = threadContext.getThread().getTask().getType();
    if (EntityUtil.isDescriptionTask(taskType)) {
      return new DescriptionTaskWorkflow(threadContext);
    } else if (EntityUtil.isTagTask(taskType)) {
      return new TagTaskWorkflow(threadContext);
    } else if (!EntityUtil.isTestCaseFailureResolutionTask(taskType)) {
      return new ApprovalTaskWorkflow(threadContext);
    }
    return super.getTaskWorkflow(threadContext);
  }

  public static class ApprovalTaskWorkflow extends FeedRepository.TaskWorkflow {
    ApprovalTaskWorkflow(FeedRepository.ThreadContext threadContext) {
      super(threadContext);
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      DataContract dataContract = (DataContract) threadContext.getAboutEntity();
      DataContractRepository.checkUpdatedByReviewer(dataContract, user);

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
            dataContract, DATA_CONTRACT, user, FIELD_ENTITY_STATUS, entityStatus, true);
      }

      return dataContract;
    }
  }

  @Override
  protected void preDelete(DataContract entity, String deletedBy) {
    // Inherited contracts cannot be deleted - they are virtual contracts derived from Data Product
    if (Boolean.TRUE.equals(entity.getInherited())) {
      throw BadRequestException.of(
          "Cannot delete an inherited data contract. The contract is inherited from a Data Product "
              + "and can only be removed by removing the entity from the Data Product or by creating "
              + "an entity-specific contract that overrides the inherited one.");
    }

    // A data contract in `IN_REVIEW` state can only be deleted by the reviewers
    if (EntityStatus.IN_REVIEW.equals(entity.getEntityStatus())) {
      checkUpdatedByReviewer(entity, deletedBy);
    }
  }

  public static void checkUpdatedByReviewer(DataContract dataContract, String updatedBy) {
    // Only list of allowed reviewers can change the status from DRAFT to APPROVED
    List<EntityReference> reviewers = dataContract.getReviewers();
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

  private void closeApprovalTask(DataContract entity, String comment) {
    EntityLink about = new EntityLink(DATA_CONTRACT, entity.getFullyQualifiedName());
    FeedRepository feedRepository = Entity.getFeedRepository();
    // Close User Tasks
    try {
      Thread taskThread = feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      feedRepository.closeTask(
          taskThread, entity.getUpdatedBy(), new CloseTask().withComment(comment));
    } catch (EntityNotFoundException ex) {
      LOG.info("No approval task found for data contract {}", entity.getFullyQualifiedName());
    }
  }

  protected void updateTaskWithNewReviewers(DataContract dataContract) {
    try {
      EntityLink about = new EntityLink(DATA_CONTRACT, dataContract.getFullyQualifiedName());
      FeedRepository feedRepository = Entity.getFeedRepository();
      Thread originalTask =
          feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      dataContract =
          Entity.getEntityByName(
              Entity.DATA_CONTRACT,
              dataContract.getFullyQualifiedName(),
              "id,fullyQualifiedName,reviewers",
              Include.ALL);

      Thread updatedTask = JsonUtils.deepCopy(originalTask, Thread.class);
      updatedTask.getTask().withAssignees(new ArrayList<>(dataContract.getReviewers()));
      JsonPatch patch = JsonUtils.getJsonPatch(originalTask, updatedTask);
      RestUtil.PatchResponse<Thread> thread =
          feedRepository.patchThread(null, originalTask.getId(), updatedTask.getUpdatedBy(), patch);

      // Send WebSocket Notification
      WebsocketNotificationHandler.handleTaskNotification(thread.entity());
    } catch (EntityNotFoundException e) {
      LOG.info(
          "{} Task not found for data contract {}",
          TaskType.RequestApproval,
          dataContract.getFullyQualifiedName());
    }
  }
}
