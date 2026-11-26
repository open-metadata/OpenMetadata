package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.ContextMemoryType;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.indexes.ContextMemoryIndex;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.client.EmbeddingModel;
import org.openmetadata.service.search.vector.utils.DTOs;
import org.slf4j.LoggerFactory;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.generic.Body;
import os.org.opensearch.client.opensearch.generic.OpenSearchGenericClient;
import os.org.opensearch.client.opensearch.generic.Request;
import os.org.opensearch.client.opensearch.generic.Response;

class OpenSearchVectorServiceTest {
  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void contentChangesReembedWhileFilterAndMappingChangesRestampStoredVectors() {
    ContextMemory memory = refreshableMemory();
    String fingerprint = VectorDocBuilder.computeFingerprintForEntity(memory);
    int current = VectorDocBuilder.CHUNK_DOC_VERSION;

    assertEquals(
        AbstractVectorIndexService.ChunkRefresh.NONE,
        refresh(memory, header(fingerprint, current, "Approved", "unanchored")));
    assertEquals(AbstractVectorIndexService.ChunkRefresh.REEMBED, refresh(memory, null));
    assertEquals(
        AbstractVectorIndexService.ChunkRefresh.REEMBED,
        refresh(memory, header("stale", current, "Approved", "unanchored")));
    assertEquals(
        AbstractVectorIndexService.ChunkRefresh.RESTAMP,
        refresh(memory, header(fingerprint, current - 1, "Approved", "unanchored")));
    assertEquals(
        AbstractVectorIndexService.ChunkRefresh.RESTAMP,
        refresh(memory, header(fingerprint, current, "Deprecated", "unanchored")));
    UUID anchorId = UUID.randomUUID();
    memory.setPrimaryEntity(new EntityReference().withId(anchorId).withType("table"));
    assertEquals(
        AbstractVectorIndexService.ChunkRefresh.RESTAMP,
        refresh(memory, header(fingerprint, current, "Approved", "unanchored")));
    assertEquals(
        AbstractVectorIndexService.ChunkRefresh.NONE,
        refresh(memory, header(fingerprint, current, "Approved", anchorId.toString())));
  }

  /**
   * Pinning or retyping a memory leaves its embedded text alone, so only the stamped kind can tell the
   * chunks are stale — and a filtered recall reads exactly that kind.
   */
  @Test
  void aNewKindRestampsTheChunksWithoutReembedding() {
    ContextMemory memory = refreshableMemory();
    String fingerprint = VectorDocBuilder.computeFingerprintForEntity(memory);
    int current = VectorDocBuilder.CHUNK_DOC_VERSION;

    memory.withPinned(true);
    assertEquals(fingerprint, VectorDocBuilder.computeFingerprintForEntity(memory));
    assertEquals(
        AbstractVectorIndexService.ChunkRefresh.RESTAMP,
        refresh(memory, header(fingerprint, current, "Approved", "unanchored")));

    memory.withPinned(false).withMemoryType(ContextMemoryType.PREFERENCE);
    assertEquals(
        AbstractVectorIndexService.ChunkRefresh.RESTAMP,
        refresh(memory, header(fingerprint, current, "Approved", "unanchored")));
    assertEquals(
        AbstractVectorIndexService.ChunkRefresh.RESTAMP,
        refresh(memory, header(fingerprint, current, "Approved", "unanchored", null)),
        "a chunk stamped before the kind existed is restamped");
  }

  /**
   * The fingerprint covers the text and not the model, so chunks made by another model, for
   * another dimension, or before chunks recorded their model need new vectors even when the text
   * is unchanged. ADR:2026-11-11-reindex-reuses-an-embedding-only-when-its-fingerprint-matches
   */
  @Test
  void chunksOfAnotherModelOrOfNoRecordedModelAreReembedded() {
    Table table = new Table().withId(UUID.randomUUID()).withName("orders");
    String fingerprint = VectorDocBuilder.computeFingerprintForEntity(table);
    int current = VectorDocBuilder.CHUNK_DOC_VERSION;

    for (EmbeddingModel stored :
        Arrays.asList(
            new EmbeddingModel("another-model", MODEL.dimension()),
            new EmbeddingModel(MODEL.id(), MODEL.dimension() + 1),
            null)) {
      assertEquals(
          AbstractVectorIndexService.ChunkRefresh.REEMBED,
          refresh(
              table,
              new AbstractVectorIndexService.ChunkHeader(
                  fingerprint, stored, 1, current, null, null, null)),
          "chunks made by " + stored);
    }
  }

  @Test
  void filterMetadataOnlyAppliesToMemoryChunks() {
    Table table = new Table().withId(UUID.randomUUID()).withName("orders");
    String fingerprint = VectorDocBuilder.computeFingerprintForEntity(table);

    assertEquals(
        AbstractVectorIndexService.ChunkRefresh.NONE,
        refresh(table, header(fingerprint, VectorDocBuilder.CHUNK_DOC_VERSION, null, null, null)));
  }

  /**
   * The 2-arg {@code updateEntityEmbeddings} overload must refuse ontology terms: the
   * release-aware writer needs the published release-snapshot body, and embedding from the
   * mutable working (draft) row would publish drafts, deprecated, and
   * not-in-active-release terms straight into the searchable ontology chunk index. Manual term
   * reindexing goes through the release-aware bulk writer (reindex), which passes the body into the
   * 3-arg overload. This is the regression for the {@code reembed} draft-leak bug.
   */
  @Test
  void twoArgOverloadRefusesOntologyConceptWithoutWritingOrEmbedding() throws Exception {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.putIfAbsent(
        "ontologyconcept", Entity.ONTOLOGY_CONCEPT);
    when(mockEmbeddingClient.isAvailable()).thenReturn(true);
    OntologyConcept term =
        new OntologyConcept()
            .withId(UUID.randomUUID())
            .withName("order")
            .withFullyQualifiedName("shop.order")
            .withDescription("A purchase")
            .withDeleted(false);

    Logger logger = (Logger) LoggerFactory.getLogger(AbstractVectorIndexService.class);
    ListAppender<ILoggingEvent> appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);
    try {
      vectorService.updateEntityEmbeddings(term, "entityIndex");

      // No chunk write, no entity-doc partial update, and crucially no embedding provider call:
      // the guard refuses before building chunk docs, so drafts are never paid for or published.
      verify(mockGenericClient, never()).execute(any());
      verify(mockEmbeddingClient, never()).embed(any(String.class));
      assertTrue(
          appender.list.stream()
              .anyMatch(
                  event ->
                      event.getLevel() == Level.WARN
                          && event.getFormattedMessage().contains("release-aware reindex path")),
          "must warn that term rebuilds go through the release-aware path");
    } finally {
      logger.detachAppender(appender);
      appender.stop();
    }
  }

  /** {@code reembed} must not embed a term from its working row either. */
  @Test
  void reembedRefusesAnOntologyTermWithoutWritingOrEmbedding() throws Exception {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.putIfAbsent(
        "ontologyconcept", Entity.ONTOLOGY_CONCEPT);
    when(mockEmbeddingClient.isAvailable()).thenReturn(true);
    OntologyConcept term =
        new OntologyConcept()
            .withId(UUID.randomUUID())
            .withName("order")
            .withFullyQualifiedName("shop.order")
            .withDescription("A purchase")
            .withDeleted(false);

    assertFalse(vectorService.reembedEntity(term, "entityIndex"));

    verify(mockGenericClient, never()).execute(any());
    verify(mockEmbeddingClient, never()).embed(any(String.class));
  }

  /** The refusal must cover both ontology term types (concept and property). */
  @Test
  void twoArgOverloadRefusesOntologyPropertyWithoutWritingOrEmbedding() throws Exception {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.putIfAbsent(
        "ontologyproperty", Entity.ONTOLOGY_PROPERTY);
    when(mockEmbeddingClient.isAvailable()).thenReturn(true);
    OntologyProperty term =
        new OntologyProperty()
            .withId(UUID.randomUUID())
            .withName("code")
            .withFullyQualifiedName("shop.code")
            .withDescription("An order code")
            .withDeleted(false);

    vectorService.updateEntityEmbeddings(term, "entityIndex");

    verify(mockGenericClient, never()).execute(any());
    verify(mockEmbeddingClient, never()).embed(any(String.class));
  }

  /**
   * A non-term entity passed to the 2-arg overload is unaffected: it still writes its chunks and
   * entity-doc embedding. Guards against an over-broad fix that would skip every entity.
   */
  @Test
  void twoArgOverloadStillWritesNonTermEntities() throws Exception {
    when(mockEmbeddingClient.isAvailable()).thenReturn(true);
    when(mockEmbeddingClient.embed(any(String.class))).thenReturn(new float[] {0.1f, 0.2f, 0.3f});
    setField("chunkIndexEnsured", true);
    mockOpenSearchResponse("{\"found\":false,\"hits\":{\"hits\":[]},\"errors\":false}");

    vectorService.updateEntityEmbeddings(
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("svc.db.sch.orders")
            .withDescription("orders"),
        "entityIndex");

    assertFalse(capturedBulkTargets().isEmpty(), "a non-term entity must still write its chunks");
  }

  /** A recreate in flight would otherwise promote the chunks it copied before this update. */
  @Test
  void liveUpdateDuringARecreateAlsoRewritesTheStagedGeneration() throws Exception {
    when(mockEmbeddingClient.isAvailable()).thenReturn(true);
    when(mockEmbeddingClient.embed(any(String.class))).thenReturn(new float[] {0.1f, 0.2f, 0.3f});
    setField("chunkIndexEnsured", true);
    setField("stagedChunkIndex", "staged_chunk_generation");
    mockOpenSearchResponse("{\"found\":false,\"hits\":{\"hits\":[]},\"errors\":false}");

    vectorService.updateEntityEmbeddings(
        refreshableMemory().withEntityStatus(ContextMemoryStatus.REJECTED), "entityIndex");

    ArgumentCaptor<os.org.opensearch.client.opensearch.generic.Request> captor =
        ArgumentCaptor.forClass(os.org.opensearch.client.opensearch.generic.Request.class);
    verify(mockGenericClient, atLeastOnce()).execute(captor.capture());
    List<String> bulkTargets =
        captor.getAllValues().stream()
            .filter(request -> "/_bulk".equals(request.getEndpoint()))
            .map(OpenSearchVectorServiceTest::bodyOf)
            .toList();
    String live = vectorService.getChunkIndexName();
    assertTrue(bulkTargets.stream().anyMatch(body -> body.contains("\"_index\":\"" + live + "\"")));
    assertTrue(
        bulkTargets.stream()
            .anyMatch(body -> body.contains("\"_index\":\"staged_chunk_generation\"")));
  }

  /**
   * On a participant JVM (stagedChunkIndex is null — only the coordinator sets it), the run-scoped
   * staged chunk index latched from ReindexContext into participantStagedTarget is what the
   * live-edit mirror writes to, instead of lossy cluster-state discovery. This is the fix for the
   * multi-node bug where a stale cached null silently dropped the mirror write.
   */
  @Test
  void liveUpdateOnAParticipantMirrorsIntoTheLatchedStagedTarget() throws Exception {
    when(mockEmbeddingClient.isAvailable()).thenReturn(true);
    when(mockEmbeddingClient.embed(any(String.class))).thenReturn(new float[] {0.1f, 0.2f, 0.3f});
    setField("chunkIndexEnsured", true);
    // Participant: stagedChunkIndex (coordinator-only) stays null; the run-scoped target is
    // latched.
    vectorService.latchParticipantStagedTarget("participant_chunk_generation");
    // Stale null discovery cache, fresh within TTL — must NOT win over the latch.
    setField("cachedSinkTarget", null);
    setField("cachedSinkTargetAt", System.currentTimeMillis());
    mockOpenSearchResponse("{\"found\":false,\"hits\":{\"hits\":[]},\"errors\":false}");

    vectorService.updateEntityEmbeddings(
        refreshableMemory().withEntityStatus(ContextMemoryStatus.REJECTED), "entityIndex");

    List<String> bulkTargets = capturedBulkTargets();
    String live = vectorService.getChunkIndexName();
    assertTrue(bulkTargets.stream().anyMatch(body -> body.contains("\"_index\":\"" + live + "\"")));
    assertTrue(
        bulkTargets.stream()
            .anyMatch(body -> body.contains("\"_index\":\"participant_chunk_generation\"")));
  }

  /**
   * The participant latch shadows the stale-null discovery cache: when both the latch and a
   * different cached discovery value are present, the latch wins. Without the latch being
   * consulted first, "discovered_gen" would have been used; confirming the latch wins proves
   * resolveChunkSinkTarget's resolution order (stagedChunkIndex, then participant latch, then
   * discovery).
   */
  @Test
  void participantLatchShadowsTheStaleDiscoveryCache() throws Exception {
    when(mockEmbeddingClient.isAvailable()).thenReturn(true);
    when(mockEmbeddingClient.embed(any(String.class))).thenReturn(new float[] {0.1f, 0.2f, 0.3f});
    setField("chunkIndexEnsured", true);
    vectorService.latchParticipantStagedTarget("latched_gen");
    // A discovery cache holding a different value that would win if the latch weren't first.
    setField("cachedSinkTarget", "discovered_gen");
    setField("cachedSinkTargetAt", System.currentTimeMillis());
    mockOpenSearchResponse("{\"found\":false,\"hits\":{\"hits\":[]},\"errors\":false}");

    vectorService.updateEntityEmbeddings(
        refreshableMemory().withEntityStatus(ContextMemoryStatus.REJECTED), "entityIndex");

    List<String> bulkTargets = capturedBulkTargets();
    assertTrue(
        bulkTargets.stream().anyMatch(body -> body.contains("\"_index\":\"latched_gen\"")),
        "mirror must target the latched generation");
    assertFalse(
        bulkTargets.stream().anyMatch(body -> body.contains("\"_index\":\"discovered_gen\"")),
        "mirror must not target the stale discovery cache value");
  }

  /**
   * Reproduces the original bug: on a participant JVM with no latch and a stale null discovery
   * cache within TTL, the mirror is skipped (no staged bulk write). The live write still lands in
   * the live alias target. The skip is logged at DEBUG because no recreate may be running, but the
   * data outcome when the latch is absent remains: only the live index receives the chunks.
   */
  @Test
  void liveUpdateSkipsTheMirrorWhenNoStagedTargetResolvesOnAParticipant() throws Exception {
    when(mockEmbeddingClient.isAvailable()).thenReturn(true);
    when(mockEmbeddingClient.embed(any(String.class))).thenReturn(new float[] {0.1f, 0.2f, 0.3f});
    setField("chunkIndexEnsured", true);
    // No stagedChunkIndex (participant), no participantStagedTarget (not yet latched), and a
    // discovery cache holding a stale null within TTL — the exact window the bug lives in.
    setField("cachedSinkTarget", null);
    setField("cachedSinkTargetAt", System.currentTimeMillis());
    mockOpenSearchResponse("{\"found\":false,\"hits\":{\"hits\":[]},\"errors\":false}");

    vectorService.updateEntityEmbeddings(
        refreshableMemory().withEntityStatus(ContextMemoryStatus.REJECTED), "entityIndex");

    List<String> bulkTargets = capturedBulkTargets();
    String live = vectorService.getChunkIndexName();
    // The live write still happens — it just lands in the soon-to-be-removed old generation.
    assertTrue(bulkTargets.stream().anyMatch(body -> body.contains("\"_index\":\"" + live + "\"")));
    // No mirror write: the only bulk target is the live index.
    assertEquals(1, bulkTargets.size(), "only the live chunk write; the mirror is skipped");
  }

  /**
   * clearParticipantStagedTarget drops the latch so a finished run cannot steer subsequent edits
   * into its generation. After clearing, the participant falls back to discovery (here a stale
   * null within TTL), and the mirror is skipped — the same behavior as an unlatched participant.
   */
  @Test
  void clearParticipantStagedTargetRemovesTheLatch() throws Exception {
    when(mockEmbeddingClient.isAvailable()).thenReturn(true);
    when(mockEmbeddingClient.embed(any(String.class))).thenReturn(new float[] {0.1f, 0.2f, 0.3f});
    setField("chunkIndexEnsured", true);
    vectorService.latchParticipantStagedTarget("stale_latched_gen");
    vectorService.clearParticipantStagedTarget();
    setField("cachedSinkTarget", null);
    setField("cachedSinkTargetAt", System.currentTimeMillis());
    mockOpenSearchResponse("{\"found\":false,\"hits\":{\"hits\":[]},\"errors\":false}");

    vectorService.updateEntityEmbeddings(
        refreshableMemory().withEntityStatus(ContextMemoryStatus.REJECTED), "entityIndex");

    List<String> bulkTargets = capturedBulkTargets();
    assertFalse(
        bulkTargets.stream().anyMatch(body -> body.contains("\"_index\":\"stale_latched_gen\"")),
        "a cleared latch must not steer the mirror into its generation");
  }

  /**
   * The coordinator's stagedChunkIndex takes precedence over the participant latch, so a node
   * that is both coordinating and would carry a participant latch still mirrors into its own
   * run-scoped generation (and promotion gating stays anchored on stagedChunkIndex).
   */
  @Test
  void coordinatorStagedChunkIndexTakesPrecedenceOverTheParticipantLatch() throws Exception {
    when(mockEmbeddingClient.isAvailable()).thenReturn(true);
    when(mockEmbeddingClient.embed(any(String.class))).thenReturn(new float[] {0.1f, 0.2f, 0.3f});
    setField("chunkIndexEnsured", true);
    setField("stagedChunkIndex", "coordinator_gen");
    vectorService.latchParticipantStagedTarget("participant_gen");
    mockOpenSearchResponse("{\"found\":false,\"hits\":{\"hits\":[]},\"errors\":false}");

    vectorService.updateEntityEmbeddings(
        refreshableMemory().withEntityStatus(ContextMemoryStatus.REJECTED), "entityIndex");

    List<String> bulkTargets = capturedBulkTargets();
    assertTrue(
        bulkTargets.stream().anyMatch(body -> body.contains("\"_index\":\"coordinator_gen\"")),
        "coordinator's stagedChunkIndex wins");
    assertFalse(
        bulkTargets.stream().anyMatch(body -> body.contains("\"_index\":\"participant_gen\"")),
        "participant latch must not override the coordinator");
  }

  private static ContextMemory refreshableMemory() {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName("memory")
        .withTitle("SQL preference")
        .withQuestion("Should keywords be upper case?")
        .withAnswer("Yes, use upper case keywords.")
        .withEntityStatus(ContextMemoryStatus.APPROVED);
  }

  @Test
  void liveUpdateWithoutARecreateDoesNotWarnAboutMissingStagedChunks() throws Exception {
    when(mockEmbeddingClient.isAvailable()).thenReturn(true);
    when(mockEmbeddingClient.embed(any(String.class))).thenReturn(new float[] {0.1f, 0.2f, 0.3f});
    setField("chunkIndexEnsured", true);
    setField("cachedSinkTargetAt", System.currentTimeMillis());
    mockOpenSearchResponse("{\"found\":false,\"hits\":{\"hits\":[]},\"errors\":false}");

    Logger logger = (Logger) LoggerFactory.getLogger(AbstractVectorIndexService.class);
    ListAppender<ILoggingEvent> appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);
    try {
      vectorService.updateEntityEmbeddings(refreshableMemory(), "entityIndex");

      assertEquals(1, capturedBulkTargets().size(), "the live chunk update must still be written");
      assertTrue(
          appender.list.stream()
              .noneMatch(
                  event ->
                      event.getLevel().isGreaterOrEqual(Level.WARN)
                          && event.getFormattedMessage().contains("staged")),
          "an ordinary live update has no staged generation and must not warn about data loss");
    } finally {
      logger.detachAppender(appender);
      appender.stop();
    }
  }

  private static AbstractVectorIndexService.ChunkRefresh refresh(
      org.openmetadata.schema.EntityInterface<?> entity,
      AbstractVectorIndexService.ChunkHeader header) {
    return AbstractVectorIndexService.chunkRefresh(
        entity, VectorDocBuilder.computeFingerprintForEntity(entity), MODEL, header);
  }

  private static final EmbeddingModel MODEL = new EmbeddingModel("chunk-model", 3);

  /** A header stamped with the kind {@link #refreshableMemory} has. */
  private static AbstractVectorIndexService.ChunkHeader header(
      String fingerprint, int docVersion, String status, String anchorId) {
    return header(fingerprint, docVersion, status, anchorId, MEMORY_KIND);
  }

  private static AbstractVectorIndexService.ChunkHeader header(
      String fingerprint,
      int docVersion,
      String status,
      String anchorId,
      AbstractVectorIndexService.MemoryKind kind) {
    return new AbstractVectorIndexService.ChunkHeader(
        fingerprint, MODEL, 1, docVersion, status, anchorId, kind);
  }

  private static final AbstractVectorIndexService.MemoryKind MEMORY_KIND =
      AbstractVectorIndexService.MemoryKind.of(refreshableMemory());

  private static String jsonString(String value) {
    return value == null ? "null" : "\"" + value + "\"";
  }

  private void setField(String name, Object value) throws ReflectiveOperationException {
    java.lang.reflect.Field field = AbstractVectorIndexService.class.getDeclaredField(name);
    field.setAccessible(true);
    field.set(vectorService, value);
  }

  private static String bodyOf(os.org.opensearch.client.opensearch.generic.Request request) {
    return request
        .getBody()
        .map(body -> new String(body.bodyAsBytes(), java.nio.charset.StandardCharsets.UTF_8))
        .orElse("");
  }

  private List<String> capturedBulkTargets() throws IOException {
    ArgumentCaptor<os.org.opensearch.client.opensearch.generic.Request> captor =
        ArgumentCaptor.forClass(os.org.opensearch.client.opensearch.generic.Request.class);
    verify(mockGenericClient, atLeastOnce()).execute(captor.capture());
    return captor.getAllValues().stream()
        .filter(request -> "/_bulk".equals(request.getEndpoint()))
        .map(OpenSearchVectorServiceTest::bodyOf)
        .toList();
  }

  @Test
  void chunkHeaderRequestsTheMemoryStatusFieldUsedByChunkDocuments() throws IOException {
    ContextMemory memory =
        new ContextMemory()
            .withId(UUID.randomUUID())
            .withName("memory")
            .withTitle("SQL preference")
            .withQuestion("Should keywords be upper case?")
            .withAnswer("Yes, use upper case keywords.")
            .withEntityStatus(ContextMemoryStatus.APPROVED);
    String fingerprint = VectorDocBuilder.computeFingerprintForEntity(memory);
    mockOpenSearchResponse(
        "{\"found\":true,\"_source\":{\"fingerprint\":\""
            + fingerprint
            + "\",\"chunkCount\":1,\"docVersion\":"
            + VectorDocBuilder.CHUNK_DOC_VERSION
            + ",\"embeddingModel\":\""
            + MODEL.id()
            + "\",\"embeddingDimension\":"
            + MODEL.dimension()
            + ",\"entityStatus\":\"Approved\",\"anchorId\":\"unanchored\""
            + ",\"memoryScope\":"
            + jsonString(ContextMemoryIndex.memoryScopeValue(memory))
            + ",\"memoryType\":"
            + jsonString(ContextMemoryIndex.memoryTypeValue(memory))
            + ",\"pinned\":false}}");

    vectorService.updateEntityEmbeddingChunks(memory, "chunkIndex");

    // One GET and nothing else: a header matching the memory's status, anchor and kind is current.
    ArgumentCaptor<os.org.opensearch.client.opensearch.generic.Request> captor =
        ArgumentCaptor.forClass(os.org.opensearch.client.opensearch.generic.Request.class);
    verify(mockGenericClient).execute(captor.capture());
    assertEquals(
        "/chunkIndex/_doc/"
            + memory.getId()
            + "_0?_source_includes=fingerprint,chunkCount,docVersion,"
            + String.join(
                ",",
                EmbeddingModel.ID_FIELD,
                EmbeddingModel.DIMENSION_FIELD,
                ContextMemoryIndex.FIELD_STATUS,
                ContextMemoryIndex.FIELD_ANCHOR_ID,
                ContextMemoryIndex.FIELD_MEMORY_SCOPE,
                ContextMemoryIndex.FIELD_MEMORY_TYPE,
                ContextMemoryIndex.FIELD_PINNED),
        captor.getValue().getEndpoint());
  }

  private OpenSearchVectorService vectorService;
  private OpenSearchClient mockClient;
  private EmbeddingClient mockEmbeddingClient;
  private OpenSearchGenericClient mockGenericClient;

  @BeforeEach
  void setup() {
    mockClient = mock(OpenSearchClient.class);
    mockEmbeddingClient = mock(EmbeddingClient.class);
    mockGenericClient = mock(OpenSearchGenericClient.class);

    when(mockClient.generic()).thenReturn(mockGenericClient);

    when(mockEmbeddingClient.embedQuery(any(String.class)))
        .thenReturn(new float[] {0.1f, 0.2f, 0.3f});
    when(mockEmbeddingClient.getModelId()).thenReturn(MODEL.id());
    when(mockEmbeddingClient.getDimension()).thenReturn(MODEL.dimension());

    vectorService = new OpenSearchVectorService(mockClient, mockEmbeddingClient);
  }

  @Test
  void testThresholdFilteringRemovesLowScoreResults() throws IOException {
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 4},
            "hits": [
              {
                "_id": "id1",
                "_score": 0.9,
                "_source": {
                  "parentId": "parent1",
                  "chunkIndex": 0,
                  "text": "High score chunk"
                }
              },
              {
                "_id": "id2",
                "_score": 0.7,
                "_source": {
                  "parentId": "parent2",
                  "chunkIndex": 0,
                  "text": "Medium score chunk"
                }
              },
              {
                "_id": "id3",
                "_score": 0.4,
                "_source": {
                  "parentId": "parent3",
                  "chunkIndex": 0,
                  "text": "Low score chunk"
                }
              },
              {
                "_id": "id4",
                "_score": 0.2,
                "_source": {
                  "parentId": "parent4",
                  "chunkIndex": 0,
                  "text": "Very low score chunk"
                }
              }
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 10, 0, 100, 0.5);

    assertNotNull(results);
    assertEquals(2, results.hits.size(), "Should return 2 results (scores 0.9 and 0.7)");

    for (Map<String, Object> result : results.hits) {
      double score = (double) result.get("_score");
      assertTrue(score >= 0.5, "All results should have score >= 0.5, got: " + score);
    }
  }

  @Test
  void testScoreFieldIncludedInResults() throws IOException {
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 1},
            "hits": [
              {
                "_id": "id1",
                "_score": 0.85,
                "_source": {
                  "parentId": "parent1",
                  "chunkIndex": 0,
                  "text": "Test chunk"
                }
              }
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

    assertEquals(1, results.hits.size());
    assertTrue(results.hits.get(0).containsKey("_score"), "Result should contain _score field");
    assertEquals(0.85, (double) results.hits.get(0).get("_score"), 0.001);
  }

  @Test
  void testParentGroupingLimitsDistinctParents() throws IOException {
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 8},
            "hits": [
              {"_id": "c1", "_score": 0.9, "_source": {"parentId": "parent1", "chunkIndex": 0}},
              {"_id": "c2", "_score": 0.88, "_source": {"parentId": "parent1", "chunkIndex": 1}},
              {"_id": "c3", "_score": 0.85, "_source": {"parentId": "parent1", "chunkIndex": 2}},
              {"_id": "c4", "_score": 0.8, "_source": {"parentId": "parent2", "chunkIndex": 0}},
              {"_id": "c5", "_score": 0.78, "_source": {"parentId": "parent2", "chunkIndex": 1}},
              {"_id": "c6", "_score": 0.7, "_source": {"parentId": "parent3", "chunkIndex": 0}},
              {"_id": "c7", "_score": 0.68, "_source": {"parentId": "parent3", "chunkIndex": 1}},
              {"_id": "c8", "_score": 0.6, "_source": {"parentId": "parent4", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 2, 0, 100, 0.0);

    assertEquals(
        5,
        results.hits.size(),
        "Should return 5 chunks from 2 distinct parents (3 from p1, 2 from p2)");

    long distinctParents = results.hits.stream().map(r -> r.get("parentId")).distinct().count();
    assertEquals(2, distinctParents, "Should have chunks from exactly 2 distinct parents");
  }

  @Test
  void testZeroThresholdReturnsAllResults() throws IOException {
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 3},
            "hits": [
              {"_id": "id1", "_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_id": "id2", "_score": 0.5, "_source": {"parentId": "p2", "chunkIndex": 0}},
              {"_id": "id3", "_score": 0.1, "_source": {"parentId": "p3", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

    assertEquals(3, results.hits.size(), "With threshold 0.0, should return all 3 results");
  }

  @Test
  void testHighThresholdFiltersAllResults() throws IOException {
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 3},
            "hits": [
              {"_id": "id1", "_score": 0.5, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_id": "id2", "_score": 0.3, "_source": {"parentId": "p2", "chunkIndex": 0}},
              {"_id": "id3", "_score": 0.1, "_source": {"parentId": "p3", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 10, 0, 100, 0.9);

    assertEquals(0, results.hits.size(), "With threshold 0.9, all results should be filtered out");
  }

  @Test
  void testLegacyVectorSearchResponseConstructorLeavesPaginationFieldsUnset() {
    DTOs.VectorSearchResponse response =
        new DTOs.VectorSearchResponse(12L, List.of(Map.of("parentId", "parent1")));

    assertEquals(12L, response.tookMillis);
    assertEquals(1, response.hits.size());
    assertNull(response.totalHits);
    assertNull(response.hasMore);
  }

  @Test
  void testHitsWithoutParentIdFallBackToDocId() throws IOException {
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 3},
            "hits": [
              {"_id": "entity1", "_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_id": "entity2", "_score": 0.8, "_source": {"chunkIndex": 0, "text": "no parentId"}},
              {"_id": "entity3", "_score": 0.7, "_source": {"parentId": "p2", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

    assertEquals(
        3, results.hits.size(), "Hits without parentId should fall back to _id for grouping");
  }

  @Test
  void testRequestedSizeLimitsDistinctParents() throws IOException {
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 10},
            "hits": [
              {"_id": "id1", "_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_id": "id2", "_score": 0.8, "_source": {"parentId": "p2", "chunkIndex": 0}},
              {"_id": "id3", "_score": 0.7, "_source": {"parentId": "p3", "chunkIndex": 0}},
              {"_id": "id4", "_score": 0.6, "_source": {"parentId": "p4", "chunkIndex": 0}},
              {"_id": "id5", "_score": 0.5, "_source": {"parentId": "p5", "chunkIndex": 0}},
              {"_id": "id6", "_score": 0.4, "_source": {"parentId": "p6", "chunkIndex": 0}},
              {"_id": "id7", "_score": 0.3, "_source": {"parentId": "p7", "chunkIndex": 0}},
              {"_id": "id8", "_score": 0.2, "_source": {"parentId": "p8", "chunkIndex": 0}},
              {"_id": "id9", "_score": 0.15, "_source": {"parentId": "p9", "chunkIndex": 0}},
              {"_id": "id10", "_score": 0.1, "_source": {"parentId": "p10", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 3, 0, 100, 0.0);

    assertEquals(3, results.hits.size(), "Should limit to 3 distinct parents");

    long distinctParents = results.hits.stream().map(r -> r.get("parentId")).distinct().count();
    assertEquals(3, distinctParents, "Should have exactly 3 distinct parents");
  }

  @Test
  void testPaginationSkipsParentsCorrectly() throws IOException {
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 5},
            "hits": [
              {"_id": "c1", "_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_id": "c2", "_score": 0.85, "_source": {"parentId": "p1", "chunkIndex": 1}},
              {"_id": "c3", "_score": 0.8, "_source": {"parentId": "p2", "chunkIndex": 0}},
              {"_id": "c4", "_score": 0.7, "_source": {"parentId": "p3", "chunkIndex": 0}},
              {"_id": "c5", "_score": 0.6, "_source": {"parentId": "p4", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 2, 1, 100, 0.0);

    long distinctParents = results.hits.stream().map(r -> r.get("parentId")).distinct().count();
    assertEquals(2, distinctParents, "Should return 2 distinct parents");
    assertEquals(
        "p2",
        results.hits.get(0).get("parentId"),
        "First result should be p2 (skipping p1 due to from=1)");
    assertEquals("p3", results.hits.get(1).get("parentId"), "Second result should be p3");
  }

  @Test
  void testPaginationFromBeyondResultsReturnsEmpty() throws IOException {
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 2},
            "hits": [
              {"_id": "c1", "_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_id": "c2", "_score": 0.8, "_source": {"parentId": "p2", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 5, 10, 100, 0.0);

    assertEquals(
        0, results.hits.size(), "Should return no results when from exceeds available parents");
  }

  @Test
  void testSearchFetchesAdditionalPagesUntilEnoughDistinctParentsAreAvailable() throws IOException {
    String firstPage =
        """
        {
          "hits": {
            "total": {"value": 8},
            "hits": [
              {"_id": "c1", "_score": 0.95, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_id": "c2", "_score": 0.94, "_source": {"parentId": "p1", "chunkIndex": 1}},
              {"_id": "c3", "_score": 0.93, "_source": {"parentId": "p1", "chunkIndex": 2}},
              {"_id": "c4", "_score": 0.90, "_source": {"parentId": "p2", "chunkIndex": 0}},
              {"_id": "c5", "_score": 0.89, "_source": {"parentId": "p2", "chunkIndex": 1}},
              {"_id": "c6", "_score": 0.88, "_source": {"parentId": "p2", "chunkIndex": 2}}
            ]
          }
        }
        """;
    String secondPage =
        """
        {
          "hits": {
            "total": {"value": 8},
            "hits": [
              {"_id": "c7", "_score": 0.87, "_source": {"parentId": "p3", "chunkIndex": 0}},
              {"_id": "c8", "_score": 0.86, "_source": {"parentId": "p4", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponses(firstPage, secondPage);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 3, 0, 100, 0.0);

    long distinctParents = results.hits.stream().map(r -> r.get("parentId")).distinct().count();
    assertEquals(3, distinctParents, "Should fetch a second page to fill 3 distinct parents");
    assertEquals(7, results.hits.size(), "Should return all chunks for the 3 selected parents");
    assertEquals(8L, results.totalHits);
    assertTrue(results.hasMore, "Should report additional parents beyond the returned page");

    ArgumentCaptor<os.org.opensearch.client.opensearch.generic.Request> captor =
        ArgumentCaptor.forClass(os.org.opensearch.client.opensearch.generic.Request.class);
    verify(mockGenericClient, org.mockito.Mockito.times(2)).execute(captor.capture());
    List<os.org.opensearch.client.opensearch.generic.Request> requests = captor.getAllValues();

    String firstBody =
        new String(
            requests.get(0).getBody().orElseThrow().bodyAsBytes(),
            java.nio.charset.StandardCharsets.UTF_8);
    String secondBody =
        new String(
            requests.get(1).getBody().orElseThrow().bodyAsBytes(),
            java.nio.charset.StandardCharsets.UTF_8);
    assertTrue(firstBody.contains("\"from\":0"));
    assertTrue(secondBody.contains("\"from\":6"));
  }

  @Test
  void testSearchSetsHasMoreFalseWhenDistinctParentsAreExhausted() throws IOException {
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 3},
            "hits": [
              {"_id": "c1", "_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_id": "c2", "_score": 0.8, "_source": {"parentId": "p2", "chunkIndex": 0}},
              {"_id": "c3", "_score": 0.7, "_source": {"parentId": "p3", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 2, 1, 100, 0.0);

    assertEquals(2L, results.hits.stream().map(r -> r.get("parentId")).distinct().count());
    assertEquals(3L, results.totalHits);
    assertEquals(Boolean.FALSE, results.hasMore);
  }

  @Test
  void reindexReusesOnlyStoredEmbeddingsWhoseFingerprintIsCurrent() throws IOException {
    long updatedAt = 1_700_000_000_000L;
    Table unchanged = reuseTable("orders", "Orders placed online", updatedAt);
    Table textChanged = reuseTable("payments", "Customer payments by card", updatedAt);
    // Stand-in for the text an older release built for the same entity: same updatedAt, other text.
    Table textChangedAsLastEmbedded =
        reuseTable("payments", "Customer payments", updatedAt).withId(textChanged.getId());
    Table unfingerprintable = reuseTable("refunds", "Refunds issued", updatedAt);
    answerMgetsFrom(
        Map.of(
            textId(unchanged), storedEntityDoc(unchanged, unchanged),
            textId(textChanged), storedEntityDoc(textChanged, textChangedAsLastEmbedded),
            textId(unfingerprintable), storedEntityDoc(unfingerprintable, unfingerprintable)));

    Map<String, JsonNode> reusable =
        vectorService.getExistingEmbeddingsBatch(
            "table_search_index",
            Map.of(
                textId(unchanged), () -> VectorDocBuilder.computeFingerprintForEntity(unchanged),
                textId(textChanged),
                    () -> VectorDocBuilder.computeFingerprintForEntity(textChanged),
                textId(unfingerprintable),
                    () -> {
                      throw new IllegalStateException("tag without an FQN");
                    },
                UUID.randomUUID().toString(),
                    () -> VectorDocBuilder.computeFingerprintForEntity(unchanged)));

    assertEquals(java.util.Set.of(textId(unchanged)), reusable.keySet());
    assertEquals(
        VectorDocBuilder.computeFingerprintForEntity(unchanged),
        reusable.get(textId(unchanged)).path("fingerprint").asText());
    ArgumentCaptor<Request> sent = ArgumentCaptor.forClass(Request.class);
    verify(mockGenericClient, times(2)).execute(sent.capture());
    Request fingerprints = sent.getAllValues().getFirst();
    Request embeddings = sent.getAllValues().getLast();
    assertEquals("POST", fingerprints.getMethod());
    assertEquals(
        "/table_search_index/_mget?_source_includes=fingerprint,embeddingModel,embeddingDimension",
        fingerprints.getEndpoint());
    assertEquals(
        "/table_search_index/_mget?_source_includes=fingerprint,embedding,textToLLMContext,"
            + "textToEmbed,chunkIndex,chunkCount,parentId,embeddingModel,embeddingDimension",
        embeddings.getEndpoint());
    assertEquals("{\"ids\":[\"" + textId(unchanged) + "\"]}", bodyOf(embeddings));
  }

  private static Table reuseTable(String name, String description, long updatedAt) {
    return new Table()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("svc.db.schema." + name)
        .withDescription(description)
        .withUpdatedAt(updatedAt);
  }

  private static String textId(Table table) {
    return table.getId().toString();
  }

  /** An entity doc as a reindex left it: current updatedAt, embedding of {@code embeddedAs}. */
  private static ObjectNode storedEntityDoc(Table current, Table embeddedAs) {
    ObjectNode doc = JsonUtils.getObjectNode();
    doc.put("name", current.getName());
    doc.put("updatedAt", current.getUpdatedAt());
    doc.put("fingerprint", VectorDocBuilder.computeFingerprintForEntity(embeddedAs));
    doc.putArray("embedding").add(0.5).add(0.25).add(0.125);
    doc.put("parentId", textId(current));
    doc.put(EmbeddingModel.ID_FIELD, MODEL.id())
        .put(EmbeddingModel.DIMENSION_FIELD, MODEL.dimension());
    return doc;
  }

  /** Answers an mget like the engine: only stored ids, only the requested _source fields. */
  private void answerMgetsFrom(Map<String, ObjectNode> storedById) throws IOException {
    when(mockGenericClient.execute(any()))
        .thenAnswer(
            invocation -> {
              Request request = invocation.getArgument(0);
              String[] sourceFields =
                  request.getEndpoint().split("_source_includes=")[1].split(",");
              ObjectNode answer = JsonUtils.getObjectNode();
              for (JsonNode id : MAPPER.readTree(bodyOf(request)).path("ids")) {
                ObjectNode stored = storedById.get(id.asText());
                ObjectNode doc = answer.withArray("docs").addObject().put("_id", id.asText());
                doc.put("found", stored != null);
                if (stored != null) {
                  ObjectNode source = doc.putObject("_source");
                  for (String field : sourceFields) {
                    copyField(stored, source, field);
                  }
                }
              }
              Response response = mock(Response.class);
              when(response.getStatus()).thenReturn(200);
              when(response.getBody())
                  .thenReturn(
                      Optional.of(
                          Body.from(
                              answer.toString().getBytes(StandardCharsets.UTF_8),
                              "application/json")));
              return response;
            });
  }

  private static void copyField(ObjectNode from, ObjectNode to, String field) {
    if (from.has(field)) {
      to.set(field, from.get(field));
    }
  }

  private void mockOpenSearchResponse(String responseJson) throws IOException {
    mockOpenSearchResponses(responseJson);
  }

  private void mockOpenSearchResponses(String... responseJsons) throws IOException {
    Response[] responses = new Response[responseJsons.length];
    for (int i = 0; i < responseJsons.length; i++) {
      Response mockResponse = mock(Response.class);
      os.org.opensearch.client.opensearch.generic.Body mockBody =
          mock(os.org.opensearch.client.opensearch.generic.Body.class);
      when(mockResponse.getStatus()).thenReturn(200);
      when(mockResponse.getBody()).thenReturn(Optional.of(mockBody));
      when(mockBody.bodyAsBytes())
          .thenReturn(responseJsons[i].getBytes(java.nio.charset.StandardCharsets.UTF_8));
      responses[i] = mockResponse;
    }
    if (responses.length == 1) {
      when(mockGenericClient.execute(any())).thenReturn(responses[0]);
    } else {
      when(mockGenericClient.execute(any()))
          .thenReturn(responses[0], java.util.Arrays.copyOfRange(responses, 1, responses.length));
    }
  }

  @Test
  void chunkMappingUpgradeBody_omitsKnnVectorButAddsDenormalizedFields() throws Exception {
    Method m = AbstractVectorIndexService.class.getDeclaredMethod("buildChunkMappingUpgradeBody");
    m.setAccessible(true);
    String body = (String) m.invoke(vectorService);

    // The unchanged embedding knn_vector must NOT be re-declared: PUT _mapping is atomic and some
    // OpenSearch versions reject re-declaring an existing knn_vector, which would fail the whole
    // additive upgrade and silently leave the new fields unmapped.
    assertTrue(!body.contains("knn_vector"), "upgrade body must not re-declare the knn_vector");
    assertTrue(
        !body.contains("\"embedding\""), "embedding field excluded from the additive upgrade");
    // The genuinely new denormalized fields and the version marker must be present.
    assertTrue(body.contains("\"owners\""), "new nested owners field present");
    assertTrue(body.contains("\"service\""), "new service field present");
    assertTrue(body.contains("\"columns\""), "new columns field present");
    assertTrue(body.contains("\"description\""), "new description field present");
    assertTrue(body.contains("chunkDocVersion"), "_meta.chunkDocVersion bumped");

    // databaseSchema must map both name and displayName (like service/database):
    // buildDenormalizedFields
    // copies both onto the chunk doc, so mapping only `name` would leave displayName unindexed.
    com.fasterxml.jackson.databind.JsonNode schema =
        new com.fasterxml.jackson.databind.ObjectMapper()
            .readTree(body)
            .path("properties")
            .path("databaseSchema")
            .path("properties");
    assertTrue(schema.has("name"), "databaseSchema.name mapped");
    assertTrue(
        schema.has("displayName"), "databaseSchema.displayName mapped (matches service/database)");
  }

  @Test
  void chunkMappingUpgradeBody_mapsTheModelOfTheVectors() throws Exception {
    Method method =
        AbstractVectorIndexService.class.getDeclaredMethod("buildChunkMappingUpgradeBody");
    method.setAccessible(true);
    JsonNode properties =
        new ObjectMapper().readTree((String) method.invoke(vectorService)).path("properties");

    assertEquals("keyword", properties.path(EmbeddingModel.ID_FIELD).path("type").asText());
    assertEquals("integer", properties.path(EmbeddingModel.DIMENSION_FIELD).path("type").asText());
  }

  @Test
  void chunkMappingUpgradeBody_mapsTheMemoryStatusAsAKeyword() throws Exception {
    Method method =
        AbstractVectorIndexService.class.getDeclaredMethod("buildChunkMappingUpgradeBody");
    method.setAccessible(true);
    JsonNode body = new ObjectMapper().readTree((String) method.invoke(vectorService));

    assertEquals(9, body.path("_meta").path("chunkDocVersion").asInt());
    assertEquals("keyword", body.path("properties").path("entityStatus").path("type").asText());
    assertEquals("keyword", body.path("properties").path("memoryScope").path("type").asText());
    assertEquals("keyword", body.path("properties").path("memoryType").path("type").asText());
    assertEquals("boolean", body.path("properties").path("pinned").path("type").asText());
  }

  @Test
  void updateEntityEmbeddingChunks_preservesExistingChunksWhenProviderUnavailable()
      throws IOException {
    when(mockEmbeddingClient.isAvailable()).thenReturn(false);
    // Entity previously had 3 chunks under a now-stale fingerprint; a content change would normally
    // re-embed and replace them. With the provider down, fromEntity() returns empty and the
    // existing
    // chunks must be preserved rather than deleted by replaceChunks().
    mockOpenSearchResponse(
        "{\"found\": true, \"_source\": {\"fingerprint\": \"STALE_FP\", \"chunkCount\": 3, \"docVersion\": 1}}");

    Table entity =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("svc.db.sch.orders")
            .withDescription("changed description");

    vectorService.updateEntityEmbeddingChunks(entity, "chunkIndex");

    ArgumentCaptor<os.org.opensearch.client.opensearch.generic.Request> captor =
        ArgumentCaptor.forClass(os.org.opensearch.client.opensearch.generic.Request.class);
    verify(mockGenericClient, atLeastOnce()).execute(captor.capture());
    boolean issuedBulk =
        captor.getAllValues().stream()
            .anyMatch(r -> r.getEndpoint() != null && r.getEndpoint().contains("_bulk"));
    assertFalse(
        issuedBulk,
        "must not issue a chunk-delete bulk while the embedding provider is unavailable");
  }
}
