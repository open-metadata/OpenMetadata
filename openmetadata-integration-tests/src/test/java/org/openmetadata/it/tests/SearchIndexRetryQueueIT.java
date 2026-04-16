package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Timestamp;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexRetryQueueDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexRetryQueueDAO.SearchIndexRetryRecord;
import org.openmetadata.service.search.SearchIndexRetryQueue;
import org.openmetadata.service.search.SearchIndexRetryWorker;
import org.openmetadata.service.search.SearchRepository;

@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD)
class SearchIndexRetryQueueIT {

  private static CollectionDAO collectionDAO;
  private static SearchIndexRetryQueueDAO retryQueueDAO;
  private static SearchRepository searchRepository;

  @BeforeAll
  static void setupAll() {
    SdkClients.adminClient();
    collectionDAO = Entity.getCollectionDAO();
    retryQueueDAO = collectionDAO.searchIndexRetryQueueDAO();
    searchRepository = Entity.getSearchRepository();
  }

  @BeforeEach
  void cleanQueue() {
    retryQueueDAO.deleteByStatuses(
        List.of(
            SearchIndexRetryQueue.STATUS_PENDING,
            SearchIndexRetryQueue.STATUS_PENDING_RETRY_1,
            SearchIndexRetryQueue.STATUS_PENDING_RETRY_2,
            SearchIndexRetryQueue.STATUS_IN_PROGRESS,
            SearchIndexRetryQueue.STATUS_COMPLETED,
            SearchIndexRetryQueue.STATUS_FAILED));
  }

  // ---------------------------------------------------------------------------
  // DAO-level tests
  // ---------------------------------------------------------------------------

  @Test
  void testUpsertAndFindByStatus(TestNamespace ns) {
    String entityId = UUID.randomUUID().toString();
    String entityFqn = ns.prefix("rq") + ".testEntity";

    retryQueueDAO.upsert(
        entityId, entityFqn, "test failure reason", SearchIndexRetryQueue.STATUS_PENDING, "table");

    List<SearchIndexRetryRecord> records =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_PENDING, 1000);
    assertTrue(records.stream().anyMatch(r -> r.getEntityId().equals(entityId)));

    SearchIndexRetryRecord record =
        records.stream().filter(r -> r.getEntityId().equals(entityId)).findFirst().orElseThrow();
    assertEquals(entityFqn, record.getEntityFqn());
    assertEquals("test failure reason", record.getFailureReason());
    assertEquals(SearchIndexRetryQueue.STATUS_PENDING, record.getStatus());
    assertEquals("table", record.getEntityType());
    assertEquals(0, record.getRetryCount());
    assertNull(record.getClaimedAt());

    retryQueueDAO.deleteByEntity(entityId, entityFqn);
  }

  @Test
  void testUpsertWithEntityType(TestNamespace ns) {
    String entityId = UUID.randomUUID().toString();
    String entityFqn = ns.prefix("rq") + ".entity";

    retryQueueDAO.upsert(
        entityId, entityFqn, "failure", SearchIndexRetryQueue.STATUS_PENDING, "dashboard");

    List<SearchIndexRetryRecord> records =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_PENDING, 1000);
    SearchIndexRetryRecord record =
        records.stream().filter(r -> r.getEntityId().equals(entityId)).findFirst().orElseThrow();
    assertEquals("dashboard", record.getEntityType());

    retryQueueDAO.deleteByEntity(entityId, entityFqn);
  }

  @Test
  void testUpsertOverwritesOnConflict(TestNamespace ns) {
    String entityId = UUID.randomUUID().toString();
    String entityFqn = ns.prefix("rq") + ".entity";

    retryQueueDAO.upsert(entityId, entityFqn, "first", SearchIndexRetryQueue.STATUS_PENDING, "");
    retryQueueDAO.upsert(
        entityId, entityFqn, "second", SearchIndexRetryQueue.STATUS_PENDING, "table");

    List<SearchIndexRetryRecord> records =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_PENDING, 1000);
    long count = records.stream().filter(r -> r.getEntityId().equals(entityId)).count();
    assertEquals(1, count);

    SearchIndexRetryRecord record =
        records.stream().filter(r -> r.getEntityId().equals(entityId)).findFirst().orElseThrow();
    assertEquals("second", record.getFailureReason());
    assertEquals("table", record.getEntityType());

    retryQueueDAO.deleteByEntity(entityId, entityFqn);
  }

  @Test
  void testFindByStatuses(TestNamespace ns) {
    String id1 = UUID.randomUUID().toString();
    String id2 = UUID.randomUUID().toString();
    String id3 = UUID.randomUUID().toString();
    String fqn1 = ns.prefix("rq") + ".a";
    String fqn2 = ns.prefix("rq") + ".b";
    String fqn3 = ns.prefix("rq") + ".c";

    // Use statuses that the background SearchIndexRetryWorker does not claim
    // (COMPLETED, FAILED, IN_PROGRESS) to avoid race conditions where a worker thread
    // changes a PENDING record to IN_PROGRESS between insert and assertion.
    retryQueueDAO.upsert(id1, fqn1, "f", SearchIndexRetryQueue.STATUS_COMPLETED, "");
    retryQueueDAO.upsert(id2, fqn2, "f", SearchIndexRetryQueue.STATUS_FAILED, "");
    retryQueueDAO.upsert(id3, fqn3, "f", SearchIndexRetryQueue.STATUS_IN_PROGRESS, "");

    List<SearchIndexRetryRecord> matchedRecords =
        retryQueueDAO.findByStatuses(
            List.of(SearchIndexRetryQueue.STATUS_COMPLETED, SearchIndexRetryQueue.STATUS_FAILED),
            1000);
    assertTrue(matchedRecords.stream().anyMatch(r -> r.getEntityId().equals(id1)));
    assertTrue(matchedRecords.stream().anyMatch(r -> r.getEntityId().equals(id2)));
    assertFalse(matchedRecords.stream().anyMatch(r -> r.getEntityId().equals(id3)));
  }

  @Test
  void testCountByStatus(TestNamespace ns) {
    String id1 = UUID.randomUUID().toString();
    String id2 = UUID.randomUUID().toString();

    retryQueueDAO.upsert(id1, ns.prefix("rq") + ".a", "f", SearchIndexRetryQueue.STATUS_FAILED, "");
    retryQueueDAO.upsert(id2, ns.prefix("rq") + ".b", "f", SearchIndexRetryQueue.STATUS_FAILED, "");

    int count = retryQueueDAO.countByStatus(SearchIndexRetryQueue.STATUS_FAILED);
    assertTrue(count >= 2);
  }

  @Test
  void testDeleteByEntity(TestNamespace ns) {
    String entityId = UUID.randomUUID().toString();
    String entityFqn = ns.prefix("rq") + ".entity";

    retryQueueDAO.upsert(entityId, entityFqn, "failure", SearchIndexRetryQueue.STATUS_PENDING, "");
    int deleted = retryQueueDAO.deleteByEntity(entityId, entityFqn);
    assertEquals(1, deleted);

    List<SearchIndexRetryRecord> records =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_PENDING, 1000);
    assertFalse(records.stream().anyMatch(r -> r.getEntityId().equals(entityId)));
  }

  @Test
  void testDeleteByStatuses(TestNamespace ns) {
    String id1 = UUID.randomUUID().toString();
    String id2 = UUID.randomUUID().toString();
    String fqn1 = ns.prefix("rq") + ".a";
    String fqn2 = ns.prefix("rq") + ".b";

    retryQueueDAO.upsert(id1, fqn1, "f", SearchIndexRetryQueue.STATUS_PENDING, "");
    retryQueueDAO.upsert(id2, fqn2, "f", SearchIndexRetryQueue.STATUS_FAILED, "");

    int deleted = retryQueueDAO.deleteByStatuses(List.of(SearchIndexRetryQueue.STATUS_FAILED));
    assertTrue(deleted >= 1);

    List<SearchIndexRetryRecord> remaining =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_PENDING, 1000);
    assertTrue(remaining.stream().anyMatch(r -> r.getEntityId().equals(id1)));
  }

  // ---------------------------------------------------------------------------
  // Claim and claimedAt tests
  // ---------------------------------------------------------------------------

  @Test
  void testClaimRecordSetsClaimedAt(TestNamespace ns) {
    String entityId = UUID.randomUUID().toString();
    String entityFqn = ns.prefix("rq") + ".entity";

    retryQueueDAO.upsert(
        entityId, entityFqn, "failure", SearchIndexRetryQueue.STATUS_PENDING, "table");

    int claimed =
        retryQueueDAO.claimRecord(entityId, entityFqn, SearchIndexRetryQueue.STATUS_PENDING);
    assertEquals(1, claimed);

    List<SearchIndexRetryRecord> inProgress =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_IN_PROGRESS, 1000);
    SearchIndexRetryRecord record =
        inProgress.stream().filter(r -> r.getEntityId().equals(entityId)).findFirst().orElseThrow();
    assertEquals(SearchIndexRetryQueue.STATUS_IN_PROGRESS, record.getStatus());
    assertNotNull(record.getClaimedAt());

    retryQueueDAO.deleteByEntity(entityId, entityFqn);
  }

  @Test
  void testClaimRecordFailsIfStatusChanged(TestNamespace ns) {
    String entityId = UUID.randomUUID().toString();
    String entityFqn = ns.prefix("rq") + ".entity";

    retryQueueDAO.upsert(
        entityId, entityFqn, "failure", SearchIndexRetryQueue.STATUS_COMPLETED, "");

    int first =
        retryQueueDAO.claimRecord(entityId, entityFqn, SearchIndexRetryQueue.STATUS_COMPLETED);
    assertEquals(1, first);

    int second =
        retryQueueDAO.claimRecord(entityId, entityFqn, SearchIndexRetryQueue.STATUS_COMPLETED);
    assertEquals(0, second);

    retryQueueDAO.deleteByEntity(entityId, entityFqn);
  }

  @Test
  void testClaimPendingBatch(TestNamespace ns) {
    for (int i = 0; i < 5; i++) {
      retryQueueDAO.upsert(
          UUID.randomUUID().toString(),
          ns.prefix("rq") + ".entity" + i,
          "failure",
          SearchIndexRetryQueue.STATUS_PENDING,
          "");
    }

    List<SearchIndexRetryRecord> claimed = retryQueueDAO.claimPending(3);
    assertEquals(3, claimed.size());

    for (SearchIndexRetryRecord record : claimed) {
      List<SearchIndexRetryRecord> inProgress =
          retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_IN_PROGRESS, 100);
      assertTrue(inProgress.stream().anyMatch(r -> r.getEntityId().equals(record.getEntityId())));
    }
  }

  @Test
  void testClaimPendingIncludesRetryStatuses(TestNamespace ns) {
    String id1 = UUID.randomUUID().toString();
    String id2 = UUID.randomUUID().toString();
    String id3 = UUID.randomUUID().toString();
    String fqn1 = ns.prefix("rq") + ".a";
    String fqn2 = ns.prefix("rq") + ".b";
    String fqn3 = ns.prefix("rq") + ".c";

    retryQueueDAO.upsert(id1, fqn1, "f", SearchIndexRetryQueue.STATUS_PENDING, "");
    retryQueueDAO.upsert(id2, fqn2, "f", SearchIndexRetryQueue.STATUS_PENDING_RETRY_1, "");
    retryQueueDAO.upsert(id3, fqn3, "f", SearchIndexRetryQueue.STATUS_PENDING_RETRY_2, "");

    List<SearchIndexRetryRecord> claimed = retryQueueDAO.claimPending(10);
    assertTrue(claimed.size() >= 3);
    assertTrue(claimed.stream().anyMatch(r -> r.getEntityId().equals(id1)));
    assertTrue(claimed.stream().anyMatch(r -> r.getEntityId().equals(id2)));
    assertTrue(claimed.stream().anyMatch(r -> r.getEntityId().equals(id3)));
  }

  // ---------------------------------------------------------------------------
  // Stale IN_PROGRESS recovery tests
  // ---------------------------------------------------------------------------

  @Test
  void testRecoverStaleInProgress(TestNamespace ns) {
    String entityId = UUID.randomUUID().toString();
    String entityFqn = ns.prefix("rq") + ".entity";

    retryQueueDAO.upsert(
        entityId, entityFqn, "failure", SearchIndexRetryQueue.STATUS_PENDING, "table");
    retryQueueDAO.claimRecord(entityId, entityFqn, SearchIndexRetryQueue.STATUS_PENDING);

    List<SearchIndexRetryRecord> inProgress =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_IN_PROGRESS, 1000);
    SearchIndexRetryRecord claimedRecord =
        inProgress.stream().filter(r -> r.getEntityId().equals(entityId)).findFirst().orElseThrow();
    assertNotNull(claimedRecord.getClaimedAt());

    // Build the cutoff from the database-generated claim time to avoid host/DB clock skew.
    Timestamp futureCutoff = new Timestamp(claimedRecord.getClaimedAt().getTime() + 1_000);
    int recovered = retryQueueDAO.recoverStaleInProgress(futureCutoff);
    assertTrue(recovered >= 1);

    List<SearchIndexRetryRecord> pending =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_PENDING, 1000);
    SearchIndexRetryRecord record =
        pending.stream().filter(r -> r.getEntityId().equals(entityId)).findFirst().orElseThrow();
    assertEquals(SearchIndexRetryQueue.STATUS_PENDING, record.getStatus());
    assertNull(record.getClaimedAt());

    retryQueueDAO.deleteByEntity(entityId, entityFqn);
  }

  @Test
  void testRecoverStaleDoesNotAffectRecentClaims(TestNamespace ns) {
    String entityId = UUID.randomUUID().toString();
    String entityFqn = ns.prefix("rq") + ".entity";

    retryQueueDAO.upsert(entityId, entityFqn, "failure", SearchIndexRetryQueue.STATUS_PENDING, "");
    retryQueueDAO.claimRecord(entityId, entityFqn, SearchIndexRetryQueue.STATUS_PENDING);

    List<SearchIndexRetryRecord> inProgress =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_IN_PROGRESS, 1000);
    SearchIndexRetryRecord claimedRecord =
        inProgress.stream().filter(r -> r.getEntityId().equals(entityId)).findFirst().orElseThrow();
    assertNotNull(claimedRecord.getClaimedAt());

    // Build the cutoff from the database-generated claim time to avoid host/DB clock skew.
    Timestamp pastCutoff = new Timestamp(claimedRecord.getClaimedAt().getTime() - 1_000);
    int recovered = retryQueueDAO.recoverStaleInProgress(pastCutoff);
    assertEquals(0, recovered);

    List<SearchIndexRetryRecord> updatedInProgress =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_IN_PROGRESS, 100);
    assertTrue(updatedInProgress.stream().anyMatch(r -> r.getEntityId().equals(entityId)));
  }

  // ---------------------------------------------------------------------------
  // Retry count progression tests
  // ---------------------------------------------------------------------------

  @Test
  void testUpdateFailureAndRetryCountIncrementsCount(TestNamespace ns) {
    String entityId = UUID.randomUUID().toString();
    String entityFqn = ns.prefix("rq") + ".entity";

    retryQueueDAO.upsert(
        entityId, entityFqn, "initial", SearchIndexRetryQueue.STATUS_PENDING, "table");
    retryQueueDAO.claimRecord(entityId, entityFqn, SearchIndexRetryQueue.STATUS_PENDING);

    retryQueueDAO.updateFailureAndRetryCount(
        entityId, entityFqn, "retry 1 failed", SearchIndexRetryQueue.STATUS_PENDING);

    List<SearchIndexRetryRecord> records =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_PENDING, 1000);
    SearchIndexRetryRecord record =
        records.stream().filter(r -> r.getEntityId().equals(entityId)).findFirst().orElseThrow();
    assertEquals(1, record.getRetryCount());
    assertEquals("retry 1 failed", record.getFailureReason());
    assertNull(record.getClaimedAt());

    retryQueueDAO.deleteByEntity(entityId, entityFqn);
  }

  @Test
  void testRetryCountProgressionToFailed(TestNamespace ns) {
    String entityId = UUID.randomUUID().toString();
    String entityFqn = ns.prefix("rq") + ".entity";

    retryQueueDAO.upsert(
        entityId, entityFqn, "initial failure", SearchIndexRetryQueue.STATUS_PENDING, "table");

    // Simulate the retry progression: PENDING → PENDING_RETRY_1 → PENDING_RETRY_2 → FAILED
    String[] statusProgression = {
      SearchIndexRetryQueue.STATUS_PENDING,
      SearchIndexRetryQueue.STATUS_PENDING_RETRY_1,
      SearchIndexRetryQueue.STATUS_PENDING_RETRY_2
    };
    String[] nextStatuses = {
      SearchIndexRetryQueue.STATUS_PENDING_RETRY_1,
      SearchIndexRetryQueue.STATUS_PENDING_RETRY_2,
      SearchIndexRetryQueue.STATUS_FAILED
    };
    for (int i = 0; i < 3; i++) {
      retryQueueDAO.claimRecord(entityId, entityFqn, statusProgression[i]);
      retryQueueDAO.updateFailureAndRetryCount(
          entityId, entityFqn, "attempt " + (i + 1) + " failed", nextStatuses[i]);
    }

    List<SearchIndexRetryRecord> failed =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_FAILED, 1000);
    SearchIndexRetryRecord record =
        failed.stream().filter(r -> r.getEntityId().equals(entityId)).findFirst().orElseThrow();
    assertEquals(SearchIndexRetryQueue.STATUS_FAILED, record.getStatus());
    assertEquals(3, record.getRetryCount());
    assertEquals("attempt 3 failed", record.getFailureReason());

    retryQueueDAO.deleteByEntity(entityId, entityFqn);
  }

  // ---------------------------------------------------------------------------
  // SearchIndexRetryQueue utility class tests
  // ---------------------------------------------------------------------------

  @Test
  void testEnqueueCreatesRecord(TestNamespace ns) {
    String entityId = UUID.randomUUID().toString();
    String entityFqn = ns.prefix("rq") + ".entity";

    SearchIndexRetryQueue.enqueue(entityId, entityFqn, "enqueue test failure");

    List<SearchIndexRetryRecord> records =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_PENDING, 1000);
    SearchIndexRetryRecord record =
        records.stream().filter(r -> r.getEntityId().equals(entityId)).findFirst().orElseThrow();
    assertEquals(entityFqn, record.getEntityFqn());
    assertEquals(SearchIndexRetryQueue.STATUS_PENDING, record.getStatus());
    assertTrue(record.getFailureReason().contains("enqueue test failure"));

    retryQueueDAO.deleteByEntity(entityId, entityFqn);
  }

  @Test
  void testEnqueueWithEntityTypeStoresType(TestNamespace ns) {
    String entityId = UUID.randomUUID().toString();
    String entityFqn = ns.prefix("rq") + ".entity";

    SearchIndexRetryQueue.enqueue(entityId, entityFqn, "pipeline", "pipeline failure");

    List<SearchIndexRetryRecord> records =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_PENDING, 1000);
    SearchIndexRetryRecord record =
        records.stream().filter(r -> r.getEntityId().equals(entityId)).findFirst().orElseThrow();
    assertEquals("pipeline", record.getEntityType());

    retryQueueDAO.deleteByEntity(entityId, entityFqn);
  }

  @Test
  void testEnqueueSkipsWhenBothKeysEmpty(TestNamespace ns) {
    int beforeCount = retryQueueDAO.countByStatus(SearchIndexRetryQueue.STATUS_PENDING);

    SearchIndexRetryQueue.enqueue("", "", "should not be inserted");
    SearchIndexRetryQueue.enqueue(null, null, "also should not be inserted");

    int afterCount = retryQueueDAO.countByStatus(SearchIndexRetryQueue.STATUS_PENDING);
    assertEquals(beforeCount, afterCount);
  }

  @Test
  void testEnqueueNormalizesWhitespace(TestNamespace ns) {
    String entityId = UUID.randomUUID().toString();

    SearchIndexRetryQueue.enqueue("  " + entityId + "  ", "  some.fqn  ", "failure");

    List<SearchIndexRetryRecord> records =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_PENDING, 1000);
    SearchIndexRetryRecord record =
        records.stream().filter(r -> r.getEntityId().equals(entityId)).findFirst().orElseThrow();
    assertEquals(entityId, record.getEntityId());
    assertEquals("some.fqn", record.getEntityFqn());

    retryQueueDAO.deleteByEntity(entityId, "some.fqn");
  }

  @Test
  void testFailureReasonFormat(TestNamespace ns) {
    String reason =
        SearchIndexRetryQueue.failureReason(
            "createEntityIndex", new RuntimeException("connection refused"));
    assertTrue(reason.startsWith("createEntityIndex: "));
    assertTrue(reason.contains("connection refused"));
  }

  @Test
  void testFailureReasonTruncation(TestNamespace ns) {
    String longMessage = "x".repeat(20000);
    String reason = SearchIndexRetryQueue.failureReason("op", new RuntimeException(longMessage));
    assertTrue(reason.length() <= 8192);
  }

  // ---------------------------------------------------------------------------
  // Status code classification tests
  // ---------------------------------------------------------------------------

  @Test
  void testClientErrorStatusCodesAreNotRetryable() {
    assertFalse(SearchIndexRetryQueue.isRetryableStatusCode(400));
    assertFalse(SearchIndexRetryQueue.isRetryableStatusCode(404));
    assertFalse(SearchIndexRetryQueue.isRetryableStatusCode(409));
    assertFalse(SearchIndexRetryQueue.isRetryableStatusCode(413));
    assertFalse(SearchIndexRetryQueue.isRetryableStatusCode(422));
  }

  @Test
  void testRateLimitStatusCodeIsRetryable() {
    assertTrue(SearchIndexRetryQueue.isRetryableStatusCode(429));
  }

  @Test
  void testServerErrorStatusCodesAreRetryable() {
    assertTrue(SearchIndexRetryQueue.isRetryableStatusCode(500));
    assertTrue(SearchIndexRetryQueue.isRetryableStatusCode(502));
    assertTrue(SearchIndexRetryQueue.isRetryableStatusCode(503));
    assertTrue(SearchIndexRetryQueue.isRetryableStatusCode(504));
  }

  @Test
  void testSuccessAndUnknownStatusCodesAreRetryable() {
    assertTrue(SearchIndexRetryQueue.isRetryableStatusCode(200));
    assertTrue(SearchIndexRetryQueue.isRetryableStatusCode(0));
    assertTrue(SearchIndexRetryQueue.isRetryableStatusCode(-1));
  }

  // ---------------------------------------------------------------------------
  // Worker integration tests
  // ---------------------------------------------------------------------------

  @Test
  void testWorkerProcessesValidEntityRetry(TestNamespace ns) throws Exception {
    var table = createTestTable(ns);
    String tableId = table.getId().toString();
    String tableFqn = table.getFullyQualifiedName();

    SearchIndexRetryQueue.enqueue(tableId, tableFqn, Entity.TABLE, "simulated failure");

    List<SearchIndexRetryRecord> before =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_PENDING, 1000);
    assertTrue(before.stream().anyMatch(r -> r.getEntityId().equals(tableId)));

    SearchIndexRetryWorker worker = new SearchIndexRetryWorker(collectionDAO, searchRepository);
    worker.start();
    try {
      Awaitility.await("Worker should process and remove the retry record")
          .atMost(Duration.ofSeconds(30))
          .pollInterval(Duration.ofSeconds(1))
          .until(
              () -> {
                List<SearchIndexRetryRecord> pending =
                    retryQueueDAO.findByStatuses(
                        List.of(
                            SearchIndexRetryQueue.STATUS_PENDING,
                            SearchIndexRetryQueue.STATUS_PENDING_RETRY_1,
                            SearchIndexRetryQueue.STATUS_PENDING_RETRY_2,
                            SearchIndexRetryQueue.STATUS_IN_PROGRESS),
                        1000);
                return pending.stream().noneMatch(r -> r.getEntityId().equals(tableId));
              });
    } finally {
      worker.stop();
    }

    List<SearchIndexRetryRecord> allRecords =
        retryQueueDAO.findByStatuses(
            List.of(
                SearchIndexRetryQueue.STATUS_PENDING,
                SearchIndexRetryQueue.STATUS_PENDING_RETRY_1,
                SearchIndexRetryQueue.STATUS_PENDING_RETRY_2,
                SearchIndexRetryQueue.STATUS_IN_PROGRESS,
                SearchIndexRetryQueue.STATUS_FAILED),
            1000);
    assertFalse(allRecords.stream().anyMatch(r -> r.getEntityId().equals(tableId)));
  }

  @Test
  void testWorkerUsesEntityTypeHintForResolution(TestNamespace ns) throws Exception {
    var table = createTestTable(ns);
    String tableId = table.getId().toString();
    String tableFqn = table.getFullyQualifiedName();

    SearchIndexRetryQueue.enqueue(tableId, tableFqn, Entity.TABLE, "hint test failure");

    SearchIndexRetryWorker worker = new SearchIndexRetryWorker(collectionDAO, searchRepository);
    worker.start();
    try {
      Awaitility.await("Worker should process retry record using entityType hint")
          .atMost(Duration.ofSeconds(30))
          .pollInterval(Duration.ofSeconds(1))
          .until(
              () -> {
                List<SearchIndexRetryRecord> remaining =
                    retryQueueDAO.findByStatuses(
                        List.of(
                            SearchIndexRetryQueue.STATUS_PENDING,
                            SearchIndexRetryQueue.STATUS_IN_PROGRESS),
                        1000);
                return remaining.stream().noneMatch(r -> r.getEntityId().equals(tableId));
              });
    } finally {
      worker.stop();
    }
  }

  @Test
  void testWorkerHandlesDeletedEntity(TestNamespace ns) throws Exception {
    String deletedId = UUID.randomUUID().toString();
    String deletedFqn = ns.prefix("rq") + ".deleted.entity";

    retryQueueDAO.upsert(
        deletedId, deletedFqn, "entity was deleted", SearchIndexRetryQueue.STATUS_PENDING, "table");

    SearchIndexRetryWorker worker = new SearchIndexRetryWorker(collectionDAO, searchRepository);
    worker.start();
    try {
      Awaitility.await("Worker should handle deleted entity and remove from queue")
          .atMost(Duration.ofSeconds(30))
          .pollInterval(Duration.ofSeconds(1))
          .until(
              () -> {
                List<SearchIndexRetryRecord> remaining =
                    retryQueueDAO.findByStatuses(
                        List.of(
                            SearchIndexRetryQueue.STATUS_PENDING,
                            SearchIndexRetryQueue.STATUS_IN_PROGRESS),
                        1000);
                return remaining.stream().noneMatch(r -> r.getEntityId().equals(deletedId));
              });
    } finally {
      worker.stop();
    }
  }

  @Test
  void testWorkerHandlesUnresolvableEntity(TestNamespace ns) throws Exception {
    String fakeId = UUID.randomUUID().toString();
    String entityFqn = ns.prefix("rq") + ".unresolvable.entity";

    retryQueueDAO.upsert(
        fakeId, entityFqn, "cannot resolve", SearchIndexRetryQueue.STATUS_PENDING, "");

    SearchIndexRetryWorker worker = new SearchIndexRetryWorker(collectionDAO, searchRepository);
    worker.start();
    try {
      Awaitility.await("Worker should move unresolvable entity to retry/failed status")
          .atMost(Duration.ofSeconds(30))
          .pollInterval(Duration.ofSeconds(1))
          .until(
              () -> {
                List<SearchIndexRetryRecord> pending =
                    retryQueueDAO.findByStatuses(
                        List.of(
                            SearchIndexRetryQueue.STATUS_PENDING,
                            SearchIndexRetryQueue.STATUS_IN_PROGRESS),
                        1000);
                return pending.stream().noneMatch(r -> r.getEntityId().equals(fakeId));
              });
    } finally {
      worker.stop();
    }

    retryQueueDAO.deleteByEntity(fakeId, entityFqn);
  }

  @Test
  void testWorkerStaleRecoveryIntegration(TestNamespace ns) throws Exception {
    String entityId = UUID.randomUUID().toString();
    String entityFqn = ns.prefix("rq") + ".stale.entity";

    retryQueueDAO.upsert(
        entityId, entityFqn, "stale test", SearchIndexRetryQueue.STATUS_PENDING, "");
    retryQueueDAO.claimRecord(entityId, entityFqn, SearchIndexRetryQueue.STATUS_PENDING);

    List<SearchIndexRetryRecord> inProgress =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_IN_PROGRESS, 1000);
    SearchIndexRetryRecord claimedRecord =
        inProgress.stream().filter(r -> r.getEntityId().equals(entityId)).findFirst().orElseThrow();
    assertNotNull(claimedRecord.getClaimedAt());

    Timestamp futureCutoff = new Timestamp(claimedRecord.getClaimedAt().getTime() + 1_000);
    int recovered = retryQueueDAO.recoverStaleInProgress(futureCutoff);
    assertTrue(recovered >= 1);

    List<SearchIndexRetryRecord> pending =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_PENDING, 1000);
    assertTrue(pending.stream().anyMatch(r -> r.getEntityId().equals(entityId)));

    SearchIndexRetryRecord record =
        pending.stream().filter(r -> r.getEntityId().equals(entityId)).findFirst().orElseThrow();
    assertNull(record.getClaimedAt());

    retryQueueDAO.deleteByEntity(entityId, entityFqn);
  }

  @Test
  void testWorkerExhaustsRetriesAndMarksFailed(TestNamespace ns) throws Exception {
    String entityFqn = ns.prefix("rq") + ".exhaust.retries";

    // Use a non-UUID entityId with a non-existent FQN so the worker cannot resolve or
    // clean up the entity, forcing it through the retry count progression to FAILED.
    retryQueueDAO.upsert(
        "", entityFqn, "initial failure", SearchIndexRetryQueue.STATUS_PENDING, "");

    SearchIndexRetryWorker worker = new SearchIndexRetryWorker(collectionDAO, searchRepository);
    worker.start();
    try {
      Awaitility.await("Record should reach FAILED after exhausting retries")
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(1))
          .until(
              () -> {
                List<SearchIndexRetryRecord> failed =
                    retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_FAILED, 1000);
                return failed.stream().anyMatch(r -> r.getEntityFqn().equals(entityFqn));
              });
    } finally {
      worker.stop();
    }

    SearchIndexRetryRecord record =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_FAILED, 1000).stream()
            .filter(r -> r.getEntityFqn().equals(entityFqn))
            .findFirst()
            .orElseThrow();
    assertEquals(SearchIndexRetryQueue.STATUS_FAILED, record.getStatus());
    assertEquals(3, record.getRetryCount());

    retryQueueDAO.deleteByEntity("", entityFqn);
  }

  @Test
  void testWorkerRecoversPendingRetryRecord(TestNamespace ns) throws Exception {
    var table = createTestTable(ns);
    String tableId = table.getId().toString();
    String tableFqn = table.getFullyQualifiedName();

    retryQueueDAO.upsert(
        tableId,
        tableFqn,
        "transient failure",
        SearchIndexRetryQueue.STATUS_PENDING_RETRY_1,
        Entity.TABLE);

    SearchIndexRetryWorker worker = new SearchIndexRetryWorker(collectionDAO, searchRepository);
    worker.start();
    try {
      Awaitility.await("Worker should process PENDING_RETRY_1 record for valid entity")
          .atMost(Duration.ofSeconds(30))
          .pollInterval(Duration.ofSeconds(1))
          .until(
              () -> {
                List<SearchIndexRetryRecord> remaining =
                    retryQueueDAO.findByStatuses(
                        List.of(
                            SearchIndexRetryQueue.STATUS_PENDING,
                            SearchIndexRetryQueue.STATUS_PENDING_RETRY_1,
                            SearchIndexRetryQueue.STATUS_PENDING_RETRY_2,
                            SearchIndexRetryQueue.STATUS_IN_PROGRESS),
                        1000);
                return remaining.stream().noneMatch(r -> r.getEntityId().equals(tableId));
              });
    } finally {
      worker.stop();
    }

    List<SearchIndexRetryRecord> allRecords =
        retryQueueDAO.findByStatuses(
            List.of(
                SearchIndexRetryQueue.STATUS_PENDING,
                SearchIndexRetryQueue.STATUS_PENDING_RETRY_1,
                SearchIndexRetryQueue.STATUS_PENDING_RETRY_2,
                SearchIndexRetryQueue.STATUS_IN_PROGRESS,
                SearchIndexRetryQueue.STATUS_FAILED),
            1000);
    assertFalse(allRecords.stream().anyMatch(r -> r.getEntityId().equals(tableId)));
  }

  @Test
  void testEnqueuePreservesErrorDetailInFailureReason(TestNamespace ns) {
    String entityId = UUID.randomUUID().toString();
    String entityFqn = ns.prefix("rq") + ".errordetail";

    String reason =
        SearchIndexRetryQueue.failureReason(
            "createEntityIndex",
            new RuntimeException(
                "mapper_parsing_exception: failed to parse field [data] of type [keyword]"));

    SearchIndexRetryQueue.enqueue(entityId, entityFqn, Entity.TABLE, reason);

    List<SearchIndexRetryRecord> records =
        retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_PENDING, 1000);
    SearchIndexRetryRecord record =
        records.stream().filter(r -> r.getEntityId().equals(entityId)).findFirst().orElseThrow();

    assertTrue(record.getFailureReason().contains("mapper_parsing_exception"));
    assertTrue(record.getFailureReason().startsWith("createEntityIndex:"));

    retryQueueDAO.deleteByEntity(entityId, entityFqn);
  }

  // ---------------------------------------------------------------------------
  // Suspension tests
  // ---------------------------------------------------------------------------

  @Test
  void testSuspensionPreventsEnqueue(TestNamespace ns) {
    String entityId = UUID.randomUUID().toString();
    String entityFqn = ns.prefix("rq") + ".suspended.entity";
    try {
      SearchIndexRetryQueue.updateSuspension(java.util.Set.of(), true);
      assertTrue(SearchIndexRetryQueue.isSuspendAllStreaming());

      // Enqueue should still insert (suspension affects worker processing, not enqueueing)
      SearchIndexRetryQueue.enqueue(entityId, entityFqn, "during suspension");
      List<SearchIndexRetryRecord> records =
          retryQueueDAO.findByStatus(SearchIndexRetryQueue.STATUS_PENDING, 1000);
      assertTrue(records.stream().anyMatch(r -> r.getEntityId().equals(entityId)));
    } finally {
      SearchIndexRetryQueue.clearSuspension();
      retryQueueDAO.deleteByEntity(entityId, entityFqn);
    }
  }

  @Test
  void testWorkerDeletesRecordsDuringSuspendAll(TestNamespace ns) throws Exception {
    String entityId = UUID.randomUUID().toString();
    String entityFqn = ns.prefix("rq") + ".suspended.entity";

    retryQueueDAO.upsert(
        entityId, entityFqn, "will be suspended", SearchIndexRetryQueue.STATUS_PENDING, "table");

    try {
      SearchIndexRetryQueue.updateSuspension(java.util.Set.of(), true);

      SearchIndexRetryWorker worker = new SearchIndexRetryWorker(collectionDAO, searchRepository);
      worker.start();
      try {
        Awaitility.await("Worker should delete record during full suspension")
            .atMost(Duration.ofSeconds(30))
            .pollInterval(Duration.ofSeconds(1))
            .until(
                () -> {
                  List<SearchIndexRetryRecord> remaining =
                      retryQueueDAO.findByStatuses(
                          List.of(
                              SearchIndexRetryQueue.STATUS_PENDING,
                              SearchIndexRetryQueue.STATUS_IN_PROGRESS),
                          1000);
                  return remaining.stream().noneMatch(r -> r.getEntityId().equals(entityId));
                });
      } finally {
        worker.stop();
      }
    } finally {
      SearchIndexRetryQueue.clearSuspension();
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private Table createTestTable(TestNamespace ns) {
    var service = DatabaseServiceTestFactory.createPostgres(ns);
    var schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    return TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
  }
}
