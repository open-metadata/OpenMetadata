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

package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Calculates partitions for distributed search indexing based on entity counts and complexity.
 *
 * <p>Uses a configurable partition size to divide large entity sets into manageable chunks that can
 * be processed in parallel across multiple servers.
 */
@Slf4j
public class PartitionCalculator {

  /** Default number of entities per partition */
  private static final int DEFAULT_PARTITION_SIZE = 10000;

  /** Minimum partition size to avoid too many small partitions */
  private static final int MIN_PARTITION_SIZE = 1000;

  /** Maximum partition size to ensure reasonable parallelism */
  private static final int MAX_PARTITION_SIZE = 50000;

  /**
   * Maximum partitions per entity type to prevent database overload.
   * With 10,000 max partitions and 10,000 entities/partition = 100M entities per type.
   */
  private static final int MAX_PARTITIONS_PER_ENTITY_TYPE = 10000;

  /** Maximum total partitions for a single job */
  private static final int MAX_TOTAL_PARTITIONS = 50000;

  /**
   * Complexity factors for different entity types. Higher values mean more processing time per
   * entity due to relationships, nested data, etc.
   */
  private static final Map<String, Double> ENTITY_COMPLEXITY_FACTORS =
      Map.ofEntries(
          Map.entry("table", 1.5), // Tables have many columns, relationships
          Map.entry("dashboard", 1.3), // Dashboards have charts, data models
          Map.entry("pipeline", 1.2), // Pipelines have tasks, lineage
          Map.entry("mlmodel", 1.4), // ML models have features, hyperparameters
          Map.entry("container", 1.1), // Containers have data models
          Map.entry("topic", 1.0), // Topics are relatively simple
          Map.entry("database", 0.8), // Databases are lightweight
          Map.entry("databaseSchema", 0.7), // Schemas are lightweight
          Map.entry("databaseService", 0.5), // Services are lightweight
          Map.entry("user", 0.6), // Users are simple
          Map.entry("team", 0.7), // Teams have members
          Map.entry("glossaryTerm", 1.0), // Glossary terms have relationships
          Map.entry("tag", 0.5), // Tags are simple
          Map.entry("testCase", 0.8), // Test cases are moderately complex
          Map.entry("testCaseResult", 0.3), // Time series, simple structure
          Map.entry("testCaseResolutionStatus", 0.3), // Time series, simple structure
          Map.entry("queryCostRecord", 0.3) // Time series, simple structure
          );

  /**
   * Priority ordering for entity types during indexing. Higher priority entities should be indexed
   * first as they may be referenced by others. This ensures that when indexing tables, their parent
   * databases and schemas already exist in the search index.
   */
  private static final Map<String, Integer> ENTITY_PRIORITY =
      Map.ofEntries(
          Map.entry("databaseService", 100),
          Map.entry("messagingService", 100),
          Map.entry("dashboardService", 100),
          Map.entry("pipelineService", 100),
          Map.entry("mlmodelService", 100),
          Map.entry("storageService", 100),
          Map.entry("database", 90),
          Map.entry("databaseSchema", 80),
          Map.entry("glossary", 70),
          Map.entry("classification", 70),
          Map.entry("team", 65),
          Map.entry("user", 60),
          Map.entry("table", 50),
          Map.entry("dashboard", 50),
          Map.entry("pipeline", 50),
          Map.entry("mlmodel", 50),
          Map.entry("topic", 50),
          Map.entry("container", 50),
          Map.entry("glossaryTerm", 45),
          Map.entry("tag", 40),
          Map.entry("testCase", 30),
          Map.entry("testCaseResult", 20),
          Map.entry("testCaseResolutionStatus", 20),
          Map.entry("queryCostRecord", 10));

  /** Time series entity types */
  private static final Set<String> TIME_SERIES_ENTITIES =
      Set.of(
          "testCaseResolutionStatus",
          "testCaseResult",
          "queryCostRecord",
          "webAnalyticEntityViewReportData",
          "webAnalyticUserActivityReportData",
          "entityReportData",
          "rawCostAnalysisReportData",
          "aggregatedCostAnalysisReportData");

  private final int partitionSize;

  public PartitionCalculator() {
    this(DEFAULT_PARTITION_SIZE);
  }

  public PartitionCalculator(int partitionSize) {
    this.partitionSize = Math.clamp(partitionSize, MIN_PARTITION_SIZE, MAX_PARTITION_SIZE);
  }

  /**
   * Calculate partitions for a job based on the entities to be indexed.
   *
   * <p>Enforces limits on total partition count to prevent database overload at extreme scale.
   *
   * @param jobId The job this partition belongs to
   * @param entityTypes Set of entity types to partition
   * @return List of partitions covering all entities
   * @throws IllegalStateException if partition count would exceed safe limits
   */
  public List<SearchIndexPartition> calculatePartitions(UUID jobId, Set<String> entityTypes) {
    List<SearchIndexPartition> partitions = new ArrayList<>();

    for (String entityType : entityTypes) {
      List<SearchIndexPartition> entityPartitions = calculatePartitionsForEntity(jobId, entityType);
      partitions.addAll(entityPartitions);

      if (partitions.size() > MAX_TOTAL_PARTITIONS) {
        throw new IllegalStateException(
            String.format(
                "Job would create too many partitions (%d > %d). "
                    + "Consider reducing entity types or increasing partition size.",
                partitions.size(), MAX_TOTAL_PARTITIONS));
      }
    }

    LOG.info(
        "Calculated {} total partitions for {} entity types",
        partitions.size(),
        entityTypes.size());
    return partitions;
  }

  /**
   * Calculate partitions for a single entity type.
   *
   * @param jobId The job this partition belongs to
   * @param entityType The entity type to partition
   * @return List of partitions for this entity type
   */
  public List<SearchIndexPartition> calculatePartitionsForEntity(UUID jobId, String entityType) {
    long totalCount = getEntityCount(entityType);
    if (totalCount == 0) {
      LOG.debug("No entities found for type: {}", entityType);
      return List.of();
    }

    double complexityFactor = ENTITY_COMPLEXITY_FACTORS.getOrDefault(entityType, 1.0);
    int priority = ENTITY_PRIORITY.getOrDefault(entityType, 50);

    // Adjust partition size based on complexity - more complex entities get smaller partitions
    long adjustedPartitionSizeLong = (long) (partitionSize / complexityFactor);
    adjustedPartitionSizeLong = Math.max(MIN_PARTITION_SIZE, adjustedPartitionSizeLong);

    // Calculate partition count with overflow protection
    long numPartitionsLong =
        (totalCount + adjustedPartitionSizeLong - 1) / adjustedPartitionSizeLong;

    // Enforce per-entity-type limit and adjust partition size if needed
    if (numPartitionsLong > MAX_PARTITIONS_PER_ENTITY_TYPE) {
      LOG.warn(
          "Entity type {} would have {} partitions, limiting to {} by increasing partition size",
          entityType,
          numPartitionsLong,
          MAX_PARTITIONS_PER_ENTITY_TYPE);
      numPartitionsLong = MAX_PARTITIONS_PER_ENTITY_TYPE;
      adjustedPartitionSizeLong = (totalCount + numPartitionsLong - 1) / numPartitionsLong;
    }

    int numPartitions = (int) numPartitionsLong;
    int adjustedPartitionSize = (int) adjustedPartitionSizeLong;
    List<SearchIndexPartition> partitions = new ArrayList<>(numPartitions);

    for (int i = 0; i < numPartitions; i++) {
      long rangeStart = (long) i * adjustedPartitionSize;
      long rangeEnd = Math.min(rangeStart + adjustedPartitionSize, totalCount);
      long estimatedCount = rangeEnd - rangeStart;

      // Work units consider both count and complexity
      long workUnits = (long) (estimatedCount * complexityFactor);

      SearchIndexPartition partition =
          SearchIndexPartition.builder()
              .id(UUID.randomUUID())
              .jobId(jobId)
              .entityType(entityType)
              .partitionIndex(i)
              .rangeStart(rangeStart)
              .rangeEnd(rangeEnd)
              .estimatedCount(estimatedCount)
              .workUnits(workUnits)
              .priority(priority)
              .status(PartitionStatus.PENDING)
              .cursor(rangeStart)
              .processedCount(0)
              .successCount(0)
              .failedCount(0)
              .retryCount(0)
              .build();

      partitions.add(partition);
    }

    LOG.info(
        "Created {} partitions for entity type {} (total: {}, partition size: {})",
        partitions.size(),
        entityType,
        totalCount,
        adjustedPartitionSize);

    return partitions;
  }

  /**
   * Get the total count of entities for a given type.
   *
   * @param entityType The entity type
   * @return Total count of entities
   */
  public long getEntityCount(String entityType) {
    try {
      long count;
      if (TIME_SERIES_ENTITIES.contains(entityType)) {
        count = getTimeSeriesEntityCount(entityType);
      } else {
        count = getRegularEntityCount(entityType);
      }
      LOG.debug("Entity count for {}: {}", entityType, count);
      return count;
    } catch (Exception e) {
      LOG.error("Failed to get entity count for type: {} - returning 0", entityType, e);
      return 0;
    }
  }

  private long getRegularEntityCount(String entityType) {
    EntityRepository<?> repository = Entity.getEntityRepository(entityType);
    return repository.getDao().listTotalCount();
  }

  private long getTimeSeriesEntityCount(String entityType) {
    ListFilter listFilter = new ListFilter(Include.ALL);
    EntityTimeSeriesRepository<?> repository;

    if (isDataInsightIndex(entityType)) {
      listFilter.addQueryParam("entityFQNHash", FullyQualifiedName.buildHash(entityType));
      repository = Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA);
    } else {
      repository = Entity.getEntityTimeSeriesRepository(entityType);
    }

    return repository.getTimeSeriesDao().listCount(listFilter);
  }

  private boolean isDataInsightIndex(String entityType) {
    return entityType.endsWith("ReportData");
  }

  /**
   * Get entity counts for all requested entity types.
   *
   * @param entityTypes Set of entity types
   * @return Map of entity type to count
   */
  public Map<String, Long> getEntityCounts(Set<String> entityTypes) {
    Map<String, Long> counts = new HashMap<>();
    for (String entityType : entityTypes) {
      counts.put(entityType, getEntityCount(entityType));
    }
    return counts;
  }

  /**
   * Get the priority for an entity type.
   *
   * @param entityType The entity type
   * @return Priority value (higher = processed first)
   */
  public int getEntityPriority(String entityType) {
    return ENTITY_PRIORITY.getOrDefault(entityType, 50);
  }

  /**
   * Get the complexity factor for an entity type.
   *
   * @param entityType The entity type
   * @return Complexity factor (higher = more processing time)
   */
  public double getComplexityFactor(String entityType) {
    return ENTITY_COMPLEXITY_FACTORS.getOrDefault(entityType, 1.0);
  }

  /**
   * Calculate total work units for a set of entity types. Useful for estimating job duration.
   *
   * @param entityTypes Set of entity types
   * @return Total work units
   */
  public long calculateTotalWorkUnits(Set<String> entityTypes) {
    long totalWorkUnits = 0;
    for (String entityType : entityTypes) {
      long count = getEntityCount(entityType);
      double complexity = getComplexityFactor(entityType);
      totalWorkUnits += (long) (count * complexity);
    }
    return totalWorkUnits;
  }
}
