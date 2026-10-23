package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.ContextMemoryType;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.indexes.ContextMemoryIndex;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
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
        OpenSearchVectorService.ChunkRefresh.NONE,
        refresh(memory, header(fingerprint, current, "Approved", "unanchored")));
    assertEquals(OpenSearchVectorService.ChunkRefresh.REEMBED, refresh(memory, null));
    assertEquals(
        OpenSearchVectorService.ChunkRefresh.REEMBED,
        refresh(memory, header("stale", current, "Approved", "unanchored")));
    assertEquals(
        OpenSearchVectorService.ChunkRefresh.RESTAMP,
        refresh(memory, header(fingerprint, current - 1, "Approved", "unanchored")));
    assertEquals(
        OpenSearchVectorService.ChunkRefresh.RESTAMP,
        refresh(memory, header(fingerprint, current, "Deprecated", "unanchored")));
    UUID anchorId = UUID.randomUUID();
    memory.setPrimaryEntity(new EntityReference().withId(anchorId).withType("table"));
    assertEquals(
        OpenSearchVectorService.ChunkRefresh.RESTAMP,
        refresh(memory, header(fingerprint, current, "Approved", "unanchored")));
    assertEquals(
        OpenSearchVectorService.ChunkRefresh.NONE,
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
        OpenSearchVectorService.ChunkRefresh.RESTAMP,
        refresh(memory, header(fingerprint, current, "Approved", "unanchored")));

    memory.withPinned(false).withMemoryType(ContextMemoryType.PREFERENCE);
    assertEquals(
        OpenSearchVectorService.ChunkRefresh.RESTAMP,
        refresh(memory, header(fingerprint, current, "Approved", "unanchored")));
    assertEquals(
        OpenSearchVectorService.ChunkRefresh.RESTAMP,
        refresh(memory, header(fingerprint, current, "Approved", "unanchored", null)),
        "a chunk stamped before the kind existed is restamped");
  }

  @Test
  void filterMetadataOnlyAppliesToMemoryChunks() {
    Table table = new Table().withId(UUID.randomUUID()).withName("orders");
    String fingerprint = VectorDocBuilder.computeFingerprintForEntity(table);

    assertEquals(
        OpenSearchVectorService.ChunkRefresh.NONE,
        refresh(table, header(fingerprint, VectorDocBuilder.CHUNK_DOC_VERSION, null, null, null)));
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

    Logger logger = (Logger) LoggerFactory.getLogger(OpenSearchVectorService.class);
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

  private static OpenSearchVectorService.ChunkRefresh refresh(
      org.openmetadata.schema.EntityInterface<?> entity,
      OpenSearchVectorService.ChunkHeader header) {
    return OpenSearchVectorService.chunkRefresh(
        entity, VectorDocBuilder.computeFingerprintForEntity(entity), header);
  }

  /** A header stamped with the kind {@link #refreshableMemory} has. */
  private static OpenSearchVectorService.ChunkHeader header(
      String fingerprint, int docVersion, String status, String anchorId) {
    return header(fingerprint, docVersion, status, anchorId, MEMORY_KIND);
  }

  private static OpenSearchVectorService.ChunkHeader header(
      String fingerprint,
      int docVersion,
      String status,
      String anchorId,
      OpenSearchVectorService.MemoryKind kind) {
    return new OpenSearchVectorService.ChunkHeader(
        fingerprint,
        1,
        docVersion,
        status,
        anchorId,
        kind,
        VectorDocBuilder.accessStamp(refreshableMemory()));
  }

  private static Table governedTable() {
    return new Table()
        .withId(UUID.randomUUID())
        .withName("orders")
        .withFullyQualifiedName("svc.db.sch.orders")
        .withDescription("revenue report")
        .withOwners(
            List.of(
                new EntityReference()
                    .withId(UUID.randomUUID())
                    .withName("finance")
                    .withType("team")));
  }

  private static OpenSearchVectorService.ChunkHeader tableHeader(
      String fingerprint, String accessStamp) {
    return new OpenSearchVectorService.ChunkHeader(
        fingerprint, 1, VectorDocBuilder.CHUNK_DOC_VERSION, null, null, null, accessStamp);
  }

  /**
   * Certification and reviewers are not embedded text, so the fingerprint cannot see them change;
   * the stamp is what keeps a policy keyed on them current on chunks, at no embedding cost.
   */
  @Test
  void chunkRefresh_restampsWhenTheAccessStampChanges() {
    var table = governedTable();
    String fingerprint = VectorDocBuilder.computeFingerprintForEntity(table);
    String stamp = VectorDocBuilder.accessStamp(table);

    assertEquals(
        OpenSearchVectorService.ChunkRefresh.NONE,
        OpenSearchVectorService.chunkRefresh(table, fingerprint, tableHeader(fingerprint, stamp)));
    assertEquals(
        OpenSearchVectorService.ChunkRefresh.RESTAMP,
        OpenSearchVectorService.chunkRefresh(
            table, fingerprint, tableHeader(fingerprint, "stale")));
    assertEquals(
        OpenSearchVectorService.ChunkRefresh.REEMBED,
        OpenSearchVectorService.chunkRefresh(table, fingerprint, tableHeader("other", stamp)));
  }

  @Test
  void chunkMappingUpgradeBody_mapsTheAccessFields() throws Exception {
    Method method = OpenSearchVectorService.class.getDeclaredMethod("buildChunkMappingUpgradeBody");
    method.setAccessible(true);
    JsonNode properties =
        new ObjectMapper().readTree((String) method.invoke(vectorService)).path("properties");

    for (String reference :
        List.of("domains", "service", "database", "databaseSchema", "reviewers")) {
      assertEquals(
          "keyword",
          properties.path(reference).path("properties").path("id").path("type").asText(),
          reference + ".id");
    }
    assertEquals(
        "keyword",
        properties.path(VectorDocBuilder.FIELD_ACCESS_STAMP).path("type").asText(),
        "accessStamp");
  }

  private static final OpenSearchVectorService.MemoryKind MEMORY_KIND =
      OpenSearchVectorService.MemoryKind.of(refreshableMemory());

  private static String jsonString(String value) {
    return value == null ? "null" : "\"" + value + "\"";
  }

  private void setField(String name, Object value) throws ReflectiveOperationException {
    java.lang.reflect.Field field = OpenSearchVectorService.class.getDeclaredField(name);
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
            + ",\"entityStatus\":\"Approved\",\"anchorId\":\"unanchored\""
            + ",\"memoryScope\":"
            + jsonString(ContextMemoryIndex.memoryScopeValue(memory))
            + ",\"memoryType\":"
            + jsonString(ContextMemoryIndex.memoryTypeValue(memory))
            + ",\"pinned\":false,\"accessStamp\":"
            + jsonString(VectorDocBuilder.accessStamp(memory))
            + "}}");

    vectorService.updateEntityEmbeddingChunks(memory, "chunkIndex");

    // One GET and nothing else: a header matching the memory's status, anchor, kind and access
    // stamp is current.
    ArgumentCaptor<os.org.opensearch.client.opensearch.generic.Request> captor =
        ArgumentCaptor.forClass(os.org.opensearch.client.opensearch.generic.Request.class);
    verify(mockGenericClient).execute(captor.capture());
    assertEquals(
        "/chunkIndex/_doc/"
            + memory.getId()
            + "_0?_source_includes=fingerprint,chunkCount,docVersion,"
            + String.join(
                ",",
                ContextMemoryIndex.FIELD_STATUS,
                ContextMemoryIndex.FIELD_ANCHOR_ID,
                ContextMemoryIndex.FIELD_MEMORY_SCOPE,
                ContextMemoryIndex.FIELD_MEMORY_TYPE,
                ContextMemoryIndex.FIELD_PINNED,
                VectorDocBuilder.FIELD_ACCESS_STAMP),
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
  void testEnsureHybridSearchPipelineSendsCorrectRequest() throws IOException {
    mockOpenSearchResponse("{\"acknowledged\":true}");

    ArgumentCaptor<os.org.opensearch.client.opensearch.generic.Request> captor =
        ArgumentCaptor.forClass(os.org.opensearch.client.opensearch.generic.Request.class);

    vectorService.ensureHybridSearchPipeline(0.4, 0.6);

    verify(mockGenericClient).execute(captor.capture());
    os.org.opensearch.client.opensearch.generic.Request captured = captor.getValue();

    assertEquals("PUT", captured.getMethod());
    assertEquals("/_search/pipeline/hybrid-rrf", captured.getEndpoint());

    String body =
        new String(captured.getBody().get().bodyAsBytes(), java.nio.charset.StandardCharsets.UTF_8);
    assertTrue(body.contains("\"weights\":[0.4,0.6]"));
    assertTrue(body.contains("\"technique\":\"rrf\""));
    assertTrue(body.contains("\"rank_constant\":30"));
    assertTrue(body.contains("\"score-ranker-processor\""));
    assertTrue(body.contains("\"phase_results_processors\""));
    // The hybrid-rrf pipeline must NOT carry a collapse response processor. Collate's NLQ hybrid
    // search applies a query-level collapse{parentId} in the request body; a pipeline-level
    // collapse
    // on the same field makes OpenSearch reject the request with
    // "Cannot collapse on parentId. Results already collapsed on parentId" (HTTP 500).
    assertFalse(body.contains("\"response_processors\""));
    assertFalse(body.contains("\"collapse\""));
    assertFalse(body.contains("\"parentId\""));
  }

  @Test
  void testInlinePipelineDefinitionIsByteIdenticalToTheStoredPipelineBody() throws IOException {
    // Hybrid ranking now travels with the query as an ad-hoc pipeline, because creating the
    // stored one needs cluster:admin/search/pipeline/put and a search role confined to a single
    // index prefix does not have it. Both forms must stay the same document: if they drift,
    // deployments on the stored pipeline and deployments inlining it silently rank differently.
    mockOpenSearchResponse("{\"acknowledged\":true}");
    ArgumentCaptor<os.org.opensearch.client.opensearch.generic.Request> captor =
        ArgumentCaptor.forClass(os.org.opensearch.client.opensearch.generic.Request.class);

    vectorService.ensureHybridSearchPipeline(0.4, 0.6);

    verify(mockGenericClient).execute(captor.capture());
    String storedBody =
        new String(
            captor.getValue().getBody().get().bodyAsBytes(),
            java.nio.charset.StandardCharsets.UTF_8);
    assertEquals(storedBody, OpenSearchVectorService.buildHybridRrfPipelineDefinition(0.4, 0.6));
  }

  @Test
  void testEnsureHybridSearchPipelineWithCustomWeights() throws IOException {
    mockOpenSearchResponse("{\"acknowledged\":true}");

    ArgumentCaptor<os.org.opensearch.client.opensearch.generic.Request> captor =
        ArgumentCaptor.forClass(os.org.opensearch.client.opensearch.generic.Request.class);

    vectorService.ensureHybridSearchPipeline(0.3, 0.7);

    verify(mockGenericClient).execute(captor.capture());
    os.org.opensearch.client.opensearch.generic.Request captured = captor.getValue();

    String body =
        new String(captured.getBody().get().bodyAsBytes(), java.nio.charset.StandardCharsets.UTF_8);
    assertTrue(
        body.contains("\"weights\":[0.3,0.7]"),
        "Pipeline body should contain custom weights [0.3,0.7]");
  }

  @Test
  void testCheckHybridSearchPipelineRunsAHybridQueryWithTheInlinePipeline() throws IOException {
    mockOpenSearchResponse("{\"hits\":{\"total\":{\"value\":0},\"hits\":[]}}");
    ArgumentCaptor<Request> captor = ArgumentCaptor.forClass(Request.class);

    Optional<String> result = vectorService.checkHybridSearchPipeline(0.6, 0.4);

    verify(mockGenericClient).execute(captor.capture());
    Request probe = captor.getValue();
    assertTrue(result.isEmpty(), "A query OpenSearch accepts means hybrid search can run");
    assertEquals("POST", probe.getMethod());
    assertEquals("/" + vectorService.getChunkIndexName() + "/_search", probe.getEndpoint());
    assertEquals("true", probe.getParameters().get("ignore_unavailable"));
    JsonNode body = MAPPER.readTree(probe.getBody().get().bodyAsString());
    assertEquals(2, body.path("query").path("hybrid").path("queries").size());
    assertEquals(
        MAPPER.readTree(OpenSearchVectorService.buildHybridRrfPipelineDefinition(0.6, 0.4)),
        body.path("search_pipeline"));
  }

  @Test
  void testCheckHybridSearchPipelineStaysInsideTheClusterAliasPrefix() throws IOException {
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.getClusterAlias()).thenReturn("bi4all-pt");
    Entity.setSearchRepository(searchRepository);
    mockOpenSearchResponse("{\"hits\":{\"total\":{\"value\":0},\"hits\":[]}}");
    ArgumentCaptor<Request> captor = ArgumentCaptor.forClass(Request.class);
    try {
      vectorService.checkHybridSearchPipeline(0.6, 0.4);
    } finally {
      Entity.setSearchRepository(null);
    }

    verify(mockGenericClient).execute(captor.capture());
    assertEquals(
        "/bi4all-pt_data_asset_embeddings_chunks/_search", captor.getValue().getEndpoint());
  }

  @Test
  void testCheckHybridSearchPipelineReportsWhyOpenSearchRejectedTheQuery() throws IOException {
    String rejection =
        "{\"error\":{\"type\":\"illegal_argument_exception\",\"reason\":\"sum of weights for"
            + " combination must be equal to 1.0\"},\"status\":400}";
    Response mockResponse = mock(Response.class);
    when(mockResponse.getStatus()).thenReturn(400);
    when(mockResponse.getBody())
        .thenReturn(
            Optional.of(Body.from(rejection.getBytes(StandardCharsets.UTF_8), "application/json")));
    when(mockGenericClient.execute(any())).thenReturn(mockResponse);

    Optional<String> result = vectorService.checkHybridSearchPipeline(0.7, 0.7);

    assertTrue(result.isPresent(), "A rejected query means hybrid search cannot run");
    assertTrue(result.get().contains("status 400"), "Error should mention the status code");
    assertTrue(result.get().contains("sum of weights"), "Error should carry OpenSearch's reason");
  }

  @Test
  void testCheckHybridSearchPipelineReturnsErrorOnException() throws IOException {
    when(mockGenericClient.execute(any())).thenThrow(new IOException("Connection refused"));

    Optional<String> result = vectorService.checkHybridSearchPipeline(0.6, 0.4);
    assertTrue(result.isPresent(), "Should return error when exception occurs");
    assertTrue(
        result.get().contains("Connection refused"), "Error should include exception message");
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
    Method m = OpenSearchVectorService.class.getDeclaredMethod("buildChunkMappingUpgradeBody");
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
  void chunkMappingUpgradeBody_mapsTheMemoryStatusAsAKeyword() throws Exception {
    Method method = OpenSearchVectorService.class.getDeclaredMethod("buildChunkMappingUpgradeBody");
    method.setAccessible(true);
    JsonNode body = new ObjectMapper().readTree((String) method.invoke(vectorService));

    assertEquals(9, body.path("_meta").path("chunkDocVersion").asInt());
    assertEquals("keyword", body.path("properties").path("entityStatus").path("type").asText());
    assertEquals("keyword", body.path("properties").path("memoryScope").path("type").asText());
    assertEquals("keyword", body.path("properties").path("memoryType").path("type").asText());
    assertEquals("boolean", body.path("properties").path("pinned").path("type").asText());
  }

  /**
   * A propagation that rewrites child documents' access fields leaves their chunks with the old
   * values; the matched entities' chunks lose their stamp, which withholds them from restricted
   * callers until a restamp.
   */
  @Test
  void invalidateChunkAccess_stripsTheStampFromTheMatchedEntitiesChunks() throws Exception {
    setField("stagedChunkIndex", null);
    setField("cachedSinkTarget", null);
    setField("cachedSinkTargetAt", System.currentTimeMillis());
    mockOpenSearchResponses(
        "{\"_scroll_id\":\"s1\",\"hits\":{\"hits\":[{\"_id\":\"e1\"},{\"_id\":\"e2\"}]}}",
        "{\"updated\":2}",
        "{\"_scroll_id\":\"s1\",\"hits\":{\"hits\":[]}}",
        "{\"_shards\":{}}",
        "{\"succeeded\":true}");

    vectorService.invalidateChunkAccess(
        List.of("cluster_table"), "{\"term\":{\"databaseSchema.id\":\"schema-1\"}}");

    List<os.org.opensearch.client.opensearch.generic.Request> requests = sentRequests(5);
    assertTrue(requests.get(0).getEndpoint().startsWith("/cluster_table/_search"));
    assertTrue(bodyOf(requests.get(0)).contains("schema-1"), bodyOf(requests.get(0)));
    String update = bodyOf(requests.get(1));
    assertTrue(
        requests
            .get(1)
            .getEndpoint()
            .startsWith("/" + vectorService.getChunkIndexName() + "/_update_by_query"),
        requests.get(1).getEndpoint());
    assertTrue(update.contains("\"parentId\":[\"e1\",\"e2\"]"), update);
    assertTrue(update.contains(VectorDocBuilder.FIELD_ACCESS_STAMP), update);
    assertEquals("DELETE", requests.get(4).getMethod());
  }

  /**
   * A tag rename can match hundreds of thousands of entities: the batches are applied without a
   * refresh each, and the chunk targets are refreshed once when every batch is in.
   */
  @Test
  void invalidateChunkAccess_refreshesOnceAfterTheLastBatch() throws Exception {
    setField("stagedChunkIndex", null);
    setField("cachedSinkTarget", null);
    setField("cachedSinkTargetAt", System.currentTimeMillis());
    mockOpenSearchResponses(
        "{\"_scroll_id\":\"s1\",\"hits\":{\"hits\":[{\"_id\":\"e1\"}]}}",
        "{\"updated\":1}",
        "{\"_scroll_id\":\"s1\",\"hits\":{\"hits\":[{\"_id\":\"e2\"}]}}",
        "{\"updated\":1}",
        "{\"_scroll_id\":\"s1\",\"hits\":{\"hits\":[]}}",
        "{\"_shards\":{}}",
        "{\"succeeded\":true}");

    vectorService.invalidateChunkAccess(
        List.of("cluster_table"), "{\"term\":{\"tags.tagFQN\":\"PII.Sensitive\"}}");

    List<String> endpoints =
        sentRequests(7).stream()
            .map(os.org.opensearch.client.opensearch.generic.Request::getEndpoint)
            .toList();
    List<String> updates = endpoints.stream().filter(e -> e.contains("_update_by_query")).toList();
    assertEquals(2, updates.size(), endpoints.toString());
    assertTrue(updates.stream().noneMatch(e -> e.contains("refresh=true")), updates.toString());
    String refresh = "/" + vectorService.getChunkIndexName() + "/_refresh";
    assertEquals(
        1, endpoints.stream().filter(e -> e.contains("_refresh")).count(), endpoints.toString());
    assertTrue(endpoints.get(3).contains("_update_by_query"), endpoints.toString());
    assertTrue(
        endpoints.get(5).startsWith(refresh), "refresh follows the last batch: " + endpoints);
  }

  /** Clearing the scroll is cleanup: its failure must not replace the failure that matters. */
  @Test
  void invalidateChunkAccess_surfacesTheUpdateFailureWhenClearingTheScrollFailsToo()
      throws Exception {
    setField("stagedChunkIndex", null);
    setField("cachedSinkTarget", null);
    setField("cachedSinkTargetAt", System.currentTimeMillis());
    Response page = mock(Response.class);
    os.org.opensearch.client.opensearch.generic.Body pageBody =
        mock(os.org.opensearch.client.opensearch.generic.Body.class);
    when(page.getStatus()).thenReturn(200);
    when(page.getBody()).thenReturn(Optional.of(pageBody));
    when(pageBody.bodyAsBytes())
        .thenReturn(
            "{\"_scroll_id\":\"s1\",\"hits\":{\"hits\":[{\"_id\":\"e1\"}]}}"
                .getBytes(java.nio.charset.StandardCharsets.UTF_8));
    when(mockGenericClient.execute(any()))
        .thenReturn(page)
        .thenThrow(new IOException("update failed"))
        .thenThrow(new IOException("clear failed"));

    RuntimeException failure =
        assertThrows(
            RuntimeException.class,
            () ->
                vectorService.invalidateChunkAccess(
                    List.of("cluster_table"), "{\"term\":{\"owners.id\":\"u1\"}}"));

    assertEquals("update failed", failure.getCause().getMessage());
  }

  @Test
  void invalidateChunkAccess_neitherUpdatesNorRefreshesWhenNothingMatches() throws Exception {
    mockOpenSearchResponses(
        "{\"_scroll_id\":\"s1\",\"hits\":{\"hits\":[]}}", "{\"succeeded\":true}");

    vectorService.invalidateChunkAccess(
        List.of("cluster_table"), "{\"term\":{\"tags.tagFQN\":\"PII.Sensitive\"}}");

    List<String> endpoints =
        sentRequests(2).stream()
            .map(os.org.opensearch.client.opensearch.generic.Request::getEndpoint)
            .toList();
    assertTrue(endpoints.get(0).startsWith("/cluster_table/_search"), endpoints.toString());
    assertEquals("/_search/scroll", endpoints.get(1));
  }

  private List<os.org.opensearch.client.opensearch.generic.Request> sentRequests(int count)
      throws Exception {
    ArgumentCaptor<os.org.opensearch.client.opensearch.generic.Request> captor =
        ArgumentCaptor.forClass(os.org.opensearch.client.opensearch.generic.Request.class);
    verify(mockGenericClient, times(count)).execute(captor.capture());
    return captor.getAllValues();
  }

  /** Only new text needs the provider; a restamp reuses the stored vectors. */
  @Test
  void onlyNewTextNeedsTheEmbeddingProvider() {
    assertTrue(
        OpenSearchVectorService.needsEmbedding(
            OpenSearchVectorService.ChunkRefresh.REEMBED, false));
    assertTrue(
        OpenSearchVectorService.needsEmbedding(OpenSearchVectorService.ChunkRefresh.NONE, true));
    assertFalse(
        OpenSearchVectorService.needsEmbedding(OpenSearchVectorService.ChunkRefresh.RESTAMP, true));
    assertFalse(
        OpenSearchVectorService.needsEmbedding(
            OpenSearchVectorService.ChunkRefresh.RESTAMP, false));
    assertFalse(
        OpenSearchVectorService.needsEmbedding(OpenSearchVectorService.ChunkRefresh.NONE, false));
  }

  /**
   * An access change (owner, domain, reviewer, tag, certification) must reach the chunks during a
   * provider outage too, or a search access policy keeps reading the old value for its length.
   */
  @Test
  void updateEntityEmbeddings_checksForARestampWhileTheProviderIsDown() throws Exception {
    when(mockEmbeddingClient.isAvailable()).thenReturn(false);
    setField("chunkIndexEnsured", true);
    mockOpenSearchResponse("{\"found\":false,\"hits\":{\"hits\":[]},\"errors\":false}");
    Table table = governedTable();

    vectorService.updateEntityEmbeddings(table, "entityIndex");

    ArgumentCaptor<os.org.opensearch.client.opensearch.generic.Request> captor =
        ArgumentCaptor.forClass(os.org.opensearch.client.opensearch.generic.Request.class);
    verify(mockGenericClient, atLeastOnce()).execute(captor.capture());
    assertTrue(
        captor.getAllValues().stream()
            .anyMatch(
                r -> String.valueOf(r.getEndpoint()).contains("/_doc/" + table.getId() + "_0")),
        "the chunk header must be read to decide on a restamp");
  }

  /**
   * Owner names are embedded text, so an owner change needs a re-embed; while that waits for the
   * provider, the old chunks must lose their stamp rather than keep answering with the old owner.
   */
  @Test
  void updateEntityEmbeddings_withholdsChunksWhileAnAccessChangeWaitsForTheProvider()
      throws Exception {
    when(mockEmbeddingClient.isAvailable()).thenReturn(false);
    setField("chunkIndexEnsured", true);
    setField("stagedChunkIndex", null);
    setField("cachedSinkTarget", null);
    setField("cachedSinkTargetAt", System.currentTimeMillis());
    mockOpenSearchResponse(
        "{\"found\":true,\"_source\":{\"fingerprint\":\"STALE\",\"accessStamp\":\"old\","
            + "\"chunkCount\":1,\"docVersion\":9}}");
    Table table = governedTable();

    vectorService.updateEntityEmbeddings(table, "entityIndex");

    ArgumentCaptor<os.org.opensearch.client.opensearch.generic.Request> captor =
        ArgumentCaptor.forClass(os.org.opensearch.client.opensearch.generic.Request.class);
    verify(mockGenericClient, atLeastOnce()).execute(captor.capture());
    assertTrue(
        captor.getAllValues().stream()
            .anyMatch(
                r ->
                    r.getEndpoint().contains("_update_by_query")
                        && bodyOf(r).contains(table.getId().toString())
                        && bodyOf(r).contains(VectorDocBuilder.FIELD_ACCESS_STAMP)),
        "the stale chunks' stamps must be stripped");
  }

  /** A partial strip (a failure or lost version conflict) must not count as done. */
  @Test
  void invalidateChunkAccess_failsWhenTheUpdateLeavesChunksStamped() throws Exception {
    setField("stagedChunkIndex", null);
    setField("cachedSinkTarget", null);
    setField("cachedSinkTargetAt", System.currentTimeMillis());
    mockOpenSearchResponses(
        "{\"_scroll_id\":\"s1\",\"hits\":{\"hits\":[{\"_id\":\"e1\"}]}}",
        "{\"updated\":0,\"version_conflicts\":1,\"failures\":[]}",
        "{\"succeeded\":true}");

    assertThrows(
        IllegalStateException.class,
        () ->
            vectorService.invalidateChunkAccess(
                List.of("cluster_table"), "{\"term\":{\"owners.id\":\"u1\"}}"));
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
