package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.apache.commons.lang3.function.FailableRunnable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.OntologyTermSearch;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.VectorFieldHealth;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.generic.Body;
import os.org.opensearch.client.opensearch.generic.OpenSearchGenericClient;
import os.org.opensearch.client.opensearch.generic.Request;
import os.org.opensearch.client.opensearch.generic.Response;

/**
 * The rebuild of an ontology chunk index that cannot hold the embedding model's vectors: a
 * recreate of both ontology term types stages a generation for the model, every term chunk goes
 * there while the run lasts, and the generation replaces the live index in one alias swap once
 * both term types are promoted
 * (ADR:2026-11-26-the-server-reconciles-live-vector-fields-with-the-embedding-model).
 */
class OpenSearchVectorServiceOntologyChunkStagingTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String LIVE = "ontology_embeddings_chunks";
  private static final String STAGED_TERM_INDEX = "ontology_concept_search_index_rebuild_1";

  private final VectorFieldHealth health = new VectorFieldHealth(name -> {});
  private final List<Request> sent = new ArrayList<>();
  private final EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
  private OpenSearchVectorService service;
  private MockedStatic<Entity> entity;

  @BeforeEach
  void setUp() throws IOException {
    OpenSearchClient client = mock(OpenSearchClient.class);
    OpenSearchGenericClient generic = mock(OpenSearchGenericClient.class);
    when(client.generic()).thenReturn(generic);
    when(generic.execute(any(Request.class))).thenAnswer(call -> answer(call.getArgument(0)));
    when(embeddingClient.embedQuery(any(String.class))).thenReturn(new float[] {0.1f, 0.2f});
    when(embeddingClient.getModelId()).thenReturn("model-b");
    when(embeddingClient.getDimension()).thenReturn(384);
    when(embeddingClient.isAvailable()).thenReturn(true);
    service = new OpenSearchVectorService(client, embeddingClient);
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.getVectorFieldHealth()).thenReturn(health);
    entity = mockStatic(Entity.class, CALLS_REAL_METHODS);
    entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
  }

  @AfterEach
  void tearDown() {
    entity.close();
  }

  @Test
  void aRecreateOfBothTermTypesStagesAGenerationForTheModelWhenTheLiveOneCannotHoldIt()
      throws Exception {
    liveIndexHoldsAnotherModel();

    String generation = service.beginStagedOntologyChunkRecreate();

    assertTrue(generation.startsWith(LIVE + "_g"), generation);
    assertEquals(Optional.of(generation), service.stagedOntologyChunkTarget());
    JsonNode created = MAPPER.readTree(bodyOf("PUT", "/" + generation));
    assertFalse(created.has("aliases"), "a staged generation is created bare");
    JsonNode embedding = created.path("mappings").path("properties").path("embedding");
    assertEquals("knn_vector", embedding.path("type").asText());
    assertEquals(384, embedding.path("dimension").asInt());
    assertEquals(
        "model-b", created.path("mappings").path("_meta").path("embedding_model").asText());
    assertTrue(endpoints().stream().noneMatch(e -> e.startsWith("DELETE /" + LIVE + " ")));
  }

  @Test
  void anOntologyChunkIndexThatCanHoldTheModelIsWrittenInPlace() {
    assertNull(service.beginStagedOntologyChunkRecreate());
    assertTrue(service.stagedOntologyChunkTarget().isEmpty());
    assertTrue(sent.isEmpty(), "nothing is staged, so no request is sent: " + endpoints());
  }

  @Test
  void aTermChunkGoesToTheStagedGenerationAndNeverToTheLiveOne() throws Exception {
    liveIndexHoldsAnotherModel();
    String generation = service.beginStagedOntologyChunkRecreate();
    sent.clear();

    writeTermEmbeddings(STAGED_TERM_INDEX);

    String bulk = bodyOf("POST", "/_bulk");
    assertTrue(bulk.contains("\"_index\":\"" + generation + "\""), bulk);
    assertFalse(bulk.contains("\"_index\":\"" + LIVE + "\""), bulk);
    assertTrue(
        endpoints().stream().anyMatch(e -> e.startsWith("POST /" + STAGED_TERM_INDEX + "/_update")),
        "the term document of the staged term index gets its vector: " + endpoints());
  }

  @Test
  void withoutAStagedGenerationATermIsNotEmbeddedIntoALiveIndexThatCannotHoldTheModel()
      throws Exception {
    liveIndexHoldsAnotherModel();

    writeTermEmbeddings(STAGED_TERM_INDEX);

    assertTrue(sent.isEmpty(), "nothing is written: " + endpoints());
  }

  @Test
  void bothTermTypesPromotedSwapTheGenerationInAndRemoveTheLiveIndexAtomically() throws Exception {
    liveIndexHoldsAnotherModel();
    String generation = service.beginStagedOntologyChunkRecreate();

    service.markEntityTypeReindexed(Entity.ONTOLOGY_CONCEPT, true, generation);
    assertTrue(endpoints().stream().noneMatch(e -> e.startsWith("POST /_aliases")));
    service.markEntityTypeReindexed(Entity.ONTOLOGY_PROPERTY, true, generation);

    JsonNode actions = MAPPER.readTree(bodyOf("POST", "/_aliases")).path("actions");
    assertEquals(2, actions.size(), actions.toString());
    assertEquals(generation, actions.get(0).path("add").path("index").asText());
    assertEquals(LIVE, actions.get(0).path("add").path("alias").asText());
    assertEquals(LIVE, actions.get(1).path("remove_index").path("index").asText());
    assertTrue(service.stagedOntologyChunkTarget().isEmpty());
  }

  @Test
  void aTermTypeThatKeptItsLiveIndexKeepsTheLiveOntologyChunks() {
    liveIndexHoldsAnotherModel();
    String generation = service.beginStagedOntologyChunkRecreate();

    service.markEntityTypeReindexed(Entity.ONTOLOGY_CONCEPT, true, generation);
    service.markEntityTypeReindexed(Entity.ONTOLOGY_PROPERTY, false, generation);

    assertTrue(endpoints().stream().noneMatch(e -> e.startsWith("POST /_aliases")));
    assertTrue(service.stagedOntologyChunkTarget().isEmpty(), "the run's state ends with it");
  }

  @Test
  void marksOfAnotherRunNeverPromoteTheGeneration() {
    liveIndexHoldsAnotherModel();
    String generation = service.beginStagedOntologyChunkRecreate();

    service.markEntityTypeReindexed(Entity.ONTOLOGY_CONCEPT, true, LIVE + "_g1");
    service.markEntityTypeReindexed(Entity.ONTOLOGY_PROPERTY, true, LIVE + "_g1");

    assertTrue(endpoints().stream().noneMatch(e -> e.startsWith("POST /_aliases")));
    assertEquals(Optional.of(generation), service.stagedOntologyChunkTarget());
  }

  @Test
  void nothingButTheLiveTargetProbeReachesTheLiveIndexBeforePromotion() {
    liveIndexHoldsAnotherModel();
    service.beginStagedOntologyChunkRecreate();
    writeTermEmbeddings(STAGED_TERM_INDEX);

    assertTrue(
        endpoints().stream()
            .filter(e -> !e.equals("GET /" + LIVE + "/_alias"))
            .noneMatch(e -> e.contains(" /" + LIVE + "/")),
        endpoints().toString());
  }

  @Test
  void aParticipantWritesTermChunksToTheGenerationItsRunStaged() {
    service.latchParticipantStagedOntologyTarget(LIVE + "_g7");
    assertEquals(Optional.of(LIVE + "_g7"), service.stagedOntologyChunkTarget());

    service.clearParticipantStagedTarget();
    assertTrue(service.stagedOntologyChunkTarget().isEmpty());
  }

  @Test
  void aRunThatDiesBeforeFinalizingForgetsItsGeneration() {
    liveIndexHoldsAnotherModel();
    String generation = service.beginStagedOntologyChunkRecreate();

    service.clearStagedChunkState(generation);

    assertTrue(service.stagedOntologyChunkTarget().isEmpty());
  }

  private void liveIndexHoldsAnotherModel() {
    health.recordCannotHold(LIVE, Set.of(LIVE), LIVE + " has knn_vector of 768 dimensions");
  }

  private void writeTermEmbeddings(String termIndex) {
    OntologyConcept concept =
        spy(
            new OntologyConcept()
                .withId(UUID.randomUUID())
                .withName("Customer")
                .withDescription("A person who buys"));
    doReturn(
            new EntityReference()
                .withId(concept.getId())
                .withName("Customer")
                .withType(Entity.ONTOLOGY_CONCEPT))
        .when(concept)
        .getEntityReference();
    try (MockedStatic<OntologyTermSearch> terms =
        mockStatic(OntologyTermSearch.class, CALLS_REAL_METHODS)) {
      terms
          .when(() -> OntologyTermSearch.writeCurrentEmbedding(any(), any(), any()))
          .thenAnswer(
              invocation -> {
                invocation.<FailableRunnable<?>>getArgument(2).run();
                return null;
              });
      service.updateEntityEmbeddings(concept, termIndex, "Customer: A person who buys");
    }
  }

  // The live ontology chunk index is a physical index, as every ontology reindex left it so far.
  private Response answer(Request request) {
    sent.add(request);
    String endpoint = request.getEndpoint();
    String body = "{}";
    if (endpoint.equals("/" + LIVE + "/_alias")) {
      body = "{\"" + LIVE + "\":{\"aliases\":{}}}";
    } else if (endpoint.endsWith("/_count")) {
      body = "{\"count\":2}";
    }
    Response response = mock(Response.class);
    when(response.getStatus()).thenReturn(200);
    when(response.getBody())
        .thenReturn(
            Optional.of(Body.from(body.getBytes(StandardCharsets.UTF_8), "application/json")));
    return response;
  }

  private List<String> endpoints() {
    return sent.stream().map(r -> r.getMethod() + " " + r.getEndpoint()).toList();
  }

  private String bodyOf(String method, String endpoint) throws IOException {
    Request request =
        sent.stream()
            .filter(r -> r.getMethod().equals(method) && r.getEndpoint().equals(endpoint))
            .findFirst()
            .orElseThrow(() -> new AssertionError(method + " " + endpoint + " in " + endpoints()));
    return new String(request.getBody().orElseThrow().bodyAsBytes(), StandardCharsets.UTF_8);
  }
}
