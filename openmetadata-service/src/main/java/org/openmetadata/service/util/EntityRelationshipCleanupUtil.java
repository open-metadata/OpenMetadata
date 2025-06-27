/*
 *  Copyright 2025 Collate
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

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Comprehensive cleanup utility that combines both orphaned relationship cleanup
 * and service hierarchy cleanup. This provides a single entry point for all
 * data integrity cleanup operations in OpenMetadata.
 */
@Slf4j
public class EntityRelationshipCleanupUtil {

  private final CollectionDAO collectionDAO;
  private final boolean dryRun;
  private final int batchSize;

  public EntityRelationshipCleanupUtil(CollectionDAO collectionDAO, boolean dryRun, int batchSize) {
    this.collectionDAO = collectionDAO;
    this.dryRun = dryRun;
    this.batchSize = batchSize;
  }

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class CleanupResult {
    private EntityRelationshipCleanup.EntityCleanupResult relationshipResult;
    private ServiceHierarchyCleanup.HierarchyCleanupResult hierarchyResult;
    private int totalEntitiesProcessed;
    private int totalEntitiesDeleted;
    private boolean completedSuccessfully;
  }

  /**
   * Performs comprehensive cleanup of both orphaned relationships and broken service hierarchies.
   *
   * @return ComprehensiveCleanupResult containing statistics from both cleanup operations
   */
  public CleanupResult performComprehensiveCleanup() {
    LOG.info("Starting comprehensive cleanup: orphaned relationships and service hierarchies");

    CleanupResult result = CleanupResult.builder().completedSuccessfully(true).build();

    try {
      // Step 1: Clean up orphaned relationships
      LOG.info("=== Step 1: Orphaned Relationships Cleanup ===");
      EntityRelationshipCleanup relationshipCleanup =
          new EntityRelationshipCleanup(collectionDAO, dryRun);
      EntityRelationshipCleanup.EntityCleanupResult relationshipResult =
          relationshipCleanup.performCleanup(batchSize);
      result.setRelationshipResult(relationshipResult);

      LOG.info(
          "Orphaned relationships - Found: {}, Deleted: {}",
          relationshipResult.getOrphanedRelationshipsFound(),
          relationshipResult.getRelationshipsDeleted());

      // Step 2: Clean up broken service hierarchies
      LOG.info("=== Step 2: Service Hierarchy Cleanup ===");
      ServiceHierarchyCleanup hierarchyCleanup = new ServiceHierarchyCleanup(collectionDAO, dryRun);
      ServiceHierarchyCleanup.HierarchyCleanupResult hierarchyResult =
          hierarchyCleanup.performHierarchyCleanup();
      result.setHierarchyResult(hierarchyResult);

      LOG.info(
          "Service hierarchies - Found: {}, Deleted: {}",
          hierarchyResult.getTotalBrokenFound(),
          hierarchyResult.getTotalBrokenDeleted());

      // Calculate totals
      int totalProcessed =
          relationshipResult.getTotalRelationshipsScanned() + hierarchyResult.getTotalBrokenFound();
      int totalDeleted =
          relationshipResult.getRelationshipsDeleted() + hierarchyResult.getTotalBrokenDeleted();

      result.setTotalEntitiesProcessed(totalProcessed);
      result.setTotalEntitiesDeleted(totalDeleted);

      LOG.info("=== Comprehensive Cleanup Summary ===");
      LOG.info("Total entities processed: {}", totalProcessed);
      LOG.info("Total entities deleted: {}", totalDeleted);

      if (dryRun && totalDeleted > 0) {
        LOG.info("To actually delete entities, run with delete mode enabled");
      }

    } catch (Exception e) {
      LOG.error("Comprehensive cleanup failed", e);
      result.setCompletedSuccessfully(false);
      throw new RuntimeException("Comprehensive cleanup failed", e);
    }

    return result;
  }

  /**
   * Prints detailed results from comprehensive cleanup in a user-friendly format.
   */
  public void printComprehensiveResults(CleanupResult result) {
    if (!result.isCompletedSuccessfully()) {
      LOG.error("Comprehensive cleanup completed with errors");
      return;
    }

    EntityRelationshipCleanup.EntityCleanupResult relationshipResult =
        result.getRelationshipResult();
    ServiceHierarchyCleanup.HierarchyCleanupResult hierarchyResult = result.getHierarchyResult();

    // Print relationship cleanup summary
    if (relationshipResult.getOrphanedRelationshipsFound() > 0) {
      LOG.info("=== Orphaned Relationships Summary ===");
      LOG.info(
          "Total relationships scanned: {}", relationshipResult.getTotalRelationshipsScanned());
      LOG.info(
          "Orphaned relationships found: {}", relationshipResult.getOrphanedRelationshipsFound());
      LOG.info("Orphaned relationships deleted: {}", relationshipResult.getRelationshipsDeleted());
    }

    // Print hierarchy cleanup summary using the reusable component
    ServiceHierarchyCleanup hierarchyCleanup = new ServiceHierarchyCleanup(collectionDAO, dryRun);
    hierarchyCleanup.printCleanupResults(hierarchyResult);

    // Print overall summary
    LOG.info("=== Overall Cleanup Summary ===");
    LOG.info("Total cleanup operations: 2 (relationships + hierarchies)");
    LOG.info("Total entities processed: {}", result.getTotalEntitiesProcessed());
    LOG.info("Total entities cleaned: {}", result.getTotalEntitiesDeleted());
    LOG.info("Cleanup completed successfully: {}", result.isCompletedSuccessfully());
  }

  /**
   * Factory method to create a ComprehensiveCleanupUtil for dry-run mode.
   */
  public static EntityRelationshipCleanupUtil forDryRun(
      CollectionDAO collectionDAO, int batchSize) {
    return new EntityRelationshipCleanupUtil(collectionDAO, true, batchSize);
  }

  /**
   * Factory method to create a ComprehensiveCleanupUtil for actual cleanup mode.
   */
  public static EntityRelationshipCleanupUtil forActualCleanup(
      CollectionDAO collectionDAO, int batchSize) {
    return new EntityRelationshipCleanupUtil(collectionDAO, false, batchSize);
  }
}
