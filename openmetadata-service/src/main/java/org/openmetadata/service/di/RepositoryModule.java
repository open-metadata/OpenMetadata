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
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.AIApplicationRepository;
import org.openmetadata.service.jdbi3.AIGovernancePolicyRepository;
import org.openmetadata.service.jdbi3.APICollectionRepository;
import org.openmetadata.service.jdbi3.APIEndpointRepository;
import org.openmetadata.service.jdbi3.ChartRepository;
import org.openmetadata.service.jdbi3.ClassificationRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ContainerRepository;
import org.openmetadata.service.jdbi3.DashboardDataModelRepository;
import org.openmetadata.service.jdbi3.DashboardRepository;
import org.openmetadata.service.jdbi3.DataProductRepository;
import org.openmetadata.service.jdbi3.DatabaseRepository;
import org.openmetadata.service.jdbi3.DatabaseSchemaRepository;
import org.openmetadata.service.jdbi3.DirectoryRepository;
import org.openmetadata.service.jdbi3.DomainRepository;
import org.openmetadata.service.jdbi3.FileRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.LLMModelRepository;
import org.openmetadata.service.jdbi3.MlModelRepository;
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

/**
 * Dagger module providing entity repository instances.
 *
 * <p>This module provides singleton instances of all entity repositories used throughout the
 * application. Repositories are created using constructor injection, with dependencies (like
 * CollectionDAO) automatically provided by Dagger from the CoreModule.
 *
 * <p>As we migrate more entities to the service layer pattern, additional repository providers
 * will be added to this module.
 */
@Module
public class RepositoryModule {

  /**
   * Provides TableRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return TableRepository singleton
   */
  @Provides
  @Singleton
  public TableRepository provideTableRepository(CollectionDAO collectionDAO) {
    return new TableRepository(collectionDAO);
  }

  /**
   * Provides DatabaseRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return DatabaseRepository singleton
   */
  @Provides
  @Singleton
  public DatabaseRepository provideDatabaseRepository(CollectionDAO collectionDAO) {
    return new DatabaseRepository(collectionDAO);
  }

  /**
   * Provides DatabaseSchemaRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return DatabaseSchemaRepository singleton
   */
  @Provides
  @Singleton
  public DatabaseSchemaRepository provideDatabaseSchemaRepository(CollectionDAO collectionDAO) {
    return new DatabaseSchemaRepository(collectionDAO);
  }

  /**
   * Provides QueryRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return QueryRepository singleton
   */
  @Provides
  @Singleton
  public QueryRepository provideQueryRepository(CollectionDAO collectionDAO) {
    return new QueryRepository(collectionDAO);
  }

  /**
   * Provides StoredProcedureRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return StoredProcedureRepository singleton
   */
  @Provides
  @Singleton
  public StoredProcedureRepository provideStoredProcedureRepository(CollectionDAO collectionDAO) {
    return new StoredProcedureRepository(collectionDAO);
  }

  /**
   * Provides DashboardRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return DashboardRepository singleton
   */
  @Provides
  @Singleton
  public DashboardRepository provideDashboardRepository(CollectionDAO collectionDAO) {
    return new DashboardRepository(collectionDAO);
  }

  /**
   * Provides ChartRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return ChartRepository singleton
   */
  @Provides
  @Singleton
  public ChartRepository provideChartRepository(CollectionDAO collectionDAO) {
    return new ChartRepository(collectionDAO);
  }

  /**
   * Provides DashboardDataModelRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return DashboardDataModelRepository singleton
   */
  @Provides
  @Singleton
  public DashboardDataModelRepository provideDashboardDataModelRepository(
      CollectionDAO collectionDAO) {
    return new DashboardDataModelRepository(collectionDAO);
  }

  /**
   * Provides PipelineRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return PipelineRepository singleton
   */
  @Provides
  @Singleton
  public PipelineRepository providePipelineRepository(CollectionDAO collectionDAO) {
    return new PipelineRepository(collectionDAO);
  }

  /**
   * Provides IngestionPipelineRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides CollectionDAO and OpenMetadataApplicationConfig dependencies
   * from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @param config OpenMetadataApplicationConfig for application configuration (injected by Dagger)
   * @return IngestionPipelineRepository singleton
   */
  @Provides
  @Singleton
  public IngestionPipelineRepository provideIngestionPipelineRepository(
      CollectionDAO collectionDAO, OpenMetadataApplicationConfig config) {
    return new IngestionPipelineRepository(collectionDAO, config);
  }

  /**
   * Provides MlModelRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return MlModelRepository singleton
   */
  @Provides
  @Singleton
  public MlModelRepository provideMlModelRepository(CollectionDAO collectionDAO) {
    return new MlModelRepository(collectionDAO);
  }

  /**
   * Provides LLMModelRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return LLMModelRepository singleton
   */
  @Provides
  @Singleton
  public LLMModelRepository provideLLMModelRepository(CollectionDAO collectionDAO) {
    return new LLMModelRepository(collectionDAO);
  }

  /**
   * Provides TopicRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return TopicRepository singleton
   */
  @Provides
  @Singleton
  public TopicRepository provideTopicRepository(CollectionDAO collectionDAO) {
    return new TopicRepository(collectionDAO);
  }

  /**
   * Provides SearchIndexRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return SearchIndexRepository singleton
   */
  @Provides
  @Singleton
  public SearchIndexRepository provideSearchIndexRepository(CollectionDAO collectionDAO) {
    return new SearchIndexRepository(collectionDAO);
  }

  /**
   * Provides ContainerRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return ContainerRepository singleton
   */
  @Provides
  @Singleton
  public ContainerRepository provideContainerRepository(CollectionDAO collectionDAO) {
    return new ContainerRepository(collectionDAO);
  }

  /**
   * Provides DirectoryRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return DirectoryRepository singleton
   */
  @Provides
  @Singleton
  public DirectoryRepository provideDirectoryRepository(CollectionDAO collectionDAO) {
    return new DirectoryRepository(collectionDAO);
  }

  /**
   * Provides FileRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return FileRepository singleton
   */
  @Provides
  @Singleton
  public FileRepository provideFileRepository(CollectionDAO collectionDAO) {
    return new FileRepository(collectionDAO);
  }

  /**
   * Provides SpreadsheetRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return SpreadsheetRepository singleton
   */
  @Provides
  @Singleton
  public SpreadsheetRepository provideSpreadsheetRepository(CollectionDAO collectionDAO) {
    return new SpreadsheetRepository(collectionDAO);
  }

  /**
   * Provides APICollectionRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return APICollectionRepository singleton
   */
  @Provides
  @Singleton
  public APICollectionRepository provideAPICollectionRepository(CollectionDAO collectionDAO) {
    return new APICollectionRepository(collectionDAO);
  }

  /**
   * Provides APIEndpointRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return APIEndpointRepository singleton
   */
  @Provides
  @Singleton
  public APIEndpointRepository provideAPIEndpointRepository(CollectionDAO collectionDAO) {
    return new APIEndpointRepository(collectionDAO);
  }

  /**
   * Provides GlossaryRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return GlossaryRepository singleton
   */
  @Provides
  @Singleton
  public GlossaryRepository provideGlossaryRepository(CollectionDAO collectionDAO) {
    return new GlossaryRepository(collectionDAO);
  }

  /**
   * Provides GlossaryTermRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return GlossaryTermRepository singleton
   */
  @Provides
  @Singleton
  public GlossaryTermRepository provideGlossaryTermRepository(CollectionDAO collectionDAO) {
    return new GlossaryTermRepository(collectionDAO);
  }

  /**
   * Provides TagRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return TagRepository singleton
   */
  @Provides
  @Singleton
  public TagRepository provideTagRepository(CollectionDAO collectionDAO) {
    return new TagRepository(collectionDAO);
  }

  /**
   * Provides ClassificationRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return ClassificationRepository singleton
   */
  @Provides
  @Singleton
  public ClassificationRepository provideClassificationRepository(CollectionDAO collectionDAO) {
    return new ClassificationRepository(collectionDAO);
  }

  /**
   * Provides PolicyRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return PolicyRepository singleton
   */
  @Provides
  @Singleton
  public PolicyRepository providePolicyRepository(CollectionDAO collectionDAO) {
    return new PolicyRepository(collectionDAO);
  }

  /**
   * Provides RoleRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return RoleRepository singleton
   */
  @Provides
  @Singleton
  public RoleRepository provideRoleRepository(CollectionDAO collectionDAO) {
    return new RoleRepository(collectionDAO);
  }

  /**
   * Provides TestDefinitionRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return TestDefinitionRepository singleton
   */
  @Provides
  @Singleton
  public TestDefinitionRepository provideTestDefinitionRepository(CollectionDAO collectionDAO) {
    return new TestDefinitionRepository(collectionDAO);
  }

  /**
   * Provides TestSuiteRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return TestSuiteRepository singleton
   */
  @Provides
  @Singleton
  public TestSuiteRepository provideTestSuiteRepository(CollectionDAO collectionDAO) {
    return new TestSuiteRepository(collectionDAO);
  }

  /**
   * Provides TestCaseRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return TestCaseRepository singleton
   */
  @Provides
  @Singleton
  public TestCaseRepository provideTestCaseRepository(CollectionDAO collectionDAO) {
    return new TestCaseRepository(collectionDAO);
  }

  /**
   * Provides TestConnectionDefinitionRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return TestConnectionDefinitionRepository singleton
   */
  @Provides
  @Singleton
  public TestConnectionDefinitionRepository provideTestConnectionDefinitionRepository(
      CollectionDAO collectionDAO) {
    return new TestConnectionDefinitionRepository(collectionDAO);
  }

  /**
   * Provides AIApplicationRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return AIApplicationRepository singleton
   */
  @Provides
  @Singleton
  public AIApplicationRepository provideAIApplicationRepository(CollectionDAO collectionDAO) {
    return new AIApplicationRepository(collectionDAO);
  }

  /**
   * Provides AIGovernancePolicyRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return AIGovernancePolicyRepository singleton
   */
  @Provides
  @Singleton
  public AIGovernancePolicyRepository provideAIGovernancePolicyRepository(
      CollectionDAO collectionDAO) {
    return new AIGovernancePolicyRepository(collectionDAO);
  }

  /**
   * Provides PromptTemplateRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return PromptTemplateRepository singleton
   */
  @Provides
  @Singleton
  public PromptTemplateRepository providePromptTemplateRepository(CollectionDAO collectionDAO) {
    return new PromptTemplateRepository(collectionDAO);
  }

  /**
   * Provides TeamRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return TeamRepository singleton
   */
  @Provides
  @Singleton
  public TeamRepository provideTeamRepository(CollectionDAO collectionDAO) {
    return new TeamRepository(collectionDAO);
  }

  /**
   * Provides PersonaRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return PersonaRepository singleton
   */
  @Provides
  @Singleton
  public PersonaRepository providePersonaRepository(CollectionDAO collectionDAO) {
    return new PersonaRepository(collectionDAO);
  }

  /**
   * Provides UserRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return UserRepository singleton
   */
  @Provides
  @Singleton
  public UserRepository provideUserRepository(CollectionDAO collectionDAO) {
    return new UserRepository(collectionDAO);
  }

  /**
   * Provides DomainRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return DomainRepository singleton
   */
  @Provides
  @Singleton
  public DomainRepository provideDomainRepository(CollectionDAO collectionDAO) {
    return new DomainRepository(collectionDAO);
  }

  /**
   * Provides DataProductRepository instance with dependency injection.
   *
   * <p>Dagger automatically provides the CollectionDAO dependency from CoreModule.
   *
   * @param collectionDAO CollectionDAO for entity data access (injected by Dagger)
   * @return DataProductRepository singleton
   */
  @Provides
  @Singleton
  public DataProductRepository provideDataProductRepository(CollectionDAO collectionDAO) {
    return new DataProductRepository(collectionDAO);
  }

  // Additional repository providers will be added here as we migrate entities
}
