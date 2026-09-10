package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.SearchUtils.ColumnLineageFlushOutcome;

class ColumnLineageReconcilerTest {

  @Test
  void refreshesBeforeRetryingAStaleSnapshot() throws IOException {
    AtomicInteger visibleVersion = new AtomicInteger(1);
    ColumnLineageFlushOutcome result =
        ColumnLineageReconciler.reconcile(
            Map.of(),
            () -> visibleVersion.get() == 1 ? outcome(1, 1, List.of()) : outcome(1, 0, List.of()),
            () -> visibleVersion.set(2));
    assertEquals(0, result.versionConflicts());
    assertEquals(2, result.updatedDocuments());
  }

  @Test
  void boundsPersistentConflicts() throws IOException {
    AtomicInteger attempts = new AtomicInteger();
    ColumnLineageFlushOutcome result =
        ColumnLineageReconciler.reconcile(
            Map.of(),
            () -> {
              attempts.incrementAndGet();
              return outcome(0, 1, List.of());
            },
            () -> {});
    assertEquals(3, attempts.get());
    assertEquals(1, result.versionConflicts());
  }

  @Test
  void doesNotRetrySuccessfulOrUnmatchedUpdates() throws IOException {
    for (int updated : List.of(0, 1)) {
      AtomicInteger attempts = new AtomicInteger();
      ColumnLineageFlushOutcome result =
          ColumnLineageReconciler.reconcile(
              Map.of(),
              () -> {
                attempts.incrementAndGet();
                return outcome(updated, 0, List.of());
              },
              () -> {
                throw new AssertionError("A successful update needs no retry refresh");
              });
      assertEquals(1, attempts.get());
      assertEquals(updated, result.updatedDocuments());
    }
  }

  @Test
  void doesNotRetryShardFailures() throws IOException {
    ColumnLineageFlushOutcome result =
        ColumnLineageReconciler.reconcile(
            Map.of(),
            () -> outcome(0, 1, List.of("invalid script")),
            () -> {
              throw new AssertionError("A shard failure is not a version conflict");
            });
    assertEquals(List.of("invalid script"), result.failureReasons());
  }

  @Test
  void propagatesTransportAndRefreshFailures() {
    assertThrows(
        IOException.class,
        () ->
            ColumnLineageReconciler.reconcile(
                Map.of(),
                () -> {
                  throw new IOException("unavailable");
                },
                () -> {}));
    assertThrows(
        IOException.class,
        () ->
            ColumnLineageReconciler.reconcile(
                Map.of(),
                () -> outcome(0, 1, List.of()),
                () -> {
                  throw new IOException("refresh unavailable");
                }));
  }

  @Test
  void doesNotReplayOverlappingRenames() throws IOException {
    AtomicInteger attempts = new AtomicInteger();
    ColumnLineageFlushOutcome result =
        ColumnLineageReconciler.reconcile(
            Map.of("a", "A", "A", "a"),
            () -> {
              attempts.incrementAndGet();
              return outcome(1, 1, List.of());
            },
            () -> {
              throw new AssertionError("Replaying a swap would undo successful documents");
            });
    assertEquals(1, attempts.get());
    assertEquals(1, result.versionConflicts());
  }

  private static ColumnLineageFlushOutcome outcome(
      long updated, long conflicts, List<String> failures) {
    return new ColumnLineageFlushOutcome(
        "Column reconciliation", "table", 2, updated, conflicts, failures);
  }
}
