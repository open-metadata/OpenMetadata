package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.entity.data.Metrics;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.entity.data.Task;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.jdbi3.AuditLogRepository.AuditLogDAO;

public interface CollectionDAO {
  @CreateSqlObject
  DatabaseDAO3 databaseDAO();

  @CreateSqlObject
  EntityRelationshipDAO3 relationshipDAO();

  @CreateSqlObject
  FieldRelationshipDAO3 fieldRelationshipDAO();

  @CreateSqlObject
  EntityExtensionDAO3 entityExtensionDAO();

  @CreateSqlObject
  UserDAO3 userDAO();

  @CreateSqlObject
  TeamDAO3 teamDAO();

  @CreateSqlObject
  TagDAO3 tagDAO();

  @CreateSqlObject
  TableDAO3 tableDAO();

  @CreateSqlObject
  UsageDAO3 usageDAO();

  @CreateSqlObject
  MetricsDAO3 metricsDAO();

  @CreateSqlObject
  TaskDAO3 taskDAO();

  @CreateSqlObject
  ChartDAO3 chartDAO();

  @CreateSqlObject
  PipelineDAO3 pipelineDAO();

  @CreateSqlObject
  DashboardDAO3 dashboardDAO();

  @CreateSqlObject
  ReportDAO3 reportDAO();

  @CreateSqlObject
  TopicDAO3 topicDAO();

  @CreateSqlObject
  ModelDAO3 modelDAO();

  @CreateSqlObject
  BotsDAO3 botsDAO();

  @CreateSqlObject
  DatabaseServiceDAO3 dbServiceDAO();

  @CreateSqlObject
  PipelineServiceDAO3 pipelineServiceDAO();

  @CreateSqlObject
  DashboardServiceDAO3 dashboardServiceDAO();

  @CreateSqlObject
  MessagingServiceDAO3 messagingServiceDAO();

  @CreateSqlObject
  FeedDAO3 feedDAO();
}
