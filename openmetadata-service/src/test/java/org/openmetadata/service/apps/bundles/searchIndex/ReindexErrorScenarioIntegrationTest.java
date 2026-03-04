package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.DistributedSearchIndexCoordinator;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.EntityCompletionTracker;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.PartitionStatus;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.PartitionWorker;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.PartitionWorker.PartitionResult;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.SearchIndexPartition;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.ServerIdentityResolver;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.DefaultRecreateHandler;
import org.openmetadata.service.search.EntityReindexContext;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.EntityUtil.Fields;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@Slf4j
@DisplayName("Reindex Error Scenario Integration Tests")
class ReindexErrorScenarioIntegrationTest {

  @Mock private DistributedSearchIndexCoordinator coordinator;
  @Mock private BulkSink bulkSink;
  @Mock private CollectionDAO collectionDAO;
  @Mock private CollectionDAO.SearchIndexServerStatsDAO statsDAO;
  @Mock private CollectionDAO.SearchIndexFailureDAO failureDAO;
  @Mock private EntityRepository<?> mockRepository;

  private MockedStatic<Entity> entityMock;
  private MockedStatic<ServerIdentityResolver> serverIdMock;
  private List<CollectionDAO.SearchIndexFailureDAO.SearchIndexFailureRecord> capturedFailures;
  private IndexingFailureRecorder failureRecorder;
  private PartitionWorker worker;
  private UUID jobId;

  @BeforeEach
  void setUp() {
    jobId = UUID.randomUUID();
    capturedFailures = new ArrayList<>();

    entityMock = mockStatic(Entity.class);
    serverIdMock = mockStatic(ServerIdentityResolver.class);

    entityMock.when(() -> Entity.getEntityRepository("table")).thenReturn(mockRepository);
    entityMock
        .when(() -> Entity.getFields(eq("table"), anyList()))
        .thenReturn(new Fields(Collections.emptySet()));

    ServerIdentityResolver mockResolver = mock(ServerIdentityResolver.class);
    when(mockResolver.getServerId()).thenReturn("test-server");
    serverIdMock.when(ServerIdentityResolver::getInstance).thenReturn(mockResolver);

    when(coordinator.getCollectionDAO()).thenReturn(collectionDAO);
    when(collectionDAO.searchIndexServerStatsDAO()).thenReturn(statsDAO);
    when(collectionDAO.searchIndexFailureDAO()).thenReturn(failureDAO);

    doAnswer(
            invocation -> {
              @SuppressWarnings("unchecked")
              List<CollectionDAO.SearchIndexFailureDAO.SearchIndexFailureRecord> records =
                  invocation.getArgument(0);
              capturedFailures.addAll(records);
              return null;
            })
        .when(failureDAO)
        .insertBatch(anyList());

    lenient()
        .when(mockRepository.getCursorAtOffset(any(ListFilter.class), anyInt()))
        .thenReturn("encoded-cursor");

    lenient().when(bulkSink.flushAndAwait(anyInt())).thenReturn(true);
    lenient().when(bulkSink.getPendingVectorTaskCount()).thenReturn(0);

    failureRecorder =
        new IndexingFailureRecorder(collectionDAO, jobId.toString(), "test-server", 100);

    worker = new PartitionWorker(coordinator, bulkSink, 100, null, false, failureRecorder, null);
  }

  @AfterEach
  void tearDown() {
    if (failureRecorder != null) {
      failureRecorder.close();
    }
    if (entityMock != null) {
      entityMock.close();
    }
    if (serverIdMock != null) {
      serverIdMock.close();
    }
  }

  private SearchIndexPartition createPartition(long rangeStart, long rangeEnd) {
    return SearchIndexPartition.builder()
        .id(UUID.randomUUID())
        .jobId(jobId)
        .entityType("table")
        .partitionIndex(0)
        .rangeStart(rangeStart)
        .rangeEnd(rangeEnd)
        .estimatedCount(rangeEnd - rangeStart)
        .workUnits(rangeEnd - rangeStart)
        .priority(0)
        .status(PartitionStatus.PENDING)
        .cursor(0L)
        .processedCount(0L)
        .successCount(0L)
        .failedCount(0L)
        .claimableAt(System.currentTimeMillis())
        .build();
  }

  private ResultList<EntityInterface> createResultList(int count, String nextCursor) {
    List<EntityInterface> entities = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      entities.add(mock(EntityInterface.class));
    }
    Paging paging = new Paging();
    paging.setAfter(nextCursor);
    paging.setTotal(count);
    ResultList<EntityInterface> result = new ResultList<>(entities);
    result.setPaging(paging);
    return result;
  }

  private ResultList<EntityInterface> createResultListWithErrors(
      int successCount, int errorCount, String nextCursor) {
    List<EntityInterface> entities = new ArrayList<>();
    for (int i = 0; i < successCount; i++) {
      entities.add(mock(EntityInterface.class));
    }
    List<EntityError> errors = new ArrayList<>();
    for (int i = 0; i < errorCount; i++) {
      errors.add(new EntityError().withMessage("Error reading entity " + i).withEntity("eid-" + i));
    }
    Paging paging = new Paging();
    paging.setAfter(nextCursor);
    paging.setTotal(successCount + errorCount);
    ResultList<EntityInterface> result = new ResultList<>(entities);
    result.setPaging(paging);
    result.setErrors(errors);
    return result;
  }

  private void stubListAfterKeysetThrowFirst(Throwable t) {
    doThrow(t)
        .when(mockRepository)
        .listAfterKeyset(
            any(ListFilter.class), anyInt(), any(), anyInt(), eq(true), any(Fields.class));
  }

  private void stubListAfterKeysetViaAnswer(List<Object> responses) {
    AtomicInteger callIndex = new AtomicInteger(0);
    doAnswer(
            invocation -> {
              int idx = callIndex.getAndIncrement();
              if (idx < responses.size()) {
                Object resp = responses.get(idx);
                if (resp instanceof Throwable t) {
                  throw t;
                }
                return resp;
              }
              return createResultList(0, null);
            })
        .when(mockRepository)
        .listAfterKeyset(
            any(ListFilter.class), anyInt(), any(), anyInt(), eq(true), any(Fields.class));
  }

  @Nested
  @DisplayName("1. Reader Failure Tests")
  class ReaderFailureTests {

    @Test
    @DisplayName("Reader throws mid-partition — batches 1,3 OK, batch 2 throws")
    void testReaderThrowsMidPartition() {
      SearchIndexPartition partition = createPartition(0, 300);

      ResultList<EntityInterface> batch1 = createResultList(100, "cursor-1");
      ResultList<EntityInterface> batch3 = createResultList(100, null);

      stubListAfterKeysetViaAnswer(
          List.of(batch1, new RuntimeException("DB connection lost"), batch3));

      PartitionResult result = worker.processPartition(partition);

      assertEquals(200, result.successCount());
      assertEquals(100, result.failedCount());
      assertEquals(100, result.readerFailed());
      assertFalse(result.wasStopped());
      verify(coordinator).completePartition(eq(partition.getId()), eq(200L), eq(100L));
    }

    @Test
    @DisplayName("Reader returns empty — data exhausted early")
    void testReaderReturnsEmpty() {
      SearchIndexPartition partition = createPartition(0, 200);

      ResultList<EntityInterface> batch1 = createResultList(100, null);
      stubListAfterKeysetViaAnswer(List.of(batch1));

      when(mockRepository.getCursorAtOffset(any(ListFilter.class), anyInt())).thenReturn(null);

      PartitionResult result = worker.processPartition(partition);

      assertEquals(100, result.successCount());
      assertEquals(0, result.failedCount());
      assertFalse(result.wasStopped());
    }

    @Test
    @DisplayName("Reader throws on first batch")
    void testReaderThrowsOnFirstBatch() {
      SearchIndexPartition partition = createPartition(0, 100);

      stubListAfterKeysetThrowFirst(new RuntimeException("Table not found"));

      when(mockRepository.getCursorAtOffset(any(ListFilter.class), anyInt())).thenReturn(null);

      PartitionResult result = worker.processPartition(partition);

      assertEquals(0, result.successCount());
      assertEquals(100, result.failedCount());
      assertEquals(100, result.readerFailed());
    }

    @Test
    @DisplayName("Reader returns ResultList with EntityErrors")
    void testReaderReturnsEntityErrors() {
      SearchIndexPartition partition = createPartition(0, 100);

      ResultList<EntityInterface> batchWithErrors = createResultListWithErrors(95, 5, null);
      stubListAfterKeysetViaAnswer(List.of(batchWithErrors));

      when(mockRepository.getCursorAtOffset(any(ListFilter.class), anyInt())).thenReturn(null);

      PartitionResult result = worker.processPartition(partition);

      assertEquals(95, result.successCount());
      assertEquals(5, result.failedCount());

      failureRecorder.flush();
      long readerFailureCount =
          capturedFailures.stream().filter(r -> "READER".equals(r.getFailureStage())).count();
      assertEquals(5, readerFailureCount);
    }

    @Test
    @DisplayName("Reader throws on last batch only")
    void testReaderThrowsOnLastBatch() {
      SearchIndexPartition partition = createPartition(0, 300);

      ResultList<EntityInterface> batch1 = createResultList(100, "cursor-1");
      ResultList<EntityInterface> batch2 = createResultList(100, "cursor-2");

      stubListAfterKeysetViaAnswer(List.of(batch1, batch2, new RuntimeException("Timeout")));

      when(mockRepository.getCursorAtOffset(any(ListFilter.class), anyInt())).thenReturn(null);

      PartitionResult result = worker.processPartition(partition);

      assertEquals(200, result.successCount());
      assertEquals(100, result.failedCount());
    }
  }

  @Nested
  @DisplayName("2. Sink Failure Tests")
  class SinkFailureTests {

    @Test
    @DisplayName("Sink throws on write")
    void testSinkThrowsOnWrite() throws Exception {
      SearchIndexPartition partition = createPartition(0, 100);

      ResultList<EntityInterface> batch1 = createResultList(100, null);
      stubListAfterKeysetViaAnswer(List.of(batch1));

      doThrow(new RuntimeException("Connection reset"))
          .when(bulkSink)
          .write(anyList(), any(Map.class));

      when(mockRepository.getCursorAtOffset(any(ListFilter.class), anyInt())).thenReturn(null);

      PartitionResult result = worker.processPartition(partition);

      assertEquals(0, result.successCount());
      assertEquals(100, result.failedCount());
      verify(coordinator).completePartition(eq(partition.getId()), eq(0L), eq(100L));
    }

    @Test
    @DisplayName("Sink fails second batch only")
    void testSinkFailsSecondBatchOnly() throws Exception {
      SearchIndexPartition partition = createPartition(0, 300);

      ResultList<EntityInterface> batch1 = createResultList(100, "cursor-1");
      ResultList<EntityInterface> batch2 = createResultList(100, "cursor-2");
      ResultList<EntityInterface> batch3 = createResultList(100, null);

      stubListAfterKeysetViaAnswer(List.of(batch1, batch2, batch3));

      AtomicInteger writeCallCount = new AtomicInteger(0);
      doAnswer(
              invocation -> {
                int call = writeCallCount.incrementAndGet();
                if (call == 2) {
                  throw new RuntimeException("Connection reset");
                }
                return null;
              })
          .when(bulkSink)
          .write(anyList(), any(Map.class));

      PartitionResult result = worker.processPartition(partition);

      assertEquals(200, result.successCount());
      assertEquals(100, result.failedCount());
    }

    @Test
    @DisplayName("Sink fails all batches")
    void testSinkFailsAllBatches() throws Exception {
      SearchIndexPartition partition = createPartition(0, 300);

      ResultList<EntityInterface> batch1 = createResultList(100, "cursor-1");
      ResultList<EntityInterface> batch2 = createResultList(100, "cursor-2");
      ResultList<EntityInterface> batch3 = createResultList(100, null);

      stubListAfterKeysetViaAnswer(List.of(batch1, batch2, batch3));

      doThrow(new RuntimeException("Connection reset"))
          .when(bulkSink)
          .write(anyList(), any(Map.class));

      PartitionResult result = worker.processPartition(partition);

      assertEquals(0, result.successCount());
      assertEquals(300, result.failedCount());
    }
  }

  @Nested
  @DisplayName("3. Process Failure Tests")
  class ProcessFailureTests {

    @Test
    @DisplayName("Sink write throws RuntimeException — treated as SINK error")
    void testDocBuildFailureTreatedAsSink() throws Exception {
      SearchIndexPartition partition = createPartition(0, 100);

      ResultList<EntityInterface> batch1 = createResultList(100, null);
      stubListAfterKeysetViaAnswer(List.of(batch1));

      doThrow(new RuntimeException("Failed to serialize"))
          .when(bulkSink)
          .write(anyList(), any(Map.class));

      when(mockRepository.getCursorAtOffset(any(ListFilter.class), anyInt())).thenReturn(null);

      PartitionResult result = worker.processPartition(partition);

      assertEquals(0, result.successCount());
      assertEquals(100, result.failedCount());
      assertEquals(0, result.readerFailed());

      failureRecorder.flush();
      long sinkFailures =
          capturedFailures.stream().filter(r -> "SINK".equals(r.getFailureStage())).count();
      assertTrue(sinkFailures > 0);
    }

    @Test
    @DisplayName("Fatal exception in updatePartitionProgress — failPartition called")
    void testFatalExceptionCallsFailPartition() {
      SearchIndexPartition partition = createPartition(0, 100);

      doThrow(new NullPointerException("Unexpected null"))
          .when(coordinator)
          .updatePartitionProgress(any(SearchIndexPartition.class));

      worker.processPartition(partition);

      verify(coordinator).failPartition(eq(partition.getId()), anyString());
    }
  }

  @Nested
  @DisplayName("4. Vector Embedding Failure Tests")
  class VectorEmbeddingFailureTests {

    @Test
    @DisplayName("Vector timeout — partition completes normally with warning")
    void testVectorTimeout() {
      SearchIndexPartition partition = createPartition(0, 100);

      ResultList<EntityInterface> batch1 = createResultList(100, null);
      stubListAfterKeysetViaAnswer(List.of(batch1));

      when(mockRepository.getCursorAtOffset(any(ListFilter.class), anyInt())).thenReturn(null);

      when(bulkSink.getPendingVectorTaskCount()).thenReturn(5);
      when(bulkSink.awaitVectorCompletion(120)).thenReturn(false);

      PartitionResult result = worker.processPartition(partition);

      assertEquals(100, result.successCount());
      assertFalse(result.wasStopped());
      verify(coordinator).completePartition(eq(partition.getId()), eq(100L), eq(0L));
    }

    @Test
    @DisplayName("Vector tasks complete normally")
    void testVectorTasksCompleteNormally() {
      SearchIndexPartition partition = createPartition(0, 100);

      ResultList<EntityInterface> batch1 = createResultList(100, null);
      stubListAfterKeysetViaAnswer(List.of(batch1));

      when(mockRepository.getCursorAtOffset(any(ListFilter.class), anyInt())).thenReturn(null);

      when(bulkSink.getPendingVectorTaskCount()).thenReturn(3).thenReturn(0);
      when(bulkSink.awaitVectorCompletion(120)).thenReturn(true);

      PartitionResult result = worker.processPartition(partition);

      assertEquals(100, result.successCount());
      verify(coordinator).completePartition(eq(partition.getId()), eq(100L), eq(0L));
    }
  }

  @Nested
  @DisplayName("5. Promotion Failure Tests")
  class PromotionFailureTests {

    private SearchClient setupPromotionMocks(SearchRepository searchRepo) {
      SearchClient searchClient = mock(SearchClient.class);
      when(searchRepo.getSearchClient()).thenReturn(searchClient);
      when(searchRepo.getClusterAlias()).thenReturn("");

      IndexMapping indexMapping =
          IndexMapping.builder()
              .indexName("table_search_index")
              .alias("table")
              .parentAliases(List.of("all"))
              .childAliases(List.of())
              .build();
      when(searchRepo.getIndexMapping("table")).thenReturn(indexMapping);

      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepo);

      return searchClient;
    }

    @Test
    @DisplayName("swapAliases returns false — old indices NOT deleted")
    void testSwapAliasesReturnsFalse() {
      SearchRepository searchRepo = mock(SearchRepository.class);
      SearchClient searchClient = setupPromotionMocks(searchRepo);

      when(searchClient.listIndicesByPrefix("table_search_index"))
          .thenReturn(Set.of("table_search_index_rebuild_old", "table_search_index_rebuild_new"));
      when(searchClient.indexExists(anyString())).thenReturn(false);
      when(searchClient.swapAliases(any(), anyString(), any())).thenReturn(false);

      EntityReindexContext context =
          EntityReindexContext.builder()
              .entityType("table")
              .canonicalIndex("table_search_index")
              .stagedIndex("table_search_index_rebuild_new")
              .build();

      new DefaultRecreateHandler().promoteEntityIndex(context, true);

      verify(searchClient, never()).deleteIndexWithBackoff(eq("table_search_index_rebuild_old"));
    }

    @Test
    @DisplayName("getDocumentCount returns -1 — should promote to avoid data loss")
    void testDocCountUnknownPromotes() {
      SearchRepository searchRepo = mock(SearchRepository.class);
      SearchClient searchClient = setupPromotionMocks(searchRepo);

      when(searchClient.getDocumentCount("table_search_index_rebuild_new")).thenReturn(-1L);
      when(searchClient.listIndicesByPrefix("table_search_index")).thenReturn(Set.of());
      when(searchClient.indexExists(anyString())).thenReturn(false);
      when(searchClient.swapAliases(any(), anyString(), any())).thenReturn(true);

      EntityReindexContext context =
          EntityReindexContext.builder()
              .entityType("table")
              .canonicalIndex("table_search_index")
              .stagedIndex("table_search_index_rebuild_new")
              .build();

      new DefaultRecreateHandler().promoteEntityIndex(context, false);

      verify(searchClient).swapAliases(any(), eq("table_search_index_rebuild_new"), any());
    }

    @Test
    @DisplayName("Promotion callback throws — entity still in promotedEntities")
    void testPromotionCallbackThrowsEntityStillPromoted() {
      EntityCompletionTracker tracker = new EntityCompletionTracker(jobId);
      tracker.initializeEntity("table", 1);
      tracker.setOnEntityComplete(
          (entityType, success) -> {
            throw new RuntimeException("Promotion failed");
          });

      tracker.recordPartitionComplete("table", false);

      assertTrue(tracker.isPromoted("table"));
    }

    @Test
    @DisplayName("Zero-doc entity, reindex failed — should NOT promote")
    void testZeroDocReindexFailedNoPromotion() {
      SearchRepository searchRepo = mock(SearchRepository.class);
      SearchClient searchClient = setupPromotionMocks(searchRepo);

      when(searchClient.getDocumentCount("table_search_index_rebuild_new")).thenReturn(0L);
      when(searchClient.indexExists("table_search_index_rebuild_new")).thenReturn(true);

      EntityReindexContext context =
          EntityReindexContext.builder()
              .entityType("table")
              .canonicalIndex("table_search_index")
              .stagedIndex("table_search_index_rebuild_new")
              .build();

      new DefaultRecreateHandler().promoteEntityIndex(context, false);

      verify(searchClient, never()).swapAliases(any(), anyString(), any());
      verify(searchClient).deleteIndexWithBackoff("table_search_index_rebuild_new");
    }

    @Test
    @DisplayName("Zero-doc entity, reindex succeeded — should promote")
    void testZeroDocReindexSuccessPromotes() {
      SearchRepository searchRepo = mock(SearchRepository.class);
      SearchClient searchClient = setupPromotionMocks(searchRepo);

      when(searchClient.listIndicesByPrefix("table_search_index")).thenReturn(Set.of());
      when(searchClient.indexExists(anyString())).thenReturn(false);
      when(searchClient.swapAliases(any(), anyString(), any())).thenReturn(true);

      EntityReindexContext context =
          EntityReindexContext.builder()
              .entityType("table")
              .canonicalIndex("table_search_index")
              .stagedIndex("table_search_index_rebuild_new")
              .build();

      new DefaultRecreateHandler().promoteEntityIndex(context, true);

      verify(searchClient).swapAliases(any(), eq("table_search_index_rebuild_new"), any());
    }
  }

  @Nested
  @DisplayName("6. Mixed Failure Tests")
  class MixedFailureTests {

    @Test
    @DisplayName("Reader + sink failures in same partition")
    void testReaderAndSinkFailuresSamePartition() throws Exception {
      SearchIndexPartition partition = createPartition(0, 300);

      ResultList<EntityInterface> batch2 = createResultList(100, "cursor-2");
      ResultList<EntityInterface> batch3 = createResultList(100, null);

      stubListAfterKeysetViaAnswer(List.of(new RuntimeException("DB error"), batch2, batch3));

      AtomicInteger writeCallCount = new AtomicInteger(0);
      doAnswer(
              invocation -> {
                int call = writeCallCount.incrementAndGet();
                if (call == 2) {
                  throw new RuntimeException("Sink error");
                }
                return null;
              })
          .when(bulkSink)
          .write(anyList(), any(Map.class));

      PartitionResult result = worker.processPartition(partition);

      assertEquals(100, result.successCount());
      assertEquals(200, result.failedCount());
      assertEquals(100, result.readerFailed());
    }

    @Test
    @DisplayName("Multiple processPartition calls have independent stats")
    void testMultipleCallsIndependentStats() {
      ResultList<EntityInterface> batch = createResultList(100, null);
      stubListAfterKeysetViaAnswer(List.of(batch));

      when(mockRepository.getCursorAtOffset(any(ListFilter.class), anyInt())).thenReturn(null);

      SearchIndexPartition partition1 = createPartition(0, 100);
      PartitionResult result1 = worker.processPartition(partition1);
      assertEquals(100, result1.successCount());
      assertEquals(0, result1.failedCount());

      stubListAfterKeysetThrowFirst(new RuntimeException("Failure"));
      when(mockRepository.getCursorAtOffset(any(ListFilter.class), anyInt())).thenReturn(null);

      SearchIndexPartition partition2 = createPartition(0, 100);
      PartitionResult result2 = worker.processPartition(partition2);
      assertEquals(0, result2.successCount());
      assertEquals(100, result2.failedCount());
    }
  }

  @Nested
  @DisplayName("7. Stats Accuracy Tests")
  class StatsAccuracyTests {

    @Test
    @DisplayName("Stats consistent after reader failure: success + failed == total")
    void testStatsConsistentAfterReaderFailure() {
      SearchIndexPartition partition = createPartition(0, 300);

      ResultList<EntityInterface> batch1 = createResultList(100, "cursor-1");
      ResultList<EntityInterface> batch3 = createResultList(100, null);

      stubListAfterKeysetViaAnswer(List.of(batch1, new RuntimeException("DB error"), batch3));

      PartitionResult result = worker.processPartition(partition);

      assertEquals(300, result.successCount() + result.failedCount());
    }

    @Test
    @DisplayName("Stats consistent after sink failure: success + failed == total")
    void testStatsConsistentAfterSinkFailure() throws Exception {
      SearchIndexPartition partition = createPartition(0, 200);

      ResultList<EntityInterface> batch1 = createResultList(100, "cursor-1");
      ResultList<EntityInterface> batch2 = createResultList(100, null);

      stubListAfterKeysetViaAnswer(List.of(batch1, batch2));

      AtomicInteger writeCallCount = new AtomicInteger(0);
      doAnswer(
              invocation -> {
                int call = writeCallCount.incrementAndGet();
                if (call == 1) {
                  throw new RuntimeException("Sink error");
                }
                return null;
              })
          .when(bulkSink)
          .write(anyList(), any(Map.class));

      PartitionResult result = worker.processPartition(partition);

      assertEquals(200, result.successCount() + result.failedCount());
    }

    @Test
    @DisplayName("Stats consistent after mixed failures: success + failed == total")
    void testStatsConsistentAfterMixedFailures() throws Exception {
      SearchIndexPartition partition = createPartition(0, 500);

      ResultList<EntityInterface> batch1 = createResultList(100, "cursor-1");
      ResultList<EntityInterface> batch3 = createResultList(100, "cursor-3");
      ResultList<EntityInterface> batch4 = createResultList(100, "cursor-4");
      ResultList<EntityInterface> batch5 = createResultList(100, null);

      stubListAfterKeysetViaAnswer(
          List.of(batch1, new RuntimeException("Reader error"), batch3, batch4, batch5));

      AtomicInteger writeCallCount = new AtomicInteger(0);
      doAnswer(
              invocation -> {
                int call = writeCallCount.incrementAndGet();
                if (call == 3) {
                  throw new RuntimeException("Sink error");
                }
                return null;
              })
          .when(bulkSink)
          .write(anyList(), any(Map.class));

      PartitionResult result = worker.processPartition(partition);

      assertEquals(500, result.successCount() + result.failedCount());
    }
  }

  @Nested
  @DisplayName("8. Partition Lifecycle Tests")
  class PartitionLifecycleTests {

    @Test
    @DisplayName("Worker stopped mid-partition — wasStopped=true, completePartition NOT called")
    void testWorkerStoppedMidPartition() throws Exception {
      SearchIndexPartition partition = createPartition(0, 300);

      ResultList<EntityInterface> batch1 = createResultList(100, "cursor-1");
      ResultList<EntityInterface> batch2 = createResultList(100, "cursor-2");

      stubListAfterKeysetViaAnswer(List.of(batch1, batch2));

      doAnswer(
              invocation -> {
                worker.stop();
                return null;
              })
          .when(bulkSink)
          .write(anyList(), any(Map.class));

      PartitionResult result = worker.processPartition(partition);

      assertTrue(result.wasStopped());
      verify(coordinator, never()).completePartition(any(UUID.class), anyLong(), anyLong());
    }

    @Test
    @DisplayName("Coordinator fails partition on fatal error")
    void testCoordinatorFailsPartitionOnFatalError() {
      SearchIndexPartition partition = createPartition(0, 100);

      doThrow(new NullPointerException("Unexpected"))
          .when(coordinator)
          .updatePartitionProgress(any(SearchIndexPartition.class));

      worker.processPartition(partition);

      verify(coordinator).failPartition(eq(partition.getId()), anyString());
      verify(coordinator, never()).completePartition(any(UUID.class), anyLong(), anyLong());
    }
  }
}
