/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.util;

import static org.openmetadata.service.util.OpenMetadataOperations.printToAsciiTable;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.FeedRepository;
import org.openmetadata.service.util.relationshipcleanup.BatchEntityExistenceResolver;
import org.openmetadata.service.util.relationshipcleanup.DefaultRelationshipValidator;
import org.openmetadata.service.util.relationshipcleanup.LineageRelationshipValidator;
import org.openmetadata.service.util.relationshipcleanup.RelationshipValidator;
import org.openmetadata.service.util.relationshipcleanup.RelationshipValidator.EntityExistenceChecker;

@Slf4j
public class EntityRelationshipCleanup {

  // Only a bounded sample of orphaned relationships is retained for the summary table. On a badly
  // broken catalog the orphan count can reach the millions; holding every one in memory is what
  // used to OOM the DataRetention pod. Counts stay exact; only the displayed detail is capped.
  private static final int MAX_SAMPLED_ORPHANS = 1000;
  private static final int PROGRESS_LOG_EVERY_BATCHES = 10;

  private final CollectionDAO collectionDAO;
  private final Map<String, EntityRepository<?>> entityRepositories = new HashMap<>();
  private final Map<String, EntityTimeSeriesRepository<?>> entityTimeSeriesRepositoy =
      new HashMap<>();
  private final FeedRepository feedRepository;
  private final boolean dryRun;

  public EntityRelationshipCleanup(CollectionDAO collectionDAO, boolean dryRun) {
    this.collectionDAO = collectionDAO;
    this.dryRun = dryRun;
    this.feedRepository = new FeedRepository();
    initializeEntityRepositories();
    initializeTimeSeriesRepositories();
  }

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class OrphanedRelationship {
    private String fromId;
    private String toId;
    private String fromEntity;
    private String toEntity;
    private int relation;
    private String reason;
    private String relationshipName;
  }

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class EntityCleanupResult {
    private int totalRelationshipsScanned;
    private int orphanedRelationshipsFound;
    private int relationshipsDeleted;
    private List<OrphanedRelationship> orphanedRelationships;
    private Map<String, Integer> orphansByEntityType;
    private Map<String, Integer> orphansByRelationType;
  }

  /**
   * Keyset (seek) cursor over the full primary key (fromId, toId, relation, relationType). Using the
   * complete key gives a strict total order, so no row is skipped when a batch boundary lands inside
   * a group of rows that share (fromId, toId, relation) but differ in relationType. Keyset paging
   * also keeps the scan cheap while orphans are deleted batch-by-batch: deletes only ever touch rows
   * behind the cursor, and there is no growing OFFSET to scan past.
   */
  private record RelationshipCursor(String fromId, String toId, int relation, String relationType) {
    private static RelationshipCursor start() {
      return new RelationshipCursor("", "", -1, "");
    }

    private static RelationshipCursor after(EntityRelationshipObject relationship) {
      return new RelationshipCursor(
          relationship.getFromId(),
          relationship.getToId(),
          relationship.getRelation(),
          relationship.getRelationType());
    }
  }

  private void initializeEntityRepositories() {
    for (String entityType : Entity.getEntityList()) {
      try {
        EntityRepository<?> repository = Entity.getEntityRepository(entityType);
        entityRepositories.put(entityType, repository);
      } catch (EntityNotFoundException e) {
        LOG.debug("No repository found for entity type: {}", entityType);
      }
    }
  }

  private void initializeTimeSeriesRepositories() {
    for (String entityType : Entity.getEntityList()) {
      try {
        EntityTimeSeriesRepository<?> repository = Entity.getEntityTimeSeriesRepository(entityType);
        entityTimeSeriesRepositoy.put(entityType, repository);
      } catch (EntityNotFoundException e) {
        LOG.debug("No repository found for entity type: {}", entityType);
      }
    }
  }

  public EntityCleanupResult performCleanup(int batchSize) {
    LOG.info(
        "Starting entity relationship cleanup. Dry run: {}, Batch size: {}", dryRun, batchSize);

    EntityCleanupResult result = newResult();
    try {
      scanAndClean(batchSize, result);
    } catch (Exception e) {
      LOG.error("Error during entity relationship cleanup", e);
      throw new RuntimeException("Entity relationship cleanup failed", e);
    }

    displayOrphanedRelationships(result);
    LOG.info(
        "Entity relationship cleanup completed. Scanned: {}, Found: {}, Deleted: {}",
        result.getTotalRelationshipsScanned(),
        result.getOrphanedRelationshipsFound(),
        result.getRelationshipsDeleted());
    return result;
  }

  private EntityCleanupResult newResult() {
    return EntityCleanupResult.builder()
        .orphanedRelationships(new ArrayList<>())
        .orphansByEntityType(new HashMap<>())
        .orphansByRelationType(new HashMap<>())
        .build();
  }

  private void scanAndClean(int batchSize, EntityCleanupResult result) {
    BatchEntityExistenceResolver resolver =
        new BatchEntityExistenceResolver(
            entityRepositories, entityTimeSeriesRepositoy, feedRepository);
    long totalRelationships = collectionDAO.relationshipDAO().getTotalRelationshipCount();
    LOG.info(
        "Found {} total relationships to scan. Processing in batches of {}",
        totalRelationships,
        batchSize);

    RelationshipCursor cursor = RelationshipCursor.start();
    int batchNumber = 1;
    boolean hasMore = true;
    while (hasMore) {
      List<EntityRelationshipObject> batch =
          collectionDAO
              .relationshipDAO()
              .getAllRelationshipsAfter(
                  cursor.fromId(),
                  cursor.toId(),
                  cursor.relation(),
                  cursor.relationType(),
                  batchSize);
      if (batch.isEmpty()) {
        hasMore = false;
      } else {
        processBatch(batch, resolver, result);
        cursor = RelationshipCursor.after(batch.getLast());
        logProgress(batchNumber, totalRelationships, result);
        batchNumber++;
      }
    }
  }

  private void processBatch(
      List<EntityRelationshipObject> batch,
      BatchEntityExistenceResolver resolver,
      EntityCleanupResult result) {
    resolver.prefetch(batch);

    List<OrphanedRelationship> orphans = new ArrayList<>();
    for (EntityRelationshipObject relationship : batch) {
      OrphanedRelationship orphan = validateRelationship(relationship, resolver);
      if (orphan != null) {
        orphans.add(orphan);
      }
    }

    result.setTotalRelationshipsScanned(result.getTotalRelationshipsScanned() + batch.size());
    recordOrphans(orphans, result);

    if (!dryRun && !orphans.isEmpty()) {
      result.setRelationshipsDeleted(
          result.getRelationshipsDeleted() + deleteOrphanedRelationships(orphans));
    }
  }

  private void recordOrphans(List<OrphanedRelationship> orphans, EntityCleanupResult result) {
    result.setOrphanedRelationshipsFound(result.getOrphanedRelationshipsFound() + orphans.size());
    for (OrphanedRelationship orphan : orphans) {
      if (result.getOrphanedRelationships().size() < MAX_SAMPLED_ORPHANS) {
        result.getOrphanedRelationships().add(orphan);
      }
      result
          .getOrphansByEntityType()
          .merge(orphan.getFromEntity() + "->" + orphan.getToEntity(), 1, Integer::sum);
      result.getOrphansByRelationType().merge(orphan.getRelationshipName(), 1, Integer::sum);
    }
  }

  private void logProgress(int batchNumber, long totalRelationships, EntityCleanupResult result) {
    if (batchNumber % PROGRESS_LOG_EVERY_BATCHES == 0) {
      LOG.info(
          "Progress: {}/{} relationships processed, {} orphaned relationships found",
          result.getTotalRelationshipsScanned(),
          totalRelationships,
          result.getOrphanedRelationshipsFound());
    }
  }

  private OrphanedRelationship validateRelationship(
      EntityRelationshipObject relationship, EntityExistenceChecker existenceChecker) {
    OrphanedRelationship orphan;
    try {
      orphan = evaluateRelationship(relationship, existenceChecker);
    } catch (Exception e) {
      LOG.debug(
          "Error validating relationship {}->{}: {}",
          relationship.getFromId(),
          relationship.getToId(),
          e.getMessage());
      orphan = toOrphan(relationship, "Validation error: " + e.getMessage());
    }
    return orphan;
  }

  private OrphanedRelationship evaluateRelationship(
      EntityRelationshipObject relationship, EntityExistenceChecker existenceChecker) {
    OrphanedRelationship orphan = null;
    if (hasResolvableEndpoints(relationship)) {
      RelationshipValidator validator = getValidatorForRelationship(relationship.getRelation());
      RelationshipValidator.ValidationResult result =
          validator.validate(relationship, existenceChecker);
      if (result.isOrphaned()) {
        orphan = toOrphan(relationship, result.getReason());
      }
    }
    return orphan;
  }

  private boolean hasResolvableEndpoints(EntityRelationshipObject relationship) {
    boolean resolvable = true;
    if (!doEntityHaveAnyRepository(relationship.getFromEntity())) {
      LOG.error(
          "No repository found for from entity type: {}, the entity will not be cleaned",
          relationship.getFromEntity());
      resolvable = false;
    } else if (!doEntityHaveAnyRepository(relationship.getToEntity())) {
      LOG.error(
          "No repository found for to entity type: {}, the entity will not be cleaned",
          relationship.getToEntity());
      resolvable = false;
    }
    return resolvable;
  }

  private OrphanedRelationship toOrphan(EntityRelationshipObject relationship, String reason) {
    return OrphanedRelationship.builder()
        .fromId(relationship.getFromId())
        .toId(relationship.getToId())
        .fromEntity(relationship.getFromEntity())
        .toEntity(relationship.getToEntity())
        .relation(relationship.getRelation())
        .reason(reason)
        .relationshipName(getRelationshipName(relationship.getRelation()))
        .build();
  }

  private RelationshipValidator getValidatorForRelationship(int relation) {
    RelationshipValidator validator;
    if (relation == Relationship.UPSTREAM.ordinal()) {
      validator = new LineageRelationshipValidator();
    } else {
      validator = new DefaultRelationshipValidator();
    }
    return validator;
  }

  private boolean doEntityHaveAnyRepository(String entityType) {
    return entityRepositories.containsKey(entityType)
        || entityTimeSeriesRepositoy.containsKey(entityType)
        || entityType.equals(Entity.THREAD);
  }

  private int deleteOrphanedRelationships(List<OrphanedRelationship> orphanedRelationships) {
    LOG.info("Deleting {} orphaned relationships", orphanedRelationships.size());
    int deletedCount = 0;

    for (OrphanedRelationship orphan : orphanedRelationships) {
      try {
        UUID fromId = UUID.fromString(orphan.getFromId());
        UUID toId = UUID.fromString(orphan.getToId());

        int deleted =
            collectionDAO
                .relationshipDAO()
                .delete(
                    fromId,
                    orphan.getFromEntity(),
                    toId,
                    orphan.getToEntity(),
                    orphan.getRelation());

        if (deleted > 0) {
          deletedCount++;
          LOG.debug(
              "Deleted orphaned relationship: {} {} -> {} {}",
              orphan.getFromEntity(),
              orphan.getFromId(),
              orphan.getToEntity(),
              orphan.getToId());
        }
      } catch (Exception e) {
        LOG.error(
            "Failed to delete orphaned relationship: {} {} -> {} {}: {}",
            orphan.getFromEntity(),
            orphan.getFromId(),
            orphan.getToEntity(),
            orphan.getToId(),
            e.getMessage());
      }
    }

    LOG.info(
        "Successfully deleted {} out of {} orphaned relationships",
        deletedCount,
        orphanedRelationships.size());
    return deletedCount;
  }

  private void displayOrphanedRelationships(EntityCleanupResult result) {
    if (result.getOrphanedRelationshipsFound() == 0) {
      LOG.info("No orphaned relationships found. All entity relationships are valid.");
      return;
    }

    LOG.info(
        "Found {} orphaned relationships (showing up to {})",
        result.getOrphanedRelationshipsFound(),
        MAX_SAMPLED_ORPHANS);

    List<String> columns =
        Arrays.asList("From Entity", "From ID", "To Entity", "To ID", "Relation", "Reason");

    List<List<String>> rows = new ArrayList<>();
    for (OrphanedRelationship orphan : result.getOrphanedRelationships()) {
      rows.add(
          Arrays.asList(
              orphan.getFromEntity(),
              orphan.getFromId(),
              orphan.getToEntity(),
              orphan.getToId(),
              orphan.getRelationshipName(),
              orphan.getReason()));
    }

    printToAsciiTable(columns, rows, "No orphaned relationships found");
    displaySummaryStatistics(result);
  }

  private void displaySummaryStatistics(EntityCleanupResult result) {
    if (!result.getOrphansByEntityType().isEmpty()) {
      LOG.info("Orphaned relationships by entity type:");
      List<String> entityColumns = Arrays.asList("Entity Type Pair", "Count");
      List<List<String>> entityRows = new ArrayList<>();

      result.getOrphansByEntityType().entrySet().stream()
          .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
          .forEach(
              entry -> entityRows.add(Arrays.asList(entry.getKey(), entry.getValue().toString())));

      printToAsciiTable(entityColumns, entityRows, "No entity type statistics");
    }

    if (!result.getOrphansByRelationType().isEmpty()) {
      LOG.info("Orphaned relationships by relation type:");
      List<String> relationColumns = Arrays.asList("Relation Type", "Count");
      List<List<String>> relationRows = new ArrayList<>();

      result.getOrphansByRelationType().entrySet().stream()
          .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
          .forEach(
              entry ->
                  relationRows.add(Arrays.asList(entry.getKey(), entry.getValue().toString())));

      printToAsciiTable(relationColumns, relationRows, "No relation type statistics");
    }
  }

  private String getRelationshipName(int relation) {
    String name;
    try {
      Relationship[] relationships = Relationship.values();
      if (relation >= 0 && relation < relationships.length) {
        name = relationships[relation].name();
      } else {
        name = "UNKNOWN_RELATION_" + relation;
      }
    } catch (Exception e) {
      LOG.debug("Error getting relationship name for ordinal {}: {}", relation, e.getMessage());
      name = "UNKNOWN_RELATION_" + relation;
    }
    return name;
  }
}
