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

import dagger.Module;
import dagger.Provides;
import javax.inject.Singleton;
import org.openmetadata.service.jdbi3.AIApplicationRepository;
import org.openmetadata.service.jdbi3.AIGovernancePolicyRepository;
import org.openmetadata.service.jdbi3.APICollectionRepository;
import org.openmetadata.service.jdbi3.APIEndpointRepository;
import org.openmetadata.service.jdbi3.AppMarketPlaceRepository;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.BotRepository;
import org.openmetadata.service.jdbi3.ChartRepository;
import org.openmetadata.service.jdbi3.ClassificationRepository;
import org.openmetadata.service.jdbi3.ContainerRepository;
import org.openmetadata.service.jdbi3.DashboardDataModelRepository;
import org.openmetadata.service.jdbi3.DashboardRepository;
import org.openmetadata.service.jdbi3.DataContractRepository;
import org.openmetadata.service.jdbi3.DataInsightChartRepository;
import org.openmetadata.service.jdbi3.DataProductRepository;
import org.openmetadata.service.jdbi3.DatabaseRepository;
import org.openmetadata.service.jdbi3.DatabaseSchemaRepository;
import org.openmetadata.service.jdbi3.DirectoryRepository;
import org.openmetadata.service.jdbi3.DomainRepository;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.jdbi3.FileRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.KpiRepository;
import org.openmetadata.service.jdbi3.LLMModelRepository;
import org.openmetadata.service.jdbi3.MetricRepository;
import org.openmetadata.service.jdbi3.MlModelRepository;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;
import org.openmetadata.service.jdbi3.PersonaRepository;
import org.openmetadata.service.jdbi3.PipelineRepository;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.PromptTemplateRepository;
import org.openmetadata.service.jdbi3.QueryRepository;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.SearchIndexRepository;
import org.openmetadata.service.jdbi3.SpreadsheetRepository;
import org.openmetadata.service.jdbi3.StoredProcedureRepository;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.jdbi3.TagRepository;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.jdbi3.TestConnectionDefinitionRepository;
import org.openmetadata.service.jdbi3.TestDefinitionRepository;
import org.openmetadata.service.jdbi3.TestSuiteRepository;
import org.openmetadata.service.jdbi3.TopicRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.jdbi3.WorkflowRepository;
import org.openmetadata.service.resources.ai.AIApplicationMapper;
import org.openmetadata.service.resources.ai.AIGovernancePolicyMapper;
import org.openmetadata.service.resources.ai.LLMModelMapper;
import org.openmetadata.service.resources.ai.PromptTemplateMapper;
import org.openmetadata.service.resources.apis.APICollectionMapper;
import org.openmetadata.service.resources.apis.APIEndpointMapper;
import org.openmetadata.service.resources.apps.AppMapper;
import org.openmetadata.service.resources.apps.AppMarketPlaceMapper;
import org.openmetadata.service.resources.automations.WorkflowMapper;
import org.openmetadata.service.resources.bots.BotMapper;
import org.openmetadata.service.resources.charts.ChartMapper;
import org.openmetadata.service.resources.dashboards.DashboardMapper;
import org.openmetadata.service.resources.data.DataContractMapper;
import org.openmetadata.service.resources.databases.DatabaseMapper;
import org.openmetadata.service.resources.databases.DatabaseSchemaMapper;
import org.openmetadata.service.resources.databases.StoredProcedureMapper;
import org.openmetadata.service.resources.databases.TableMapper;
import org.openmetadata.service.resources.datainsight.DataInsightChartMapper;
import org.openmetadata.service.resources.datamodels.DashboardDataModelMapper;
import org.openmetadata.service.resources.domains.DataProductMapper;
import org.openmetadata.service.resources.domains.DomainMapper;
import org.openmetadata.service.resources.dqtests.TestCaseMapper;
import org.openmetadata.service.resources.dqtests.TestDefinitionMapper;
import org.openmetadata.service.resources.dqtests.TestSuiteMapper;
import org.openmetadata.service.resources.drives.DirectoryMapper;
import org.openmetadata.service.resources.drives.FileMapper;
import org.openmetadata.service.resources.drives.SpreadsheetMapper;
import org.openmetadata.service.resources.events.NotificationTemplateMapper;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionMapper;
import org.openmetadata.service.resources.glossary.GlossaryMapper;
import org.openmetadata.service.resources.glossary.GlossaryTermMapper;
import org.openmetadata.service.resources.kpi.KpiMapper;
import org.openmetadata.service.resources.metrics.MetricMapper;
import org.openmetadata.service.resources.mlmodels.MlModelMapper;
import org.openmetadata.service.resources.pipelines.PipelineMapper;
import org.openmetadata.service.resources.policies.PolicyMapper;
import org.openmetadata.service.resources.query.QueryMapper;
import org.openmetadata.service.resources.searchindex.SearchIndexMapper;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineMapper;
import org.openmetadata.service.resources.storages.ContainerMapper;
import org.openmetadata.service.resources.tags.ClassificationMapper;
import org.openmetadata.service.resources.tags.TagMapper;
import org.openmetadata.service.resources.teams.PersonaMapper;
import org.openmetadata.service.resources.teams.RoleMapper;
import org.openmetadata.service.resources.teams.TeamMapper;
import org.openmetadata.service.resources.teams.UserMapper;
import org.openmetadata.service.resources.topics.TopicMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
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
 * Dagger module providing entity service instances.
 *
 * <p>This module provides singleton instances of all entity services. Services contain business
 * logic and coordinate between repositories and other components like search and authorization.
 *
 * <p>Each service is provided as a singleton with its dependencies (repositories, search,
 * authorizer) automatically injected by Dagger.
 *
 * <p>As we migrate more entities to the service layer pattern, additional service providers will
 * be added to this module.
 */
@Module
public class ServiceModule {

  /**
   * Provides TableService instance.
   *
   * @param tableRepository TableRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param tableMapper TableMapper for entity mapping
   * @return TableService singleton
   */
  @Provides
  @Singleton
  public TableService provideTableService(
      TableRepository tableRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      TableMapper tableMapper) {
    return new TableService(tableRepository, searchRepository, authorizer, tableMapper);
  }

  /**
   * Provides DatabaseService instance.
   *
   * @param databaseRepository DatabaseRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param databaseMapper DatabaseMapper for entity mapping
   * @return DatabaseService singleton
   */
  @Provides
  @Singleton
  public DatabaseService provideDatabaseService(
      DatabaseRepository databaseRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      DatabaseMapper databaseMapper) {
    return new DatabaseService(databaseRepository, searchRepository, authorizer, databaseMapper);
  }

  /**
   * Provides DatabaseSchemaService instance.
   *
   * @param databaseSchemaRepository DatabaseSchemaRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param databaseSchemaMapper DatabaseSchemaMapper for entity mapping
   * @return DatabaseSchemaService singleton
   */
  @Provides
  @Singleton
  public DatabaseSchemaService provideDatabaseSchemaService(
      DatabaseSchemaRepository databaseSchemaRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      DatabaseSchemaMapper databaseSchemaMapper) {
    return new DatabaseSchemaService(
        databaseSchemaRepository, searchRepository, authorizer, databaseSchemaMapper);
  }

  /**
   * Provides QueryService instance.
   *
   * @param queryRepository QueryRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param queryMapper QueryMapper for entity mapping
   * @return QueryService singleton
   */
  @Provides
  @Singleton
  public QueryService provideQueryService(
      QueryRepository queryRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      QueryMapper queryMapper) {
    return new QueryService(queryRepository, searchRepository, authorizer, queryMapper);
  }

  /**
   * Provides StoredProcedureService instance.
   *
   * @param storedProcedureRepository StoredProcedureRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param storedProcedureMapper StoredProcedureMapper for entity mapping
   * @return StoredProcedureService singleton
   */
  @Provides
  @Singleton
  public StoredProcedureService provideStoredProcedureService(
      StoredProcedureRepository storedProcedureRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      StoredProcedureMapper storedProcedureMapper) {
    return new StoredProcedureService(
        storedProcedureRepository, searchRepository, authorizer, storedProcedureMapper);
  }

  /**
   * Provides DashboardService instance.
   *
   * @param dashboardRepository DashboardRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param dashboardMapper DashboardMapper for entity mapping
   * @return DashboardService singleton
   */
  @Provides
  @Singleton
  public DashboardService provideDashboardService(
      DashboardRepository dashboardRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      DashboardMapper dashboardMapper) {
    return new DashboardService(dashboardRepository, searchRepository, authorizer, dashboardMapper);
  }

  /**
   * Provides ChartService instance.
   *
   * @param chartRepository ChartRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param chartMapper ChartMapper for entity mapping
   * @return ChartService singleton
   */
  @Provides
  @Singleton
  public ChartService provideChartService(
      ChartRepository chartRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      ChartMapper chartMapper) {
    return new ChartService(chartRepository, searchRepository, authorizer, chartMapper);
  }

  /**
   * Provides DashboardDataModelService instance.
   *
   * @param dashboardDataModelRepository DashboardDataModelRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param dashboardDataModelMapper DashboardDataModelMapper for entity mapping
   * @return DashboardDataModelService singleton
   */
  @Provides
  @Singleton
  public DashboardDataModelService provideDashboardDataModelService(
      DashboardDataModelRepository dashboardDataModelRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      DashboardDataModelMapper dashboardDataModelMapper) {
    return new DashboardDataModelService(
        dashboardDataModelRepository, searchRepository, authorizer, dashboardDataModelMapper);
  }

  /**
   * Provides PipelineService instance.
   *
   * @param pipelineRepository PipelineRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param pipelineMapper PipelineMapper for entity mapping
   * @return PipelineService singleton
   */
  @Provides
  @Singleton
  public PipelineService providePipelineService(
      PipelineRepository pipelineRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      PipelineMapper pipelineMapper) {
    return new PipelineService(pipelineRepository, searchRepository, authorizer, pipelineMapper);
  }

  /**
   * Provides IngestionPipelineService instance.
   *
   * @param ingestionPipelineRepository IngestionPipelineRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param ingestionPipelineMapper IngestionPipelineMapper for entity mapping
   * @return IngestionPipelineService singleton
   */
  @Provides
  @Singleton
  public IngestionPipelineService provideIngestionPipelineService(
      IngestionPipelineRepository ingestionPipelineRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      IngestionPipelineMapper ingestionPipelineMapper) {
    return new IngestionPipelineService(
        ingestionPipelineRepository, searchRepository, authorizer, ingestionPipelineMapper);
  }

  /**
   * Provides MlModelService instance.
   *
   * @param mlModelRepository MlModelRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param mlModelMapper MlModelMapper for entity mapping
   * @return MlModelService singleton
   */
  @Provides
  @Singleton
  public MlModelService provideMlModelService(
      MlModelRepository mlModelRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      MlModelMapper mlModelMapper) {
    return new MlModelService(mlModelRepository, searchRepository, authorizer, mlModelMapper);
  }

  /**
   * Provides LLMModelService instance.
   *
   * @param llmModelRepository LLMModelRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param llmModelMapper LLMModelMapper for entity mapping
   * @return LLMModelService singleton
   */
  @Provides
  @Singleton
  public LLMModelService provideLLMModelService(
      LLMModelRepository llmModelRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      LLMModelMapper llmModelMapper) {
    return new LLMModelService(llmModelRepository, searchRepository, authorizer, llmModelMapper);
  }

  /**
   * Provides TopicService instance.
   *
   * @param topicRepository TopicRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param topicMapper TopicMapper for entity mapping
   * @return TopicService singleton
   */
  @Provides
  @Singleton
  public TopicService provideTopicService(
      TopicRepository topicRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      TopicMapper topicMapper) {
    return new TopicService(topicRepository, searchRepository, authorizer, topicMapper);
  }

  /**
   * Provides SearchIndexService instance.
   *
   * @param searchIndexRepository SearchIndexRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param searchIndexMapper SearchIndexMapper for entity mapping
   * @return SearchIndexService singleton
   */
  @Provides
  @Singleton
  public SearchIndexService provideSearchIndexService(
      SearchIndexRepository searchIndexRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      SearchIndexMapper searchIndexMapper) {
    return new SearchIndexService(
        searchIndexRepository, searchRepository, authorizer, searchIndexMapper);
  }

  /**
   * Provides ContainerService instance.
   *
   * @param containerRepository ContainerRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param containerMapper ContainerMapper for entity mapping
   * @return ContainerService singleton
   */
  @Provides
  @Singleton
  public ContainerService provideContainerService(
      ContainerRepository containerRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      ContainerMapper containerMapper) {
    return new ContainerService(containerRepository, searchRepository, authorizer, containerMapper);
  }

  /**
   * Provides DirectoryService instance.
   *
   * @param directoryRepository DirectoryRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param directoryMapper DirectoryMapper for entity mapping
   * @return DirectoryService singleton
   */
  @Provides
  @Singleton
  public DirectoryService provideDirectoryService(
      DirectoryRepository directoryRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      DirectoryMapper directoryMapper) {
    return new DirectoryService(directoryRepository, searchRepository, authorizer, directoryMapper);
  }

  /**
   * Provides FileService instance.
   *
   * @param fileRepository FileRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param fileMapper FileMapper for entity mapping
   * @return FileService singleton
   */
  @Provides
  @Singleton
  public FileService provideFileService(
      FileRepository fileRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      FileMapper fileMapper) {
    return new FileService(fileRepository, searchRepository, authorizer, fileMapper);
  }

  /**
   * Provides SpreadsheetService instance.
   *
   * @param spreadsheetRepository SpreadsheetRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param spreadsheetMapper SpreadsheetMapper for entity mapping
   * @return SpreadsheetService singleton
   */
  @Provides
  @Singleton
  public SpreadsheetService provideSpreadsheetService(
      SpreadsheetRepository spreadsheetRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      SpreadsheetMapper spreadsheetMapper) {
    return new SpreadsheetService(
        spreadsheetRepository, searchRepository, authorizer, spreadsheetMapper);
  }

  /**
   * Provides APICollectionService instance.
   *
   * @param apiCollectionRepository APICollectionRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param apiCollectionMapper APICollectionMapper for entity mapping
   * @return APICollectionService singleton
   */
  @Provides
  @Singleton
  public APICollectionService provideAPICollectionService(
      APICollectionRepository apiCollectionRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      APICollectionMapper apiCollectionMapper) {
    return new APICollectionService(
        apiCollectionRepository, searchRepository, authorizer, apiCollectionMapper);
  }

  /**
   * Provides APIEndpointService instance.
   *
   * @param apiEndpointRepository APIEndpointRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param apiEndpointMapper APIEndpointMapper for entity mapping
   * @return APIEndpointService singleton
   */
  @Provides
  @Singleton
  public APIEndpointService provideAPIEndpointService(
      APIEndpointRepository apiEndpointRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      APIEndpointMapper apiEndpointMapper) {
    return new APIEndpointService(
        apiEndpointRepository, searchRepository, authorizer, apiEndpointMapper);
  }

  /**
   * Provides GlossaryService instance.
   *
   * @param glossaryRepository GlossaryRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param glossaryMapper GlossaryMapper for entity mapping
   * @return GlossaryService singleton
   */
  @Provides
  @Singleton
  public GlossaryService provideGlossaryService(
      GlossaryRepository glossaryRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      GlossaryMapper glossaryMapper) {
    return new GlossaryService(glossaryRepository, searchRepository, authorizer, glossaryMapper);
  }

  /**
   * Provides GlossaryTermService instance.
   *
   * @param glossaryTermRepository GlossaryTermRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param glossaryTermMapper GlossaryTermMapper for entity mapping
   * @return GlossaryTermService singleton
   */
  @Provides
  @Singleton
  public GlossaryTermService provideGlossaryTermService(
      GlossaryTermRepository glossaryTermRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      GlossaryTermMapper glossaryTermMapper) {
    return new GlossaryTermService(
        glossaryTermRepository, searchRepository, authorizer, glossaryTermMapper);
  }

  /**
   * Provides TagService instance.
   *
   * @param tagRepository TagRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param tagMapper TagMapper for entity mapping
   * @return TagService singleton
   */
  @Provides
  @Singleton
  public TagService provideTagService(
      TagRepository tagRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      TagMapper tagMapper) {
    return new TagService(tagRepository, searchRepository, authorizer, tagMapper);
  }

  /**
   * Provides ClassificationService instance.
   *
   * @param classificationRepository ClassificationRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param classificationMapper ClassificationMapper for entity mapping
   * @return ClassificationService singleton
   */
  @Provides
  @Singleton
  public ClassificationService provideClassificationService(
      ClassificationRepository classificationRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      ClassificationMapper classificationMapper) {
    return new ClassificationService(
        classificationRepository, searchRepository, authorizer, classificationMapper);
  }

  /**
   * Provides PolicyService instance.
   *
   * @param policyRepository PolicyRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param policyMapper PolicyMapper for entity mapping
   * @return PolicyService singleton
   */
  @Provides
  @Singleton
  public PolicyService providePolicyService(
      PolicyRepository policyRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      PolicyMapper policyMapper) {
    return new PolicyService(policyRepository, searchRepository, authorizer, policyMapper);
  }

  /**
   * Provides RoleService instance.
   *
   * @param roleRepository RoleRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param roleMapper RoleMapper for entity mapping
   * @return RoleService singleton
   */
  @Provides
  @Singleton
  public RoleService provideRoleService(
      RoleRepository roleRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      RoleMapper roleMapper) {
    return new RoleService(roleRepository, searchRepository, authorizer, roleMapper);
  }

  /**
   * Provides TestDefinitionService instance.
   *
   * @param testDefinitionRepository TestDefinitionRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param testDefinitionMapper TestDefinitionMapper for entity mapping
   * @return TestDefinitionService singleton
   */
  @Provides
  @Singleton
  public TestDefinitionService provideTestDefinitionService(
      TestDefinitionRepository testDefinitionRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      TestDefinitionMapper testDefinitionMapper) {
    return new TestDefinitionService(
        testDefinitionRepository, searchRepository, authorizer, testDefinitionMapper);
  }

  /**
   * Provides TestSuiteService instance.
   *
   * @param testSuiteRepository TestSuiteRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param testSuiteMapper TestSuiteMapper for entity mapping
   * @return TestSuiteService singleton
   */
  @Provides
  @Singleton
  public TestSuiteService provideTestSuiteService(
      TestSuiteRepository testSuiteRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      TestSuiteMapper testSuiteMapper) {
    return new TestSuiteService(testSuiteRepository, searchRepository, authorizer, testSuiteMapper);
  }

  /**
   * Provides TestCaseService instance.
   *
   * @param testCaseRepository TestCaseRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param testCaseMapper TestCaseMapper for entity mapping
   * @return TestCaseService singleton
   */
  @Provides
  @Singleton
  public TestCaseService provideTestCaseService(
      TestCaseRepository testCaseRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      TestCaseMapper testCaseMapper) {
    return new TestCaseService(testCaseRepository, searchRepository, authorizer, testCaseMapper);
  }

  /**
   * Provides TestConnectionDefinitionService instance.
   *
   * <p>Note: TestConnectionDefinition is a read-only entity without a mapper.
   *
   * @param testConnectionDefinitionRepository TestConnectionDefinitionRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @return TestConnectionDefinitionService singleton
   */
  @Provides
  @Singleton
  public TestConnectionDefinitionService provideTestConnectionDefinitionService(
      TestConnectionDefinitionRepository testConnectionDefinitionRepository,
      SearchRepository searchRepository,
      Authorizer authorizer) {
    return new TestConnectionDefinitionService(
        testConnectionDefinitionRepository, searchRepository, authorizer);
  }

  /**
   * Provides AIApplicationService instance.
   *
   * @param aiApplicationRepository AIApplicationRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param aiApplicationMapper AIApplicationMapper for entity mapping
   * @return AIApplicationService singleton
   */
  @Provides
  @Singleton
  public AIApplicationService provideAIApplicationService(
      AIApplicationRepository aiApplicationRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      AIApplicationMapper aiApplicationMapper) {
    return new AIApplicationService(
        aiApplicationRepository, searchRepository, authorizer, aiApplicationMapper);
  }

  /**
   * Provides AIGovernancePolicyService instance.
   *
   * @param aiGovernancePolicyRepository AIGovernancePolicyRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param aiGovernancePolicyMapper AIGovernancePolicyMapper for entity mapping
   * @return AIGovernancePolicyService singleton
   */
  @Provides
  @Singleton
  public AIGovernancePolicyService provideAIGovernancePolicyService(
      AIGovernancePolicyRepository aiGovernancePolicyRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      AIGovernancePolicyMapper aiGovernancePolicyMapper) {
    return new AIGovernancePolicyService(
        aiGovernancePolicyRepository, searchRepository, authorizer, aiGovernancePolicyMapper);
  }

  /**
   * Provides PromptTemplateService instance.
   *
   * @param promptTemplateRepository PromptTemplateRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param promptTemplateMapper PromptTemplateMapper for entity mapping
   * @return PromptTemplateService singleton
   */
  @Provides
  @Singleton
  public PromptTemplateService providePromptTemplateService(
      PromptTemplateRepository promptTemplateRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      PromptTemplateMapper promptTemplateMapper) {
    return new PromptTemplateService(
        promptTemplateRepository, searchRepository, authorizer, promptTemplateMapper);
  }

  /**
   * Provides TeamService instance.
   *
   * @param teamRepository TeamRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param teamMapper TeamMapper for entity mapping
   * @return TeamService singleton
   */
  @Provides
  @Singleton
  public TeamService provideTeamService(
      TeamRepository teamRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      TeamMapper teamMapper) {
    return new TeamService(teamRepository, searchRepository, authorizer, teamMapper);
  }

  /**
   * Provides PersonaService instance.
   *
   * @param personaRepository PersonaRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param personaMapper PersonaMapper for entity mapping
   * @return PersonaService singleton
   */
  @Provides
  @Singleton
  public PersonaService providePersonaService(
      PersonaRepository personaRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      PersonaMapper personaMapper) {
    return new PersonaService(personaRepository, searchRepository, authorizer, personaMapper);
  }

  /**
   * Provides UserService instance.
   *
   * @param userRepository UserRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param userMapper UserMapper for entity mapping
   * @return UserService singleton
   */
  @Provides
  @Singleton
  public UserService provideUserService(
      UserRepository userRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      UserMapper userMapper) {
    return new UserService(userRepository, searchRepository, authorizer, userMapper);
  }

  /**
   * Provides DomainService instance.
   *
   * @param domainRepository DomainRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param domainMapper DomainMapper for entity mapping
   * @return DomainService singleton
   */
  @Provides
  @Singleton
  public DomainService provideDomainService(
      DomainRepository domainRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      DomainMapper domainMapper) {
    return new DomainService(domainRepository, searchRepository, authorizer, domainMapper);
  }

  /**
   * Provides DataProductService instance.
   *
   * @param dataProductRepository DataProductRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param dataProductMapper DataProductMapper for entity mapping
   * @return DataProductService singleton
   */
  @Provides
  @Singleton
  public DataProductService provideDataProductService(
      DataProductRepository dataProductRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      DataProductMapper dataProductMapper) {
    return new DataProductService(
        dataProductRepository, searchRepository, authorizer, dataProductMapper);
  }

  /**
   * Provides AppService instance.
   *
   * @param appRepository AppRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param appMapper AppMapper for entity mapping
   * @return AppService singleton
   */
  @Provides
  @Singleton
  public AppService provideAppService(
      AppRepository appRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      AppMapper appMapper) {
    return new AppService(appRepository, searchRepository, authorizer, appMapper);
  }

  /**
   * Provides AppMarketPlaceService instance.
   *
   * @param appMarketPlaceRepository AppMarketPlaceRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param appMarketPlaceMapper AppMarketPlaceMapper for entity mapping
   * @return AppMarketPlaceService singleton
   */
  @Provides
  @Singleton
  public AppMarketPlaceService provideAppMarketPlaceService(
      AppMarketPlaceRepository appMarketPlaceRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      AppMarketPlaceMapper appMarketPlaceMapper) {
    return new AppMarketPlaceService(
        appMarketPlaceRepository, searchRepository, authorizer, appMarketPlaceMapper);
  }

  /**
   * Provides BotService instance.
   *
   * @param botRepository BotRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param botMapper BotMapper for entity mapping
   * @return BotService singleton
   */
  @Provides
  @Singleton
  public BotService provideBotService(
      BotRepository botRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      BotMapper botMapper) {
    return new BotService(botRepository, searchRepository, authorizer, botMapper);
  }

  /**
   * Provides DataContractService instance.
   *
   * @param dataContractRepository DataContractRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param dataContractMapper DataContractMapper for entity mapping
   * @return DataContractService singleton
   */
  @Provides
  @Singleton
  public DataContractService provideDataContractService(
      DataContractRepository dataContractRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      DataContractMapper dataContractMapper) {
    return new DataContractService(
        dataContractRepository, searchRepository, authorizer, dataContractMapper);
  }

  /**
   * Provides MetricService instance.
   *
   * @param metricRepository MetricRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param metricMapper MetricMapper for entity mapping
   * @return MetricService singleton
   */
  @Provides
  @Singleton
  public MetricService provideMetricService(
      MetricRepository metricRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      MetricMapper metricMapper) {
    return new MetricService(metricRepository, searchRepository, authorizer, metricMapper);
  }

  /**
   * Provides DataInsightChartService instance.
   *
   * @param dataInsightChartRepository DataInsightChartRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param dataInsightChartMapper DataInsightChartMapper for entity mapping
   * @return DataInsightChartService singleton
   */
  @Provides
  @Singleton
  public DataInsightChartService provideDataInsightChartService(
      DataInsightChartRepository dataInsightChartRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      DataInsightChartMapper dataInsightChartMapper) {
    return new DataInsightChartService(
        dataInsightChartRepository, searchRepository, authorizer, dataInsightChartMapper);
  }

  /**
   * Provides KpiService instance.
   *
   * @param kpiRepository KpiRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param kpiMapper KpiMapper for entity mapping
   * @return KpiService singleton
   */
  @Provides
  @Singleton
  public KpiService provideKpiService(
      KpiRepository kpiRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      KpiMapper kpiMapper) {
    return new KpiService(kpiRepository, searchRepository, authorizer, kpiMapper);
  }

  /**
   * Provides EventSubscriptionService instance.
   *
   * @param eventSubscriptionRepository EventSubscriptionRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param eventSubscriptionMapper EventSubscriptionMapper for entity mapping
   * @return EventSubscriptionService singleton
   */
  @Provides
  @Singleton
  public EventSubscriptionService provideEventSubscriptionService(
      EventSubscriptionRepository eventSubscriptionRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      EventSubscriptionMapper eventSubscriptionMapper) {
    return new EventSubscriptionService(
        eventSubscriptionRepository, searchRepository, authorizer, eventSubscriptionMapper);
  }

  /**
   * Provides NotificationTemplateService instance.
   *
   * @param notificationTemplateRepository NotificationTemplateRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param notificationTemplateMapper NotificationTemplateMapper for entity mapping
   * @return NotificationTemplateService singleton
   */
  @Provides
  @Singleton
  public NotificationTemplateService provideNotificationTemplateService(
      NotificationTemplateRepository notificationTemplateRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      NotificationTemplateMapper notificationTemplateMapper) {
    return new NotificationTemplateService(
        notificationTemplateRepository, searchRepository, authorizer, notificationTemplateMapper);
  }

  /**
   * Provides WorkflowService instance.
   *
   * @param workflowRepository WorkflowRepository for data access
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param workflowMapper WorkflowMapper for entity mapping
   * @return WorkflowService singleton
   */
  @Provides
  @Singleton
  public WorkflowService provideWorkflowService(
      WorkflowRepository workflowRepository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      WorkflowMapper workflowMapper) {
    return new WorkflowService(workflowRepository, searchRepository, authorizer, workflowMapper);
  }

  // Additional service providers will be added here as we migrate entities
}
