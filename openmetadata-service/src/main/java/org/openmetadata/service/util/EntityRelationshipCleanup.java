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
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;

@Slf4j
public class EntityRelationshipCleanup {

  private final CollectionDAO collectionDAO;
  private final Map<String, EntityRepository<?>> entityRepositories;
  private final boolean dryRun;

  public EntityRelationshipCleanup(CollectionDAO collectionDAO, boolean dryRun) {
    this.collectionDAO = collectionDAO;
    this.dryRun = dryRun;
    this.entityRepositories = new HashMap<>();
    initializeEntityRepositories();
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
  public static class CleanupResult {
    private int totalRelationshipsScanned;
    private int orphanedRelationshipsFound;
    private int relationshipsDeleted;
    private List<OrphanedRelationship> orphanedRelationships;
    private Map<String, Integer> orphansByEntityType;
    private Map<String, Integer> orphansByRelationType;
  }

  /**
   * Initialize entity repositories for all known entity types
   */
  private void initializeEntityRepositories() {
    for (String entityType : Entity.getEntityList()) {
      try {
        EntityRepository<?> repository = Entity.getEntityRepository(entityType);
        entityRepositories.put(entityType, repository);
      } catch (EntityNotFoundException e) {
        LOG.error("No repository found for entity type: {}", entityType);
      }
    }
  }

  /**
   * Main method to perform entity relationship cleanup with pagination
   *
   * @return CleanupResult containing summary of the cleanup operation
   */
  public CleanupResult performCleanup() {
    return performCleanup(1000); // Default batch size of 1000
  }

  /**
   * Main method to perform entity relationship cleanup with configurable batch size
   *
   * @param batchSize Number of relationships to process per batch
   * @return CleanupResult containing summary of the cleanup operation
   */
  public CleanupResult performCleanup(int batchSize) {
    LOG.info(
        "Starting entity relationship cleanup. Dry run: {}, Batch size: {}", dryRun, batchSize);

    CleanupResult result =
        CleanupResult.builder()
            .orphanedRelationships(new ArrayList<>())
            .orphansByEntityType(new HashMap<>())
            .orphansByRelationType(new HashMap<>())
            .build();

    try {
      // Get total count of relationships
      long totalRelationships = collectionDAO.relationshipDAO().getTotalRelationshipCount();
      result.setTotalRelationshipsScanned((int) totalRelationships);

      LOG.info(
          "Found {} total relationships to scan. Processing in batches of {}",
          totalRelationships,
          batchSize);

      long offset = 0;
      int processedCount = 0;
      int batchNumber = 1;

      // Process relationships in batches to avoid memory issues
      while (offset < totalRelationships) {
        LOG.info("Processing batch {} (offset: {}, limit: {})", batchNumber, offset, batchSize);

        List<CollectionDAO.EntityRelationshipObject> relationshipBatch =
            collectionDAO.relationshipDAO().getAllRelationshipsPaginated(offset, batchSize);

        if (relationshipBatch.isEmpty()) {
          LOG.info("No more relationships to process");
          break;
        }

        // Check each relationship in the batch for orphaned entities
        for (CollectionDAO.EntityRelationshipObject relationship : relationshipBatch) {
          OrphanedRelationship orphan = validateRelationship(relationship);
          if (orphan != null) {
            result.getOrphanedRelationships().add(orphan);

            // Track statistics
            result
                .getOrphansByEntityType()
                .merge(orphan.getFromEntity() + "->" + orphan.getToEntity(), 1, Integer::sum);
            result.getOrphansByRelationType().merge(orphan.getRelationshipName(), 1, Integer::sum);
          }
          processedCount++;
        }

        offset += relationshipBatch.size();
        batchNumber++;

        // Log progress periodically
        if (processedCount % (batchSize * 10) == 0 || offset >= totalRelationships) {
          LOG.info(
              "Progress: {}/{} relationships processed, {} orphaned relationships found",
              processedCount,
              totalRelationships,
              result.getOrphanedRelationships().size());
        }
      }

      result.setOrphanedRelationshipsFound(result.getOrphanedRelationships().size());

      LOG.info(
          "Completed scanning {} relationships. Found {} orphaned relationships",
          processedCount,
          result.getOrphanedRelationshipsFound());

      // Display findings
      displayOrphanedRelationships(result);

      // Perform cleanup if not dry run
      if (!dryRun && !result.getOrphanedRelationships().isEmpty()) {
        result.setRelationshipsDeleted(
            deleteOrphanedRelationships(result.getOrphanedRelationships()));
      }

      LOG.info(
          "Entity relationship cleanup completed. Scanned: {}, Found: {}, Deleted: {}",
          processedCount,
          result.getOrphanedRelationshipsFound(),
          result.getRelationshipsDeleted());

    } catch (Exception e) {
      LOG.error("Error during entity relationship cleanup", e);
      throw new RuntimeException("Entity relationship cleanup failed", e);
    }

    return result;
  }

  /**
   * Validates a single relationship to check if both entities exist
   *
   * @param relationship The relationship to validate
   * @return OrphanedRelationship if the relationship is orphaned, null otherwise
   */
  private OrphanedRelationship validateRelationship(
      CollectionDAO.EntityRelationshipObject relationship) {
    try {
      UUID fromId = UUID.fromString(relationship.getFromId());
      UUID toId = UUID.fromString(relationship.getToId());
      String fromEntity = relationship.getFromEntity();
      String toEntity = relationship.getToEntity();

      // Check if fromEntity exists
      boolean fromExists = entityExists(fromId, fromEntity);

      // Check if toEntity exists
      boolean toExists = entityExists(toId, toEntity);

      // If both exist, relationship is valid
      if (fromExists && toExists) {
        return null;
      }

      // Determine the reason for orphaning
      String reason;
      if (!fromExists && !toExists) {
        reason = "Both fromEntity and toEntity do not exist";
      } else if (!fromExists) {
        reason = "fromEntity does not exist";
      } else {
        reason = "toEntity does not exist";
      }

      return OrphanedRelationship.builder()
          .fromId(relationship.getFromId())
          .toId(relationship.getToId())
          .fromEntity(fromEntity)
          .toEntity(toEntity)
          .relation(relationship.getRelation())
          .reason(reason)
          .relationshipName(getRelationshipName(relationship.getRelation()))
          .build();

    } catch (Exception e) {
      LOG.debug(
          "Error validating relationship {}->{}: {}",
          relationship.getFromId(),
          relationship.getToId(),
          e.getMessage());

      return OrphanedRelationship.builder()
          .fromId(relationship.getFromId())
          .toId(relationship.getToId())
          .fromEntity(relationship.getFromEntity())
          .toEntity(relationship.getToEntity())
          .relation(relationship.getRelation())
          .reason("Validation error: " + e.getMessage())
          .relationshipName(getRelationshipName(relationship.getRelation()))
          .build();
    }
  }

  /**
   * Checks if an entity exists in the database
   *
   * @param entityId The ID of the entity
   * @param entityType The type of the entity
   * @return true if the entity exists, false otherwise
   */
  private boolean entityExists(UUID entityId, String entityType) {
    try {
      EntityRepository<?> repository = entityRepositories.get(entityType);
      if (repository == null) {
        LOG.debug("No repository found for entity type: {}", entityType);
        return false;
      }

      // Try to find the entity by ID
      repository.get(null, entityId, EntityUtil.Fields.EMPTY_FIELDS);
      return true;
    } catch (EntityNotFoundException e) {
      LOG.debug("Entity {}:{} not found", entityType, entityId);
      return false;
    } catch (Exception e) {
      LOG.debug(
          "Error checking existence of entity {}:{}: {}", entityType, entityId, e.getMessage());
      return false;
    }
  }

  /**
   * Deletes orphaned relationships from the database
   *
   * @param orphanedRelationships List of orphaned relationships to delete
   * @return Number of relationships successfully deleted
   */
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

  /**
   * Displays orphaned relationships in a formatted table
   *
   * @param result The cleanup result containing orphaned relationships
   */
  private void displayOrphanedRelationships(CleanupResult result) {
    if (result.getOrphanedRelationships().isEmpty()) {
      LOG.info("No orphaned relationships found. All entity relationships are valid.");
      return;
    }

    LOG.info("Found {} orphaned relationships", result.getOrphanedRelationshipsFound());

    // Display detailed table of orphaned relationships
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

    // Display summary statistics
    displaySummaryStatistics(result);
  }

  /**
   * Displays summary statistics about orphaned relationships
   *
   * @param result The cleanup result containing statistics
   */
  private void displaySummaryStatistics(CleanupResult result) {
    // Display orphans by entity type
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

    // Display orphans by relation type
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

  /**
   * Gets a human-readable name for a relationship type
   *
   * @param relation The relationship type integer
   * @return Human-readable relationship name
   */
  private String getRelationshipName(int relation) {
    // Map common relationship types to names
    // These constants should ideally be imported from the actual schema
    return switch (relation) {
      case 10 -> "CONTAINS";
        return "CONTAINS";
      case 11:
      case 11 -> "CREATED_BY";
      case 12:
      case 12 -> "MENTIONED_IN";
      case 13:
      case 13 -> "PARENT_OF";
      case 14 -> "OWNS";
        return "OWNS";
      case 15 -> "FOLLOWS";
        return "FOLLOWS";
      case 16 -> "JOINED";
        return "JOINED";
      case 17:
      case 17 -> "REACTED_TO";
      case 18:
      case 18 -> "REPLIED_TO";
      case 19 -> "TESTED_BY";
        return "TESTED_BY";
      case 20 -> "UPSTREAM";
        return "UPSTREAM";
      case 21:
      case 21 -> "DOWNSTREAM";
      default:
      default -> "RELATION_" + relation;
    };
  }
}
