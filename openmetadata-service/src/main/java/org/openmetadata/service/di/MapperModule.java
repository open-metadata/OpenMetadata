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
import org.openmetadata.service.resources.ai.AIApplicationMapper;
import org.openmetadata.service.resources.ai.AIGovernancePolicyMapper;
import org.openmetadata.service.resources.ai.LLMModelMapper;
import org.openmetadata.service.resources.ai.PromptTemplateMapper;
import org.openmetadata.service.resources.apis.APICollectionMapper;
import org.openmetadata.service.resources.apis.APIEndpointMapper;
import org.openmetadata.service.resources.charts.ChartMapper;
import org.openmetadata.service.resources.dashboards.DashboardMapper;
import org.openmetadata.service.resources.databases.DatabaseMapper;
import org.openmetadata.service.resources.databases.DatabaseSchemaMapper;
import org.openmetadata.service.resources.databases.StoredProcedureMapper;
import org.openmetadata.service.resources.databases.TableMapper;
import org.openmetadata.service.resources.datamodels.DashboardDataModelMapper;
import org.openmetadata.service.resources.dqtests.TestCaseMapper;
import org.openmetadata.service.resources.dqtests.TestDefinitionMapper;
import org.openmetadata.service.resources.dqtests.TestSuiteMapper;
import org.openmetadata.service.resources.drives.DirectoryMapper;
import org.openmetadata.service.resources.drives.FileMapper;
import org.openmetadata.service.resources.drives.SpreadsheetMapper;
import org.openmetadata.service.resources.glossary.GlossaryMapper;
import org.openmetadata.service.resources.glossary.GlossaryTermMapper;
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

/**
 * Dagger module for providing entity mapper instances.
 *
 * <p>Mappers handle conversion between CreateEntity DTOs and Entity objects. This module provides
 * singleton mapper instances that can be injected into services.
 *
 * <p>As more services are added, their corresponding mappers should be provided here.
 */
@Module
public class MapperModule {

  /**
   * Provides TableMapper instance.
   *
   * <p>TableMapper handles conversion from CreateTable to Table entity.
   *
   * @return TableMapper singleton
   */
  @Provides
  @Singleton
  public TableMapper provideTableMapper() {
    return new TableMapper();
  }

  /**
   * Provides DatabaseMapper instance.
   *
   * <p>DatabaseMapper handles conversion from CreateDatabase to Database entity.
   *
   * @return DatabaseMapper singleton
   */
  @Provides
  @Singleton
  public DatabaseMapper provideDatabaseMapper() {
    return new DatabaseMapper();
  }

  /**
   * Provides DatabaseSchemaMapper instance.
   *
   * <p>DatabaseSchemaMapper handles conversion from CreateDatabaseSchema to DatabaseSchema entity.
   *
   * @return DatabaseSchemaMapper singleton
   */
  @Provides
  @Singleton
  public DatabaseSchemaMapper provideDatabaseSchemaMapper() {
    return new DatabaseSchemaMapper();
  }

  /**
   * Provides QueryMapper instance.
   *
   * <p>QueryMapper handles conversion from CreateQuery to Query entity.
   *
   * @return QueryMapper singleton
   */
  @Provides
  @Singleton
  public QueryMapper provideQueryMapper() {
    return new QueryMapper();
  }

  /**
   * Provides StoredProcedureMapper instance.
   *
   * <p>StoredProcedureMapper handles conversion from CreateStoredProcedure to StoredProcedure
   * entity.
   *
   * @return StoredProcedureMapper singleton
   */
  @Provides
  @Singleton
  public StoredProcedureMapper provideStoredProcedureMapper() {
    return new StoredProcedureMapper();
  }

  /**
   * Provides DashboardMapper instance.
   *
   * <p>DashboardMapper handles conversion from CreateDashboard to Dashboard entity.
   *
   * @return DashboardMapper singleton
   */
  @Provides
  @Singleton
  public DashboardMapper provideDashboardMapper() {
    return new DashboardMapper();
  }

  /**
   * Provides ChartMapper instance.
   *
   * <p>ChartMapper handles conversion from CreateChart to Chart entity.
   *
   * @return ChartMapper singleton
   */
  @Provides
  @Singleton
  public ChartMapper provideChartMapper() {
    return new ChartMapper();
  }

  /**
   * Provides DashboardDataModelMapper instance.
   *
   * <p>DashboardDataModelMapper handles conversion from CreateDashboardDataModel to
   * DashboardDataModel entity.
   *
   * @return DashboardDataModelMapper singleton
   */
  @Provides
  @Singleton
  public DashboardDataModelMapper provideDashboardDataModelMapper() {
    return new DashboardDataModelMapper();
  }

  /**
   * Provides PipelineMapper instance.
   *
   * <p>PipelineMapper handles conversion from CreatePipeline to Pipeline entity.
   *
   * @return PipelineMapper singleton
   */
  @Provides
  @Singleton
  public PipelineMapper providePipelineMapper() {
    return new PipelineMapper();
  }

  /**
   * Provides IngestionPipelineMapper instance.
   *
   * <p>IngestionPipelineMapper handles conversion from CreateIngestionPipeline to
   * IngestionPipeline entity.
   *
   * @param config OpenMetadataApplicationConfig for mapper configuration (injected by Dagger)
   * @return IngestionPipelineMapper singleton
   */
  @Provides
  @Singleton
  public IngestionPipelineMapper provideIngestionPipelineMapper(
      org.openmetadata.service.OpenMetadataApplicationConfig config) {
    return new IngestionPipelineMapper(config);
  }

  /**
   * Provides MlModelMapper instance.
   *
   * <p>MlModelMapper handles conversion from CreateMlModel to MlModel entity.
   *
   * @return MlModelMapper singleton
   */
  @Provides
  @Singleton
  public MlModelMapper provideMlModelMapper() {
    return new MlModelMapper();
  }

  /**
   * Provides LLMModelMapper instance.
   *
   * <p>LLMModelMapper handles conversion from CreateLLMModel to LLMModel entity.
   *
   * @return LLMModelMapper singleton
   */
  @Provides
  @Singleton
  public LLMModelMapper provideLLMModelMapper() {
    return new LLMModelMapper();
  }

  /**
   * Provides TopicMapper instance.
   *
   * <p>TopicMapper handles conversion from CreateTopic to Topic entity.
   *
   * @return TopicMapper singleton
   */
  @Provides
  @Singleton
  public TopicMapper provideTopicMapper() {
    return new TopicMapper();
  }

  /**
   * Provides SearchIndexMapper instance.
   *
   * <p>SearchIndexMapper handles conversion from CreateSearchIndex to SearchIndex entity.
   *
   * @return SearchIndexMapper singleton
   */
  @Provides
  @Singleton
  public SearchIndexMapper provideSearchIndexMapper() {
    return new SearchIndexMapper();
  }

  /**
   * Provides ContainerMapper instance.
   *
   * <p>ContainerMapper handles conversion from CreateContainer to Container entity.
   *
   * @return ContainerMapper singleton
   */
  @Provides
  @Singleton
  public ContainerMapper provideContainerMapper() {
    return new ContainerMapper();
  }

  /**
   * Provides DirectoryMapper instance.
   *
   * <p>DirectoryMapper handles conversion from CreateDirectory to Directory entity.
   *
   * @return DirectoryMapper singleton
   */
  @Provides
  @Singleton
  public DirectoryMapper provideDirectoryMapper() {
    return new DirectoryMapper();
  }

  /**
   * Provides FileMapper instance.
   *
   * <p>FileMapper handles conversion from CreateFile to File entity.
   *
   * @return FileMapper singleton
   */
  @Provides
  @Singleton
  public FileMapper provideFileMapper() {
    return new FileMapper();
  }

  /**
   * Provides SpreadsheetMapper instance.
   *
   * <p>SpreadsheetMapper handles conversion from CreateSpreadsheet to Spreadsheet entity.
   *
   * @return SpreadsheetMapper singleton
   */
  @Provides
  @Singleton
  public SpreadsheetMapper provideSpreadsheetMapper() {
    return new SpreadsheetMapper();
  }

  /**
   * Provides APICollectionMapper instance.
   *
   * <p>APICollectionMapper handles conversion from CreateAPICollection to APICollection entity.
   *
   * @return APICollectionMapper singleton
   */
  @Provides
  @Singleton
  public APICollectionMapper provideAPICollectionMapper() {
    return new APICollectionMapper();
  }

  /**
   * Provides APIEndpointMapper instance.
   *
   * <p>APIEndpointMapper handles conversion from CreateAPIEndpoint to APIEndpoint entity.
   *
   * @return APIEndpointMapper singleton
   */
  @Provides
  @Singleton
  public APIEndpointMapper provideAPIEndpointMapper() {
    return new APIEndpointMapper();
  }

  /**
   * Provides GlossaryMapper instance.
   *
   * <p>GlossaryMapper handles conversion from CreateGlossary to Glossary entity.
   *
   * @return GlossaryMapper singleton
   */
  @Provides
  @Singleton
  public GlossaryMapper provideGlossaryMapper() {
    return new GlossaryMapper();
  }

  /**
   * Provides GlossaryTermMapper instance.
   *
   * <p>GlossaryTermMapper handles conversion from CreateGlossaryTerm to GlossaryTerm entity.
   *
   * @return GlossaryTermMapper singleton
   */
  @Provides
  @Singleton
  public GlossaryTermMapper provideGlossaryTermMapper() {
    return new GlossaryTermMapper();
  }

  /**
   * Provides TagMapper instance.
   *
   * <p>TagMapper handles conversion from CreateTag to Tag entity.
   *
   * @return TagMapper singleton
   */
  @Provides
  @Singleton
  public TagMapper provideTagMapper() {
    return new TagMapper();
  }

  /**
   * Provides ClassificationMapper instance.
   *
   * <p>ClassificationMapper handles conversion from CreateClassification to Classification
   * entity.
   *
   * @return ClassificationMapper singleton
   */
  @Provides
  @Singleton
  public ClassificationMapper provideClassificationMapper() {
    return new ClassificationMapper();
  }

  /**
   * Provides PolicyMapper instance.
   *
   * <p>PolicyMapper handles conversion from CreatePolicy to Policy entity.
   *
   * @return PolicyMapper singleton
   */
  @Provides
  @Singleton
  public PolicyMapper providePolicyMapper() {
    return new PolicyMapper();
  }

  /**
   * Provides RoleMapper instance.
   *
   * <p>RoleMapper handles conversion from CreateRole to Role entity.
   *
   * @return RoleMapper singleton
   */
  @Provides
  @Singleton
  public RoleMapper provideRoleMapper() {
    return new RoleMapper();
  }

  /**
   * Provides TestDefinitionMapper instance.
   *
   * <p>TestDefinitionMapper handles conversion from CreateTestDefinition to TestDefinition entity.
   *
   * @return TestDefinitionMapper singleton
   */
  @Provides
  @Singleton
  public TestDefinitionMapper provideTestDefinitionMapper() {
    return new TestDefinitionMapper();
  }

  /**
   * Provides TestSuiteMapper instance.
   *
   * <p>TestSuiteMapper handles conversion from CreateTestSuite to TestSuite entity.
   *
   * @return TestSuiteMapper singleton
   */
  @Provides
  @Singleton
  public TestSuiteMapper provideTestSuiteMapper() {
    return new TestSuiteMapper();
  }

  /**
   * Provides TestCaseMapper instance.
   *
   * <p>TestCaseMapper handles conversion from CreateTestCase to TestCase entity.
   *
   * @return TestCaseMapper singleton
   */
  @Provides
  @Singleton
  public TestCaseMapper provideTestCaseMapper() {
    return new TestCaseMapper();
  }

  /**
   * Provides AIApplicationMapper instance.
   *
   * <p>AIApplicationMapper handles conversion from CreateAIApplication to AIApplication entity.
   *
   * @return AIApplicationMapper singleton
   */
  @Provides
  @Singleton
  public AIApplicationMapper provideAIApplicationMapper() {
    return new AIApplicationMapper();
  }

  /**
   * Provides AIGovernancePolicyMapper instance.
   *
   * <p>AIGovernancePolicyMapper handles conversion from CreateAIGovernancePolicy to
   * AIGovernancePolicy entity.
   *
   * @return AIGovernancePolicyMapper singleton
   */
  @Provides
  @Singleton
  public AIGovernancePolicyMapper provideAIGovernancePolicyMapper() {
    return new AIGovernancePolicyMapper();
  }

  /**
   * Provides PromptTemplateMapper instance.
   *
   * <p>PromptTemplateMapper handles conversion from CreatePromptTemplate to PromptTemplate entity.
   *
   * @return PromptTemplateMapper singleton
   */
  @Provides
  @Singleton
  public PromptTemplateMapper providePromptTemplateMapper() {
    return new PromptTemplateMapper();
  }

  /**
   * Provides TeamMapper instance.
   *
   * <p>TeamMapper handles conversion from CreateTeam to Team entity.
   *
   * @return TeamMapper singleton
   */
  @Provides
  @Singleton
  public TeamMapper provideTeamMapper() {
    return new TeamMapper();
  }

  /**
   * Provides PersonaMapper instance.
   *
   * <p>PersonaMapper handles conversion from CreatePersona to Persona entity.
   *
   * @return PersonaMapper singleton
   */
  @Provides
  @Singleton
  public PersonaMapper providePersonaMapper() {
    return new PersonaMapper();
  }

  /**
   * Provides UserMapper instance.
   *
   * <p>UserMapper handles conversion from CreateUser to User entity.
   *
   * @return UserMapper singleton
   */
  @Provides
  @Singleton
  public UserMapper provideUserMapper() {
    return new UserMapper();
  }

  // Additional mapper providers will be added here as we migrate entities
}
