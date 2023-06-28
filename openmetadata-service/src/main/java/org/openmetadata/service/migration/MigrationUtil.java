package org.openmetadata.service.migration;

import static org.openmetadata.service.Entity.INGESTION_PIPELINE;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_SUITE;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.analytics.WebAnalyticEvent;
import org.openmetadata.schema.api.tests.CreateTestSuite;
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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.jdbi3.TestSuiteRepository;
import org.openmetadata.service.migration.api.MigrationStep;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class MigrationUtil {
  @SneakyThrows
  public static <T extends EntityInterface> void updateFQNHashForEntity(Class<T> clazz, EntityDAO<T> dao) {
    List<String> jsons = dao.listAfter(new ListFilter(Include.ALL), Integer.MAX_VALUE, "");
    for (String json : jsons) {
      T entity = JsonUtils.readValue(json, clazz);
      dao.update(
          entity.getId(), FullyQualifiedName.buildHash(entity.getFullyQualifiedName()), JsonUtils.pojoToJson(entity));
    }
  }

  public static MigrationDAO.ServerMigrationSQLTable buildServerMigrationTable(String version, String statement) {
    MigrationDAO.ServerMigrationSQLTable result = new MigrationDAO.ServerMigrationSQLTable();
    result.setVersion(String.valueOf(version));
    result.setSqlStatement(statement);
    result.setCheckSum(EntityUtil.hash(statement));
    return result;
  }

  public static List<MigrationDAO.ServerMigrationSQLTable> addInListIfToBeExecuted(
      String version, Set<String> lookUp, List<String> queries) {
    List<MigrationDAO.ServerMigrationSQLTable> result = new ArrayList<>();
    for (String query : queries) {
      MigrationDAO.ServerMigrationSQLTable tableContent = buildServerMigrationTable(version, query);
      if (!lookUp.contains(tableContent.getCheckSum())) {
        result.add(tableContent);
      } else {
        // TODO:LOG better
        LOG.debug("Query will be skipped in Migration Step , as this has already been executed");
      }
    }
    return result;
  }

  public static void dataMigrationFQNHashing(CollectionDAO collectionDAO) {
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
    updateFQNHashForFieldRelationship(collectionDAO);

    // TimeSeries
    updateFQNHashEntityExtensionTimeSeries(collectionDAO);

    // Tag Usage
    updateFQNHashTagUsage(collectionDAO);
  }

  private static void updateFQNHashForFieldRelationship(CollectionDAO collectionDAO) {
    List<CollectionDAO.FieldRelationshipDAO.FieldRelationship> fieldRelationships =
        collectionDAO.fieldRelationshipDAO().listAll();
    for (CollectionDAO.FieldRelationshipDAO.FieldRelationship fieldRelationship : fieldRelationships) {
      if (CommonUtil.nullOrEmpty(fieldRelationship.getFromFQNHash())
          && CommonUtil.nullOrEmpty(fieldRelationship.getToFQNHash())) {
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
  }

  private static void updateFQNHashEntityExtensionTimeSeries(CollectionDAO collectionDAO) {
    List<CollectionDAO.EntityExtensionTimeSeriesDAO.EntityExtensionTimeSeriesTable> timeSeriesTables =
        collectionDAO.entityExtensionTimeSeriesDao().listAll();
    for (CollectionDAO.EntityExtensionTimeSeriesDAO.EntityExtensionTimeSeriesTable timeSeries : timeSeriesTables) {
      if (CommonUtil.nullOrEmpty(timeSeries.getEntityFQNHash())) {
        collectionDAO
            .entityExtensionTimeSeriesDao()
            .updateEntityFQNHash(
                FullyQualifiedName.buildHash(timeSeries.getEntityFQN()),
                timeSeries.getEntityFQN(),
                timeSeries.getExtension(),
                timeSeries.getTimestamp());
      }
    }
  }

  public static void updateFQNHashTagUsage(CollectionDAO collectionDAO) {
    List<CollectionDAO.TagUsageDAO.TagLabelMigration> tagLabelMigrationList = collectionDAO.tagUsageDAO().listAll();
    for (CollectionDAO.TagUsageDAO.TagLabelMigration tagLabel : tagLabelMigrationList) {
      if (CommonUtil.nullOrEmpty(tagLabel.getTagFQNHash()) && CommonUtil.nullOrEmpty(tagLabel.getTargetFQNHash())) {
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
  }

  public static void performSqlExecutionAndUpdation(
      MigrationStep step, MigrationDAO migrationDAO, Handle handle, List<String> queryList) {
    // These are DDL Statements and will cause an Implicit commit even if part of transaction still committed inplace
    Set<String> executedSQLChecksums =
        new HashSet<>(migrationDAO.getServerMigrationSQLWithVersion(String.valueOf(step.getMigrationVersion())));
    // Execute the Statements as batch
    List<MigrationDAO.ServerMigrationSQLTable> toBeExecuted =
        addInListIfToBeExecuted(String.valueOf(step.getMigrationVersion()), executedSQLChecksums, queryList);

    for (MigrationDAO.ServerMigrationSQLTable tableData : toBeExecuted) {
      handle.execute(tableData.getSqlStatement());
      migrationDAO.upsertServerMigrationSQL(
          tableData.getVersion(), tableData.getSqlStatement(), tableData.getCheckSum());
    }
  }

  public static TestSuite getTestSuite(CollectionDAO dao, CreateTestSuite create, String user) throws IOException {
    TestSuite testSuite =
        copy(new TestSuite(), create, user)
            .withDescription(create.getDescription())
            .withDisplayName(create.getDisplayName())
            .withName(create.getName());
    if (create.getExecutableEntityReference() != null) {
      TableRepository tableRepository = new TableRepository(dao);
      Table table =
          JsonUtils.readValue(
              tableRepository.getDao().findJsonByFqn(create.getExecutableEntityReference(), Include.ALL), Table.class);
      EntityReference entityReference =
          new EntityReference()
              .withId(table.getId())
              .withFullyQualifiedName(table.getFullyQualifiedName())
              .withName(table.getName())
              .withType(Entity.TABLE);
      testSuite.setExecutableEntityReference(entityReference);
    }
    return testSuite;
  }

  public static TestSuite copy(TestSuite entity, CreateEntity request, String updatedBy) throws IOException {
    entity.setId(UUID.randomUUID());
    entity.setName(request.getName());
    entity.setDisplayName(request.getDisplayName());
    entity.setDescription(request.getDescription());
    entity.setExtension(request.getExtension());
    entity.setUpdatedBy(updatedBy);
    entity.setOwner(null);
    entity.setUpdatedAt(System.currentTimeMillis());
    return entity;
  }

  @SneakyThrows
  public static void testSuitesMigration(CollectionDAO collectionDAO) {
    IngestionPipelineRepository ingestionPipelineRepository = new IngestionPipelineRepository(collectionDAO);
    TestSuiteRepository testSuiteRepository = new TestSuiteRepository(collectionDAO);
    TestCaseRepository testCaseRepository = new TestCaseRepository(collectionDAO);
    List<TestCase> testCases =
        testCaseRepository.listAll(new EntityUtil.Fields(List.of("id")), new ListFilter(Include.ALL));

    for (TestCase test : testCases) {

      // Create New Executable Test Suites
      MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(test.getEntityLink());
      // Create new Logical Test Suite
      String testSuiteFqn = entityLink.getEntityFQN() + ".testSuite";
      try {
        // Check if the test Suite Exists, this brings the data on nameHash basis
        TestSuite stored =
            testSuiteRepository.getByName(
                null, FullyQualifiedName.quoteName(testSuiteFqn), new EntityUtil.Fields(List.of("id")), Include.ALL);
        testSuiteRepository.addRelationship(stored.getId(), test.getId(), TEST_SUITE, TEST_CASE, Relationship.CONTAINS);
      } catch (EntityNotFoundException ex) {
        // TODO: Need to update the executable field as well
        TestSuite newExecutableTestSuite =
            getTestSuite(
                    collectionDAO,
                    new CreateTestSuite()
                        .withName(testSuiteFqn)
                        .withExecutableEntityReference(entityLink.getEntityFQN()),
                    "ingestion-bot")
                .withExecutable(false);
        TestSuite testSuitePutResponse = testSuiteRepository.create(null, newExecutableTestSuite);
        // Here we aer manually adding executable relationship since the table Repository is not registered and result
        // into null for entity type table
        testSuiteRepository.addRelationship(
            newExecutableTestSuite.getExecutableEntityReference().getId(),
            newExecutableTestSuite.getId(),
            Entity.TABLE,
            TEST_SUITE,
            Relationship.CONTAINS);

        // add relationship from testSuite to TestCases
        testSuiteRepository.addRelationship(
            newExecutableTestSuite.getId(), test.getId(), TEST_SUITE, TEST_CASE, Relationship.CONTAINS);

        // Not a good approach but executable cannot be set true before
        TestSuite temp =
            testSuiteRepository
                .getDao()
                .findEntityByName(FullyQualifiedName.quoteName(newExecutableTestSuite.getName()));
        temp.setExecutable(true);
        testSuiteRepository.getDao().update(temp);
      }
    }

    // Update Test Suites
    ListFilter filter = new ListFilter(Include.ALL);
    filter.addQueryParam("testSuiteType", "logical");
    List<TestSuite> testSuites = testSuiteRepository.listAll(new EntityUtil.Fields(List.of("id")), filter);

    for (TestSuite testSuiteRecord : testSuites) {
      TestSuite temp = testSuiteRepository.getDao().findEntityById(testSuiteRecord.getId());
      if (Boolean.FALSE.equals(temp.getExecutable())) {
        temp.setExecutable(false);
        testSuiteRepository.getDao().update(temp);
      }

      // get Ingestion Pipelines
      try {
        List<CollectionDAO.EntityRelationshipRecord> ingestionPipelineRecords =
            collectionDAO
                .relationshipDAO()
                .findTo(
                    testSuiteRecord.getId().toString(),
                    TEST_SUITE,
                    Relationship.CONTAINS.ordinal(),
                    INGESTION_PIPELINE);
        for (CollectionDAO.EntityRelationshipRecord ingestionRecord : ingestionPipelineRecords) {
          // remove relationship
          collectionDAO.relationshipDAO().deleteAll(ingestionRecord.getId().toString(), INGESTION_PIPELINE);
          // Cannot use Delete directly it uses other repos internally
          ingestionPipelineRepository.getDao().delete(ingestionRecord.getId().toString());
        }
      } catch (EntityNotFoundException ex) {
        // Already Removed
      }
    }
  }
}
