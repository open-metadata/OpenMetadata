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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Reusable utility class for cleaning up broken service hierarchy entities.
 * This class provides common functionality that can be used by both OpenMetadataOperations
 * and DataRetention applications.
 */
@Slf4j
public class ServiceHierarchyCleanup {

  private final CollectionDAO collectionDAO;
  private final boolean dryRun;

  public ServiceHierarchyCleanup(CollectionDAO collectionDAO, boolean dryRun) {
    this.collectionDAO = collectionDAO;
    this.dryRun = dryRun;
  }

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class ServiceHierarchy {
    private String parentEntityType;
    private String childEntityType;
    private String tableName;
  }

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class HierarchyCleanupResult {
    private int totalBrokenFound;
    private int totalBrokenDeleted;
    private Map<String, Integer> brokenEntitiesByService;
    private Map<String, Integer> deletedEntitiesByService;
  }

  /**
   * Performs comprehensive service hierarchy cleanup for all OpenMetadata service types.
   *
   * @return HierarchyCleanupResult containing statistics about the cleanup operation
   */
  public HierarchyCleanupResult performHierarchyCleanup() {
    LOG.info("Starting comprehensive service hierarchy cleanup for all service types");

    Map<String, List<ServiceHierarchy>> serviceHierarchies = getServiceHierarchies();

    HierarchyCleanupResult result =
        HierarchyCleanupResult.builder()
            .totalBrokenFound(0)
            .totalBrokenDeleted(0)
            .brokenEntitiesByService(new HashMap<>())
            .deletedEntitiesByService(new HashMap<>())
            .build();

    for (Map.Entry<String, List<ServiceHierarchy>> serviceEntry : serviceHierarchies.entrySet()) {
      String serviceName = serviceEntry.getKey();
      List<ServiceHierarchy> hierarchies = serviceEntry.getValue();

      LOG.info("Processing {} hierarchies", serviceName);

      int serviceBrokenFound = 0;
      int serviceDeleted = 0;

      for (ServiceHierarchy hierarchy : hierarchies) {
        try {
          List<String> brokenEntities = getBrokenEntitiesForHierarchy(hierarchy);
          serviceBrokenFound += brokenEntities.size();

          if (!brokenEntities.isEmpty()) {
            LOG.info(
                "Found {} broken {} entities", brokenEntities.size(), hierarchy.childEntityType);

            if (!dryRun) {
              int deletedCount = deleteBrokenEntitiesForHierarchy(hierarchy);
              serviceDeleted += deletedCount;
              LOG.info("Deleted {} broken {} entities", deletedCount, hierarchy.childEntityType);
            }
          }
        } catch (Exception e) {
          LOG.warn(
              "Failed to process hierarchy {}->{}: {}",
              hierarchy.parentEntityType,
              hierarchy.childEntityType,
              e.getMessage());
        }
      }

      result.getBrokenEntitiesByService().put(serviceName, serviceBrokenFound);
      result.getDeletedEntitiesByService().put(serviceName, serviceDeleted);
      result.setTotalBrokenFound(result.getTotalBrokenFound() + serviceBrokenFound);
      result.setTotalBrokenDeleted(result.getTotalBrokenDeleted() + serviceDeleted);
    }

    LOG.info("=== Service Hierarchy Cleanup Summary ===");
    LOG.info("Total broken entities found: {}", result.getTotalBrokenFound());
    LOG.info("Total broken entities deleted: {}", result.getTotalBrokenDeleted());

    if (dryRun && result.getTotalBrokenFound() > 0) {
      LOG.info("To actually delete broken entities, run with delete mode enabled");
    }

    return result;
  }

  /**
   * Gets broken entities for a specific hierarchy relationship.
   */
  public List<String> getBrokenEntitiesForHierarchy(ServiceHierarchy hierarchy) {
    try {
      return collectionDAO
          .systemDAO()
          .getBrokenRelationFromParentToChild(
              hierarchy.tableName, hierarchy.parentEntityType, hierarchy.childEntityType);
    } catch (Exception e) {
      LOG.debug(
          "Error querying broken entities for hierarchy {}->{}: {}",
          hierarchy.parentEntityType,
          hierarchy.childEntityType,
          e.getMessage());
      return List.of();
    }
  }

  /**
   * Deletes broken entities for a specific hierarchy relationship.
   */
  public int deleteBrokenEntitiesForHierarchy(ServiceHierarchy hierarchy) {
    if (dryRun) {
      return 0;
    }

    try {
      return collectionDAO
          .systemDAO()
          .deleteBrokenRelationFromParentToChild(
              hierarchy.tableName, hierarchy.parentEntityType, hierarchy.childEntityType);
    } catch (Exception e) {
      LOG.error(
          "Error deleting broken entities for hierarchy {}->{}: {}",
          hierarchy.parentEntityType,
          hierarchy.childEntityType,
          e.getMessage());
      return 0;
    }
  }

  /**
   * Defines all service hierarchies in OpenMetadata.
   * This is the single source of truth for service hierarchy definitions.
   */
  public static Map<String, List<ServiceHierarchy>> getServiceHierarchies() {
    return Map.of(
        "Database",
            List.of(
                ServiceHierarchy.builder()
                    .parentEntityType(Entity.DATABASE_SERVICE)
                    .childEntityType(Entity.DATABASE)
                    .tableName("database_entity")
                    .build(),
                ServiceHierarchy.builder()
                    .parentEntityType(Entity.DATABASE)
                    .childEntityType(Entity.DATABASE_SCHEMA)
                    .tableName("database_schema_entity")
                    .build(),
                ServiceHierarchy.builder()
                    .parentEntityType(Entity.DATABASE_SCHEMA)
                    .childEntityType(Entity.TABLE)
                    .tableName("table_entity")
                    .build(),
                ServiceHierarchy.builder()
                    .parentEntityType(Entity.DATABASE_SCHEMA)
                    .childEntityType(Entity.STORED_PROCEDURE)
                    .tableName("stored_procedure_entity")
                    .build()),
        "Dashboard",
            List.of(
                ServiceHierarchy.builder()
                    .parentEntityType(Entity.DASHBOARD_SERVICE)
                    .childEntityType(Entity.DASHBOARD)
                    .tableName("dashboard_entity")
                    .build(),
                ServiceHierarchy.builder()
                    .parentEntityType(Entity.DASHBOARD)
                    .childEntityType(Entity.CHART)
                    .tableName("chart_entity")
                    .build(),
                ServiceHierarchy.builder()
                    .parentEntityType(Entity.DASHBOARD_SERVICE)
                    .childEntityType(Entity.DASHBOARD_DATA_MODEL)
                    .tableName("dashboard_data_model_entity")
                    .build()),
        "API",
            List.of(
                ServiceHierarchy.builder()
                    .parentEntityType(Entity.API_SERVICE)
                    .childEntityType(Entity.API_COLLCECTION)
                    .tableName("api_collection_entity")
                    .build(),
                ServiceHierarchy.builder()
                    .parentEntityType(Entity.API_COLLCECTION)
                    .childEntityType(Entity.API_ENDPOINT)
                    .tableName("api_endpoint_entity")
                    .build()),
        "Messaging",
            List.of(
                ServiceHierarchy.builder()
                    .parentEntityType(Entity.MESSAGING_SERVICE)
                    .childEntityType(Entity.TOPIC)
                    .tableName("topic_entity")
                    .build()),
        "Pipeline",
            List.of(
                ServiceHierarchy.builder()
                    .parentEntityType(Entity.PIPELINE_SERVICE)
                    .childEntityType(Entity.PIPELINE)
                    .tableName("pipeline_entity")
                    .build()),
        "Storage",
            List.of(
                ServiceHierarchy.builder()
                    .parentEntityType(Entity.STORAGE_SERVICE)
                    .childEntityType(Entity.CONTAINER)
                    .tableName("storage_container_entity")
                    .build()),
        "MLModel",
            List.of(
                ServiceHierarchy.builder()
                    .parentEntityType(Entity.MLMODEL_SERVICE)
                    .childEntityType(Entity.MLMODEL)
                    .tableName("ml_model_entity")
                    .build()),
        "Search",
            List.of(
                ServiceHierarchy.builder()
                    .parentEntityType(Entity.SEARCH_SERVICE)
                    .childEntityType(Entity.SEARCH_INDEX)
                    .tableName("search_index_entity")
                    .build()));
  }

  /**
   * Prints detailed cleanup results in ASCII table format.
   */
  public void printCleanupResults(HierarchyCleanupResult result) {
    if (result.getTotalBrokenFound() == 0) {
      LOG.info("No broken service hierarchy entities found.");
      return;
    }

    LOG.info(
        "Found {} broken entities across all service hierarchies", result.getTotalBrokenFound());

    // Print per-service breakdown
    List<String> columns = List.of("Service Type", "Broken Found", "Deleted");
    List<List<String>> rows = new ArrayList<>();

    for (Map.Entry<String, Integer> entry : result.getBrokenEntitiesByService().entrySet()) {
      String serviceName = entry.getKey();
      int brokenFound = entry.getValue();
      int deleted = result.getDeletedEntitiesByService().getOrDefault(serviceName, 0);

      if (brokenFound > 0) {
        rows.add(List.of(serviceName, String.valueOf(brokenFound), String.valueOf(deleted)));
      }
    }

    if (!rows.isEmpty()) {
      OpenMetadataOperations.printToAsciiTable(columns, rows, "No broken entities found");
    }
  }
}
