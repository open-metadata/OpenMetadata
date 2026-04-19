package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.ai.PromptTemplate;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.LLMService;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

class EntityTypeNameTest {

  private static MockedStatic<Entity> entityStaticMock;

  @BeforeAll
  static void setUp() {
    SearchRepository mockSearchRepo =
        Mockito.mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
    entityStaticMock = Mockito.mockStatic(Entity.class);
    entityStaticMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepo);
  }

  @AfterAll
  static void tearDown() {
    entityStaticMock.close();
  }

  private static UUID id() {
    return UUID.randomUUID();
  }

  static Stream<Arguments> indexEntityTypeProvider() {
    return Stream.of(
        // DataAssetIndex implementations
        Arguments.of(new TableIndex(new Table().withId(id())), Entity.TABLE),
        Arguments.of(new DashboardIndex(new Dashboard().withId(id())), Entity.DASHBOARD),
        Arguments.of(new PipelineIndex(new Pipeline().withId(id())), Entity.PIPELINE),
        Arguments.of(new TopicIndex(new Topic().withId(id())), Entity.TOPIC),
        Arguments.of(new MlModelIndex(new MlModel().withId(id())), Entity.MLMODEL),
        Arguments.of(new ContainerIndex(new Container().withId(id())), Entity.CONTAINER),
        Arguments.of(
            new StoredProcedureIndex(new StoredProcedure().withId(id())), Entity.STORED_PROCEDURE),
        Arguments.of(
            new SearchEntityIndex(
                new org.openmetadata.schema.entity.data.SearchIndex().withId(id())),
            Entity.SEARCH_INDEX),
        Arguments.of(new APIEndpointIndex(new APIEndpoint().withId(id())), Entity.API_ENDPOINT),
        Arguments.of(
            new DashboardDataModelIndex(new DashboardDataModel().withId(id())),
            Entity.DASHBOARD_DATA_MODEL),
        Arguments.of(new WorksheetIndex(new Worksheet().withId(id())), Entity.WORKSHEET),
        Arguments.of(new FileIndex(new File().withId(id())), Entity.FILE),
        Arguments.of(new SpreadsheetIndex(new Spreadsheet().withId(id())), Entity.SPREADSHEET),
        Arguments.of(new DirectoryIndex(new Directory().withId(id())), Entity.DIRECTORY),

        // TaggableIndex implementations
        Arguments.of(new QueryIndex(new Query().withId(id())), Entity.QUERY),
        Arguments.of(new LlmModelIndex(new LLMModel().withId(id())), Entity.LLM_MODEL),
        Arguments.of(
            new AiApplicationIndex(new AIApplication().withId(id())), Entity.AI_APPLICATION),
        Arguments.of(
            new AiGovernancePolicyIndex(new AIGovernancePolicy().withId(id())),
            Entity.AI_GOVERNANCE_POLICY),
        Arguments.of(new McpServerIndex(new McpServer().withId(id())), Entity.MCP_SERVER),
        Arguments.of(
            new PromptTemplateIndex(new PromptTemplate().withId(id())), Entity.PROMPT_TEMPLATE),

        // TaggableIndex + LineageIndex
        Arguments.of(new DomainIndex(new Domain().withId(id())), Entity.DOMAIN),
        Arguments.of(new DataProductIndex(new DataProduct().withId(id())), Entity.DATA_PRODUCT),

        // LineageIndex only (services)
        Arguments.of(
            new DatabaseServiceIndex(new DatabaseService().withId(id())), Entity.DATABASE_SERVICE),
        Arguments.of(
            new DashboardServiceIndex(new DashboardService().withId(id())),
            Entity.DASHBOARD_SERVICE),
        Arguments.of(
            new PipelineServiceIndex(new PipelineService().withId(id())), Entity.PIPELINE_SERVICE),
        Arguments.of(
            new MessagingServiceIndex(new MessagingService().withId(id())),
            Entity.MESSAGING_SERVICE),
        Arguments.of(
            new MlModelServiceIndex(new MlModelService().withId(id())), Entity.MLMODEL_SERVICE),
        Arguments.of(
            new SearchServiceIndex(new SearchService().withId(id())), Entity.SEARCH_SERVICE),
        Arguments.of(
            new StorageServiceIndex(new StorageService().withId(id())), Entity.STORAGE_SERVICE),
        Arguments.of(
            new MetadataServiceIndex(new MetadataService().withId(id())), Entity.METADATA_SERVICE),
        Arguments.of(new LlmServiceIndex(new LLMService().withId(id())), Entity.LLM_SERVICE),
        Arguments.of(new McpServiceIndex(new McpService().withId(id())), Entity.MCP_SERVICE),

        // LineageIndex only (data)
        Arguments.of(new MetricIndex(new Metric().withId(id())), Entity.METRIC),
        Arguments.of(new ChartIndex(new Chart().withId(id())), Entity.CHART),

        // TaggableIndex only
        Arguments.of(new GlossaryIndex(new Glossary().withId(id())), Entity.GLOSSARY),
        Arguments.of(new GlossaryTermIndex(new GlossaryTerm().withId(id())), Entity.GLOSSARY_TERM),
        Arguments.of(new DatabaseIndex(new Database().withId(id())), Entity.DATABASE),
        Arguments.of(
            new DatabaseSchemaIndex(new DatabaseSchema().withId(id())), Entity.DATABASE_SCHEMA),
        Arguments.of(
            new APICollectionIndex(new APICollection().withId(id())), Entity.API_COLLECTION),

        // Base SearchIndex only
        Arguments.of(
            new ClassificationIndex(new Classification().withId(id())), Entity.CLASSIFICATION),
        Arguments.of(new TagIndex(new Tag().withId(id())), Entity.TAG),
        Arguments.of(new UserIndex(new User().withId(id())), Entity.USER),
        Arguments.of(new TeamIndex(new Team().withId(id())), Entity.TEAM));
  }

  @ParameterizedTest(name = "{1}")
  @MethodSource("indexEntityTypeProvider")
  void testGetEntityTypeName(SearchIndex index, String expectedType) {
    assertEquals(expectedType, index.getEntityTypeName());
  }

  @ParameterizedTest(name = "{1} - getEntity")
  @MethodSource("indexEntityTypeProvider")
  void testGetEntityReturnsNonNull(SearchIndex index, String expectedType) {
    assertNotNull(index.getEntity(), expectedType + " getEntity() returned null");
  }
}
