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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.DistributedSearchIndexCoordinator;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.PartitionCalculator;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.SearchIndexJob;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.SearchIndexPartition;
import org.openmetadata.service.jdbi3.EntityDAO.CursorRow;
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * A reindex partition must start at the row it started at when the job was created, whichever
 * server claims it. Finding the start again with OFFSET at claim time moves it past rows once
 * earlier rows are deleted, and those rows are never indexed.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated("Partitions every classification and hard-deletes some while the job exists")
@ExtendWith(TestNamespaceExtension.class)
class SearchIndexPartitionStartIT {
  private static final int PARTITIONS = 4;
  private static final int PARTITION_INDEX = PARTITIONS - 1;
  private static final int PARTITION_SIZE = 1_000;
  private static final int DELETED_ROWS = 3;
  private static final int KEPT_ROWS = 12;
  // Digits sort before letters, so these rows come before the start of a later partition.
  private static final String SORTS_FIRST = "0000_";
  private static final Map<String, String> HARD_DELETE = Map.of("hardDelete", "true");

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void aPartitionStartsAtTheRowItStartedAtWhenTheJobWasCreated(final TestNamespace ns) {
    final List<Classification> deleted = createClassifications(ns, SORTS_FIRST, DELETED_ROWS);
    final List<Classification> kept = createClassifications(ns, "", KEPT_ROWS);
    final UUID jobId = createJob();
    try {
      final SearchIndexPartition partition = partition(jobId);
      final String startAtCreation = cursorBefore(partition);
      assertSortBefore(deleted, partition);

      deleted.forEach(SearchIndexPartitionStartIT::hardDelete);

      assertEquals(startAtCreation, partition(jobId).getStartCursor());
      assertNotEquals(startAtCreation, cursorBefore(partition), "OFFSET now finds a later row");
    } finally {
      Entity.getCollectionDAO().searchIndexJobDAO().delete(jobId.toString());
      kept.forEach(SearchIndexPartitionStartIT::hardDelete);
    }
  }

  private static UUID createJob() {
    final DistributedSearchIndexCoordinator coordinator = coordinator();
    final Set<String> types = Set.of(Entity.CLASSIFICATION);
    final SearchIndexJob job =
        coordinator.createJob(types, new EventPublisherJob().withEntities(types), "admin");
    coordinator.initializePartitions(job.getId());
    return job.getId();
  }

  /** Reads through a coordinator that did not create the job, as another server would. */
  private static SearchIndexPartition partition(final UUID jobId) {
    return coordinator().getPartitions(jobId, null).stream()
        .filter(partition -> partition.getPartitionIndex() == PARTITION_INDEX)
        .findFirst()
        .orElseThrow();
  }

  private static DistributedSearchIndexCoordinator coordinator() {
    return new DistributedSearchIndexCoordinator(
        Entity.getCollectionDAO(), new PartitionCalculator(PARTITION_SIZE, PARTITIONS));
  }

  private static String cursorBefore(final SearchIndexPartition partition) {
    final EntityRepository<?> repository = Entity.getEntityRepository(Entity.CLASSIFICATION);
    return repository.getCursorAtOffset(
        repository.getReindexFilter(), Math.toIntExact(partition.getRangeStart() - 1));
  }

  private static void assertSortBefore(
      final List<Classification> rows, final SearchIndexPartition partition) {
    final EntityRepository<?> repository = Entity.getEntityRepository(Entity.CLASSIFICATION);
    final Set<String> earlierIds =
        repository
            .getDao()
            .listKeys(
                repository.getReindexFilter(), Math.toIntExact(partition.getRangeStart() - 1), true)
            .stream()
            .map(CursorRow::id)
            .collect(Collectors.toSet());
    assertTrue(
        rows.stream().allMatch(row -> earlierIds.contains(row.getId().toString())),
        "The rows this test deletes must sort before the partition's first row");
  }

  private static List<Classification> createClassifications(
      final TestNamespace ns, final String namePrefix, final int count) {
    return IntStream.range(0, count)
        .mapToObj(
            index ->
                SdkClients.adminClient()
                    .classifications()
                    .create(
                        new CreateClassification()
                            .withName(namePrefix + ns.prefix("partitioned" + index))
                            .withDescription("Partitioned by a search index job")))
        .toList();
  }

  private static void hardDelete(final Classification classification) {
    SdkClients.adminClient()
        .classifications()
        .delete(classification.getId().toString(), HARD_DELETE);
  }
}
