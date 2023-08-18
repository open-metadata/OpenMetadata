package org.openmetadata.service.migration.utils.v110;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.INGESTION_PIPELINE;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_SUITE;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.core.Handle;
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
import org.openmetadata.schema.utils.EntityInterfaceUtil;
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
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {
    /* Cannot create object  util class*/
  }

  private static final String MYSQL_ENTITY_UPDATE = "UPDATE %s SET %s = :nameHashColumnValue WHERE id = :id";
  private static final String POSTGRES_ENTITY_UPDATE = "UPDATE %s SET %s = :nameHashColumnValue WHERE id = :id";
  private static final String MYSQL_ENTITY_EXTENSION_TIME_SERIES_UPDATE =
      "UPDATE entity_extension_time_series set entityFQNHash = :entityFQNHash where entityFQN=:entityFQN";
  private static final String POSTGRES_ENTITY_EXTENSION_TIME_SERIES_UPDATE =
      "UPDATE entity_extension_time_series set entityFQNHash = :entityFQNHash  where entityFQN=:entityFQN";

  private static final String MYSQL_FIELD_RELATIONSHIP_UPDATE =
      "UPDATE field_relationship SET fromFQNHash = :fromFQNHash, toFQNHash = :toFQNHash where fromFQN= :fromFQN and toFQN = :toFQN";
  private static final String POSTGRES_FIELD_RELATIONSHIP_UPDATE =
      "UPDATE field_relationship SET fromFQNHash = :fromFQNHash, toFQNHash = :toFQNHash where fromFQN= :fromFQN and toFQN = :toFQN";

  @SneakyThrows
  public static <T extends EntityInterface> void updateFQNHashForEntity(
      Handle handle, Class<T> clazz, EntityDAO<T> dao, int limitParam) {
    String nameHashColumn = dao.getNameHashColumn();
    if (dao instanceof CollectionDAO.TestSuiteDAO) {
      // We have to do this since this column in changed in the dao in latest version after this , and this will fail
      // the migrations here
      nameHashColumn = "nameHash";
    }
    if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
      readAndProcessEntity(
          handle,
          String.format(MYSQL_ENTITY_UPDATE, dao.getTableName(), nameHashColumn),
          clazz,
          dao,
          false,
          limitParam);
    } else {
      readAndProcessEntity(
          handle,
          String.format(POSTGRES_ENTITY_UPDATE, dao.getTableName(), nameHashColumn),
          clazz,
          dao,
          false,
          limitParam);
    }
  }

  @SneakyThrows
  public static <T extends EntityInterface> void updateFQNHashForEntityWithName(
      Handle handle, Class<T> clazz, EntityDAO<T> dao, int limitParam) {
    String nameHashColumn = dao.getNameHashColumn();
    if (dao instanceof CollectionDAO.TestSuiteDAO) {
      // We have to do this since this column in changed in the dao in latest version after this , and this will fail
      // the migrations here
      nameHashColumn = "nameHash";
    }
    if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
      readAndProcessEntity(
          handle, String.format(MYSQL_ENTITY_UPDATE, dao.getTableName(), nameHashColumn), clazz, dao, true, limitParam);
    } else {
      readAndProcessEntity(
          handle,
          String.format(POSTGRES_ENTITY_UPDATE, dao.getTableName(), nameHashColumn),
          clazz,
          dao,
          true,
          limitParam);
    }
  }

  public static <T extends EntityInterface> void readAndProcessEntity(
      Handle handle, String updateSql, Class<T> clazz, EntityDAO<T> dao, boolean withName, int limitParam) {
    LOG.debug("Starting Migration for table : {}", dao.getTableName());
    String nameHashColumn = dao.getNameHashColumn();
    if (dao instanceof CollectionDAO.TestSuiteDAO) {
      // We have to do this since this column in changed in the dao in latest version after this , and this will fail
      // the migrations here
      nameHashColumn = "nameHash";
    }
    while (true) {
      // Read from Database
      List<String> jsons = dao.migrationListAfterWithOffset(limitParam, nameHashColumn);
      LOG.debug("[{}]Read a Batch of Size: {}", dao.getTableName(), jsons.size());
      if (jsons.isEmpty()) {
        break;
      }
      // Process Update
      for (String json : jsons) {
        // Update the Statements to Database
        T entity = JsonUtils.readValue(json, clazz);
        try {
          String hash =
              withName
                  ? FullyQualifiedName.buildHash(EntityInterfaceUtil.quoteName(entity.getFullyQualifiedName()))
                  : FullyQualifiedName.buildHash(entity.getFullyQualifiedName());
          int result =
              handle
                  .createUpdate(updateSql)
                  .bind("nameHashColumnValue", hash)
                  .bind("id", entity.getId().toString())
                  .execute();
          if (result <= 0) {
            LOG.error("No Rows Affected for Updating Hash with Entity Name : {}", entity.getFullyQualifiedName());
          }
        } catch (Exception ex) {
          LOG.error("Failed in creating FQN Hash for Entity Name : {}", entity.getFullyQualifiedName(), ex);
        }
      }
    }
    LOG.debug("End Migration for table : {}", dao.getTableName());
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
        LOG.debug("Query will be skipped in Migration Step , as this has already been executed");
      }
    }
    return result;
  }

  public static void dataMigrationFQNHashing(Handle handle, CollectionDAO collectionDAO, int limitParam) {
    // Migration for Entities with Name as their FQN
    // We need to quote the FQN, if these entities have "." in their name we are storing it as it is
    // into the FQN field.
    updateFQNHashForEntityWithName(handle, Bot.class, collectionDAO.botDAO(), limitParam);
    updateFQNHashForEntityWithName(handle, User.class, collectionDAO.userDAO(), limitParam);
    updateFQNHashForEntityWithName(handle, Team.class, collectionDAO.teamDAO(), limitParam);

    // Update all the services
    updateFQNHashForEntityWithName(handle, DatabaseService.class, collectionDAO.dbServiceDAO(), limitParam);
    updateFQNHashForEntityWithName(handle, DashboardService.class, collectionDAO.dashboardServiceDAO(), limitParam);
    updateFQNHashForEntityWithName(handle, MessagingService.class, collectionDAO.messagingServiceDAO(), limitParam);
    updateFQNHashForEntityWithName(handle, MetadataService.class, collectionDAO.metadataServiceDAO(), limitParam);
    updateFQNHashForEntityWithName(handle, MlModelService.class, collectionDAO.mlModelServiceDAO(), limitParam);
    updateFQNHashForEntityWithName(handle, StorageService.class, collectionDAO.storageServiceDAO(), limitParam);
    updateFQNHashForEntityWithName(handle, PipelineService.class, collectionDAO.pipelineServiceDAO(), limitParam);
    updateFQNHashForEntity(handle, IngestionPipeline.class, collectionDAO.ingestionPipelineDAO(), limitParam);

    // Update Entities
    updateFQNHashForEntity(handle, Database.class, collectionDAO.databaseDAO(), limitParam);
    updateFQNHashForEntity(handle, DatabaseSchema.class, collectionDAO.databaseSchemaDAO(), limitParam);
    updateFQNHashForEntity(handle, Table.class, collectionDAO.tableDAO(), limitParam);
    updateFQNHashForEntity(handle, Query.class, collectionDAO.queryDAO(), limitParam);
    updateFQNHashForEntity(handle, Topic.class, collectionDAO.topicDAO(), limitParam);
    updateFQNHashForEntity(handle, Dashboard.class, collectionDAO.dashboardDAO(), limitParam);
    updateFQNHashForEntity(handle, DashboardDataModel.class, collectionDAO.dashboardDataModelDAO(), limitParam);
    updateFQNHashForEntity(handle, Chart.class, collectionDAO.chartDAO(), limitParam);
    updateFQNHashForEntity(handle, Container.class, collectionDAO.containerDAO(), limitParam);
    updateFQNHashForEntity(handle, MlModel.class, collectionDAO.mlModelDAO(), limitParam);
    updateFQNHashForEntity(handle, Pipeline.class, collectionDAO.pipelineDAO(), limitParam);
    updateFQNHashForEntity(handle, Metrics.class, collectionDAO.metricsDAO(), limitParam);
    updateFQNHashForEntity(handle, Report.class, collectionDAO.reportDAO(), limitParam);

    // Update Glossaries & Classifications
    updateFQNHashForEntity(handle, Classification.class, collectionDAO.classificationDAO(), limitParam);
    updateFQNHashForEntity(handle, Glossary.class, collectionDAO.glossaryDAO(), limitParam);
    updateFQNHashForEntity(handle, GlossaryTerm.class, collectionDAO.glossaryTermDAO(), limitParam);
    updateFQNHashForEntity(handle, Tag.class, collectionDAO.tagDAO(), limitParam);

    // Update DataInsights
    updateFQNHashForEntity(handle, DataInsightChart.class, collectionDAO.dataInsightChartDAO(), limitParam);
    updateFQNHashForEntity(handle, Kpi.class, collectionDAO.kpiDAO(), limitParam);

    // Update DQ
    updateFQNHashForEntity(handle, TestCase.class, collectionDAO.testCaseDAO(), limitParam);
    updateFQNHashForEntity(
        handle, TestConnectionDefinition.class, collectionDAO.testConnectionDefinitionDAO(), limitParam);
    updateFQNHashForEntity(handle, TestDefinition.class, collectionDAO.testDefinitionDAO(), limitParam);
    updateFQNHashForEntity(handle, TestSuite.class, collectionDAO.testSuiteDAO(), limitParam);

    // Update Misc
    updateFQNHashForEntity(handle, Policy.class, collectionDAO.policyDAO(), limitParam);
    updateFQNHashForEntity(handle, EventSubscription.class, collectionDAO.eventSubscriptionDAO(), limitParam);
    updateFQNHashForEntity(handle, Role.class, collectionDAO.roleDAO(), limitParam);
    updateFQNHashForEntity(handle, Type.class, collectionDAO.typeEntityDAO(), limitParam);
    updateFQNHashForEntity(handle, WebAnalyticEvent.class, collectionDAO.webAnalyticEventDAO(), limitParam);
    updateFQNHashForEntity(handle, Workflow.class, collectionDAO.workflowDAO(), limitParam);

    // Field Relationship
    if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
      updateFQNHashForFieldRelationship(handle, MYSQL_FIELD_RELATIONSHIP_UPDATE, collectionDAO, limitParam);
    } else {
      updateFQNHashForFieldRelationship(handle, POSTGRES_FIELD_RELATIONSHIP_UPDATE, collectionDAO, limitParam);
    }

    // TimeSeries
    if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
      updateFQNHashEntityExtensionTimeSeries(
          handle, MYSQL_ENTITY_EXTENSION_TIME_SERIES_UPDATE, collectionDAO, limitParam);
    } else {
      updateFQNHashEntityExtensionTimeSeries(
          handle, POSTGRES_ENTITY_EXTENSION_TIME_SERIES_UPDATE, collectionDAO, limitParam);
    }

    // Tag Usage
    updateFQNHashTagUsage(collectionDAO);
  }

  private static void updateFQNHashForFieldRelationship(
      Handle handle, String updateSql, CollectionDAO collectionDAO, int limitParam) {
    LOG.debug("Starting Migration for Field Relationship");
    while (true) {
      List<Pair<String, String>> entityFQNPairList =
          collectionDAO.fieldRelationshipDAO().migrationListDistinctWithOffset(limitParam);
      LOG.debug("[FieldRelationship] Read a Batch of Size: {}", entityFQNPairList.size());
      if (entityFQNPairList.isEmpty()) {
        break;
      }
      for (Pair<String, String> entityFQNPair : entityFQNPairList) {
        try {
          String fromFQNHash = FullyQualifiedName.buildHash(entityFQNPair.getLeft());
          String toFQNHash = FullyQualifiedName.buildHash(entityFQNPair.getRight());
          int result =
              handle
                  .createUpdate(updateSql)
                  .bind("fromFQNHash", fromFQNHash)
                  .bind("toFQNHash", toFQNHash)
                  .bind("fromFQN", entityFQNPair.getLeft())
                  .bind("toFQN", entityFQNPair.getRight())
                  .execute();
          if (result <= 0) {
            LOG.error(
                "No Rows Affected for Updating Field Relationship fromFQN : {}, toFQN : {}",
                entityFQNPair.getLeft(),
                entityFQNPair.getRight());
          }
        } catch (Exception ex) {
          LOG.error(
              "Failed in creating fromFQN : {} , toFQN : {}", entityFQNPair.getLeft(), entityFQNPair.getRight(), ex);
        }
      }
      LOG.debug("[FieldRelationship] Committing a Batch of Size: {}", entityFQNPairList.size());
    }
    LOG.debug("End Migration for Field Relationship");
  }

  private static void updateFQNHashEntityExtensionTimeSeries(
      Handle handle, String updateSql, CollectionDAO collectionDAO, int limitParam) {
    LOG.debug("Starting Migration for Entity Extension Time Series");
    try {
      collectionDAO.entityExtensionTimeSeriesDao().listDistinctCount();
    } catch (Exception ex) {
      return;
    }
    while (true) {
      List<String> entityFQNLists =
          collectionDAO.entityExtensionTimeSeriesDao().migrationListDistinctWithOffset(limitParam);
      LOG.debug("[TimeSeries] Read a Batch of Size: {}", entityFQNLists.size());
      if (entityFQNLists.isEmpty()) {
        break;
      }
      for (String entityFQN : entityFQNLists) {
        try {
          int result =
              handle
                  .createUpdate(updateSql)
                  .bind("entityFQNHash", FullyQualifiedName.buildHash(entityFQN))
                  .bind("entityFQN", entityFQN)
                  .execute();
          if (result <= 0) {
            LOG.error("No Rows Affected for Updating entity_extension_time_series entityFQN : {}", entityFQN);
          }
        } catch (Exception ex) {
          LOG.error("Failed in creating EntityFQN : {}", entityFQN, ex);
        }
      }
      LOG.debug("[TimeSeries] Committing a Batch of Size: {}", entityFQNLists.size());
    }
    LOG.debug("Ended Migration for Entity Extension Time Series");
  }

  public static void updateFQNHashTagUsage(CollectionDAO collectionDAO) {
    LOG.debug("Starting Migration for Tag Usage");
    List<CollectionDAO.TagUsageDAO.TagLabelMigration> tagLabelMigrationList = collectionDAO.tagUsageDAO().listAll();
    for (CollectionDAO.TagUsageDAO.TagLabelMigration tagLabel : tagLabelMigrationList) {
      if (nullOrEmpty(tagLabel.getTagFQNHash()) && nullOrEmpty(tagLabel.getTargetFQNHash())) {
        try {
          String tagFQNHash = FullyQualifiedName.buildHash(tagLabel.getTagFQN());
          String targetFQNHash = FullyQualifiedName.buildHash(tagLabel.getTargetFQN());
          collectionDAO
              .tagUsageDAO()
              .upsertFQNHash(
                  tagLabel.getSource(),
                  tagLabel.getTagFQN(),
                  tagFQNHash,
                  targetFQNHash,
                  tagLabel.getLabelType(),
                  tagLabel.getState(),
                  tagLabel.getTargetFQN());
        } catch (Exception ex) {
          LOG.error("Failed in creating tagFQN : {}, targetFQN: {}", tagLabel.getTagFQN(), tagLabel.getTargetFQN(), ex);
        }
      }
    }
    LOG.debug("Ended Migration for Tag Usage");
  }

  public static void performSqlExecutionAndUpdate(
      Handle handle, MigrationDAO migrationDAO, List<String> queryList, String version) {
    // These are DDL Statements and will cause an Implicit commit even if part of transaction still committed inplace
    if (!nullOrEmpty(queryList)) {
      for (String sql : queryList) {
        try {
          handle.execute(sql);
          migrationDAO.upsertServerMigrationSQL(version, sql, EntityUtil.hash(sql));
        } catch (Exception e) {
          LOG.error(String.format("Failed to run sql %s due to %s", sql, e));
          throw e;
        }
      }
    }
  }

  public static TestSuite getTestSuite(CollectionDAO dao, CreateTestSuite create, String user) {
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

  public static TestSuite copy(TestSuite entity, CreateEntity request, String updatedBy) {
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
    List<TestCase> testCases = testCaseRepository.listAll(new Fields(Set.of("id")), new ListFilter(Include.ALL));

    for (TestCase test : testCases) {

      // Create New Executable Test Suites
      MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(test.getEntityLink());
      // Create new Logical Test Suite
      String testSuiteFqn = entityLink.getEntityFQN() + ".testSuite";
      TestSuite stored;
      try {
        // If entity is found by Hash it is already migrated
        testSuiteRepository
            .getDao()
            .findEntityByName(EntityInterfaceUtil.quoteName(testSuiteFqn), "nameHash", Include.ALL);
      } catch (EntityNotFoundException entityNotFoundException) {
        try {
          // Check if the test Suite Exists, this brings the data on nameHash basis
          stored =
              testSuiteRepository
                  .getDao()
                  .findEntityByName(EntityInterfaceUtil.quoteName(testSuiteFqn), "nameHash", Include.ALL);
          testSuiteRepository.addRelationship(
              stored.getId(), test.getId(), TEST_SUITE, TEST_CASE, Relationship.CONTAINS);
          stored.setExecutable(true);
          stored.setName(FullyQualifiedName.buildHash(testSuiteFqn));
          // the update() method here internally calls FullyQualifiedName.buildHash so not adding it
          stored.setFullyQualifiedName(EntityInterfaceUtil.quoteName(FullyQualifiedName.buildHash(testSuiteFqn)));
          stored.setDisplayName(testSuiteFqn);
          testSuiteRepository.getDao().update(stored);
        } catch (EntityNotFoundException ex) {
          try {
            TestSuite newExecutableTestSuite =
                getTestSuite(
                        collectionDAO,
                        new CreateTestSuite()
                            .withName(FullyQualifiedName.buildHash(testSuiteFqn))
                            .withDisplayName(testSuiteFqn)
                            .withExecutableEntityReference(entityLink.getEntityFQN()),
                        "ingestion-bot")
                    .withExecutable(false);
            // Create
            testSuiteRepository.prepareInternal(newExecutableTestSuite);
            testSuiteRepository
                .getDao()
                .insert("nameHash", newExecutableTestSuite, newExecutableTestSuite.getFullyQualifiedName());
            // Here we aer manually adding executable relationship since the table Repository is not registered and
            // result
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
                    .findEntityByName(
                        EntityInterfaceUtil.quoteName(FullyQualifiedName.buildHash(testSuiteFqn)),
                        "nameHash",
                        Include.ALL);
            temp.setExecutable(true);
            testSuiteRepository.getDao().update("nameHash", temp);
          } catch (Exception exIgnore) {
            LOG.warn("Ignoring error since already added: {}", ex.getMessage());
          }
        }
      }
    }

    // Update Test Suites
    ListFilter filter = new ListFilter(Include.ALL);
    filter.addQueryParam("testSuiteType", "logical");
    List<TestSuite> testSuites = testSuiteRepository.listAll(new Fields(Set.of("id")), filter);

    for (TestSuite testSuiteRecord : testSuites) {
      TestSuite temp = testSuiteRepository.getDao().findEntityById(testSuiteRecord.getId(), Include.ALL);
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
