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

package org.openmetadata.service.di;

import dagger.Component;
import java.util.Set;
import javax.inject.Singleton;
import org.openmetadata.service.di.providers.ApplicationInitializer;
import org.openmetadata.service.di.providers.ConfigurationInitializer;
import org.openmetadata.service.di.providers.FilterRegistrar;
import org.openmetadata.service.di.providers.JerseyRegistrar;
import org.openmetadata.service.di.providers.MCPServerFactory;
import org.openmetadata.service.di.providers.SecurityInitializer;
import org.openmetadata.service.services.ai.AIApplicationService;
import org.openmetadata.service.services.ai.AIGovernancePolicyService;
import org.openmetadata.service.services.ai.PromptTemplateService;
import org.openmetadata.service.services.apis.APICollectionService;
import org.openmetadata.service.services.apis.APIEndpointService;
import org.openmetadata.service.services.apps.AppMarketPlaceService;
import org.openmetadata.service.services.apps.AppService;
import org.openmetadata.service.services.automations.WorkflowService;
import org.openmetadata.service.services.bots.BotService;
import org.openmetadata.service.services.connections.TestConnectionDefinitionService;
import org.openmetadata.service.services.dashboards.ChartService;
import org.openmetadata.service.services.dashboards.DashboardDataModelService;
import org.openmetadata.service.services.dashboards.DashboardService;
import org.openmetadata.service.services.data.DataContractService;
import org.openmetadata.service.services.databases.DatabaseSchemaService;
import org.openmetadata.service.services.databases.DatabaseService;
import org.openmetadata.service.services.databases.QueryService;
import org.openmetadata.service.services.databases.StoredProcedureService;
import org.openmetadata.service.services.databases.TableService;
import org.openmetadata.service.services.datainsight.DataInsightChartService;
import org.openmetadata.service.services.domains.DataProductService;
import org.openmetadata.service.services.domains.DomainService;
import org.openmetadata.service.services.dqtests.TestCaseService;
import org.openmetadata.service.services.dqtests.TestDefinitionService;
import org.openmetadata.service.services.dqtests.TestSuiteService;
import org.openmetadata.service.services.drives.DirectoryService;
import org.openmetadata.service.services.drives.FileService;
import org.openmetadata.service.services.drives.SpreadsheetService;
import org.openmetadata.service.services.events.EventSubscriptionService;
import org.openmetadata.service.services.events.NotificationTemplateService;
import org.openmetadata.service.services.glossary.GlossaryService;
import org.openmetadata.service.services.glossary.GlossaryTermService;
import org.openmetadata.service.services.kpi.KpiService;
import org.openmetadata.service.services.messaging.TopicService;
import org.openmetadata.service.services.metrics.MetricService;
import org.openmetadata.service.services.ml.LLMModelService;
import org.openmetadata.service.services.ml.MlModelService;
import org.openmetadata.service.services.pipelines.IngestionPipelineService;
import org.openmetadata.service.services.pipelines.PipelineService;
import org.openmetadata.service.services.policies.PolicyService;
import org.openmetadata.service.services.policies.RoleService;
import org.openmetadata.service.services.searchindex.SearchIndexService;
import org.openmetadata.service.services.storages.ContainerService;
import org.openmetadata.service.services.tags.ClassificationService;
import org.openmetadata.service.services.tags.TagService;
import org.openmetadata.service.services.teams.PersonaService;
import org.openmetadata.service.services.teams.TeamService;
import org.openmetadata.service.services.teams.UserService;

/**
 * Main Dagger component that wires together all modules and provides access to services.
 *
 * <p>This component is the root of the dependency injection graph. It combines:
 *
 * <ul>
 *   <li>CoreModule - provides Environment, Config
 *   <li>DatabaseModule - provides JDBI, CollectionDAO, JobDAO
 *   <li>SearchModule - provides SearchRepository
 *   <li>RepositoryModule - provides entity repositories
 *   <li>MapperModule - provides entity mappers
 *   <li>ServiceModule - provides entity services
 *   <li>ComponentsModule - provides initializers and registrars
 *   <li>OpenMetadataModule - provides OpenMetadata-specific implementations (can be overridden by
 *       Collate)
 * </ul>
 *
 * <p>The component is built during application initialization and provides access to services for
 * resources:
 *
 * <pre>{@code
 * ApplicationComponent component = DaggerApplicationComponent.builder()
 *     .coreModule(new CoreModule(environment, config, authorizer))
 *     .databaseModule(new DatabaseModule())
 *     .searchModule(new SearchModule())
 *     .componentsModule(new ComponentsModule())
 *     .openMetadataModule(new OpenMetadataModule())
 *     .build();
 *
 * TableService tableService = component.tableService();
 * }</pre>
 *
 * <p>As we migrate more entities, additional service accessor methods will be added to this
 * component.
 */
@Singleton
@Component(
    modules = {
      CoreModule.class,
      DatabaseModule.class,
      SearchModule.class,
      RepositoryModule.class,
      MapperModule.class,
      ServiceModule.class,
      ComponentsModule.class,
      OpenMetadataModule.class
    })
public interface ApplicationComponent {

  ConfigurationInitializer configurationInitializer();

  SecurityInitializer securityInitializer();

  ApplicationInitializer applicationInitializer();

  MCPServerFactory mcpServerFactory();

  Set<FilterRegistrar> filterRegistrars();

  Set<JerseyRegistrar> jerseyRegistrars();

  /**
   * Provides TableService instance.
   *
   * @return TableService singleton
   */
  TableService tableService();

  /**
   * Provides DatabaseService instance.
   *
   * @return DatabaseService singleton
   */
  DatabaseService databaseService();

  /**
   * Provides DatabaseSchemaService instance.
   *
   * @return DatabaseSchemaService singleton
   */
  DatabaseSchemaService databaseSchemaService();

  /**
   * Provides QueryService instance.
   *
   * @return QueryService singleton
   */
  QueryService queryService();

  /**
   * Provides StoredProcedureService instance.
   *
   * @return StoredProcedureService singleton
   */
  StoredProcedureService storedProcedureService();

  /**
   * Provides DashboardService instance.
   *
   * @return DashboardService singleton
   */
  DashboardService dashboardService();

  /**
   * Provides ChartService instance.
   *
   * @return ChartService singleton
   */
  ChartService chartService();

  /**
   * Provides DashboardDataModelService instance.
   *
   * @return DashboardDataModelService singleton
   */
  DashboardDataModelService dashboardDataModelService();

  /**
   * Provides PipelineService instance.
   *
   * @return PipelineService singleton
   */
  PipelineService pipelineService();

  /**
   * Provides IngestionPipelineService instance.
   *
   * @return IngestionPipelineService singleton
   */
  IngestionPipelineService ingestionPipelineService();

  /**
   * Provides MlModelService instance.
   *
   * @return MlModelService singleton
   */
  MlModelService mlModelService();

  /**
   * Provides LLMModelService instance.
   *
   * @return LLMModelService singleton
   */
  LLMModelService llmModelService();

  /**
   * Provides TopicService instance.
   *
   * @return TopicService singleton
   */
  TopicService topicService();

  /**
   * Provides SearchIndexService instance.
   *
   * @return SearchIndexService singleton
   */
  SearchIndexService searchIndexService();

  /**
   * Provides ContainerService instance.
   *
   * @return ContainerService singleton
   */
  ContainerService containerService();

  /**
   * Provides DirectoryService instance.
   *
   * @return DirectoryService singleton
   */
  DirectoryService directoryService();

  /**
   * Provides FileService instance.
   *
   * @return FileService singleton
   */
  FileService fileService();

  /**
   * Provides SpreadsheetService instance.
   *
   * @return SpreadsheetService singleton
   */
  SpreadsheetService spreadsheetService();

  /**
   * Provides APICollectionService instance.
   *
   * @return APICollectionService singleton
   */
  APICollectionService apiCollectionService();

  /**
   * Provides APIEndpointService instance.
   *
   * @return APIEndpointService singleton
   */
  APIEndpointService apiEndpointService();

  /**
   * Provides GlossaryService instance.
   *
   * @return GlossaryService singleton
   */
  GlossaryService glossaryService();

  /**
   * Provides GlossaryTermService instance.
   *
   * @return GlossaryTermService singleton
   */
  GlossaryTermService glossaryTermService();

  /**
   * Provides TagService instance.
   *
   * @return TagService singleton
   */
  TagService tagService();

  /**
   * Provides ClassificationService instance.
   *
   * @return ClassificationService singleton
   */
  ClassificationService classificationService();

  /**
   * Provides PolicyService instance.
   *
   * @return PolicyService singleton
   */
  PolicyService policyService();

  /**
   * Provides RoleService instance.
   *
   * @return RoleService singleton
   */
  RoleService roleService();

  /**
   * Provides TestDefinitionService instance.
   *
   * @return TestDefinitionService singleton
   */
  TestDefinitionService testDefinitionService();

  /**
   * Provides TestSuiteService instance.
   *
   * @return TestSuiteService singleton
   */
  TestSuiteService testSuiteService();

  /**
   * Provides TestCaseService instance.
   *
   * @return TestCaseService singleton
   */
  TestCaseService testCaseService();

  /**
   * Provides TestConnectionDefinitionService instance.
   *
   * @return TestConnectionDefinitionService singleton
   */
  TestConnectionDefinitionService testConnectionDefinitionService();

  /**
   * Provides AIApplicationService instance.
   *
   * @return AIApplicationService singleton
   */
  AIApplicationService aiApplicationService();

  /**
   * Provides AIGovernancePolicyService instance.
   *
   * @return AIGovernancePolicyService singleton
   */
  AIGovernancePolicyService aiGovernancePolicyService();

  /**
   * Provides PromptTemplateService instance.
   *
   * @return PromptTemplateService singleton
   */
  PromptTemplateService promptTemplateService();

  /**
   * Provides TeamService instance.
   *
   * @return TeamService singleton
   */
  TeamService teamService();

  /**
   * Provides PersonaService instance.
   *
   * @return PersonaService singleton
   */
  PersonaService personaService();

  /**
   * Provides UserService instance.
   *
   * @return UserService singleton
   */
  UserService userService();

  /**
   * Provides DomainService instance.
   *
   * @return DomainService singleton
   */
  DomainService domainService();

  /**
   * Provides DataProductService instance.
   *
   * @return DataProductService singleton
   */
  DataProductService dataProductService();

  /**
   * Provides AppService instance.
   *
   * @return AppService singleton
   */
  AppService appService();

  /**
   * Provides AppMarketPlaceService instance.
   *
   * @return AppMarketPlaceService singleton
   */
  AppMarketPlaceService appMarketPlaceService();

  /**
   * Provides BotService instance.
   *
   * @return BotService singleton
   */
  BotService botService();

  /**
   * Provides DataContractService instance.
   *
   * @return DataContractService singleton
   */
  DataContractService dataContractService();

  /**
   * Provides MetricService instance.
   *
   * @return MetricService singleton
   */
  MetricService metricService();

  /**
   * Provides DataInsightChartService instance.
   *
   * @return DataInsightChartService singleton
   */
  DataInsightChartService dataInsightChartService();

  /**
   * Provides KpiService instance.
   *
   * @return KpiService singleton
   */
  KpiService kpiService();

  /**
   * Provides EventSubscriptionService instance.
   *
   * @return EventSubscriptionService singleton
   */
  EventSubscriptionService eventSubscriptionService();

  /**
   * Provides NotificationTemplateService instance.
   *
   * @return NotificationTemplateService singleton
   */
  NotificationTemplateService notificationTemplateService();

  /**
   * Provides WorkflowService instance.
   *
   * @return WorkflowService singleton
   */
  WorkflowService workflowService();

  // Additional service accessors will be added here as we migrate entities
}
