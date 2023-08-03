package org.openmetadata.service.migration.versions.postgres.v110;

import static org.openmetadata.service.migration.versions.utils.v110.MigrationUtil.dataMigrationFQNHashing;
import static org.openmetadata.service.migration.versions.utils.v110.MigrationUtil.performSqlExecutionAndUpdation;
import static org.openmetadata.service.migration.versions.utils.v110.MigrationUtil.testSuitesMigration;

import java.util.Arrays;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.MigrationFile;
import org.openmetadata.service.migration.api.MigrationStep;

@Slf4j
@MigrationFile(name = "v110_PostgresMigration")
@SuppressWarnings("unused")
public class PostgresMigration implements MigrationStep {
  private CollectionDAO collectionDAO;
  private MigrationDAO migrationDAO;
  private Handle handle;

  @Override
  public String getMigrationVersion() {
    return "1.1.0";
  }

  @Override
  public String getMigrationFileName() {
    return "v110_PostgresMigration";
  }

  @Override
  public String getFileUuid() {
    return "98b837ea-5941-4577-bb6d-99ca6a80ed13";
  }

  @Override
  public ConnectionType getDatabaseConnectionType() {
    return ConnectionType.POSTGRES;
  }

  @Override
  public void initialize(Handle handle) {
    this.handle = handle;
    this.collectionDAO = handle.attach(CollectionDAO.class);
    this.migrationDAO = handle.attach(MigrationDAO.class);
  }

  @Override
  public void preDDL() {
    // FQNHASH
    preDDLFixQueryEntityFQN();
    preDDLFQNHashing();
  }

  @Override
  public void runDataMigration() {
    String envVariableValue = System.getenv("MIGRATION_LIMIT_PARAM");
    if (envVariableValue != null) {
      dataMigrationFQNHashing(handle, collectionDAO, Integer.parseInt(envVariableValue));
    } else {
      dataMigrationFQNHashing(handle, collectionDAO, 1000);
    }
  }

  @Override
  public void postDDL() {
    postDDLFQNHashing();
    testSuitesMigration(collectionDAO);
  }

  @Override
  public void close() {}

  private void preDDLFixQueryEntityFQN() {
    List<String> queryList =
        List.of(
            // Add missing FQN to query_entity
            "UPDATE query_entity SET json = jsonb_set(json::jsonb, '{fullyQualifiedName}', json#>'{name}') WHERE json#>'{fullyQualifiedName}' IS NULL");
    performSqlExecutionAndUpdation(this, migrationDAO, handle, queryList);
  }

  private void preDDLFQNHashing() {
    // These are DDL Statements and will cause an Implicit commit even if part of transaction still committed inplace
    List<String> queryList =
        Arrays.asList(
            "ALTER TABLE bot_entity DROP CONSTRAINT bot_entity_name_key, ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE chart_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768), ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL",
            "ALTER TABLE classification  DROP CONSTRAINT tag_category_name_key, ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE storage_container_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768), ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL",
            "ALTER TABLE dashboard_data_model_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768), ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL",
            "ALTER TABLE dashboard_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768), ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL",
            "ALTER TABLE dashboard_service_entity DROP CONSTRAINT dashboard_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE data_insight_chart DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768)",
            "ALTER TABLE database_entity  DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768), ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL",
            "ALTER TABLE database_schema_entity  DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768), ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL",
            "ALTER TABLE dbservice_entity DROP CONSTRAINT dbservice_entity_name_key, ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE event_subscription_entity DROP CONSTRAINT event_subscription_entity_name_key, ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE glossary_entity DROP CONSTRAINT glossary_entity_name_key, ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE glossary_term_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768), ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL",
            "ALTER TABLE ingestion_pipeline_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768), ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL",
            "ALTER TABLE kpi_entity  DROP CONSTRAINT kpi_entity_name_key, ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE messaging_service_entity DROP CONSTRAINT messaging_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE metadata_service_entity DROP CONSTRAINT metadata_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE metric_entity  DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768), ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL",
            "ALTER TABLE ml_model_entity  DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768), ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL",
            "ALTER TABLE mlmodel_service_entity DROP CONSTRAINT mlmodel_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE pipeline_entity  DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768), ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL",
            "ALTER TABLE pipeline_service_entity DROP CONSTRAINT pipeline_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE policy_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768), ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL",
            "ALTER TABLE query_entity DROP CONSTRAINT query_entity_name_key, ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE report_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768), ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL",
            "ALTER TABLE role_entity DROP CONSTRAINT role_entity_name_key,  ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE storage_service_entity DROP CONSTRAINT storage_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE table_entity DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(768), ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL",
            "ALTER TABLE tag DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768), ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL",
            "ALTER TABLE team_entity DROP CONSTRAINT team_entity_name_key, ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE test_case DROP COLUMN fullyQualifiedName, ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL, ADD COLUMN fqnHash VARCHAR(768)",
            "ALTER TABLE test_connection_definition ADD COLUMN nameHash VARCHAR(256), ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL",
            "ALTER TABLE test_definition DROP CONSTRAINT test_definition_name_key, ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE test_suite DROP CONSTRAINT test_suite_name_key, ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE topic_entity  DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(256), ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL",
            "ALTER TABLE type_entity DROP CONSTRAINT type_entity_name_key, ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE user_entity DROP CONSTRAINT user_entity_name_key, ADD COLUMN nameHash VARCHAR(256)",
            "ALTER TABLE web_analytic_event DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768)",
            "ALTER TABLE automations_workflow DROP CONSTRAINT automations_workflow_name_key,  ADD COLUMN nameHash VARCHAR(256)",
            // field_relationship
            "DROP INDEX field_relationship_from_index, field_relationship_to_index;",
            "ALTER TABLE field_relationship ADD COLUMN fromFQNHash VARCHAR(382), ADD COLUMN toFQNHash VARCHAR(382)",
            "CREATE INDEX IF NOT EXISTS field_relationship_from_index ON field_relationship(fromFQNHash, relation)",
            "CREATE INDEX IF NOT EXISTS field_relationship_to_index ON field_relationship(toFQNHash, relation)",
            // entity_extension_time_series
            "ALTER TABLE entity_extension_time_series ADD COLUMN entityFQNHash VARCHAR (768)",
            // tag_usage
            "ALTER TABLE tag_usage ADD COLUMN tagFQNHash VARCHAR(382), ADD COLUMN targetFQNHash VARCHAR(382)");
    performSqlExecutionAndUpdation(this, migrationDAO, handle, queryList);
  }

  private void postDDLFQNHashing() {
    // These are DDL Statements and will cause an Implicit commit even if part of transaction still committed inplace

    List<String> queryList =
        Arrays.asList(
            "ALTER TABLE bot_entity ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE chart_entity ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE classification ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE storage_container_entity ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE dashboard_data_model_entity ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE dashboard_entity ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE dashboard_service_entity ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE data_insight_chart ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE database_entity ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE database_schema_entity ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE dbservice_entity ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE event_subscription_entity ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE glossary_entity ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE glossary_term_entity ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE ingestion_pipeline_entity ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE kpi_entity ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE messaging_service_entity ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE metadata_service_entity ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE metric_entity ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE ml_model_entity ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE mlmodel_service_entity ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE pipeline_entity ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE pipeline_service_entity ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE policy_entity ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE query_entity ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE report_entity ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE role_entity ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE storage_service_entity ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE table_entity ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE tag ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE team_entity ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE test_case ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE test_connection_definition ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE test_definition ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE test_suite ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE topic_entity ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE type_entity ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE user_entity ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            "ALTER TABLE web_analytic_event ADD UNIQUE (fqnHash), ALTER COLUMN fqnHash SET NOT NULL",
            "ALTER TABLE automations_workflow ADD UNIQUE (nameHash), ALTER COLUMN nameHash SET NOT NULL",
            // field_relationship
            "ALTER TABLE field_relationship DROP CONSTRAINT field_relationship_pkey, ADD CONSTRAINT field_relationship_pkey PRIMARY KEY(fromFQNHash, toFQNHash, relation), ALTER fromFQN TYPE VARCHAR(2096), ALTER toFQN TYPE VARCHAR(2096)",
            // entity_extension_time_series
            "ALTER TABLE entity_extension_time_series DROP COLUMN entityFQN, ALTER COLUMN entityFQNHash SET NOT NULL",
            // tag_usage
            "ALTER TABLE tag_usage DROP CONSTRAINT tag_usage_source_tagfqn_targetfqn_key, DROP COLUMN targetFQN, ADD UNIQUE (source, tagFQNHash, targetFQNHash)");
    performSqlExecutionAndUpdation(this, migrationDAO, handle, queryList);
  }
}
