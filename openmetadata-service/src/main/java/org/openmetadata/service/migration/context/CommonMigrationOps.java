package org.openmetadata.service.migration.context;

import java.util.List;

public class CommonMigrationOps {
  private CommonMigrationOps() {
    /* Hidden constructor */
  }

  public static final List<MigrationOps> COMMON_OPS =
      List.of(
          // Entities
          new MigrationOps("tableCount", "SELECT COUNT(fqnHash) FROM table_entity"),
          new MigrationOps("topicCount", "SELECT COUNT(fqnHash) FROM topic_entity"),
          new MigrationOps("dashboardCount", "SELECT COUNT(fqnHash) FROM dashboard_entity"),
          new MigrationOps("pipelineCount", "SELECT COUNT(fqnHash) FROM pipeline_entity"),
          new MigrationOps("mlModelCount", "SELECT COUNT(fqnHash) FROM ml_model_entity"),
          new MigrationOps(
              "storageContainerCount", "SELECT COUNT(fqnHash) FROM storage_container_entity"),
          new MigrationOps("searchIndexCount", "SELECT COUNT(fqnHash) FROM search_index_entity"),
          new MigrationOps("glossaryCount", "SELECT COUNT(nameHash) FROM glossary_entity"),
          new MigrationOps("glossaryTermCount", "SELECT COUNT(fqnHash) FROM glossary_term_entity"),
          // Services
          new MigrationOps("databaseServiceCount", "SELECT COUNT(nameHash) FROM dbservice_entity"),
          new MigrationOps(
              "messagingServiceCount", "SELECT COUNT(nameHash) FROM messaging_service_entity"),
          new MigrationOps(
              "dashboardServiceCount", "SELECT COUNT(nameHash) FROM dashboard_service_entity"),
          new MigrationOps(
              "pipelineServiceCount", "SELECT COUNT(nameHash) FROM pipeline_service_entity"),
          new MigrationOps(
              "mlModelServiceCount", "SELECT COUNT(nameHash) FROM mlmodel_service_entity"),
          new MigrationOps(
              "searchServiceCount", "SELECT COUNT(nameHash) FROM search_service_entity"),
          new MigrationOps(
              "storageServiceCount", "SELECT COUNT(nameHash) FROM storage_service_entity"),
          // Org
          new MigrationOps("userCount", "SELECT COUNT(nameHash) FROM user_entity"),
          new MigrationOps("teamCount", "SELECT COUNT(nameHash) FROM team_entity"),
          new MigrationOps("botCount", "SELECT COUNT(nameHash) FROM bot_entity"),
          // Tests
          new MigrationOps("testSuiteCount", "SELECT COUNT(fqnHash) FROM test_suite"));

  // Return a copy of the list so that we can store the correct results in each context
  public static List<MigrationOps> getCommonOps() {
    return List.copyOf(COMMON_OPS);
  }
}
