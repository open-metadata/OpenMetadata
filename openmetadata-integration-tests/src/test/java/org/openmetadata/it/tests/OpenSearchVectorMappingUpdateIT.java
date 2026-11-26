package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.apache.commons.lang3.function.FailableRunnable;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.mockito.MockedStatic;
import org.openmetadata.it.util.MappingReadFailingProxy;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.EmbeddingFieldUpdate;
import org.openmetadata.service.search.LiveEmbeddingField;
import org.openmetadata.service.search.OntologyTermSearch;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.VectorFieldHealth;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import org.openmetadata.service.search.opensearch.OpenSearchIndexManager;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.client.EmbeddingModel;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;
import org.opensearch.testcontainers.OpensearchContainer;
import org.slf4j.LoggerFactory;
import org.testcontainers.utility.DockerImageName;

/**
 * Creates, updates and reads entity index mappings on a real OpenSearch, with only the embedding
 * model known, as {@code migrate} and server start know it before any embedding client exists. The
 * engine refuses to change the dimension or the method of an existing {@code knn_vector}, or to add
 * one to an index created without {@code index.knn}, and a refused field fails the whole {@code PUT
 * _mapping}, so only a real cluster shows whether every new field of an upgrade reaches the live
 * index (ADR:2026-11-26-the-server-reconciles-live-vector-fields-with-the-embedding-model).
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Execution(ExecutionMode.SAME_THREAD)
class OpenSearchVectorMappingUpdateIT {

  private static final int DIMENSION = 384;
  private static final EmbeddingModel MODEL = model(DIMENSION);

  private static final String FIRST_RELEASE_MAPPING =
      "{\"settings\":{\"index\":{}},\"mappings\":{\"properties\":{"
          + "\"fingerprint\":{\"type\":\"keyword\"},\"name\":{\"type\":\"keyword\"}}}}";
  private static final String NEXT_RELEASE_MAPPING =
      "{\"settings\":{\"index\":{}},\"mappings\":{\"properties\":{"
          + "\"fingerprint\":{\"type\":\"keyword\"},\"name\":{\"type\":\"keyword\"},"
          + "\"addedInNextRelease\":{\"type\":\"keyword\"}}}}";
  private static final String EMBEDDING_WITH_OTHER_METHOD_PARAMETERS =
      "{\"settings\":{\"index\":{\"knn\":true}},\"mappings\":{\"properties\":{"
          + "\"fingerprint\":{\"type\":\"keyword\"},\"name\":{\"type\":\"keyword\"},"
          + "\"embedding\":{\"type\":\"knn_vector\",\"dimension\":"
          + DIMENSION
          + ",\"method\":{\"name\":\"hnsw\",\"engine\":\"lucene\",\"space_type\":\"cosinesimil\","
          + "\"parameters\":{\"m\":16,\"ef_construction\":100}}}}}}";
  private static final String KNN_INDEX_WITHOUT_VECTOR_FIELD =
      "{\"settings\":{\"index\":{\"knn\":true}},\"mappings\":{\"properties\":{"
          + "\"fingerprint\":{\"type\":\"keyword\"},\"name\":{\"type\":\"keyword\"}}}}";
  private static final String EMBEDDING_AS_FLOATS =
      "{\"mappings\":{\"properties\":{\"fingerprint\":{\"type\":\"keyword\"},"
          + "\"name\":{\"type\":\"keyword\"},\"embedding\":{\"type\":\"float\"}}}}";

  /** Another supported version can be checked with {@code -DopensearchVectorMappingImage}. */
  private static final String IMAGE =
      System.getProperty("opensearchVectorMappingImage", "opensearchproject/opensearch:3.4.0");

  private final OpensearchContainer<?> container =
      new OpensearchContainer<>(DockerImageName.parse(IMAGE))
          .withStartupTimeout(Duration.ofMinutes(5))
          .withEnv("DISABLE_SECURITY_PLUGIN", "true")
          .withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true")
          .withEnv("OPENSEARCH_INITIAL_ADMIN_PASSWORD", "Test@12345")
          .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms512m -Xmx512m");
  private final HttpClient http = HttpClient.newHttpClient();
  private final ListAppender<ILoggingEvent> searchLogs = new ListAppender<>();
  private VectorFieldHealth health;
  private OpenSearchClient client;

  @BeforeAll
  void start() {
    container.start();
    client = new OpenSearchClient(configFor(container.getHost(), container.getMappedPort(9200)));
  }

  @AfterAll
  void stop() {
    client.close();
    container.stop();
  }

  @BeforeEach
  void captureSearchLogs() {
    health = new VectorFieldHealth(name -> {});
    searchLogs.list.clear();
    searchLogs.start();
    searchLogger().addAppender(searchLogs);
  }

  @AfterEach
  void releaseSearchLogs() {
    searchLogger().detachAppender(searchLogs);
  }

  @Test
  void migrateCreatesAnIndexWithKnnAndTheVectorFieldBeforeAnyEmbeddingClientExists()
      throws Exception {
    String indexName = "created_by_migrate_table_search_index";

    withModel(MODEL, () -> client.createIndex(indexName, FIRST_RELEASE_MAPPING));

    JsonNode embedding = liveMappings(indexName).path("properties").path("embedding");
    assertEquals("knn_vector", embedding.path("type").asText());
    assertEquals(DIMENSION, embedding.path("dimension").asInt());
    assertTrue(knnEnabled(indexName), "index.knn is fixed at creation, so it must be set now");
    assertEquals(MODEL.id(), recordedModel(indexName));
  }

  @Test
  void anUpgradeAddsItsNewFieldsToAnIndexWithTheVectorField() throws Exception {
    String rebuiltIndex = "pinned_table_search_index_rebuild_1";
    String canonicalName = "pinned_table_search_index";
    withModel(MODEL, () -> client.createIndex(rebuiltIndex, FIRST_RELEASE_MAPPING));
    send("PUT", "/" + rebuiltIndex + "/_alias/" + canonicalName, "{}");

    withModel(MODEL, () -> client.updateIndex(entityIndex(canonicalName), NEXT_RELEASE_MAPPING));

    JsonNode live = liveMappings(rebuiltIndex);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    JsonNode embedding = live.path("properties").path("embedding");
    assertEquals(DIMENSION, embedding.path("dimension").asInt());
    assertEquals(48, embedding.path("method").path("parameters").path("m").asInt());
    assertEquals(MODEL.id(), recordedModel(rebuiltIndex));
    assertTrue(health.mismatches().isEmpty());
    assertTrue(errors().isEmpty(), "the normal path reports nothing: " + errors());
  }

  @Test
  void anUpgradeKeepsTheMethodAnExistingVectorFieldWasCreatedWith() throws Exception {
    String indexName = "other_method_table_search_index";
    send("PUT", "/" + indexName, EMBEDDING_WITH_OTHER_METHOD_PARAMETERS);

    withModel(MODEL, () -> client.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING));

    JsonNode live = liveMappings(indexName);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertEquals(16, methodM(live));
    assertTrue(health.mismatches().isEmpty());
  }

  @Test
  void turningEmbeddingsOnAddsTheVectorFieldAndTheModelToAnIndexWithVectorSupport()
      throws Exception {
    String indexName = "knn_ready_table_search_index";
    send("PUT", "/" + indexName, KNN_INDEX_WITHOUT_VECTOR_FIELD);

    withModel(MODEL, () -> client.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING));

    JsonNode live = liveMappings(indexName);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertEquals("knn_vector", live.path("properties").path("embedding").path("type").asText());
    assertEquals(DIMENSION, live.path("properties").path("embedding").path("dimension").asInt());
    assertEquals(MODEL.id(), recordedModel(indexName));
  }

  @Test
  void turningEmbeddingsOnFindsThatAnIndexCreatedWithoutKnnNeedsARebuild() throws Exception {
    String indexName = "embeddings_off_table_search_index";
    withSearchRepository(
        mock(SearchRepository.class), () -> client.createIndex(indexName, FIRST_RELEASE_MAPPING));
    assertFalse(knnEnabled(indexName));

    withModel(MODEL, () -> client.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING));

    JsonNode live = liveMappings(indexName);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertFalse(live.path("properties").has("embedding"));
    assertNeedsARebuild(indexName, "created without vector support");
  }

  @Test
  void anUpgradeWithAnotherEmbeddingDimensionStillAddsItsOtherFields() throws Exception {
    String indexName = "other_dimension_table_search_index";
    withModel(MODEL, () -> client.createIndex(indexName, FIRST_RELEASE_MAPPING));

    assertDoesNotThrow(
        () ->
            withModel(
                model(DIMENSION * 2),
                () -> client.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING)));

    JsonNode live = liveMappings(indexName);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertEquals(DIMENSION, live.path("properties").path("embedding").path("dimension").asInt());
    assertEquals(MODEL.id(), recordedModel(indexName), "the model the index holds stays recorded");
    assertNeedsARebuild(indexName, "knn_vector of " + DIMENSION + " dimensions");
  }

  @Test
  void anUpgradeForAnotherModelOfTheSameDimensionLeavesTheFieldAndItsModelAlone() throws Exception {
    String indexName = "same_dimension_other_model_table_search_index";
    withModel(MODEL, () -> client.createIndex(indexName, FIRST_RELEASE_MAPPING));
    EmbeddingModel other = new EmbeddingModel("another-model", DIMENSION);

    withModel(other, () -> client.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING));

    JsonNode live = liveMappings(indexName);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertEquals(MODEL.id(), recordedModel(indexName));
    assertNeedsARebuild(indexName, "holds vectors of model " + MODEL.id());
  }

  /**
   * After {@code reembed} replaced every vector of a chunk index built for another model of the
   * same dimension, the index records the model and keeps the rest of its {@code _meta}.
   */
  @Test
  void recordingTheModelOnALiveIndexKeepsItsOtherMetaAndClearsTheOtherModel() throws Exception {
    String indexName = "reembedded_embeddings_chunks_g1";
    send(
        "PUT",
        "/" + indexName,
        "{\"settings\":{\"index\":{\"knn\":true}},\"mappings\":{\"_meta\":{"
            + "\"chunkDocVersion\":9,\"embedding_model\":\"another-model\","
            + "\"embedding_dimension\":"
            + DIMENSION
            + "},\"properties\":{\"embedding\":{\"type\":\"knn_vector\",\"dimension\":"
            + DIMENSION
            + "}}}}");
    assertEquals(
        EmbeddingFieldUpdate.LEAVE_OUT,
        EmbeddingFieldUpdate.updateFor(client.readEmbeddingField(indexName), MODEL));

    client.recordEmbeddingModel(indexName, MODEL);

    JsonNode live = liveMappings(indexName);
    assertEquals(9, live.path("_meta").path("chunkDocVersion").asInt());
    assertEquals(MODEL.id(), recordedModel(indexName));
    assertEquals(DIMENSION, live.path("_meta").path("embedding_dimension").asInt());
    assertEquals(DIMENSION, live.path("properties").path("embedding").path("dimension").asInt());
    assertEquals(
        EmbeddingFieldUpdate.KEEP,
        EmbeddingFieldUpdate.updateFor(client.readEmbeddingField(indexName), MODEL));
  }

  @Test
  void anEmbeddingMappedAsAnotherTypeNeedsARebuildAndIsLeftAlone() throws Exception {
    String indexName = "float_embedding_table_search_index";
    send("PUT", "/" + indexName, EMBEDDING_AS_FLOATS);

    withModel(MODEL, () -> client.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING));

    JsonNode live = liveMappings(indexName);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertEquals("float", live.path("properties").path("embedding").path("type").asText());
    assertNeedsARebuild(indexName, "has float");
  }

  @Test
  void theLiveFieldIsReadThroughTheAliasOfARebuiltIndex() throws Exception {
    String rebuiltIndex = "aliased_table_search_index_rebuild_2";
    String canonicalName = "aliased_table_search_index";
    withModel(MODEL, () -> client.createIndex(rebuiltIndex, FIRST_RELEASE_MAPPING));
    send("PUT", "/" + rebuiltIndex + "/_alias/" + canonicalName, "{}");

    LiveEmbeddingField live = client.readEmbeddingField(canonicalName);

    assertEquals(
        Map.of(rebuiltIndex, new LiveEmbeddingField.Declared("knn_vector", DIMENSION)),
        live.byIndex());
    assertEquals(Map.of(rebuiltIndex, MODEL.id()), live.recordedModels());
    assertEquals(
        EmbeddingFieldUpdate.LEAVE_OUT, EmbeddingFieldUpdate.updateFor(live, model(DIMENSION * 2)));
    assertEquals(
        rebuiltIndex + " has knn_vector of " + DIMENSION + " dimensions",
        live.describe(model(DIMENSION * 2)));
  }

  @Test
  void aFailedLiveReadStillAddsTheOtherFieldsAndNeverResendsTheVectorField() throws Exception {
    String indexName = "unreadable_table_search_index";
    send("PUT", "/" + indexName, EMBEDDING_WITH_OTHER_METHOD_PARAMETERS);

    try (MappingReadFailingProxy proxy =
        new MappingReadFailingProxy(container.getHost(), container.getMappedPort(9200))) {
      OpenSearchClient proxied = new OpenSearchClient(configFor("127.0.0.1", proxy.port()));
      try {
        withModel(MODEL, () -> proxied.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING));
      } finally {
        proxied.close();
      }
    }

    JsonNode live = liveMappings(indexName);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertEquals(16, methodM(live));
    assertTrue(health.report(MODEL).orElseThrow().contains("could not be read"));
  }

  @Test
  void aMappingReplyThatIsNotJsonIsAnUnreadableFieldAndNeverAFailure() throws Exception {
    String indexName = "gateway_page_table_search_index";
    withModel(MODEL, () -> client.createIndex(indexName, FIRST_RELEASE_MAPPING));

    try (MappingReadFailingProxy proxy =
        MappingReadFailingProxy.answeringWithAPageThatIsNotJson(
            container.getHost(), container.getMappedPort(9200))) {
      OpenSearchClient proxied = new OpenSearchClient(configFor("127.0.0.1", proxy.port()));
      try {
        LiveEmbeddingField live = assertDoesNotThrow(() -> proxied.readEmbeddingField(indexName));
        assertFalse(live.readable());
      } finally {
        proxied.close();
      }
    }
  }

  @Test
  void theServerDeclaresTheVectorFieldAndTheModelOnAnIndexWithVectorSupport() throws Exception {
    String indexName = "knn_ready_at_startup_table_search_index";
    send("PUT", "/" + indexName, KNN_INDEX_WITHOUT_VECTOR_FIELD);

    LiveEmbeddingField live = client.readEmbeddingField(indexName);
    assertEquals(EmbeddingFieldUpdate.DECLARE, EmbeddingFieldUpdate.updateFor(live, MODEL));
    Logger indexManager = (Logger) LoggerFactory.getLogger(OpenSearchIndexManager.class);
    Level configured = indexManager.getLevel();
    indexManager.setLevel(Level.INFO);
    try {
      client.declareEmbeddingField(indexName, MODEL);
    } finally {
      indexManager.setLevel(configured);
    }

    JsonNode embedding = liveMappings(indexName).path("properties").path("embedding");
    assertEquals("knn_vector", embedding.path("type").asText());
    assertEquals(DIMENSION, embedding.path("dimension").asInt());
    assertEquals(MODEL.id(), recordedModel(indexName));
    assertEquals(
        EmbeddingFieldUpdate.KEEP,
        EmbeddingFieldUpdate.updateFor(client.readEmbeddingField(indexName), MODEL),
        "a second start or smart reindex declares nothing");
    assertTrue(
        messages()
            .contains(
                "Declared the embedding field of index "
                    + indexName
                    + " for the embedding model "
                    + MODEL.id()
                    + " ("
                    + DIMENSION
                    + " dimensions)"),
        messages().toString());
  }

  @Test
  void theServerFindsAnIndexCreatedWithoutKnnAndCannotAddTheField() throws Exception {
    String indexName = "created_at_startup_table_search_index";
    withSearchRepository(
        mock(SearchRepository.class), () -> client.createIndex(indexName, FIRST_RELEASE_MAPPING));

    LiveEmbeddingField live = client.readEmbeddingField(indexName);

    assertEquals(EmbeddingFieldUpdate.LEAVE_OUT, EmbeddingFieldUpdate.updateFor(live, MODEL));
    assertEquals(indexName + " was created without vector support", live.describe(MODEL));
  }

  @Test
  void migrateCreatesAnIndexWithKnnForAModelNotLoadedYetAndTheServerDeclaresItsField()
      throws Exception {
    String indexName = "model_not_loaded_table_search_index";

    withModelNotLoadedYet(() -> client.createIndex(indexName, FIRST_RELEASE_MAPPING));

    assertTrue(knnEnabled(indexName), "index.knn is fixed at creation, so it must be set now");
    assertFalse(liveMappings(indexName).path("properties").has("embedding"));
    LiveEmbeddingField live = client.readEmbeddingField(indexName);
    assertEquals(EmbeddingFieldUpdate.DECLARE, EmbeddingFieldUpdate.updateFor(live, MODEL));
    client.declareEmbeddingField(indexName, MODEL);
    JsonNode embedding = liveMappings(indexName).path("properties").path("embedding");
    assertEquals("knn_vector", embedding.path("type").asText());
    assertEquals(DIMENSION, embedding.path("dimension").asInt());
    assertEquals(MODEL.id(), recordedModel(indexName));
  }

  @Test
  void anOntologySearchBeforeItsChunkIndexExistsFindsNothingWhileAnotherIndexNeedsARebuild() {
    health.recordCannotHold(
        "table_search_index",
        Set.of("table_search_index"),
        "table_search_index has knn_vector of 768 dimensions");
    EmbeddingClient embeddings = mock(EmbeddingClient.class);
    OpenSearchVectorService vectorService =
        new OpenSearchVectorService(client.getNewClient(), embeddings);
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.getVectorFieldHealth()).thenReturn(health);
    List<VectorSearchResponse> responses = new ArrayList<>();

    withSearchRepository(
        searchRepository,
        () ->
            responses.add(
                vectorService.search(
                    "churn",
                    Map.of("entityType", List.of(Entity.ONTOLOGY_CONCEPT)),
                    3,
                    0,
                    10,
                    0.0)));

    assertTrue(responses.getFirst().hits.isEmpty());
    verify(embeddings, never()).embedQuery(any(String.class));
  }

  /**
   * After a model switch, a recreate of both ontology term types rebuilds the ontology chunk index:
   * term chunks go to a staged generation for the model while the live index keeps its old
   * vectors, and the generation replaces it in one alias swap once both term types are promoted,
   * after which the index can hold the model's vectors and ontology vector search answers again.
   */
  @Test
  void aRecreateOfBothTermTypesRebuildsAnOntologyChunkIndexThatCannotHoldTheModel()
      throws Exception {
    String live = "ontology_embeddings_chunks";
    String stagedTermIndex = "ontology_concept_search_index_rebuild_it";
    send("PUT", "/" + live, chunkIndexFor(768, "an-earlier-model"));
    send("PUT", "/" + live + "/_doc/old_0?refresh=true", oldChunk(768));
    send("PUT", "/" + stagedTermIndex, TERM_INDEX_FOR_THE_MODEL);
    VectorFieldHealth readsTheCluster = healthReadingTheCluster();
    readsTheCluster.check(live);
    assertNeedsARebuild(readsTheCluster, live);
    EmbeddingClient embeddings = embeddingsOf(MODEL);
    OpenSearchVectorService vectorService =
        new OpenSearchVectorService(client.getNewClient(), embeddings);
    OntologyConcept concept = concept("Customer", "A person who buys");
    send(
        "PUT",
        "/" + stagedTermIndex + "/_doc/" + concept.getId() + "?refresh=true",
        "{\"name\":\"Customer\"}");
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.getVectorFieldHealth()).thenReturn(readsTheCluster);
    List<String> generations = new ArrayList<>();
    List<VectorSearchResponse> responses = new ArrayList<>();

    withSearchRepository(
        searchRepository,
        () -> {
          generations.add(vectorService.beginStagedOntologyChunkRecreate());
          writeTermEmbeddings(vectorService, concept, stagedTermIndex);
          vectorService.markEntityTypeReindexed(
              Entity.ONTOLOGY_CONCEPT, true, generations.getFirst());
          assertEquals(1, chunkCount(live, "old"), "the live index serves until promotion");
          vectorService.markEntityTypeReindexed(
              Entity.ONTOLOGY_PROPERTY, true, generations.getFirst());
          responses.add(
              vectorService.search(
                  "customer",
                  Map.of("entityType", List.of(Entity.ONTOLOGY_CONCEPT)),
                  3,
                  0,
                  10,
                  0.0));
        });

    String generation = generations.getFirst();
    assertTrue(generation.startsWith(live + "_g"), generation);
    assertEquals(Set.of(generation), indexesBehind(live), "the alias now names the generation");
    assertEquals(
        DIMENSION,
        liveMappings(generation).path("properties").path("embedding").path("dimension").asInt());
    assertTrue(readsTheCluster.mismatches().isEmpty(), readsTheCluster.mismatches().toString());
    assertEquals(1, responses.getFirst().hits.size(), responses.getFirst().hits.toString());
    assertEquals(concept.getId().toString(), responses.getFirst().hits.getFirst().get("parentId"));
    assertTrue(
        get("/" + stagedTermIndex + "/_doc/" + concept.getId()).path("_source").has("embedding"),
        "the rebuilt term document gets its vector too");
  }

  /** Reads the embedding field of a name on the cluster and records what it means for vectors. */
  private VectorFieldHealth healthReadingTheCluster() {
    AtomicReference<VectorFieldHealth> self = new AtomicReference<>();
    self.set(
        new VectorFieldHealth(
            name -> {
              LiveEmbeddingField field = client.readEmbeddingField(name);
              self.get().record(field, MODEL, EmbeddingFieldUpdate.updateFor(field, MODEL));
            }));
    return self.get();
  }

  private static void assertNeedsARebuild(VectorFieldHealth readsTheCluster, String indexName) {
    List<VectorFieldHealth.Mismatch> mismatches = readsTheCluster.mismatches();
    assertEquals(1, mismatches.size(), mismatches.toString());
    assertEquals(indexName, mismatches.getFirst().name());
  }

  private static EmbeddingClient embeddingsOf(EmbeddingModel model) {
    float[] vector = new float[model.dimension()];
    vector[0] = 1.0f;
    EmbeddingClient embeddings = mock(EmbeddingClient.class);
    when(embeddings.getModelId()).thenReturn(model.id());
    when(embeddings.getDimension()).thenReturn(model.dimension());
    when(embeddings.isAvailable()).thenReturn(true);
    when(embeddings.embed(any(String.class))).thenReturn(vector);
    when(embeddings.embedQuery(any(String.class))).thenReturn(vector);
    return embeddings;
  }

  private static OntologyConcept concept(String name, String description) {
    OntologyConcept concept =
        spy(
            new OntologyConcept()
                .withId(UUID.randomUUID())
                .withName(name)
                .withDescription(description));
    doReturn(
            new EntityReference()
                .withId(concept.getId())
                .withName(name)
                .withType(Entity.ONTOLOGY_CONCEPT))
        .when(concept)
        .getEntityReference();
    return concept;
  }

  /** A term embedding of the active release, as the release-aware reindex writes it. */
  private static void writeTermEmbeddings(
      OpenSearchVectorService vectorService, OntologyConcept concept, String termIndex) {
    try (MockedStatic<OntologyTermSearch> terms =
        mockStatic(OntologyTermSearch.class, CALLS_REAL_METHODS)) {
      terms
          .when(() -> OntologyTermSearch.writeCurrentEmbedding(any(), any(), any()))
          .thenAnswer(
              invocation -> {
                invocation.<FailableRunnable<?>>getArgument(2).run();
                return null;
              });
      vectorService.updateEntityEmbeddings(
          concept, termIndex, concept.getName() + ": " + concept.getDescription());
    }
  }

  private static String chunkIndexFor(int dimension, String modelId) {
    return "{\"settings\":{\"index\":{\"knn\":true}},\"mappings\":{\"dynamic\":false,"
        + "\"_meta\":{\"embedding_model\":\""
        + modelId
        + "\",\"embedding_dimension\":"
        + dimension
        + "},\"properties\":{\"parentId\":{\"type\":\"keyword\"},"
        + "\"entityType\":{\"type\":\"keyword\"},\"fingerprint\":{\"type\":\"keyword\"},"
        + "\"embedding\":{\"type\":\"knn_vector\",\"dimension\":"
        + dimension
        + ",\"method\":{\"name\":\"hnsw\",\"engine\":\"lucene\",\"space_type\":\"cosinesimil\"}}}}}";
  }

  private static String oldChunk(int dimension) {
    StringBuilder vector = new StringBuilder("[1.0");
    for (int i = 1; i < dimension; i++) {
      vector.append(",0.0");
    }
    return "{\"parentId\":\"old\",\"entityType\":\"ontologyConcept\",\"embedding\":"
        + vector.append(']')
        + "}";
  }

  private static final String TERM_INDEX_FOR_THE_MODEL =
      "{\"settings\":{\"index\":{\"knn\":true}},\"mappings\":{\"properties\":{"
          + "\"fingerprint\":{\"type\":\"keyword\"},\"name\":{\"type\":\"keyword\"},"
          + "\"embedding\":{\"type\":\"knn_vector\",\"dimension\":"
          + DIMENSION
          + ",\"method\":{\"name\":\"hnsw\",\"engine\":\"lucene\",\"space_type\":\"cosinesimil\"}}}}}";

  private long chunkCount(String index, String parentId) {
    try {
      send("POST", "/" + index + "/_refresh", "");
      return get("/" + index + "/_count?q=parentId:" + parentId).path("count").asLong();
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private Set<String> indexesBehind(String name) throws Exception {
    Set<String> indexes = new TreeSet<>();
    get("/" + name + "/_alias").fieldNames().forEachRemaining(indexes::add);
    return indexes;
  }

  private static EmbeddingModel model(int dimension) {
    return new EmbeddingModel("vector-mapping-update-" + dimension, dimension);
  }

  private static ElasticSearchConfiguration configFor(String host, int port) {
    return new ElasticSearchConfiguration()
        .withHost(host)
        .withPort(port)
        .withScheme("http")
        .withSearchType(ElasticSearchConfiguration.SearchType.OPENSEARCH)
        .withConnectionTimeoutSecs(10)
        .withSocketTimeoutSecs(30)
        .withKeepAliveTimeoutSecs(600)
        .withBatchSize(10)
        .withClusterAlias("");
  }

  private static IndexMapping entityIndex(String indexName) {
    return IndexMapping.builder()
        .indexName(indexName)
        .alias(indexName + "_alias")
        .parentAliases(List.of())
        .childAliases(List.of())
        .build();
  }

  /**
   * Runs the action with semantic search on and only the embedding model known, as {@code
   * Entity.getSearchRepository()} reports it to {@code migrate}: there is no embedding client.
   */
  private void withModel(EmbeddingModel model, Runnable action) {
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.buildsVectorIndexes()).thenReturn(true);
    when(searchRepository.getEmbeddingModel()).thenReturn(Optional.of(model));
    when(searchRepository.getVectorFieldHealth()).thenReturn(health);
    withSearchRepository(searchRepository, action);
  }

  /**
   * Runs the action with semantic search on for a model whose dimension is known only once it is
   * loaded, a DJL model, as {@code migrate} sees it.
   */
  private void withModelNotLoadedYet(Runnable action) {
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.buildsVectorIndexes()).thenReturn(true);
    when(searchRepository.getEmbeddingModel()).thenReturn(Optional.empty());
    when(searchRepository.getVectorFieldHealth()).thenReturn(health);
    withSearchRepository(searchRepository, action);
  }

  private static void withSearchRepository(SearchRepository searchRepository, Runnable action) {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      action.run();
    }
  }

  private String send(String method, String path, String body) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(baseUrl() + path))
            .header("Content-Type", "application/json")
            .method(method, HttpRequest.BodyPublishers.ofString(body))
            .build();
    HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
    assertTrue(response.statusCode() < 300, method + " " + path + ": " + response.body());
    return response.body();
  }

  private String baseUrl() {
    return "http://" + container.getHost() + ":" + container.getMappedPort(9200);
  }

  private JsonNode get(String path) throws IOException, InterruptedException {
    HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl() + path)).GET().build();
    return JsonUtils.readTree(http.send(request, HttpResponse.BodyHandlers.ofString()).body());
  }

  private JsonNode liveMappings(String indexName) throws Exception {
    return get("/" + indexName + "/_mapping").path(indexName).path("mappings");
  }

  private String recordedModel(String indexName) throws Exception {
    return liveMappings(indexName).path("_meta").path("embedding_model").asText(null);
  }

  private boolean knnEnabled(String indexName) throws Exception {
    return get("/" + indexName + "/_settings/index.knn")
        .path(indexName)
        .path("settings")
        .path("index")
        .path("knn")
        .asBoolean(false);
  }

  private static int methodM(JsonNode mappings) {
    return mappings
        .path("properties")
        .path("embedding")
        .path("method")
        .path("parameters")
        .path("m")
        .asInt();
  }

  private static Logger searchLogger() {
    return (Logger) LoggerFactory.getLogger("org.openmetadata.service.search");
  }

  private List<String> messages() {
    return searchLogs.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
  }

  private List<String> errors() {
    return searchLogs.list.stream()
        .filter(event -> event.getLevel() == Level.ERROR)
        .map(ILoggingEvent::getFormattedMessage)
        .toList();
  }

  /**
   * The index is recorded as one that cannot hold the vectors, for the reason given, and the one
   * report names it with the way out. Nothing is logged per index.
   */
  private void assertNeedsARebuild(String indexName, String reason) {
    List<VectorFieldHealth.Mismatch> mismatches = health.mismatches();
    assertEquals(1, mismatches.size(), mismatches.toString());
    assertTrue(mismatches.getFirst().reason().contains(reason), mismatches.toString());
    String report = health.report(MODEL).orElseThrow();
    assertTrue(report.contains(indexName), report);
    assertTrue(report.contains("openmetadata-ops.sh reindex"), report);
    assertTrue(errors().isEmpty(), "nothing is logged per index: " + errors());
  }
}
