package org.openmetadata.service.migration.versions.mysql.v110;

import static org.openmetadata.service.migration.MigrationUtil.dataMigrationFQNHashing;
import static org.openmetadata.service.migration.MigrationUtil.performSqlExecutionAndUpdation;
import static org.openmetadata.service.migration.MigrationUtil.testSuitesMigration;

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
@MigrationFile(name = "v110_MySQLMigration")
@SuppressWarnings("unused")
public class MySQLMigration implements MigrationStep {
  private CollectionDAO collectionDAO;
  private MigrationDAO migrationDAO;
  private Handle handle;

  @Override
  public String getMigrationVersion() {
    return "1.1.0";
  }

  @Override
  public String getMigrationFileName() {
    return "v110_MySQLMigration";
  }

  @Override
  public String getFileUuid() {
    return "ffcc502b-d4a0-4e5f-a562-0a6d4110c762";
  }

  @Override
  public ConnectionType getDatabaseConnectionType() {
    return ConnectionType.MYSQL;
  }

  @Override
  public void initialize(Handle handle) {
    this.handle = handle;
    this.collectionDAO = handle.attach(CollectionDAO.class);
    this.migrationDAO = handle.attach(MigrationDAO.class);
  }

  @Override
  public void preDDL() {
    preDDLFQNHashing();
  }

  @Override
  public void runDataMigration() {
    // FQN Hashing Migrations
    dataMigrationFQNHashing(handle, collectionDAO);
  }

  @Override
  public void postDDL() {
    // This SQLs cannot be part of the commit as these need some data to be committed
    postDDLFQNHashing();
    testSuitesMigration(collectionDAO);
  }

  @Override
  public void close() {}

  private void preDDLFQNHashing() {
    // These are DDL Statements and will cause an Implicit commit even if part of transaction still committed inplace
    List<String> queryList =
        Arrays.asList(
            "ALTER TABLE bot_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE chart_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768) NOT NULL, ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE classification DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE storage_container_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768) NOT NULL, ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE dashboard_data_model_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768) NOT NULL, ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE dashboard_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768) NOT NULL, ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE dashboard_service_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE data_insight_chart DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768) NOT NULL",
            "ALTER TABLE database_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE database_schema_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE dbservice_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE event_subscription_entity DROP KEY `name`,  ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE glossary_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE glossary_term_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE ingestion_pipeline_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE kpi_entity  DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE messaging_service_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE metadata_service_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE metric_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE ml_model_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE mlmodel_service_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE pipeline_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE pipeline_service_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE policy_entity DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(768) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE query_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE report_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE role_entity DROP KEY `name`,  ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE storage_service_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE table_entity DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(768) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE tag DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE team_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE test_case DROP COLUMN fullyQualifiedName,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL, ADD COLUMN fqnHash VARCHAR(768) NOT NULL",
            "ALTER TABLE test_connection_definition ADD COLUMN nameHash VARCHAR(256) NOT NULL,ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE test_definition DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE test_suite DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE topic_entity DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(768) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;",
            "ALTER TABLE type_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE user_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE web_analytic_event DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(768) NOT NULL",
            "ALTER TABLE automations_workflow DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            // field_relationship
            "ALTER TABLE field_relationship ADD COLUMN fromFQNHash VARCHAR(382), ADD COLUMN toFQNHash VARCHAR(382), DROP INDEX from_index, DROP INDEX to_index, ADD INDEX from_fqnhash_index(fromFQNHash, relation), ADD INDEX to_fqnhash_index(toFQNHash, relation)",
            // entity_extension_time_series
            "ALTER TABLE entity_extension_time_series ADD COLUMN entityFQNHash VARCHAR (768) NOT NULL",
            // tag_usage
            "ALTER TABLE tag_usage ADD COLUMN tagFQNHash VARCHAR(382), ADD COLUMN targetFQNHash VARCHAR(382)");
    performSqlExecutionAndUpdation(this, migrationDAO, handle, queryList);
  }

  private void postDDLFQNHashing() {
    // These are DDL Statements and will cause an Implicit commit even if part of transaction still committed inplace
    List<String> queryList =
        Arrays.asList(
            "ALTER TABLE bot_entity ADD UNIQUE (nameHash)",
            "ALTER TABLE chart_entity ADD UNIQUE (fqnHash)",
            "ALTER TABLE classification ADD UNIQUE (nameHash)",
            "ALTER TABLE storage_container_entity ADD UNIQUE (fqnHash)",
            "ALTER TABLE dashboard_data_model_entity ADD UNIQUE (fqnHash)",
            "ALTER TABLE dashboard_entity ADD UNIQUE (fqnHash)",
            "ALTER TABLE dashboard_service_entity ADD UNIQUE (nameHash)",
            "ALTER TABLE data_insight_chart ADD UNIQUE (fqnHash)",
            "ALTER TABLE database_entity ADD UNIQUE (fqnHash)",
            "ALTER TABLE database_schema_entity ADD UNIQUE (fqnHash)",
            "ALTER TABLE dbservice_entity ADD UNIQUE (nameHash)",
            "ALTER TABLE event_subscription_entity ADD UNIQUE (nameHash)",
            "ALTER TABLE glossary_entity ADD UNIQUE (nameHash)",
            "ALTER TABLE glossary_term_entity ADD UNIQUE (fqnHash)",
            "ALTER TABLE ingestion_pipeline_entity ADD UNIQUE (fqnHash)",
            "ALTER TABLE kpi_entity ADD UNIQUE (nameHash)",
            "ALTER TABLE messaging_service_entity ADD UNIQUE (nameHash)",
            "ALTER TABLE metadata_service_entity ADD UNIQUE (nameHash)",
            "ALTER TABLE metric_entity ADD UNIQUE (fqnHash)",
            "ALTER TABLE ml_model_entity ADD UNIQUE (fqnHash)",
            "ALTER TABLE mlmodel_service_entity ADD UNIQUE (nameHash)",
            "ALTER TABLE pipeline_entity ADD UNIQUE (fqnHash)",
            "ALTER TABLE pipeline_service_entity ADD UNIQUE (nameHash)",
            "ALTER TABLE policy_entity ADD UNIQUE (fqnHash)",
            "ALTER TABLE query_entity ADD UNIQUE (nameHash)",
            "ALTER TABLE report_entity ADD UNIQUE (fqnHash)",
            "ALTER TABLE role_entity ADD UNIQUE (nameHash)",
            "ALTER TABLE storage_service_entity ADD UNIQUE (nameHash)",
            "ALTER TABLE table_entity ADD UNIQUE (fqnHash)",
            "ALTER TABLE tag ADD UNIQUE (fqnHash)",
            "ALTER TABLE team_entity ADD UNIQUE (nameHash)",
            "ALTER TABLE test_case ADD UNIQUE (fqnHash)",
            "ALTER TABLE test_connection_definition ADD UNIQUE (nameHash)",
            "ALTER TABLE test_definition ADD UNIQUE (nameHash)",
            "ALTER TABLE test_suite ADD UNIQUE (nameHash)",
            "ALTER TABLE topic_entity ADD UNIQUE (fqnHash)",
            "ALTER TABLE type_entity ADD UNIQUE (nameHash)",
            "ALTER TABLE user_entity ADD UNIQUE (nameHash)",
            "ALTER TABLE web_analytic_event ADD UNIQUE (fqnHash)",
            "ALTER TABLE automations_workflow ADD UNIQUE (nameHash)",
            // entity_extension_time_series
            "ALTER TABLE entity_extension_time_series DROP COLUMN entityFQN",
            // field_relationship
            "ALTER TABLE field_relationship DROP KEY `PRIMARY`,ADD CONSTRAINT  `field_relationship_primary` PRIMARY KEY(fromFQNHash, toFQNHash, relation), MODIFY fromFQN VARCHAR(2096) NOT NULL, MODIFY toFQN VARCHAR(2096) NOT NULL",
            // tag_usage
            "ALTER TABLE tag_usage DROP index `source`, DROP COLUMN targetFQN, ADD UNIQUE KEY `tag_usage_key` (source, tagFQNHash, targetFQNHash)");
    performSqlExecutionAndUpdation(this, migrationDAO, handle, queryList);
  }
}
