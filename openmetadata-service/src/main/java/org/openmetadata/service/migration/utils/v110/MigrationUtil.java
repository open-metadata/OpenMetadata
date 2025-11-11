package org.openmetadata.service.migration.utils.v110;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.INGESTION_PIPELINE;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_SUITE;
import static org.openmetadata.service.util.EntityUtil.hash;

import java.util.*;
import java.util.Map.Entry;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
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
import org.openmetadata.schema.entity.data.Metric;
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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.jdbi3.TestSuiteRepository;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {
    /* Cannot create object  util class*/
  }

  private static final String COLUMN_CHECK = "SELECT * FROM %s WHERE 1=0;";

  private static final String MYSQL_ENTITY_UPDATE =
      "UPDATE %s SET %s = :nameHashColumnValue WHERE id = :id";
  private static final String POSTGRES_ENTITY_UPDATE =
      "UPDATE %s SET %s = :nameHashColumnValue WHERE id = :id";
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
    updateFQNHashForEntity(handle, clazz, dao, limitParam, nameHashColumn);
  }

  @SneakyThrows
  public static <T extends EntityInterface> void updateFQNHashForEntity(
      Handle handle, Class<T> clazz, EntityDAO<T> dao, int limitParam, String nameHashColumn) {
    if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
      handle.execute(String.format(COLUMN_CHECK, dao.getTableName()));
      readAndProcessEntity(
          handle,
          String.format(MYSQL_ENTITY_UPDATE, dao.getTableName(), nameHashColumn),
          clazz,
          dao,
          false,
          limitParam,
          nameHashColumn);
    } else {
      readAndProcessEntity(
          handle,
          String.format(POSTGRES_ENTITY_UPDATE, dao.getTableName(), nameHashColumn),
          clazz,
          dao,
          false,
          limitParam,
          nameHashColumn);
    }
  }

  @SneakyThrows
  public static <T extends EntityInterface> void updateFQNHashForEntityWithName(
      Handle handle, Class<T> clazz, EntityDAO<T> dao, int limitParam) {
    String nameHashColumn = dao.getNameHashColumn();
    updateFQNHashForEntityWithName(handle, clazz, dao, limitParam, nameHashColumn);
  }

  @SneakyThrows
  public static <T extends EntityInterface> void updateFQNHashForEntityWithName(
      Handle handle, Class<T> clazz, EntityDAO<T> dao, int limitParam, String nameHashColumn) {
    if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
      readAndProcessEntity(
          handle,
          String.format(MYSQL_ENTITY_UPDATE, dao.getTableName(), nameHashColumn),
          clazz,
          dao,
          true,
          limitParam,
          nameHashColumn);
    } else {
      readAndProcessEntity(
          handle,
          String.format(POSTGRES_ENTITY_UPDATE, dao.getTableName(), nameHashColumn),
          clazz,
          dao,
          true,
          limitParam,
          nameHashColumn);
    }
  }

  public static <T extends EntityInterface> void readAndProcessEntity(
      Handle handle,
      String updateSql,
      Class<T> clazz,
      EntityDAO<T> dao,
      boolean withName,
      int limitParam,
      String nameHashColumn) {
    LOG.debug("Starting Migration for table : {}", dao.getTableName());
    if (dao instanceof CollectionDAO.TestSuiteDAO || dao instanceof CollectionDAO.QueryDAO) {
      // We have to do this since this column in changed in the dao in the latest version after this
      // , and this will fail the migrations here
      nameHashColumn = "nameHash";
    }
    while (true) {
      // Read from Database
      try {
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
            String hash;
            if (entity.getFullyQualifiedName() != null) {
              hash =
                  withName
                      ? FullyQualifiedName.buildHash(
                          EntityInterfaceUtil.quoteName(entity.getFullyQualifiedName()))
                      : FullyQualifiedName.buildHash(entity.getFullyQualifiedName());
            } else {
              LOG.info(
                  "Failed in creating FQN Hash for Entity Name : {}, since the FQN is null. Auto Correcting.",
                  entity.getName());
              hash =
                  withName
                      ? FullyQualifiedName.buildHash(
                          EntityInterfaceUtil.quoteName(entity.getName()))
                      : FullyQualifiedName.buildHash(entity.getName());
              entity.setFullyQualifiedName(entity.getName());
              dao.update(entity.getId(), entity.getName(), JsonUtils.pojoToJson(entity));
            }
            int result =
                handle
                    .createUpdate(updateSql)
                    .bind("nameHashColumnValue", hash)
                    .bind("id", entity.getId().toString())
                    .execute();
            if (result <= 0) {
              LOG.error(
                  "No Rows Affected for Updating Hash with Entity Name : {}",
                  entity.getFullyQualifiedName());
            }
          } catch (Exception ex) {
            LOG.error(
                "Failed in creating FQN Hash for Entity Name : {}",
                entity.getFullyQualifiedName(),
                ex);
          }
        }
      } catch (UnableToExecuteStatementException ex) {
        LOG.warn(
            "Migration already done for table : {}, Failure Reason : {}",
            dao.getTableName(),
            ex.getMessage());
        break;
      } catch (Exception ex) {
        LOG.warn("Failed to list the entities, they might already migrated ", ex);
        break;
      }
      LOG.debug("End Migration for table : {}", dao.getTableName());
    }
  }

  public static MigrationDAO.ServerMigrationSQLTable buildServerMigrationTable(
      String version, String statement) {
    MigrationDAO.ServerMigrationSQLTable result = new MigrationDAO.ServerMigrationSQLTable();
    result.setVersion(String.valueOf(version));
    result.setSqlStatement(statement);
    result.setCheckSum(hash(statement));
    return result;
  }

  public static void dataMigrationFQNHashing(
      Handle handle, CollectionDAO collectionDAO, int limitParam) {
    // Migration for Entities with Name as their FQN. We need to quote the FQN, if these entities
    // have "." in their name we are storing it as it is into the FQN field.
    updateFQNHashForEntityWithName(handle, Bot.class, collectionDAO.botDAO(), limitParam);
    updateFQNHashForEntityWithName(handle, User.class, collectionDAO.userDAO(), limitParam);
    updateFQNHashForEntityWithName(handle, Team.class, collectionDAO.teamDAO(), limitParam);
    updateFQNHashForEntityWithName(
        handle, Classification.class, collectionDAO.classificationDAO(), limitParam);

    // Update all the services
    updateFQNHashForEntityWithName(
        handle, DatabaseService.class, collectionDAO.dbServiceDAO(), limitParam);
    updateFQNHashForEntityWithName(
        handle, DashboardService.class, collectionDAO.dashboardServiceDAO(), limitParam);
    updateFQNHashForEntityWithName(
        handle, MessagingService.class, collectionDAO.messagingServiceDAO(), limitParam);
    updateFQNHashForEntityWithName(
        handle, MetadataService.class, collectionDAO.metadataServiceDAO(), limitParam);
    updateFQNHashForEntityWithName(
        handle, MlModelService.class, collectionDAO.mlModelServiceDAO(), limitParam);
    updateFQNHashForEntityWithName(
        handle, StorageService.class, collectionDAO.storageServiceDAO(), limitParam);
    updateFQNHashForEntityWithName(
        handle, PipelineService.class, collectionDAO.pipelineServiceDAO(), limitParam);
    updateFQNHashForEntity(
        handle, IngestionPipeline.class, collectionDAO.ingestionPipelineDAO(), limitParam);

    // Update Entities
    updateFQNHashForEntity(handle, Database.class, collectionDAO.databaseDAO(), limitParam);
    updateFQNHashForEntity(
        handle, DatabaseSchema.class, collectionDAO.databaseSchemaDAO(), limitParam);
    updateFQNHashForEntity(handle, Table.class, collectionDAO.tableDAO(), limitParam);
    updateFQNHashForEntity(handle, Query.class, collectionDAO.queryDAO(), limitParam, "nameHash");
    updateFQNHashForEntity(handle, Topic.class, collectionDAO.topicDAO(), limitParam);
    updateFQNHashForEntity(handle, Dashboard.class, collectionDAO.dashboardDAO(), limitParam);
    updateFQNHashForEntity(
        handle, DashboardDataModel.class, collectionDAO.dashboardDataModelDAO(), limitParam);
    updateFQNHashForEntity(handle, Chart.class, collectionDAO.chartDAO(), limitParam);
    updateFQNHashForEntity(handle, Container.class, collectionDAO.containerDAO(), limitParam);
    updateFQNHashForEntity(handle, MlModel.class, collectionDAO.mlModelDAO(), limitParam);
    updateFQNHashForEntity(handle, Pipeline.class, collectionDAO.pipelineDAO(), limitParam);
    updateFQNHashForEntity(handle, Metric.class, collectionDAO.metricDAO(), limitParam);
    updateFQNHashForEntity(handle, Report.class, collectionDAO.reportDAO(), limitParam);

    // Update Glossaries & Classifications
    updateFQNHashForEntity(handle, Glossary.class, collectionDAO.glossaryDAO(), limitParam);
    updateFQNHashForEntity(handle, GlossaryTerm.class, collectionDAO.glossaryTermDAO(), limitParam);
    updateFQNHashForEntity(handle, Tag.class, collectionDAO.tagDAO(), limitParam);

    // Update DataInsights
    updateFQNHashForEntity(
        handle, DataInsightChart.class, collectionDAO.dataInsightChartDAO(), limitParam);
    updateFQNHashForEntity(handle, Kpi.class, collectionDAO.kpiDAO(), limitParam);

    // Update DQ
    updateFQNHashForEntity(handle, TestCase.class, collectionDAO.testCaseDAO(), limitParam);
    updateFQNHashForEntity(
        handle,
        TestConnectionDefinition.class,
        collectionDAO.testConnectionDefinitionDAO(),
        limitParam);
    updateFQNHashForEntity(
        handle, TestDefinition.class, collectionDAO.testDefinitionDAO(), limitParam);
    updateFQNHashForEntity(
        handle, TestSuite.class, collectionDAO.testSuiteDAO(), limitParam, "nameHash");

    // Update Misc
    updateFQNHashForEntity(handle, Policy.class, collectionDAO.policyDAO(), limitParam);
    updateFQNHashForEntity(
        handle, EventSubscription.class, collectionDAO.eventSubscriptionDAO(), limitParam);
    updateFQNHashForEntity(handle, Role.class, collectionDAO.roleDAO(), limitParam);
    updateFQNHashForEntity(handle, Type.class, collectionDAO.typeEntityDAO(), limitParam);
    updateFQNHashForEntity(
        handle, WebAnalyticEvent.class, collectionDAO.webAnalyticEventDAO(), limitParam);
    updateFQNHashForEntity(handle, Workflow.class, collectionDAO.workflowDAO(), limitParam);

    // Field Relationship
    if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
      updateFQNHashForFieldRelationship(
          handle, MYSQL_FIELD_RELATIONSHIP_UPDATE, collectionDAO, limitParam);
    } else {
      updateFQNHashForFieldRelationship(
          handle, POSTGRES_FIELD_RELATIONSHIP_UPDATE, collectionDAO, limitParam);
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
              "Failed in creating fromFQN : {} , toFQN : {}",
              entityFQNPair.getLeft(),
              entityFQNPair.getRight(),
              ex);
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
            LOG.error(
                "No Rows Affected for Updating entity_extension_time_series entityFQN : {}",
                entityFQN);
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
    List<CollectionDAO.TagUsageDAO.TagLabelMigration> tagLabelMigrationList =
        collectionDAO.tagUsageDAO().listAll();
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
          LOG.error(
              "Failed in creating tagFQN : {}, targetFQN: {}",
              tagLabel.getTagFQN(),
              tagLabel.getTargetFQN(),
              ex);
        }
      }
    }
    LOG.debug("Ended Migration for Tag Usage");
  }

  public static TestSuite getTestSuite(CollectionDAO dao, CreateTestSuite create, String user) {
    TestSuite testSuite =
        copy(new TestSuite(), create, user)
            .withDescription(create.getDescription())
            .withDisplayName(create.getDisplayName())
            .withName(create.getName());
    if (create.getExecutableEntityReference() != null) {
      Table table =
          Entity.getEntityByName(
              Entity.TABLE, create.getExecutableEntityReference(), "", Include.ALL);
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
    entity.setOwners(new ArrayList<>());
    entity.setUpdatedAt(System.currentTimeMillis());
    return entity;
  }

  /**
   * Test Suites Migration in 1.0.x -> 1.1.4 1. This is the first time users are migrating from User created TestSuite
   * to System created native TestSuite Per Table 2. Our Goal with this migration is to list all the test cases and
   * create .testSuite with executable set to true and associate all of the respective test cases with new native test
   * suite.
   */
  @SneakyThrows
  public static void testSuitesMigration(CollectionDAO collectionDAO) {
    try {
      // Update existing test suites as logical test suites and delete any ingestion pipeline
      // associated with the existing test suite
      migrateExistingTestSuitesToLogical(collectionDAO);

      // create native test suites
      TestSuiteRepository testSuiteRepository =
          (TestSuiteRepository) Entity.getEntityRepository(TEST_SUITE);
      Map<String, ArrayList<TestCase>> testCasesByTable = groupTestCasesByTable();
      for (Entry<String, ArrayList<TestCase>> entry : testCasesByTable.entrySet()) {
        String tableFQN = entry.getKey();
        String nativeTestSuiteFqn = tableFQN + ".testSuite";
        List<TestCase> testCases = entry.getValue();
        if (testCases != null && !testCases.isEmpty()) {
          MessageParser.EntityLink entityLink =
              MessageParser.EntityLink.parse(testCases.stream().findFirst().get().getEntityLink());
          TestSuite newExecutableTestSuite =
              getTestSuite(
                      collectionDAO,
                      new CreateTestSuite()
                          .withName(FullyQualifiedName.buildHash(nativeTestSuiteFqn))
                          .withDisplayName(nativeTestSuiteFqn)
                          .withExecutableEntityReference(entityLink.getEntityFQN()),
                      "ingestion-bot")
                  .withExecutable(true)
                  .withFullyQualifiedName(nativeTestSuiteFqn);
          testSuiteRepository.prepareInternal(newExecutableTestSuite, false);
          try {
            testSuiteRepository
                .getDao()
                .insert(
                    "nameHash",
                    newExecutableTestSuite,
                    newExecutableTestSuite.getFullyQualifiedName());

            // add relationship between executable TestSuite with Table
            testSuiteRepository.addRelationship(
                newExecutableTestSuite.getExecutableEntityReference().getId(),
                newExecutableTestSuite.getId(),
                Entity.TABLE,
                TEST_SUITE,
                Relationship.CONTAINS);

            // add relationship between all the testCases that are created against a table with
            // native
            // test suite.
            for (TestCase testCase : testCases) {
              testSuiteRepository.addRelationship(
                  newExecutableTestSuite.getId(),
                  testCase.getId(),
                  TEST_SUITE,
                  TEST_CASE,
                  Relationship.CONTAINS);
            }
          } catch (Exception ex) {
            LOG.warn(String.format("TestSuite %s exists", nativeTestSuiteFqn));
          }
        }
      }
    } catch (Exception ex) {
      LOG.error("Failed to migrate test suites", ex);
    }
  }

  private static void migrateExistingTestSuitesToLogical(CollectionDAO collectionDAO) {
    IngestionPipelineRepository ingestionPipelineRepository =
        (IngestionPipelineRepository) Entity.getEntityRepository(INGESTION_PIPELINE);
    TestSuiteRepository testSuiteRepository =
        (TestSuiteRepository) Entity.getEntityRepository(TEST_SUITE);
    ListFilter filter = new ListFilter(Include.ALL);
    List<TestSuite> testSuites = testSuiteRepository.listAll(new Fields(Set.of("id")), filter);
    for (TestSuite testSuite : testSuites) {
      testSuite.setExecutable(false);
      List<CollectionDAO.EntityRelationshipRecord> ingestionPipelineRecords =
          collectionDAO
              .relationshipDAO()
              .findTo(
                  testSuite.getId(),
                  TEST_SUITE,
                  Relationship.CONTAINS.ordinal(),
                  INGESTION_PIPELINE);
      for (CollectionDAO.EntityRelationshipRecord ingestionRecord : ingestionPipelineRecords) {
        // remove relationship
        collectionDAO.relationshipDAO().deleteAll(ingestionRecord.getId(), INGESTION_PIPELINE);
        // Cannot use Delete directly it uses other repos internally
        ingestionPipelineRepository.getDao().delete(ingestionRecord.getId());
      }
    }
  }

  public static Map<String, ArrayList<TestCase>> groupTestCasesByTable() {
    Map<String, ArrayList<TestCase>> testCasesByTable = new HashMap<>();
    TestCaseRepository testCaseRepository =
        (TestCaseRepository) Entity.getEntityRepository(TEST_CASE);
    List<TestCase> testCases =
        testCaseRepository.listAll(new Fields(Set.of("id")), new ListFilter(Include.ALL));
    for (TestCase testCase : testCases) {
      // Create New Executable Test Suites
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(testCase.getEntityLink());
      // Create new Logical Test Suite
      ArrayList<TestCase> testCasesGroup = new ArrayList<>();
      if (testCasesByTable.containsKey(entityLink.getEntityFQN())) {
        testCasesGroup = testCasesByTable.get(entityLink.getEntityFQN());
        testCasesGroup.add(testCase);
      } else {
        testCasesGroup.add(testCase);
      }
      testCasesByTable.put(entityLink.getEntityFQN(), testCasesGroup);
    }
    return testCasesByTable;
  }
}
