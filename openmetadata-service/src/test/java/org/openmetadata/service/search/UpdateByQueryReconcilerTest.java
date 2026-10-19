package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;

class UpdateByQueryReconcilerTest {

  private static final List<String> INDICES = List.of("table_search_index");

  @Test
  void aConflictIsRetriedAgainstARefreshedSnapshot() throws IOException {
    AtomicInteger visibleVersion = new AtomicInteger(1);

    UpdateByQueryOutcome result =
        UpdateByQueryReconciler.reconcile(
            () -> visibleVersion.get() == 1 ? outcome(4, 1, List.of()) : outcome(1, 0, List.of()),
            () -> visibleVersion.set(2),
            true);

    assertEquals(0, result.versionConflicts());
    assertEquals(5, result.updatedDocuments());
    assertEquals(2, result.attempts());
  }

  @Test
  void persistentConflictsStopAfterThreeAttempts() throws IOException {
    AtomicInteger attempts = new AtomicInteger();

    UpdateByQueryOutcome result =
        UpdateByQueryReconciler.reconcile(
            () -> {
              attempts.incrementAndGet();
              return outcome(0, 2, List.of());
            },
            () -> {},
            true);

    assertEquals(UpdateByQueryReconciler.MAX_ATTEMPTS, attempts.get());
    assertEquals(UpdateByQueryReconciler.MAX_ATTEMPTS, result.attempts());
    assertEquals(2, result.versionConflicts());
  }

  @Test
  void aQueryThatIsNotSafeToReplayRunsOnce() throws IOException {
    AtomicInteger attempts = new AtomicInteger();

    UpdateByQueryOutcome result =
        UpdateByQueryReconciler.reconcile(
            () -> {
              attempts.incrementAndGet();
              return outcome(3, 1, List.of());
            },
            () -> {
              throw new AssertionError("A query that is not safe to replay is not refreshed");
            },
            false);

    assertEquals(1, attempts.get());
    assertEquals(1, result.attempts());
    assertEquals(1, result.versionConflicts());
  }

  @Test
  void shardFailuresAreReportedNotRetried() throws IOException {
    UpdateByQueryOutcome result =
        UpdateByQueryReconciler.reconcile(
            () -> outcome(0, 1, List.of("invalid script")),
            () -> {
              throw new AssertionError("A shard failure is not a version conflict");
            },
            true);

    assertEquals(List.of("invalid script"), result.failureReasons());
    assertEquals(1, result.attempts());
  }

  @Test
  void aPrefixRenameNestingUnderItselfIsNotSafeToReplay() {
    assertTrue(UpdateByQueryReconciler.prefixRenameIsReplaySafe("Finance", "Sales"));
    assertTrue(UpdateByQueryReconciler.prefixRenameIsReplaySafe("Finance", "FinanceOps"));
    assertTrue(UpdateByQueryReconciler.prefixRenameIsReplaySafe("Finance.Ops", "Finance"));
    assertFalse(UpdateByQueryReconciler.prefixRenameIsReplaySafe("Finance", "Finance.Ops"));
  }

  @Test
  void leftoverConflictsOnKnownDocumentsAreQueuedForReindex() {
    try (MockedStatic<SearchIndexRetryQueue> queue = mockStatic(SearchIndexRetryQueue.class)) {
      outcome(1, 1, List.of()).requeueIfConflicted(List.of("a", "b"));

      queue.verify(() -> SearchIndexRetryQueue.enqueue(eq("a"), isNull(), anyString()));
      queue.verify(() -> SearchIndexRetryQueue.enqueue(eq("b"), isNull(), anyString()));
    }
  }

  @Test
  void theQueuedReasonStatesTheAttemptsActuallyMade() {
    try (MockedStatic<SearchIndexRetryQueue> queue = mockStatic(SearchIndexRetryQueue.class)) {
      new UpdateByQueryOutcome("rename", INDICES, 0, 2, List.of(), 1)
          .requeueIfConflicted(List.of("a"));

      queue.verify(
          () ->
              SearchIndexRetryQueue.enqueue(
                  eq("a"), isNull(), eq("rename: 2 version conflict(s) left after 1 attempt(s)")));
    }
  }

  @Test
  void nothingIsQueuedWithoutLeftoverConflicts() {
    try (MockedStatic<SearchIndexRetryQueue> queue = mockStatic(SearchIndexRetryQueue.class)) {
      outcome(2, 0, List.of()).requeueIfConflicted(List.of("a"));

      queue.verify(
          () -> SearchIndexRetryQueue.enqueue(anyString(), isNull(), anyString()), never());
    }
  }

  private static UpdateByQueryOutcome outcome(
      long updated, long versionConflicts, List<String> failures) {
    return new UpdateByQueryOutcome("test", INDICES, updated, versionConflicts, failures);
  }
}
