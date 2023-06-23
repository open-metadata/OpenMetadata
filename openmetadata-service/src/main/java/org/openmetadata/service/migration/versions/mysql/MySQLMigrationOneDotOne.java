package org.openmetadata.service.migration.versions.mysql;

import static org.openmetadata.service.migration.MigrationUtil.addInListIfToBeExecuted;
import static org.openmetadata.service.migration.MigrationUtil.updateFQNHashForEntity;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.analytics.WebAnalyticEvent;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.schema.dataInsight.kpi.Kpi;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metrics;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Report;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.entity.services.connections.TestConnectionDefinition;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.MigrationDAO.ServerMigrationSQLTable;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.MigrationFile;
import org.openmetadata.service.migration.api.MigrationStep;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@MigrationFile(name = "MySQLMigrationOneDotOne")
@SuppressWarnings("unused")
public class MySQLMigrationOneDotOne implements MigrationStep {
  private CollectionDAO collectionDAO;
  private MigrationDAO migrationDAO;
  private Handle handle;

  @Override
  public double getMigrationVersion() {
    return 1.1;
  }

  @Override
  public String getMigrationFileName() {
    return "MySQLMigrationOneDotOne";
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
    dataMigrationFQNHashing();
  }

  @Override
  public void postDDL() {
    // This SQLs cannot be part of the commit as these need some data to be committed
    postDDLFQNHashing();
  }

  @Override
  public void close() {}

  private void performSqlExecutionAndUpdation(List<String> queryList) {
    // These are DDL Statements and will cause an Implicit commit even if part of transaction still committed inplace
    Set<String> executedSQLChecksums =
        new HashSet<>(migrationDAO.getServerMigrationSQLWithVersion(String.valueOf(this.getMigrationVersion())));
    // Execute the Statements as batch
    List<ServerMigrationSQLTable> toBeExecuted =
        addInListIfToBeExecuted(String.valueOf(this.getMigrationVersion()), executedSQLChecksums, queryList);

    for (ServerMigrationSQLTable tableData : toBeExecuted) {
      handle.execute(tableData.getSqlStatement());
      migrationDAO.upsertServerMigrationSQL(
          tableData.getVersion(), tableData.getSqlStatement(), tableData.getCheckSum());
    }
  }

  private void preDDLFQNHashing() {
    // These are DDL Statements and will cause an Implicit commit even if part of transaction still committed inplace
    List<String> queryList =
        Arrays.asList(
            "ALTER TABLE bot_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE chart_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE classification DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE storage_container_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE dashboard_data_model_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE dashboard_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE dashboard_service_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE data_insight_chart DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL",
            "ALTER TABLE database_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE database_schema_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE dbservice_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE event_subscription_entity DROP KEY `name`,  ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE glossary_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE glossary_term_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE ingestion_pipeline_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;",
            "ALTER TABLE kpi_entity  DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE messaging_service_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE metadata_service_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE metric_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE ml_model_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE mlmodel_service_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE pipeline_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE pipeline_service_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE policy_entity DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(256) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE query_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE report_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE role_entity DROP KEY `name`,  ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE storage_service_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE table_entity DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(256) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE tag DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE team_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE test_case DROP COLUMN fullyQualifiedName,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL, ADD COLUMN fqnHash VARCHAR(256) NOT NULL",
            "ALTER TABLE test_connection_definition ADD COLUMN nameHash VARCHAR(256) NOT NULL,ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL",
            "ALTER TABLE test_definition DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE test_suite DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE topic_entity DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(256) NOT NULL,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;",
            "ALTER TABLE type_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE user_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE web_analytic_event DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL",
            "ALTER TABLE automations_workflow DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL",
            "ALTER TABLE field_relationship ADD COLUMN fromFQNHash VARCHAR(256), ADD COLUMN toFQNHash VARCHAR(256), DROP INDEX from_index, DROP INDEX to_index, ADD INDEX from_fqnhash_index(fromFQNHash, relation), ADD INDEX to_fqnhash_index(toFQNHash, relation)",
            "ALTER TABLE entity_extension_time_series ADD COLUMN entityFQNHash VARCHAR (256) NOT NULL",
            "ALTER TABLE tag_usage ADD COLUMN tagFQNHash VARCHAR(256), ADD COLUMN targetFQNHash VARCHAR(256)");
    performSqlExecutionAndUpdation(queryList);
  }

  private void dataMigrationFQNHashing() {
    // Migration for Entities
    updateFQNHashForEntity(Bot.class, collectionDAO.botDAO());
    updateFQNHashForEntity(Chart.class, collectionDAO.chartDAO());
    updateFQNHashForEntity(Classification.class, collectionDAO.classificationDAO());
    updateFQNHashForEntity(Container.class, collectionDAO.containerDAO());
    updateFQNHashForEntity(DashboardDataModel.class, collectionDAO.dashboardDataModelDAO());
    updateFQNHashForEntity(Dashboard.class, collectionDAO.dashboardDAO());
    updateFQNHashForEntity(DashboardService.class, collectionDAO.dashboardServiceDAO());
    updateFQNHashForEntity(DataInsightChart.class, collectionDAO.dataInsightChartDAO());
    updateFQNHashForEntity(Database.class, collectionDAO.databaseDAO());
    updateFQNHashForEntity(DatabaseSchema.class, collectionDAO.databaseSchemaDAO());
    updateFQNHashForEntity(DatabaseService.class, collectionDAO.dbServiceDAO());
    updateFQNHashForEntity(EventSubscription.class, collectionDAO.eventSubscriptionDAO());
    updateFQNHashForEntity(Glossary.class, collectionDAO.glossaryDAO());
    updateFQNHashForEntity(GlossaryTerm.class, collectionDAO.glossaryTermDAO());
    updateFQNHashForEntity(IngestionPipeline.class, collectionDAO.ingestionPipelineDAO());
    updateFQNHashForEntity(Kpi.class, collectionDAO.kpiDAO());
    updateFQNHashForEntity(MessagingService.class, collectionDAO.messagingServiceDAO());
    updateFQNHashForEntity(MetadataService.class, collectionDAO.metadataServiceDAO());
    updateFQNHashForEntity(Metrics.class, collectionDAO.metricsDAO());
    updateFQNHashForEntity(MlModel.class, collectionDAO.mlModelDAO());
    updateFQNHashForEntity(MlModelService.class, collectionDAO.mlModelServiceDAO());
    updateFQNHashForEntity(Pipeline.class, collectionDAO.pipelineDAO());
    updateFQNHashForEntity(PipelineService.class, collectionDAO.pipelineServiceDAO());
    updateFQNHashForEntity(Policy.class, collectionDAO.policyDAO());
    updateFQNHashForEntity(Query.class, collectionDAO.queryDAO());
    updateFQNHashForEntity(Report.class, collectionDAO.reportDAO());
    updateFQNHashForEntity(Role.class, collectionDAO.roleDAO());
    updateFQNHashForEntity(StorageService.class, collectionDAO.storageServiceDAO());
    updateFQNHashForEntity(Table.class, collectionDAO.tableDAO());
    updateFQNHashForEntity(Tag.class, collectionDAO.tagDAO());
    updateFQNHashForEntity(Team.class, collectionDAO.teamDAO());
    updateFQNHashForEntity(TestCase.class, collectionDAO.testCaseDAO());
    updateFQNHashForEntity(TestConnectionDefinition.class, collectionDAO.testConnectionDefinitionDAO());
    updateFQNHashForEntity(TestDefinition.class, collectionDAO.testDefinitionDAO());
    updateFQNHashForEntity(TestSuite.class, collectionDAO.testSuiteDAO());
    updateFQNHashForEntity(Topic.class, collectionDAO.topicDAO());
    updateFQNHashForEntity(Type.class, collectionDAO.typeEntityDAO());
    updateFQNHashForEntity(User.class, collectionDAO.userDAO());
    updateFQNHashForEntity(WebAnalyticEvent.class, collectionDAO.webAnalyticEventDAO());
    updateFQNHashForEntity(Workflow.class, collectionDAO.workflowDAO());

    // Field Relationship
    updateFQNHashForFieldRelationship();

    // TimeSeries
    updateFQNHashEntityExtensionTimeSeries();

    // Tag Usage
    updateFQNHashTagUsage();
  }

  private void updateFQNHashForFieldRelationship() {
    List<CollectionDAO.FieldRelationshipDAO.FieldRelationship> fieldRelationships =
        collectionDAO.fieldRelationshipDAO().listAll();
    for (CollectionDAO.FieldRelationshipDAO.FieldRelationship fieldRelationship : fieldRelationships) {
      collectionDAO
          .fieldRelationshipDAO()
          .upsertFQNHash(
              FullyQualifiedName.buildHash(fieldRelationship.getFromFQN()),
              FullyQualifiedName.buildHash(fieldRelationship.getToFQN()),
              fieldRelationship.getFromFQN(),
              fieldRelationship.getToFQN(),
              fieldRelationship.getFromType(),
              fieldRelationship.getToType(),
              fieldRelationship.getRelation(),
              fieldRelationship.getJsonSchema(),
              fieldRelationship.getJson());
    }
  }

  private void updateFQNHashEntityExtensionTimeSeries() {
    List<CollectionDAO.EntityExtensionTimeSeriesDAO.EntityExtensionTimeSeriesTable> timeSeriesTables =
        collectionDAO.entityExtensionTimeSeriesDao().listAll();
    for (CollectionDAO.EntityExtensionTimeSeriesDAO.EntityExtensionTimeSeriesTable fieldRelationship :
        timeSeriesTables) {
      collectionDAO
          .entityExtensionTimeSeriesDao()
          .update(
              FullyQualifiedName.buildHash(fieldRelationship.getEntityFQN()),
              fieldRelationship.getExtension(),
              fieldRelationship.getJson(),
              fieldRelationship.getTimestamp());
    }
  }

  private void updateFQNHashTagUsage() {
    List<CollectionDAO.TagUsageDAO.TagLabelMigration> tagLabelMigrationList = collectionDAO.tagUsageDAO().listAll();
    for (CollectionDAO.TagUsageDAO.TagLabelMigration tagLabel : tagLabelMigrationList) {
      collectionDAO
          .tagUsageDAO()
          .upsertFQNHash(
              tagLabel.getSource(),
              tagLabel.getTagFQN(),
              FullyQualifiedName.buildHash(tagLabel.getTagFQN()),
              FullyQualifiedName.buildHash(tagLabel.getTargetFQN()),
              tagLabel.getLabelType(),
              tagLabel.getState(),
              tagLabel.getTargetFQN());
    }
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
            "ALTER TABLE entity_extension_time_series DROP COLUMN entityFQN",
            "ALTER TABLE field_relationship DROP KEY `PRIMARY`,ADD CONSTRAINT  `field_relationship_primary` PRIMARY KEY(fromFQNHash, toFQNHash, relation), MODIFY fromFQN VARCHAR(2096) NOT NULL, MODIFY toFQN VARCHAR(2096) NOT NULL",
            "ALTER TABLE tag_usage DROP index `source`, DROP COLUMN targetFQN, ADD UNIQUE KEY `tag_usage_key` (source, tagFQNHash, targetFQNHash)");
    performSqlExecutionAndUpdation(queryList);
  }
}
