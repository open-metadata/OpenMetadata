package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.UUID;
import java.util.function.IntConsumer;
import java.util.function.Predicate;
import org.apache.commons.lang3.function.FailableRunnable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.OntologyChunkIndex;
import org.openmetadata.service.search.OntologyTermSearch;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

/**
 * Chunk 0's {@code chunkCount} bounds every chunk id stored for a parent. These scenarios run the
 * shared write and delete code against an in-memory cluster whose searches, like a real one's, see
 * only refreshed documents, and they never refresh between steps: the by-id bound alone must reach
 * what a failed write left behind. Chunk 0 is written over the version read, so racing writers
 * keep the bound, and a one-time heal removes the chunks older writes left past it.
 */
class ChunkSetBoundTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String LIVE = "data_asset_embeddings_chunks";
  private static final String STAGED = LIVE + "_g1";
  private static final String ENTITY_INDEX = "table_search_index";
  private static final VectorIndexService.LiveEntities EVERY_ENTITY_LIVE =
      (entityType, ids) -> Set.copyOf(ids);

  private FakeCluster cluster;
  private AdjustableClock clock;
  private InMemoryVectorService service;
  private EmbeddingClient embeddingClient;
  private Table table;
  private String parentId;

  @BeforeEach
  void setUp() {
    embeddingClient = mock(EmbeddingClient.class);
    when(embeddingClient.embed(any(String.class))).thenReturn(new float[] {0.1f, 0.2f, 0.3f});
    when(embeddingClient.getDimension()).thenReturn(3);
    when(embeddingClient.isAvailable()).thenReturn(true);
    cluster = new FakeCluster();
    clock = new AdjustableClock(Instant.parse("2026-11-26T12:00:00Z"));
    service = new InMemoryVectorService(embeddingClient, cluster, clock);
    table = new Table().withId(UUID.randomUUID()).withName("orders").withUpdatedAt(1L);
    parentId = table.getId().toString();
  }

  @ParameterizedTest(name = "into {0}")
  @ValueSource(strings = {LIVE, STAGED})
  void aDeleteAfterAGrowthWhoseHeaderFailedLeavesNoChunk(String target) {
    growFromOneToThreeChunksWithTheHeaderFailing(target);

    service.deleteEntityChunks(parentId);

    assertEquals(Set.of(), cluster.chunkIds(target, parentId));
  }

  @ParameterizedTest(name = "into {0}")
  @ValueSource(strings = {LIVE, STAGED})
  void aShrinkAfterAGrowthWhoseHeaderFailedLeavesNoTrailingChunk(String target) {
    growFromOneToThreeChunksWithTheHeaderFailing(target);

    assertTrue(write(target, chunks(1)));

    assertEquals(Set.of(parentId + "_0"), cluster.chunkIds(target, parentId));
    assertEquals(1, cluster.header(target, parentId).path("chunkCount").asInt());
  }

  @ParameterizedTest(name = "into {0}")
  @ValueSource(strings = {LIVE, STAGED})
  void aLaterFullWriteAfterAGrowthWhoseHeaderFailedKeepsOnlyItsChunks(String target) {
    growFromOneToThreeChunksWithTheHeaderFailing(target);
    List<Map<String, Object>> twoChunks = chunks(2);

    assertTrue(write(target, twoChunks));

    assertEquals(Set.of(parentId + "_0", parentId + "_1"), cluster.chunkIds(target, parentId));
    assertEquals(
        twoChunks.getFirst().get("fingerprint"),
        cluster.header(target, parentId).path("fingerprint").asText());
  }

  @Test
  void aLiveEditMirroredIntoTheStagedGenerationKeepsItsBound() {
    service.latchParticipantStagedTarget(STAGED);
    assertTrue(write(STAGED, chunks(1)));
    cluster.rejectHeaderWritesTo(STAGED);

    service.updateEntityEmbeddings(withChunks(3), ENTITY_INDEX);
    cluster.acceptAllWrites();
    service.deleteEntityChunks(parentId);

    assertEquals(Set.of(), cluster.chunkIds(STAGED, parentId));
    assertEquals(Set.of(), cluster.chunkIds(LIVE, parentId));
  }

  @Test
  void aGrowthWhoseHeaderFailedLeavesAHeaderThatNoUpdateReadsAsCurrent() {
    growFromOneToThreeChunksWithTheHeaderFailing(LIVE);

    JsonNode header = cluster.header(LIVE, parentId);
    assertFalse(header.has("fingerprint"), header::toString);
    assertEquals(3, header.path("chunkCount").asInt());
  }

  @Test
  void aWriteThatKeepsWithinTheBoundSendsNoReservation() {
    assertTrue(write(LIVE, chunks(3)));
    int requestsBefore = cluster.bulkRequests;

    assertTrue(write(LIVE, chunks(3)));

    assertEquals(2, cluster.bulkRequests - requestsBefore, "the chunks, then the header");
  }

  @ParameterizedTest(name = "{0} chunks")
  @ValueSource(ints = {0, 1, 3})
  void aDeleteSendsOneReadAndOneDeletePerRequestTheBoundNeedsAndNoQuery(int chunkCount) {
    givenTheLiveChunkIndexExists();
    if (chunkCount > 0) {
      assertTrue(write(LIVE, chunks(chunkCount)));
    }
    service.deleteEntityChunks(UUID.randomUUID().toString());
    int requestsBefore = cluster.requests;
    int deletesByQueryBefore = cluster.deletesByQuery;

    service.deleteEntityChunks(parentId);

    assertEquals(Set.of(), cluster.chunkIds(LIVE, parentId));
    int expected = chunkCount == 0 ? 1 : chunkCount == 1 ? 2 : 3;
    assertEquals(
        expected,
        cluster.requests - requestsBefore,
        "a read of the header, then the chunks past it, then the header");
    assertEquals(0, cluster.deletesByQuery - deletesByQueryBefore);
  }

  @Test
  void aHeaderThatCannotBeReadFailsTheStagedDeleteAndKeepsTheGenerationFromGoingLive() {
    service.latchParticipantStagedTarget(STAGED);
    assertTrue(write(STAGED, chunks(3)));
    cluster.failReadsOf(STAGED, 503);

    service.deleteEntityChunks(parentId);

    assertEquals(
        Set.of(parentId + "_0", parentId + "_1", parentId + "_2"),
        cluster.chunkIds(STAGED, parentId),
        "nothing is deleted from a chunk set whose header could not be read");
    assertTrue(cluster.flaggedIncomplete(STAGED), "the missed delete is recorded");
  }

  @Test
  void aHeaderThatCannotBeReadFailsTheWriteAndKeepsTheBound() {
    givenTheLiveChunkIndexExists();
    assertTrue(write(LIVE, chunks(3)));
    cluster.failReadsOf(LIVE, 429);

    assertFalse(write(LIVE, chunks(2)), "a write that cannot read the header is a miss");

    cluster.acceptAllReads();
    assertEquals(3, cluster.header(LIVE, parentId).path("chunkCount").asInt());
    assertEquals(
        Set.of(parentId + "_0", parentId + "_1", parentId + "_2"),
        cluster.chunkIds(LIVE, parentId));
  }

  @Test
  void aFailedGenerationProbeHidesTheGenerationOnlyForItsBackoff() {
    givenTheLiveChunkIndexExists();
    cluster.stageGeneration(STAGED);
    assertTrue(write(STAGED, chunks(1)));
    cluster.failNextGenerationProbe();
    service.deleteEntityChunks(UUID.randomUUID().toString());
    clock.advance(Duration.ofMillis(2_100));

    service.deleteEntityChunks(parentId);

    assertEquals(Set.of(), cluster.chunkIds(STAGED, parentId));
  }

  @Test
  void aDeleteRetriesAHeaderReadTheClusterThrottledOnce() {
    givenTheLiveChunkIndexExists();
    assertTrue(write(LIVE, chunks(3)));
    cluster.refreshAll(LIVE);
    cluster.failNextReadsOf(LIVE, 429, 1);

    service.deleteEntityChunks(parentId);

    assertEquals(Set.of(), cluster.chunkIds(LIVE, parentId));
  }

  @Test
  void aStagedDeleteRetriesAHeaderReadAndLeavesTheGenerationPromotable() {
    service.latchParticipantStagedTarget(STAGED);
    assertTrue(write(STAGED, chunks(3)));
    cluster.failNextReadsOf(STAGED, 503, 1);

    service.deleteEntityChunks(parentId);

    assertEquals(Set.of(), cluster.chunkIds(STAGED, parentId));
    assertFalse(cluster.flaggedIncomplete(STAGED), "one 503 no longer flags the generation");
  }

  @Test
  void aWriteRetriesABulkWhoseItemsTheClusterRejectedOnce() {
    givenTheLiveChunkIndexExists();
    assertTrue(write(LIVE, chunks(3)));
    cluster.rejectNextBulks(429, 1);

    assertTrue(write(LIVE, chunks(2)), "one rejected bulk is retried");

    assertEquals(Set.of(parentId + "_0", parentId + "_1"), cluster.chunkIds(LIVE, parentId));
  }

  @Test
  void aWriteRetriesAHeaderReadThatGotNoResponse() {
    givenTheLiveChunkIndexExists();
    cluster.failNextReadsOf(LIVE, 0, 1);

    assertTrue(write(LIVE, chunks(2)), "a read with no response is retried");

    assertEquals(Set.of(parentId + "_0", parentId + "_1"), cluster.chunkIds(LIVE, parentId));
  }

  @Test
  void writersRacingOnOneEntityLeaveNoChunkPastTheHeader() {
    givenTheLiveChunkIndexExists();
    assertTrue(write(LIVE, chunks(3)));
    List<Map<String, Object>> five = chunks(5);
    List<Map<String, Object>> two = chunks(2);
    cluster.beforeNextBulk(() -> assertTrue(write(LIVE, five)));

    assertTrue(write(LIVE, two));

    assertEquals(Set.of(parentId + "_0", parentId + "_1"), cluster.chunkIds(LIVE, parentId));
    assertEquals(2, cluster.header(LIVE, parentId).path("chunkCount").asInt());
  }

  @Test
  void aDeleteRacingAWriteThatGrewTheSetLeavesNoChunk() {
    givenTheLiveChunkIndexExists();
    assertTrue(write(LIVE, chunks(1)));
    List<Map<String, Object>> three = chunks(3);
    cluster.beforeNextBulk(() -> assertTrue(write(LIVE, three)));

    service.deleteEntityChunks(parentId);

    assertEquals(Set.of(), cluster.chunkIds(LIVE, parentId));
  }

  @Test
  void aFailedGenerationProbeIsNotRepeatedByEveryDelete() {
    givenTheLiveChunkIndexExists();
    cluster.failGenerationProbes(true);

    service.deleteEntityChunks(parentId);
    service.deleteEntityChunks(UUID.randomUUID().toString());
    service.deleteEntityChunks(UUID.randomUUID().toString());

    assertEquals(1, cluster.generationProbes, "one probe while the probe keeps failing");
  }

  @Test
  void anUnreadableOntologyHeaderStillRefreshesTheTermEmbedding() {
    OntologyConcept concept = ontologyConcept();
    String termIndex = "ontology_concept_search_index";
    cluster.storeRefreshed(OntologyChunkIndex.name(), "other_0", Map.of("parentId", "other"));
    cluster.failReadsOf(OntologyChunkIndex.name(), 503);

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

    assertEquals(
        List.of("/" + termIndex + "/_update/" + concept.getId() + "?retry_on_conflict=3"),
        cluster.updates,
        "the term document gets its embedding");
  }

  private OntologyConcept ontologyConcept() {
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
    return concept;
  }

  @Test
  void aHeaderReadTheClusterKeepsRefusingIsTriedFourTimes() {
    givenTheLiveChunkIndexExists();
    assertTrue(write(LIVE, chunks(3)));
    cluster.failReadsOf(LIVE, 503);
    int readsBefore = cluster.headerReads;

    assertThrows(IllegalStateException.class, () -> service.deleteEntityChunks(parentId));

    assertEquals(4, cluster.headerReads - readsBefore, "the first read and three retries");
    cluster.acceptAllReads();
    assertEquals(3, cluster.chunkIds(LIVE, parentId).size(), "nothing is deleted");
  }

  @Test
  void aHeaderReadThatLeavesTheHeaderOutFailsTheDeleteAndDeletesNothing() {
    givenTheLiveChunkIndexExists();
    assertTrue(write(LIVE, chunks(3)));
    cluster.leaveDocsOutOfReadsOf(LIVE);

    assertThrows(IllegalStateException.class, () -> service.deleteEntityChunks(parentId));

    cluster.acceptAllReads();
    assertEquals(3, cluster.chunkIds(LIVE, parentId).size(), "nothing is deleted");
  }

  @Test
  void theHealRemovesChunksPastTheirHeader() throws IOException {
    givenTheLiveChunkIndexExists();
    assertTrue(write(LIVE, chunks(2)));
    cluster.storeRefreshed(LIVE, parentId + "_4", Map.of("parentId", parentId, "chunkIndex", 4));
    String behind = UUID.randomUUID().toString();
    cluster.storeRefreshed(LIVE, behind + "_0", Map.of("parentId", behind, "chunkCount", 1));
    cluster.storeRefreshed(LIVE, behind + "_1", Map.of("parentId", behind, "chunkIndex", 1));
    cluster.refreshAll(LIVE);

    service.removeChunksNoHeaderCounts();

    assertEquals(Set.of(parentId + "_0", parentId + "_1"), cluster.chunkIds(LIVE, parentId));
    assertEquals(Set.of(behind + "_0"), cluster.chunkIds(LIVE, behind));
    assertTrue(cluster.meta(LIVE).path("chunkSetsBounded").asBoolean(), "the heal is recorded");
  }

  @Test
  void aDeleteRemovesChunksStoredWithoutAHeader() throws IOException {
    cluster.storeRefreshed(LIVE, parentId + "_2", Map.of("parentId", parentId, "chunkIndex", 2));
    String noChunkZero = UUID.randomUUID().toString();
    cluster.storeRefreshed(LIVE, noChunkZero + "_1", Map.of("parentId", noChunkZero));
    cluster.storeRefreshed(LIVE, noChunkZero + "_2", Map.of("parentId", noChunkZero));

    service.deleteEntityChunks(parentId);
    service.removeChunksNoHeaderCounts();

    assertEquals(Set.of(), cluster.chunkIds(LIVE, parentId));
    assertEquals(Set.of(), cluster.chunkIds(LIVE, noChunkZero));
  }

  @Test
  void theHealKeepsAChunkAWriterRewroteAfterItWasListed() throws IOException {
    givenTheLiveChunkIndexExists();
    assertTrue(write(LIVE, chunks(1)));
    cluster.storeRefreshed(LIVE, parentId + "_3", Map.of("parentId", parentId, "chunkIndex", 3));
    cluster.refreshAll(LIVE);
    List<Map<String, Object>> five = chunks(5);
    cluster.beforeNextBulk(() -> assertTrue(write(LIVE, five)));

    service.removeChunksNoHeaderCounts();

    assertEquals(5, cluster.chunkIds(LIVE, parentId).size(), "the new set keeps its chunk 3");
    assertEquals(5, cluster.header(LIVE, parentId).path("chunkCount").asInt());
  }

  @Test
  void theHealRunsOncePerIndex() throws IOException {
    givenTheLiveChunkIndexExists();
    service.removeChunksNoHeaderCounts();
    int aggregationsBefore = cluster.aggregations;

    service.removeChunksNoHeaderCounts();

    assertEquals(0, cluster.aggregations - aggregationsBefore);
  }

  @Test
  void aChunkIndexCreatedEmptyIsNeverHealed() throws IOException {
    assertTrue(write(LIVE, chunks(2)));

    service.removeChunksNoHeaderCounts();

    assertEquals(0, cluster.aggregations, "an index created empty is recorded as healed");
  }

  @Test
  void aHealThatFailsThrowsAndIsNotRecordedAndTheNextPassHeals() throws IOException {
    givenTheLiveChunkIndexExists();
    cluster.storeRefreshed(LIVE, parentId + "_2", Map.of("parentId", parentId, "chunkIndex", 2));
    cluster.failSearches(true);
    assertThrows(RuntimeException.class, service::removeChunksNoHeaderCounts);
    assertFalse(cluster.meta(LIVE).path("chunkSetsBounded").asBoolean(false));
    cluster.failSearches(false);

    service.removeChunksNoHeaderCounts();

    assertEquals(Set.of(), cluster.chunkIds(LIVE, parentId));
  }

  @Test
  void aMappingUpgradeKeepsTheRecordOfTheHeal() {
    givenTheLiveChunkIndexExists();
    cluster.storeMeta(LIVE, Map.of("chunkDocVersion", 0, "chunkSetsBounded", true));

    assertTrue(write(LIVE, chunks(1)));

    assertTrue(cluster.meta(LIVE).path("chunkSetsBounded").asBoolean(false));
    assertEquals(
        VectorDocBuilder.CHUNK_DOC_VERSION, cluster.meta(LIVE).path("chunkDocVersion").asInt());
  }

  /** A failed shard or a timed out search still answers 200, with what the rest found. */
  @ParameterizedTest(name = "{0}")
  @EnumSource(
      value = IncompleteSearch.class,
      names = {"AGGREGATION_SHARD_FAILED", "LISTING_TIMED_OUT"})
  void aHealOverAnIncompleteSearchAnswerIsNotRecorded(IncompleteSearch answer) throws IOException {
    givenTheLiveChunkIndexExists();
    assertTrue(write(LIVE, chunks(2)));
    cluster.storeRefreshed(LIVE, parentId + "_4", Map.of("parentId", parentId, "chunkIndex", 4));
    cluster.refreshAll(LIVE);
    cluster.answerSearches(answer);

    Optional<Exception> failure = failureOf(service::removeChunksNoHeaderCounts);

    assertFalse(
        cluster.meta(LIVE).path("chunkSetsBounded").asBoolean(false), "not recorded as healed");
    assertTrue(failure.isPresent(), "the pass fails, so it is tried again");
    cluster.answerSearches(IncompleteSearch.NONE);
    service.removeChunksNoHeaderCounts();
    service.deleteEntityChunks(parentId);
    assertEquals(Set.of(), cluster.chunkIds(LIVE, parentId), "the next pass reaches the chunk");
  }

  @Test
  void aWriterThatLosesEveryHeaderRaceLeavesTheSetForTheNextUpdateToRewrite() {
    givenTheLiveChunkIndexExists();
    assertTrue(write(LIVE, chunks(3)));
    List<Map<String, Object>> five = chunks(5);
    List<Map<String, Object>> two = chunks(2);
    // Each of the loser's three attempts sends its other chunks, then chunk 0. The winner writes
    // its whole set just before each of those chunk bulks.
    cluster.beforeEachBulk(
        bulk -> {
          if (bulk % 2 == 1 && bulk <= 5) {
            assertTrue(write(LIVE, five));
          }
        });

    assertFalse(write(LIVE, two), "the loser gives up after three conflicts");
    cluster.beforeEachBulk(null);

    assertFalse(
        cluster.header(LIVE, parentId).has("fingerprint"),
        "chunk 1 is the loser's, so no update may read the set as current");
    service.updateEntityEmbeddingChunks(withChunks(5), LIVE);
    assertEquals(
        five.getFirst().get("fingerprint"),
        cluster.header(LIVE, parentId).path("fingerprint").asText());
    assertEquals(5, cluster.chunkIds(LIVE, parentId).size(), "the winner's next update rewrote");
  }

  @Test
  void aWriterThatLosesEveryHeaderRaceWhileGrowingTheSetLeavesNoChunkPastTheHeader() {
    givenTheLiveChunkIndexExists();
    assertTrue(write(LIVE, chunks(3)));
    List<Map<String, Object>> five = chunks(5);
    List<Map<String, Object>> two = chunks(2);
    // Each of the loser's three attempts raises the count, sends its other chunks, then writes
    // chunk 0. The winner shrinks the set to two just before each of those chunk bulks.
    cluster.beforeEachBulk(
        bulk -> {
          if (bulk % 3 == 2 && bulk <= 8) {
            assertTrue(write(LIVE, two));
          }
        });

    assertFalse(write(LIVE, five), "the loser gives up after three conflicts");
    cluster.beforeEachBulk(null);

    assertEquals(
        5,
        cluster.header(LIVE, parentId).path("chunkCount").asInt(),
        "the header counts the ids the loser wrote past the winner's set");
    service.deleteEntityChunks(parentId);
    assertEquals(Set.of(), cluster.chunkIds(LIVE, parentId), "a delete reaches every chunk");
  }

  @Test
  void aHealThatFailsIsTriedAgainInTheSameProcessUntilItIsRecorded() {
    givenTheLiveChunkIndexExists();
    cluster.storeRefreshed(LIVE, parentId + "_2", Map.of("parentId", parentId, "chunkIndex", 2));
    cluster.failSearchesWith(500);
    List<Duration> pauses = new ArrayList<>();
    ChunkSetHealRunner runner =
        new ChunkSetHealRunner(
            service,
            new LeaseTable().leaseOf("server"),
            EVERY_ENTITY_LIVE,
            wait -> {
              pauses.add(wait);
              if (pauses.size() == 7) {
                cluster.failSearches(false);
              }
            });

    runner.run();

    assertTrue(cluster.meta(LIVE).path("chunkSetsBounded").asBoolean(false), "recorded");
    assertEquals(Set.of(), cluster.chunkIds(LIVE, parentId));
    assertEquals(
        List.of(
            Duration.ofSeconds(30),
            Duration.ofMinutes(1),
            Duration.ofMinutes(2),
            Duration.ofMinutes(4),
            Duration.ofMinutes(8),
            Duration.ofMinutes(15),
            Duration.ofMinutes(15)),
        pauses,
        "the wait doubles up to 15 minutes");
  }

  @Test
  void aServerThatFindsTheLeaseHeldRunsNoPassAndStopsOnceTheHealIsRecorded() {
    givenTheLiveChunkIndexExists();
    cluster.storeRefreshed(LIVE, parentId + "_2", Map.of("parentId", parentId, "chunkIndex", 2));
    LeaseTable leases = new LeaseTable();
    ChunkSetHealRunner.Lease first = leases.leaseOf("first");
    assertTrue(first.tryAcquire(), "the first server starts its pass");
    List<Integer> aggregationsWhileHeld = new ArrayList<>();
    int[] aggregationsOfTheFirstPass = new int[1];
    ChunkSetHealRunner second =
        new ChunkSetHealRunner(
            service,
            leases.leaseOf("second"),
            EVERY_ENTITY_LIVE,
            wait -> {
              aggregationsWhileHeld.add(cluster.aggregations);
              first.release();
              new ChunkSetHealRunner(
                      service, first, EVERY_ENTITY_LIVE, ignored -> fail("the pass succeeds"))
                  .run();
              aggregationsOfTheFirstPass[0] = cluster.aggregations;
            });

    second.run();

    assertEquals(List.of(0), aggregationsWhileHeld, "the second server waited, sending nothing");
    assertEquals(
        aggregationsOfTheFirstPass[0],
        cluster.aggregations,
        "it then finds the heal recorded and runs no pass of its own");
    assertEquals(Set.of(), cluster.chunkIds(LIVE, parentId));
    assertTrue(leases.leaseOf("third").tryAcquire(), "the lease is released");
  }

  private static Optional<Exception> failureOf(FailableRunnable<Exception> step) {
    Optional<Exception> failure = Optional.empty();
    try {
      step.run();
    } catch (Exception e) {
      failure = Optional.of(e);
    }
    return failure;
  }

  private void givenTheLiveChunkIndexExists() {
    cluster.storeRefreshed(LIVE, "other_0", Map.of("parentId", "other", "chunkIndex", 0));
  }

  @Test
  void aDeleteBeforeTheChunkIndexExistsSendsNothingToIt() {
    service.latchParticipantStagedTarget(STAGED);

    service.deleteEntityChunks(parentId);

    assertEquals(0, cluster.requestsToMissingIndices);
  }

  private void growFromOneToThreeChunksWithTheHeaderFailing(String target) {
    service.latchParticipantStagedTarget(STAGED);
    assertTrue(write(target, chunks(1)));
    cluster.rejectHeaderWritesTo(target);
    assertFalse(write(target, chunks(3)), "the header write fails");
    cluster.acceptAllWrites();
    assertEquals(
        Set.of(parentId + "_0", parentId + "_1", parentId + "_2"),
        cluster.chunkIds(target, parentId),
        "the failed write left chunks past the old count");
  }

  private boolean write(String target, List<Map<String, Object>> chunkDocs) {
    return service.writeEntityChunks(parentId, chunkDocs, LIVE.equals(target) ? null : target);
  }

  private List<Map<String, Object>> chunks(int count) {
    List<Map<String, Object>> chunkDocs =
        VectorDocBuilder.fromEntity(withChunks(count), embeddingClient);
    assertEquals(count, chunkDocs.size(), "the description spans the expected chunk count");
    return chunkDocs;
  }

  private Table withChunks(int count) {
    String description = count == 1 ? "Orders placed online." : "word ".repeat(380 * count - 200);
    return table.withDescription(description);
  }

  /** A clock a scenario moves forward itself. */
  private static final class AdjustableClock extends Clock {
    private Instant now;

    AdjustableClock(Instant start) {
      now = start;
    }

    void advance(Duration duration) {
      now = now.plus(duration);
    }

    @Override
    public ZoneId getZone() {
      return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
      return this;
    }

    @Override
    public Instant instant() {
      return now;
    }
  }

  /** One lock row the servers of a cluster share. */
  private static final class LeaseTable {
    private String holder;

    ChunkSetHealRunner.Lease leaseOf(String server) {
      return new ChunkSetHealRunner.Lease() {
        @Override
        public boolean tryAcquire() {
          boolean free = holder == null;
          if (free) {
            holder = server;
          }
          return free;
        }

        @Override
        public void release() {
          if (server.equals(holder)) {
            holder = null;
          }
        }
      };
    }
  }

  /** How the cluster answers the heal's searches: in full, or with what part of it found. */
  enum IncompleteSearch {
    NONE,
    AGGREGATION_SHARD_FAILED,
    LISTING_TIMED_OUT
  }

  /** The shared vector index code over {@link FakeCluster}. */
  private static final class InMemoryVectorService extends AbstractVectorIndexService {
    private final FakeCluster cluster;

    InMemoryVectorService(EmbeddingClient embeddingClient, FakeCluster cluster, Clock clock) {
      super(embeddingClient, parameters -> Set.of(), clock);
      this.cluster = cluster;
    }

    @Override
    protected String engineName() {
      return "InMemory";
    }

    @Override
    protected RawResponse performRequest(String method, String endpoint, String body)
        throws IOException {
      return cluster.handle(method, endpoint, body);
    }

    @Override
    protected ObjectNode chunkIndexSettings() {
      return MAPPER.createObjectNode();
    }

    @Override
    protected ObjectNode embeddingFieldMapping(int dimension) {
      return MAPPER.createObjectNode().put("type", "float");
    }

    @Override
    protected String buildKnnSearch(
        float[] vector, VectorSearchParameters parameters, Set<String> readableAnchorIds) {
      return "{}";
    }

    @Override
    protected String buildKnnQueryClause(
        float[] vector, VectorSearchParameters parameters, Set<String> readableAnchorIds) {
      return "{}";
    }

    @Override
    protected boolean knnReturnsAtMostK(double threshold) {
      return true;
    }

    @Override
    protected boolean chunksOntologyTerms() {
      return true;
    }
  }

  /**
   * Documents by index and id, each with the sequence number its last write gave it. A by-id read
   * sees every write, as a realtime GET does; a search, an aggregation or a delete-by-query sees
   * only documents stored as refreshed. A bulk honours {@code create} and {@code if_seq_no} and
   * reports each item as a real cluster does. A rejected header write is a chunk 0 that carries a
   * fingerprint. An index exists once it is created or written to; a delete sent to one that does
   * not fails, as on a real cluster. Faults can be queued: reads or bulks the cluster answers with
   * an error status or not at all, and a writer that runs just before the next bulk.
   */
  private static final class FakeCluster {
    private static final String DOC = "/_doc/";
    private static final String MGET = "/_mget";
    private static final String SEARCH = "/_search";
    private static final String GENERATIONS = LIVE + "_g*";
    private static final int NO_RESPONSE = 0;
    private final Map<String, Map<String, JsonNode>> indices = new HashMap<>();
    private final Map<String, Long> seqNos = new HashMap<>();
    private final Map<String, JsonNode> metas = new HashMap<>();
    private final Set<String> existing = new HashSet<>();
    private final Set<String> refreshed = new HashSet<>();
    private final Set<String> generations = new HashSet<>();
    private final List<String> updates = new ArrayList<>();
    private long lastSeqNo;
    private int requestsToMissingIndices;
    private Predicate<String> rejectHeaderIndex = index -> false;
    private Predicate<String> unreadableIndex = index -> false;
    private Predicate<String> docsLeftOutIndex = index -> false;
    private int unreadableStatus;
    private String faultyReadIndex;
    private int faultyReads;
    private int faultyReadStatus;
    private int rejectedBulks;
    private int rejectedBulkStatus;
    private boolean generationProbesFail;
    private boolean failNextGenerationProbe;
    private Runnable beforeNextBulk;
    private int bulkRequests;
    private int requests;
    private int deletesByQuery;
    private int generationProbes;
    private int aggregations;
    private int headerReads;
    private boolean searchesFail;
    private int searchFailureStatus;
    private IncompleteSearch incompleteSearch = IncompleteSearch.NONE;
    private IntConsumer beforeEachBulk;
    private int hookedBulks;
    private boolean inBulkHook;

    void rejectHeaderWritesTo(String index) {
      rejectHeaderIndex = index::equals;
    }

    void acceptAllWrites() {
      rejectHeaderIndex = index -> false;
    }

    /** Every header read of {@code index} answers {@code status}, as a cluster under load does. */
    void failReadsOf(String index, int status) {
      unreadableIndex = index::equals;
      unreadableStatus = status;
    }

    void acceptAllReads() {
      unreadableIndex = index -> false;
      docsLeftOutIndex = index -> false;
    }

    /** Every header read of {@code index} answers 200 with no documents, as a broken proxy may. */
    void leaveDocsOutOfReadsOf(String index) {
      docsLeftOutIndex = index::equals;
    }

    /** The next {@code times} reads of {@code index} answer {@code status}, or nothing for 0. */
    void failNextReadsOf(String index, int status, int times) {
      faultyReadIndex = index;
      faultyReadStatus = status;
      faultyReads = times;
    }

    /** The next {@code times} bulks have every item rejected with {@code status}. */
    void rejectNextBulks(int status, int times) {
      rejectedBulkStatus = status;
      rejectedBulks = times;
    }

    /** Runs {@code writer} once, just before the next bulk is applied. */
    void beforeNextBulk(Runnable writer) {
      beforeNextBulk = writer;
    }

    /**
     * Runs {@code writer} before every bulk until cleared, with the bulk's number since it was set.
     * The bulks the writer sends itself are not counted and run no writer.
     */
    void beforeEachBulk(IntConsumer writer) {
      beforeEachBulk = writer;
      hookedBulks = 0;
    }

    /** A bare generation index, found by the probe for un-promoted generations. */
    void stageGeneration(String index) {
      existing.add(index);
      generations.add(index);
    }

    void failNextGenerationProbe() {
      failNextGenerationProbe = true;
    }

    void failGenerationProbes(boolean failing) {
      generationProbesFail = failing;
    }

    void failSearches(boolean failing) {
      searchesFail = failing;
      searchFailureStatus = 503;
    }

    void failSearchesWith(int status) {
      searchesFail = true;
      searchFailureStatus = status;
    }

    void answerSearches(IncompleteSearch answer) {
      incompleteSearch = answer;
    }

    void storeMeta(String index, Map<String, Object> meta) {
      metas.put(index, MAPPER.valueToTree(meta));
    }

    boolean flaggedIncomplete(String index) {
      return meta(index).path("incompleteChunkWrites").asBoolean(false);
    }

    JsonNode meta(String index) {
      return metas.getOrDefault(index, MAPPER.createObjectNode());
    }

    void storeRefreshed(String index, String id, Map<String, Object> source) {
      existing.add(index);
      put(index, id, MAPPER.valueToTree(source));
      refreshed.add(index + DOC + id);
    }

    void refreshAll(String index) {
      docs(index).keySet().forEach(id -> refreshed.add(index + DOC + id));
    }

    Set<String> chunkIds(String index, String parentId) {
      Set<String> ids = new TreeSet<>();
      docs(index)
          .forEach(
              (id, source) -> {
                if (parentId.equals(source.path("parentId").asText())) {
                  ids.add(id);
                }
              });
      return ids;
    }

    JsonNode header(String index, String parentId) {
      return docs(index).get(parentId + "_0");
    }

    AbstractVectorIndexService.RawResponse handle(String method, String endpoint, String body)
        throws IOException {
      requests++;
      String index = endpoint.substring(1).split("[/?]")[0];
      boolean wholeIndex = endpoint.indexOf('/', 1) < 0 && !index.startsWith("_");
      AbstractVectorIndexService.RawResponse response;
      if (GENERATIONS.equals(index)) {
        response = probeGenerations();
      } else if (wholeIndex) {
        response = indexRequest(method, index, body);
      } else if (endpoint.endsWith("/_alias") || endpoint.endsWith("/_mapping")) {
        response = metadataRequest(method, endpoint, index, body);
      } else {
        response = documentRequest(method, endpoint, index, body);
      }
      return response;
    }

    private AbstractVectorIndexService.RawResponse indexRequest(
        String method, String index, String body) throws IOException {
      AbstractVectorIndexService.RawResponse response = ok("{}");
      if ("PUT".equals(method)) {
        existing.add(index);
        metas.put(index, MAPPER.readTree(body).path("mappings").path("_meta"));
      } else if ("HEAD".equals(method)) {
        response =
            new AbstractVectorIndexService.RawResponse(existing.contains(index) ? 200 : 404, null);
      }
      return response;
    }

    private AbstractVectorIndexService.RawResponse metadataRequest(
        String method, String endpoint, String index, String body) throws IOException {
      AbstractVectorIndexService.RawResponse response;
      ObjectNode answer = MAPPER.createObjectNode();
      if (!existing.contains(index)) {
        response = new AbstractVectorIndexService.RawResponse(404, "{\"status\":404}");
      } else if (endpoint.endsWith("/_alias")) {
        answer.putObject(index).putObject("aliases");
        response = ok(answer.toString());
      } else if ("PUT".equals(method)) {
        metas.put(index, MAPPER.readTree(body).path("_meta"));
        response = ok("{}");
      } else {
        answer.putObject(index).putObject("mappings").set("_meta", meta(index));
        response = ok(answer.toString());
      }
      return response;
    }

    private AbstractVectorIndexService.RawResponse documentRequest(
        String method, String endpoint, String index, String body) throws IOException {
      AbstractVectorIndexService.RawResponse response = ok("{}");
      if (endpoint.equals("/_bulk")) {
        response = bulk(body);
      } else if (endpoint.contains("/_delete_by_query")) {
        deletesByQuery++;
        response = deleteByQuery(index, body);
      } else if (endpoint.startsWith("/" + index + MGET)) {
        response = multiGet(index, body);
      } else if (endpoint.contains(SEARCH)) {
        response = search(index, body);
      } else if (endpoint.contains("/_update/")) {
        updates.add(endpoint);
      } else if (endpoint.contains(DOC)) {
        response = getById(method, endpoint);
      }
      return response;
    }

    private AbstractVectorIndexService.RawResponse probeGenerations() {
      generationProbes++;
      AbstractVectorIndexService.RawResponse response;
      if (failNextGenerationProbe || generationProbesFail) {
        failNextGenerationProbe = false;
        response = new AbstractVectorIndexService.RawResponse(503, "{\"status\":503}");
      } else {
        ObjectNode body = MAPPER.createObjectNode();
        generations.forEach(name -> body.putObject(name).putObject("aliases"));
        response = ok(body.toString());
      }
      return response;
    }

    // A realtime multi-get, answering each id on its own, as both engines do: an index that
    // does not exist is an error on every doc, not a 404 of the request.
    private AbstractVectorIndexService.RawResponse multiGet(String index, String body)
        throws IOException {
      AbstractVectorIndexService.RawResponse response;
      headerReads++;
      if (faultyReads > 0 && index.equals(faultyReadIndex)) {
        faultyReads--;
        response = failure(faultyReadStatus);
      } else if (unreadableIndex.test(index)) {
        response = failure(unreadableStatus);
      } else if (docsLeftOutIndex.test(index)) {
        response = ok("{\"docs\":[]}");
      } else {
        ArrayNode docs = MAPPER.createArrayNode();
        JsonNode request = MAPPER.readTree(body);
        JsonNode requested = request.has("docs") ? request.path("docs") : request.path("ids");
        requested.forEach(
            doc -> docs.add(multiGetDoc(index, doc.path("_id").asText(doc.asText()))));
        ObjectNode result = MAPPER.createObjectNode();
        result.set("docs", docs);
        response = ok(result.toString());
      }
      return response;
    }

    private ObjectNode multiGetDoc(String index, String id) {
      ObjectNode doc = MAPPER.createObjectNode().put("_index", index).put("_id", id);
      JsonNode source = docs(index).get(id);
      if (!existing.contains(index)) {
        doc.putObject("error").put("type", "index_not_found_exception");
      } else if (source == null) {
        doc.put("found", false);
      } else {
        doc.put("_seq_no", seqNos.get(index + DOC + id)).put("_primary_term", 1);
        doc.put("found", true).set("_source", source);
      }
      return doc;
    }

    private static AbstractVectorIndexService.RawResponse failure(int status) throws IOException {
      if (status == NO_RESPONSE) {
        throw new IOException("Connection reset");
      }
      return new AbstractVectorIndexService.RawResponse(status, "{\"status\":" + status + "}");
    }

    private AbstractVectorIndexService.RawResponse getById(String method, String endpoint)
        throws IOException {
      String index = endpoint.substring(1, endpoint.indexOf(DOC));
      String id = endpoint.substring(endpoint.indexOf(DOC) + DOC.length(), endpoint.indexOf('?'));
      return unreadableIndex.test(index) && id.endsWith("_0") && "GET".equals(method)
          ? failure(unreadableStatus)
          : storedById(method, index, id);
    }

    private AbstractVectorIndexService.RawResponse storedById(
        String method, String index, String id) {
      JsonNode source = docs(index).get(id);
      ObjectNode body = MAPPER.createObjectNode().put("found", source != null);
      if (source != null) {
        body.set("_source", source);
      }
      boolean head = "HEAD".equals(method);
      return new AbstractVectorIndexService.RawResponse(
          source == null && head ? 404 : 200, head ? null : body.toString());
    }

    private AbstractVectorIndexService.RawResponse bulk(String body) throws IOException {
      if (beforeNextBulk != null) {
        Runnable concurrentWriter = beforeNextBulk;
        beforeNextBulk = null;
        concurrentWriter.run();
      }
      runTheWriterBeforeEachBulk();
      bulkRequests++;
      boolean rejected = rejectedBulks > 0;
      rejectedBulks = rejected ? rejectedBulks - 1 : 0;
      ArrayNode items = MAPPER.createArrayNode();
      String[] lines = body.split("\n");
      for (int i = 0; i < lines.length; i++) {
        JsonNode action = MAPPER.readTree(lines[i]);
        String name = action.fieldNames().next();
        JsonNode source = "delete".equals(name) ? null : MAPPER.readTree(lines[++i]);
        ObjectNode item =
            rejected ? error(rejectedBulkStatus, "es_rejected_execution_exception") : null;
        item = item == null ? apply(name, action.path(name), source) : item;
        items.addObject().set(name, item);
      }
      boolean errors = false;
      for (JsonNode item : items) {
        errors |= item.elements().next().has("error");
      }
      ObjectNode result = MAPPER.createObjectNode().put("errors", errors);
      result.set("items", items);
      return ok(result.toString());
    }

    private void runTheWriterBeforeEachBulk() {
      if (beforeEachBulk != null && !inBulkHook) {
        inBulkHook = true;
        try {
          beforeEachBulk.accept(++hookedBulks);
        } finally {
          inBulkHook = false;
        }
      }
    }

    private ObjectNode apply(String action, JsonNode meta, JsonNode source) {
      String index = meta.path("_index").asText();
      String id = meta.path("_id").asText();
      String key = index + DOC + id;
      boolean stored = docs(index).containsKey(id);
      boolean conflict =
          "create".equals(action) && stored
              || meta.has("if_seq_no")
                  && (!stored || meta.path("if_seq_no").asLong() != seqNos.get(key));
      ObjectNode item;
      if ("delete".equals(action) && !existsOrCount(index)) {
        item = error(404, "index_not_found_exception");
      } else if (conflict) {
        item = error(409, "version_conflict_engine_exception");
      } else if ("delete".equals(action)) {
        docs(index).remove(id);
        item = MAPPER.createObjectNode().put("status", stored ? 200 : 404);
      } else {
        item = write(index, id, source);
      }
      return item.put("_index", index).put("_id", id);
    }

    private ObjectNode write(String index, String id, JsonNode source) {
      ObjectNode item;
      if (rejectHeaderIndex.test(index) && id.endsWith("_0") && source.has("fingerprint")) {
        item = error(400, "document_parsing_exception");
      } else {
        existing.add(index);
        put(index, id, source);
        refreshed.remove(index + DOC + id);
        item =
            MAPPER
                .createObjectNode()
                .put("status", 201)
                .put("_seq_no", seqNos.get(index + DOC + id))
                .put("_primary_term", 1);
      }
      return item;
    }

    private void put(String index, String id, JsonNode source) {
      docs(index).put(id, source);
      seqNos.put(index + DOC + id, ++lastSeqNo);
    }

    private static ObjectNode error(int status, String type) {
      ObjectNode item = MAPPER.createObjectNode().put("status", status);
      item.putObject("error").put("type", type).put("reason", type);
      return item;
    }

    private boolean existsOrCount(String index) {
      boolean found = existing.contains(index);
      if (!found) {
        requestsToMissingIndices++;
      }
      return found;
    }

    private AbstractVectorIndexService.RawResponse search(String index, String body)
        throws IOException {
      JsonNode request = MAPPER.readTree(body);
      JsonNode composite = request.path("aggs").path("parents").path("composite");
      AbstractVectorIndexService.RawResponse response;
      if (searchesFail) {
        response = failure(searchFailureStatus);
      } else if (composite.isMissingNode()) {
        response =
            incompleteSearch == IncompleteSearch.LISTING_TIMED_OUT
                ? ok("{\"timed_out\":true,\"hits\":{\"hits\":[]}}")
                : ok(searchHits(index, request.path("query").path("bool")).toString());
      } else {
        response =
            incompleteSearch == IncompleteSearch.AGGREGATION_SHARD_FAILED
                ? shardFailedPage()
                : ok(compositePage(index, composite).toString());
      }
      return response;
    }

    // The shard holding every parent failed; the one that answered holds none.
    private AbstractVectorIndexService.RawResponse shardFailedPage() {
      aggregations++;
      return ok(
          "{\"_shards\":{\"total\":2,\"successful\":1,\"failed\":1},"
              + "\"aggregations\":{\"parents\":{\"buckets\":[]}}}");
    }

    // Only the shapes the chunk code sends: a parent's chunks other than the ids it excludes.
    private ObjectNode searchHits(String index, JsonNode bool) {
      String parentId = bool.path("filter").path(0).path("term").path("parentId").asText();
      Set<String> excluded = new HashSet<>();
      bool.path("must_not")
          .path(0)
          .path("ids")
          .path("values")
          .forEach(id -> excluded.add(id.asText()));
      ArrayNode hits = MAPPER.createArrayNode();
      refreshedDocs(index)
          .forEach(
              (id, source) -> {
                if (parentId.equals(source.path("parentId").asText()) && !excluded.contains(id)) {
                  ObjectNode hit = hits.addObject().put("_id", id);
                  hit.put("_seq_no", seqNos.get(index + DOC + id)).put("_primary_term", 1);
                  hit.putObject("_source").set("chunkIndex", source.path("chunkIndex"));
                }
              });
      ObjectNode result = MAPPER.createObjectNode();
      result.putObject("hits").set("hits", hits);
      return result;
    }

    private ObjectNode compositePage(String index, JsonNode composite) {
      aggregations++;
      String after = composite.path("after").path("parentId").asText("");
      int size = composite.path("size").asInt();
      Map<String, List<JsonNode>> byParent = new TreeMap<>();
      refreshedDocs(index)
          .values()
          .forEach(
              source -> {
                String parent = source.path("parentId").asText();
                if (parent.compareTo(after) > 0) {
                  byParent.computeIfAbsent(parent, ignored -> new ArrayList<>()).add(source);
                }
              });
      ArrayNode buckets = MAPPER.createArrayNode();
      byParent.entrySet().stream()
          .limit(size)
          .forEach(e -> buckets.add(bucket(e.getKey(), e.getValue())));
      ObjectNode parents = MAPPER.createObjectNode();
      parents.set("buckets", buckets);
      if (!buckets.isEmpty()) {
        parents
            .putObject("after_key")
            .set("parentId", buckets.get(buckets.size() - 1).path("key").path("parentId"));
      }
      ObjectNode result = MAPPER.createObjectNode();
      result.putObject("aggregations").set("parents", parents);
      return result;
    }

    private static ObjectNode bucket(String parentId, List<JsonNode> sources) {
      ObjectNode bucket = MAPPER.createObjectNode().put("doc_count", sources.size());
      bucket.putObject("key").put("parentId", parentId);
      Integer maxIndex = null;
      Integer headerCount = null;
      int headers = 0;
      for (JsonNode source : sources) {
        int chunkIndex = source.path("chunkIndex").asInt();
        maxIndex = maxIndex == null ? chunkIndex : Math.max(maxIndex, chunkIndex);
        if (chunkIndex == 0) {
          headers++;
          headerCount = source.path("chunkCount").asInt();
        }
      }
      bucket.putObject("maxIndex").put("value", maxIndex);
      ObjectNode header = bucket.putObject("header").put("doc_count", headers);
      header.putObject("count").put("value", headerCount);
      return bucket;
    }

    private Map<String, JsonNode> refreshedDocs(String index) {
      Map<String, JsonNode> visible = new TreeMap<>();
      docs(index)
          .forEach(
              (id, source) -> {
                if (refreshed.contains(index + DOC + id)) {
                  visible.put(id, source);
                }
              });
      return visible;
    }

    private AbstractVectorIndexService.RawResponse deleteByQuery(String index, String body)
        throws IOException {
      AbstractVectorIndexService.RawResponse response =
          new AbstractVectorIndexService.RawResponse(404, "{\"error\":\"index_not_found\"}");
      if (existsOrCount(index)) {
        JsonNode bool = MAPPER.readTree(body).path("query").path("bool");
        String parentId = bool.path("filter").path(0).path("term").path("parentId").asText();
        Set<String> kept = new HashSet<>();
        bool.path("must_not")
            .path(0)
            .path("ids")
            .path("values")
            .forEach(id -> kept.add(id.asText()));
        docs(index)
            .entrySet()
            .removeIf(
                doc ->
                    refreshed.contains(index + DOC + doc.getKey())
                        && !kept.contains(doc.getKey())
                        && parentId.equals(doc.getValue().path("parentId").asText()));
        response = ok("{\"failures\":[]}");
      }
      return response;
    }

    private Map<String, JsonNode> docs(String index) {
      return indices.computeIfAbsent(index, ignored -> new HashMap<>());
    }

    private static AbstractVectorIndexService.RawResponse ok(String body) {
      return new AbstractVectorIndexService.RawResponse(200, body);
    }
  }
}
