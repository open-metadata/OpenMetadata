package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMEmbeddingsConfig;
import org.openmetadata.schema.configuration.LLMGoogleConfig;
import org.openmetadata.schema.configuration.LLMGoogleEmbeddingConfig;
import org.openmetadata.schema.configuration.LLMOpenAIConfig;
import org.openmetadata.schema.configuration.LLMOpenAIEmbeddingConfig;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;
import org.openmetadata.schema.system.StepValidation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.llm.LlmConfigHolder;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SystemDAO;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

class SystemRepositoryEmbeddingsValidationTest {

  private MockedStatic<Entity> entityMock;
  private MockedStatic<MigrationValidationClient> migrationMock;
  private SearchRepository searchRepository;
  private OpenMetadataApplicationConfig appConfig;
  private SystemRepository systemRepository;

  @BeforeEach
  void setup() {
    entityMock = mockStatic(Entity.class);
    migrationMock = mockStatic(MigrationValidationClient.class);

    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    SystemDAO systemDAO = mock(SystemDAO.class);
    when(collectionDAO.systemDAO()).thenReturn(systemDAO);
    entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

    MigrationValidationClient migrationClient = mock(MigrationValidationClient.class);
    migrationMock.when(MigrationValidationClient::getInstance).thenReturn(migrationClient);

    searchRepository = mock(SearchRepository.class);
    entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

    appConfig = mock(OpenMetadataApplicationConfig.class);
    ElasticSearchConfiguration esConfig = mock(ElasticSearchConfiguration.class);
    NaturalLanguageSearchConfiguration nlpConfig = mock(NaturalLanguageSearchConfiguration.class);
    when(appConfig.getElasticSearchConfiguration()).thenReturn(esConfig);
    when(esConfig.getNaturalLanguageSearch()).thenReturn(nlpConfig);

    when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.OPENSEARCH);

    systemRepository = new SystemRepository();
  }

  @AfterEach
  void tearDown() {
    entityMock.close();
    migrationMock.close();
  }

  @Test
  void testEmbeddingsPassWhenTheClientWorks() {
    VectorIndexService vectorService = mock(VectorIndexService.class);
    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    when(searchRepository.getVectorIndexService()).thenReturn(vectorService);
    when(searchRepository.getEmbeddingClient()).thenReturn(embeddingClient);
    when(embeddingClient.embed("OpenMetadata embedding validation test"))
        .thenReturn(new float[] {0.1f, 0.2f});
    when(embeddingClient.getDimension()).thenReturn(2);

    StepValidation result = systemRepository.getEmbeddingsValidation(appConfig);

    assertTrue(result.getPassed());
    assertTrue(result.getMessage().contains("working correctly"));
  }

  @Test
  void reportsEmbeddingDeploymentWhenInitializationFails() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withOpenai(
                new LLMOpenAIConfig()
                    .withEndpoint("https://example.com")
                    .withDeploymentName("chat"))
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.OPENAI)
                    .withOpenai(new LLMOpenAIEmbeddingConfig().withDeploymentName("vectors")));
    try (MockedStatic<LlmConfigHolder> holder = mockStatic(LlmConfigHolder.class)) {
      holder.when(LlmConfigHolder::get).thenReturn(config);

      StepValidation result = systemRepository.getEmbeddingsValidation(appConfig);

      assertFalse(result.getPassed());
      assertTrue(result.getMessage().contains("deploymentName: vectors"), result.getMessage());
    }
  }

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {"  "})
  void reportsMissingEndpointForAnEmbeddingDeployment(String endpoint) {
    LLMConfiguration config =
        new LLMConfiguration()
            .withOpenai(new LLMOpenAIConfig().withEndpoint(endpoint))
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.OPENAI)
                    .withOpenai(new LLMOpenAIEmbeddingConfig().withDeploymentName("vectors")));
    try (MockedStatic<LlmConfigHolder> holder = mockStatic(LlmConfigHolder.class)) {
      holder.when(LlmConfigHolder::get).thenReturn(config);

      StepValidation result = systemRepository.getEmbeddingsValidation(appConfig);

      assertFalse(result.getPassed());
      assertTrue(result.getMessage().contains("LLM_OPENAI_ENDPOINT"), result.getMessage());
      assertFalse(result.getMessage().contains("api.openai.com"), result.getMessage());
    }
  }

  @Test
  void testEmbeddingClientInitFailureIncludesErrorMessage() {
    when(searchRepository.getVectorIndexService()).thenReturn(null);
    when(searchRepository.getEmbeddingClient()).thenReturn(null);
    when(searchRepository.getVectorServiceInitError())
        .thenReturn("Bedrock embedding model ID is required");

    StepValidation result = systemRepository.getEmbeddingsValidation(appConfig);

    assertFalse(result.getPassed());
    assertTrue(result.getMessage().contains("Bedrock embedding model ID is required"));
    assertTrue(result.getMessage().contains("Embedding client could not be initialized"));
  }

  @Test
  void reportsVertexDestinationWhenEmbeddingInitializationFails() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withGoogle(
                new LLMGoogleConfig()
                    .withUseVertexAI(true)
                    .withVertexProject("test-project")
                    .withVertexLocation("europe-west4"))
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.GOOGLE)
                    .withGoogle(new LLMGoogleEmbeddingConfig()));
    try (MockedStatic<LlmConfigHolder> holder = mockStatic(LlmConfigHolder.class)) {
      holder.when(LlmConfigHolder::get).thenReturn(config);
      StepValidation result = systemRepository.getEmbeddingsValidation(appConfig);
      assertFalse(result.getPassed());
      assertTrue(
          result.getMessage().contains("Vertex AI project: test-project, location: europe-west4"));
      assertTrue(result.getMessage().contains("gemini-embedding-001"));
    }
  }

  @Test
  void testVectorServiceInitFailureWithEmbeddingClientOk() {
    when(searchRepository.getVectorIndexService()).thenReturn(null);
    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    when(searchRepository.getEmbeddingClient()).thenReturn(embeddingClient);
    when(searchRepository.getVectorServiceInitError()).thenReturn("OpenSearch connection refused");

    StepValidation result = systemRepository.getEmbeddingsValidation(appConfig);

    assertFalse(result.getPassed());
    assertTrue(result.getMessage().contains("OpenSearch connection refused"));
    assertTrue(
        result
            .getMessage()
            .contains(
                "The embedding client is configured but the vector service failed to start."));
  }

  @Test
  void testRetrySuccessThenEmbeddingGenerationFails() {
    when(searchRepository.getVectorIndexService()).thenReturn(null).thenReturn(null);
    when(searchRepository.getEmbeddingClient()).thenReturn(null);
    when(searchRepository.getVectorServiceInitError()).thenReturn(null);

    StepValidation result = systemRepository.getEmbeddingsValidation(appConfig);

    assertFalse(result.getPassed());
    assertTrue(result.getMessage().contains("Embedding client could not be initialized"));
  }

  @Test
  void testElasticsearchEmbeddingsValidatedSameAsOpenSearch() {
    // ES is a first-class supported backend; the validator runs the same embedding generation
    // check on it instead of short-circuiting.
    when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);

    VectorIndexService vectorService = mock(VectorIndexService.class);
    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    when(searchRepository.getVectorIndexService()).thenReturn(vectorService);
    when(searchRepository.getEmbeddingClient()).thenReturn(embeddingClient);
    when(embeddingClient.embed("OpenMetadata embedding validation test"))
        .thenReturn(new float[] {0.1f, 0.2f});
    when(embeddingClient.getDimension()).thenReturn(2);

    StepValidation result = systemRepository.getEmbeddingsValidation(appConfig);

    assertTrue(result.getPassed(), "ES embeddings validation should pass when the client works");
    assertTrue(result.getMessage().startsWith("Embeddings are working correctly."));
    assertFalse(
        result.getMessage().contains("pipeline"), "no engine has a search pipeline to report on");
  }
}
