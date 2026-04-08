package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.service.configuration.elasticsearch.Bedrock;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;
import org.openmetadata.schema.system.StepValidation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO.SystemDAO;
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
    when(nlpConfig.getEmbeddingProvider()).thenReturn("bedrock");
    Bedrock bedrockConfig = mock(Bedrock.class);
    when(nlpConfig.getBedrock()).thenReturn(bedrockConfig);

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
  void testEmbeddingsPassWithPipelineAvailable() {
    VectorIndexService vectorService = mock(VectorIndexService.class);
    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    when(searchRepository.getVectorIndexService()).thenReturn(vectorService);
    when(searchRepository.getEmbeddingClient()).thenReturn(embeddingClient);
    when(embeddingClient.embed("OpenMetadata embedding validation test"))
        .thenReturn(new float[] {0.1f, 0.2f});
    when(embeddingClient.getDimension()).thenReturn(2);
    when(searchRepository.checkHybridSearchPipeline()).thenReturn(Optional.empty());

    StepValidation result = systemRepository.getEmbeddingsValidation(appConfig);

    assertTrue(result.getPassed());
    assertTrue(result.getMessage().contains("working correctly"));
  }

  @Test
  void testEmbeddingsFailWhenPipelineMissing() {
    VectorIndexService vectorService = mock(VectorIndexService.class);
    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    when(searchRepository.getVectorIndexService()).thenReturn(vectorService);
    when(searchRepository.getEmbeddingClient()).thenReturn(embeddingClient);
    when(embeddingClient.embed("OpenMetadata embedding validation test"))
        .thenReturn(new float[] {0.1f, 0.2f});
    when(embeddingClient.getDimension()).thenReturn(2);
    when(searchRepository.checkHybridSearchPipeline())
        .thenReturn(Optional.of("Hybrid search pipeline 'hybrid-rrf' not found."));

    StepValidation result = systemRepository.getEmbeddingsValidation(appConfig);

    assertFalse(result.getPassed());
    assertTrue(result.getMessage().contains("not found"));
  }

  @Test
  void testPipelineCheck5xxReportsSpecificError() {
    VectorIndexService vectorService = mock(VectorIndexService.class);
    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    when(searchRepository.getVectorIndexService()).thenReturn(vectorService);
    when(searchRepository.getEmbeddingClient()).thenReturn(embeddingClient);
    when(embeddingClient.embed("OpenMetadata embedding validation test"))
        .thenReturn(new float[] {0.1f, 0.2f});
    when(embeddingClient.getDimension()).thenReturn(2);
    when(searchRepository.checkHybridSearchPipeline())
        .thenReturn(Optional.of("Unexpected status 500"));

    StepValidation result = systemRepository.getEmbeddingsValidation(appConfig);

    assertFalse(result.getPassed());
    assertTrue(result.getMessage().contains("Unexpected status 500"));
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
  void testVectorServiceInitFailureWithEmbeddingClientOk() {
    when(searchRepository.getVectorIndexService()).thenReturn(null);
    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    when(searchRepository.getEmbeddingClient()).thenReturn(embeddingClient);
    when(searchRepository.getVectorServiceInitError()).thenReturn("OpenSearch connection refused");

    StepValidation result = systemRepository.getEmbeddingsValidation(appConfig);

    assertFalse(result.getPassed());
    assertTrue(result.getMessage().contains("OpenSearch connection refused"));
    assertTrue(result.getMessage().contains("OpenSearch vector service failed to start"));
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
  void testElasticsearchNotSupported() {
    when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);

    StepValidation result = systemRepository.getEmbeddingsValidation(appConfig);

    assertFalse(result.getPassed());
    assertEquals(
        "Elasticsearch is not supported for Semantic Search embeddings. Please use OpenSearch.",
        result.getMessage());
  }
}
