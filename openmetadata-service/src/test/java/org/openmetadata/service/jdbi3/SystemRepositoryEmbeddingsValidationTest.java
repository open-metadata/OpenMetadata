package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;
import org.openmetadata.schema.system.StepValidation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SystemDAO;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.VectorFieldHealth;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.client.EmbeddingModel;

class SystemRepositoryEmbeddingsValidationTest {

  private MockedStatic<Entity> entityMock;
  private MockedStatic<MigrationValidationClient> migrationMock;
  private SearchRepository searchRepository;
  private final AtomicBoolean rebuilt = new AtomicBoolean();
  private VectorFieldHealth vectorFieldHealth;
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
    vectorFieldHealth =
        new VectorFieldHealth(
            name -> {
              if (rebuilt.get()) {
                vectorFieldHealth.forget(name);
              }
            });
    lenient().when(searchRepository.getVectorFieldHealth()).thenReturn(vectorFieldHealth);
    lenient()
        .when(searchRepository.getEmbeddingModel())
        .thenReturn(Optional.of(new EmbeddingModel("model-b", 2)));

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

  private void embeddingsWork() {
    VectorIndexService vectorService = mock(VectorIndexService.class);
    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    when(searchRepository.getVectorIndexService()).thenReturn(vectorService);
    when(searchRepository.getEmbeddingClient()).thenReturn(embeddingClient);
    when(embeddingClient.embed("OpenMetadata embedding validation test"))
        .thenReturn(new float[] {0.1f, 0.2f});
    when(embeddingClient.getDimension()).thenReturn(2);
  }

  @Test
  void testAnIndexThatCannotHoldTheModelsVectorsFailsTheStepWithTheWayOut() {
    embeddingsWork();
    vectorFieldHealth.recordCannotHold(
        "table_search_index",
        Set.of("table_search_index_rebuild_1"),
        "table_search_index_rebuild_1 holds vectors of model model-a");

    StepValidation result = systemRepository.getEmbeddingsValidation(appConfig);

    assertFalse(result.getPassed());
    String message = result.getMessage();
    assertTrue(message.contains("Semantic search needs a rebuild of 1 search index"), message);
    assertTrue(message.contains("model-b (2 dimensions)"), message);
    assertTrue(message.contains("holds vectors of model model-a"), message);
    assertTrue(message.contains("Recreate Indexes"), message);
    assertTrue(message.contains("reindex --force"), message);
  }

  @Test
  void testAFinishedRebuildClearsTheStepWithoutARestart() {
    embeddingsWork();
    vectorFieldHealth.recordCannotHold(
        "table_search_index", Set.of(), "table_search_index has dense_vector of 384 dimensions");
    rebuilt.set(true);

    StepValidation result = systemRepository.getEmbeddingsValidation(appConfig);

    assertTrue(result.getPassed(), result.getMessage());
    assertTrue(vectorFieldHealth.mismatches().isEmpty());
  }

  @Test
  void testALateVectorServiceStartAlsoReconcilesTheVectorFields() {
    when(searchRepository.getVectorIndexService()).thenReturn(null);

    systemRepository.getEmbeddingsValidation(appConfig);

    verify(searchRepository).startVectorSearch();
  }
}
