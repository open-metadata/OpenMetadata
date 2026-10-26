/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.DistributedSearchIndexCoordinator;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.PartitionCalculator;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.PartitionStatus;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.PartitionWorker;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.SearchIndexJob;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.SearchIndexPartition;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;

/**
 * A reindex plans its partitions when the job starts, then reads them while the catalog keeps
 * changing. Rows created or deleted in between must not make any partition skip an existing row,
 * whichever server reads the partition. Partitions are read with the real repositories; only the
 * search write is captured, so the test sees exactly which rows the reindex sent to search.
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class DistributedReindexConcurrentWritesIT {

  private static final int EXISTING_TABLES = 30;
  private static final int CREATED_DURING_RUN = 5;
  private static final int DELETED_DURING_RUN = 3;
  private static final int PARTITION_SIZE = 1000;
  private static final int MIN_PARTITIONS = 10;
  private static final int BATCH_SIZE = 7;

  @Test
  void rowsWrittenDuringRunDoNotHideExistingRowsFromTheServerThatPlannedIt(TestNamespace ns)
      throws SearchIndexException {
    assertEveryTableIsIndexed(ns, false);
  }

  @Test
  void rowsWrittenDuringRunDoNotHideExistingRowsFromAnotherServer(TestNamespace ns)
      throws SearchIndexException {
    assertEveryTableIsIndexed(ns, true);
  }

  private void assertEveryTableIsIndexed(TestNamespace ns, boolean readOnAnotherServer)
      throws SearchIndexException {
    List<Table> existing = createTables(ns, "existing", EXISTING_TABLES);
    DistributedSearchIndexCoordinator planner = newCoordinator();
    SearchIndexJob job = planReindex(planner);
    List<Table> created = new ArrayList<>();
    try {
      created.addAll(createTables(ns, "0000_created_during_run", CREATED_DURING_RUN));
      existing
          .subList(0, DELETED_DURING_RUN)
          .forEach(DistributedReindexConcurrentWritesIT::hardDelete);
      DistributedSearchIndexCoordinator reader = readOnAnotherServer ? newCoordinator() : planner;
      Set<UUID> indexed = readAllPartitions(reader, job.getId());
      assertEquals(
          Set.of(), missing(tablesAFullReadIndexes(), indexed), "tables never sent to search");
    } finally {
      discardJob(planner, job.getId());
      created.forEach(DistributedReindexConcurrentWritesIT::hardDelete);
      existing.forEach(DistributedReindexConcurrentWritesIT::hardDelete);
    }
  }

  private static void discardJob(DistributedSearchIndexCoordinator coordinator, UUID jobId) {
    coordinator.markOrphanedJobCompletedWithErrors(jobId);
    coordinator.deleteJob(jobId);
  }

  private static List<Table> createTables(TestNamespace ns, String baseName, int count) {
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimple(ns, DatabaseServiceTestFactory.createPostgres(ns));
    List<Table> tables = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      tables.add(
          TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), baseName + "_" + i));
    }
    return tables;
  }

  private static DistributedSearchIndexCoordinator newCoordinator() {
    CollectionDAO dao = Entity.getCollectionDAO();
    return new DistributedSearchIndexCoordinator(
        dao, new PartitionCalculator(PARTITION_SIZE, MIN_PARTITIONS));
  }

  private static SearchIndexJob planReindex(DistributedSearchIndexCoordinator coordinator) {
    Set<String> entities = Set.of(Entity.TABLE);
    SearchIndexJob job =
        coordinator.createJob(entities, new EventPublisherJob().withEntities(entities), "admin");
    return coordinator.initializePartitions(job.getId());
  }

  private static Set<UUID> readAllPartitions(
      DistributedSearchIndexCoordinator coordinator, UUID jobId) {
    CapturingSink sink = new CapturingSink();
    PartitionWorker worker = new PartitionWorker(coordinator, sink, BATCH_SIZE, stagedContext());
    for (SearchIndexPartition partition :
        coordinator.getPartitions(jobId, PartitionStatus.PENDING)) {
      worker.processPartition(partition);
    }
    return sink.ids;
  }

  private static ReindexContext stagedContext() {
    ReindexContext context = new ReindexContext();
    context.add(
        Entity.TABLE,
        "table_search_index",
        "table_search_index",
        "table_search_index_capture",
        Set.of(),
        "table",
        List.of());
    return context;
  }

  /** What one uninterrupted read of the whole table sends to search, after the writes. */
  private static Set<UUID> tablesAFullReadIndexes() throws SearchIndexException {
    PaginatedEntitiesSource source =
        new PaginatedEntitiesSource(
            Entity.TABLE, PARTITION_SIZE, ReindexingUtil.getSearchIndexFields(Entity.TABLE), 0);
    Set<UUID> ids = new HashSet<>();
    String cursor = null;
    do {
      ResultList<? extends EntityInterface<?>> page = source.readNextKeyset(cursor);
      page.getData().forEach(entity -> ids.add(entity.getId()));
      cursor = page.getPaging() == null ? null : page.getPaging().getAfter();
    } while (cursor != null);
    return ids;
  }

  private static Set<UUID> missing(Set<UUID> expected, Set<UUID> indexed) {
    Set<UUID> missing = new TreeSet<>(expected);
    missing.removeAll(indexed);
    return missing;
  }

  private static void hardDelete(Table table) {
    try {
      SdkClients.adminClient()
          .tables()
          .delete(table.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
    } catch (Exception ignored) {
      // Already deleted by the test itself.
    }
  }

  /** Records which entities the reindex handed to search, in place of a real bulk sink. */
  private static final class CapturingSink implements BulkSink {
    private final Set<UUID> ids = new HashSet<>();

    @Override
    public void write(List<?> entities, Map<String, Object> contextData) {
      for (Object entity : entities) {
        ids.add(((EntityInterface<?>) entity).getId());
      }
    }

    @Override
    public void updateStats(int currentSuccess, int currentFailed) {}

    @Override
    public StepStats getStats() {
      return new StepStats();
    }

    @Override
    public void close() {}
  }
}
