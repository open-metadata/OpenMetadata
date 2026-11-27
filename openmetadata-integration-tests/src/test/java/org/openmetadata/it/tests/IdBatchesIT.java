package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.migration.utils.IdBatches.BATCH_SIZE;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.PreparedBatch;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.service.migration.utils.IdBatches;

/**
 * Walks real tables across {@link IdBatches#BATCH_SIZE} page boundaries on the suite's engine.
 *
 * <p>Each test seeds its own scratch table, so no entity table and no other test is touched. Ids
 * are real UUID strings; the assertions never compare an order computed in Java, because what has
 * to hold is that the engine's own {@code >} and {@code ORDER BY} agree under its collation, so
 * every id is handed to the step exactly once.
 */
@Execution(ExecutionMode.CONCURRENT)
class IdBatchesIT {

  @Test
  void walksEveryIdOnceAcrossBatchBoundaries() {
    final List<List<String>> batches = walkScratchTable(2 * BATCH_SIZE + 1);

    assertEquals(List.of(BATCH_SIZE, BATCH_SIZE, 1), sizesOf(batches));
    assertEquals(2 * BATCH_SIZE + 1, distinctIdsIn(batches));
  }

  @Test
  void aTableFillingWholeBatchesNeverHandsTheStepAnEmptyBatch() {
    final List<List<String>> batches = walkScratchTable(2 * BATCH_SIZE);

    assertEquals(List.of(BATCH_SIZE, BATCH_SIZE), sizesOf(batches));
    assertEquals(2 * BATCH_SIZE, distinctIdsIn(batches));
  }

  private List<List<String>> walkScratchTable(final int rows) {
    final String table = "id_batches_it_" + UUID.randomUUID().toString().substring(0, 8);
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle -> {
              handle.execute("CREATE TABLE " + table + " (id VARCHAR(36) NOT NULL PRIMARY KEY)");
              try {
                seed(handle, table, rows);
                return IdBatches.fold(handle, table, new ArrayList<List<String>>(), this::collect);
              } finally {
                handle.execute("DROP TABLE " + table);
              }
            });
  }

  private void seed(final Handle handle, final String table, final int rows) {
    final PreparedBatch batch = handle.prepareBatch("INSERT INTO " + table + " (id) VALUES (:id)");
    for (int row = 0; row < rows; row++) {
      batch.bind("id", UUID.randomUUID().toString()).add();
    }
    batch.execute();
  }

  private List<List<String>> collect(final List<List<String>> seen, final List<String> batch) {
    seen.add(List.copyOf(batch));
    return seen;
  }

  private List<Integer> sizesOf(final List<List<String>> batches) {
    return batches.stream().map(List::size).toList();
  }

  private int distinctIdsIn(final List<List<String>> batches) {
    final Set<String> ids = new HashSet<>();
    batches.forEach(ids::addAll);
    return ids.size();
  }
}
