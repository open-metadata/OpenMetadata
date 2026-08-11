/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.apps.bundles.rdf.distributed;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.EntityPriority;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.PartitionStatus;

@Slf4j
public class RdfPartitionCalculator {

  private static final int DEFAULT_PARTITION_SIZE = 10000;
  private static final int MIN_PARTITION_SIZE = 1000;
  private static final int MAX_PARTITION_SIZE = 50000;

  private static final Map<String, Double> ENTITY_COMPLEXITY_FACTORS =
      Map.of(
          "table", 1.5,
          "dashboard", 1.3,
          "pipeline", 1.2,
          "mlmodel", 1.3,
          "glossaryTerm", 1.1);

  private final int partitionSize;

  public RdfPartitionCalculator() {
    this(DEFAULT_PARTITION_SIZE);
  }

  public RdfPartitionCalculator(int partitionSize) {
    this.partitionSize = Math.clamp(partitionSize, MIN_PARTITION_SIZE, MAX_PARTITION_SIZE);
  }

  public List<RdfIndexPartition> calculatePartitions(UUID jobId, Set<String> entityTypes) {
    List<RdfIndexPartition> partitions = new ArrayList<>();
    for (String entityType : entityTypes) {
      partitions.addAll(calculatePartitionsForEntity(jobId, entityType));
    }
    return partitions;
  }

  public List<RdfIndexPartition> calculatePartitionsForEntity(UUID jobId, String entityType) {
    long totalCount = getEntityCount(entityType);
    if (totalCount <= 0) {
      return List.of();
    }

    double complexityFactor = ENTITY_COMPLEXITY_FACTORS.getOrDefault(entityType, 1.0);
    long adjustedPartitionSize =
        Math.max(MIN_PARTITION_SIZE, (long) (partitionSize / complexityFactor));
    int priority = EntityPriority.getNumericPriority(entityType);
    long numPartitions = (totalCount + adjustedPartitionSize - 1) / adjustedPartitionSize;

    List<RdfIndexPartition> partitions = new ArrayList<>();
    for (int index = 0; index < numPartitions; index++) {
      long rangeStart = index * adjustedPartitionSize;
      long rangeEnd = Math.min(rangeStart + adjustedPartitionSize, totalCount);
      long estimatedCount = rangeEnd - rangeStart;
      partitions.add(
          RdfIndexPartition.builder()
              .id(UUID.randomUUID())
              .jobId(jobId)
              .entityType(entityType)
              .partitionIndex(index)
              .rangeStart(rangeStart)
              .rangeEnd(rangeEnd)
              .estimatedCount(estimatedCount)
              .workUnits((long) (estimatedCount * complexityFactor))
              .priority(priority)
              .status(PartitionStatus.PENDING)
              .cursor(rangeStart)
              .processedCount(0)
              .successCount(0)
              .failedCount(0)
              .retryCount(0)
              .claimableAt(0)
              .build());
    }

    LOG.info(
        "Calculated {} RDF partitions for {} (totalRecords={}, partitionSize={})",
        partitions.size(),
        entityType,
        totalCount,
        adjustedPartitionSize);
    return partitions;
  }

  public long getEntityCount(String entityType) {
    try {
      return Entity.getEntityRepository(entityType).getDao().listTotalCount();
    } catch (Exception e) {
      LOG.warn("Failed to fetch entity count for {}", entityType, e);
      return 0;
    }
  }
}
