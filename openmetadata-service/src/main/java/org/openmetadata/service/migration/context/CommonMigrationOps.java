package org.openmetadata.service.migration.context;

import java.util.List;

public class CommonMigrationOps {
  private CommonMigrationOps() {
    /* Hidden constructor */
  }

  public static final List<MigrationOps> COMMON_OPS =
      List.of(
          // Entities
          new MigrationOps("tableCount", "SELECT COUNT(*) FROM table_entity"),
          new MigrationOps("topicCount", "SELECT COUNT(*) FROM topic_entity"),
          new MigrationOps("dashboardCount", "SELECT COUNT(*) FROM dashboard_entity"),
          new MigrationOps("pipelineCount", "SELECT COUNT(*) FROM pipeline_entity"),
          new MigrationOps("mlModelCount", "SELECT COUNT(*) FROM ml_model_entity"),
          new MigrationOps(
              "storageContainerCount", "SELECT COUNT(*) FROM storage_container_entity"),
          new MigrationOps("searchIndexCount", "SELECT COUNT(*) FROM search_index_entity"),
          new MigrationOps("glossaryCount", "SELECT COUNT(*) FROM glossary_entity"),
          new MigrationOps("glossaryTermCount", "SELECT COUNT(*) FROM glossary_term_entity"),
          // Services
          new MigrationOps("databaseServiceCount", "SELECT COUNT(*) FROM dbservice_entity"),
          new MigrationOps(
              "messagingServiceCount", "SELECT COUNT(*) FROM messaging_service_entity"),
          new MigrationOps(
              "dashboardServiceCount", "SELECT COUNT(*) FROM dashboard_service_entity"),
          new MigrationOps("pipelineServiceCount", "SELECT COUNT(*) FROM pipeline_service_entity"),
          new MigrationOps("mlModelServiceCount", "SELECT COUNT(*) FROM mlmodel_service_entity"),
          new MigrationOps("searchServiceCount", "SELECT COUNT(*) FROM search_service_entity"),
          new MigrationOps("securityServiceCount", "SELECT COUNT(*) FROM security_service_entity"),
          new MigrationOps("storageServiceCount", "SELECT COUNT(*) FROM storage_service_entity"),
          // Org
          new MigrationOps("userCount", "SELECT COUNT(*) FROM user_entity"),
          new MigrationOps("teamCount", "SELECT COUNT(*) FROM team_entity"),
          new MigrationOps("botCount", "SELECT COUNT(*) FROM bot_entity"),
          // Tests
          new MigrationOps("testSuiteCount", "SELECT COUNT(*) FROM test_suite"));

  // Return a copy of the list so that we can store the correct results in each context
  public static List<MigrationOps> getCommonOps() {
    return List.copyOf(COMMON_OPS);
  }
}
