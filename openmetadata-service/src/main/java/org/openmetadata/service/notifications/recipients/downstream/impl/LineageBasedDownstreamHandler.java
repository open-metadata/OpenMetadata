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

package org.openmetadata.service.notifications.recipients.downstream.impl;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.downstream.DownstreamHandler;
import org.openmetadata.service.notifications.recipients.downstream.EntityLineageResolver;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;
import org.openmetadata.service.util.LineageGraphExplorer;

/**
 * Default implementation of DownstreamHandler using LineageGraphExplorer with
 * entity-specific lineage resolution.
 *
 * Flow:
 * 1. Use EntityLineageResolver to transform entity if needed (e.g., TestCase → Parent Table)
 * 2. For each resolved parent entity (lineage root):
 *    a. Resolve recipients from the root entity itself
 *    b. Traverse lineage from resolved entity using LineageGraphExplorer
 *    c. For each downstream entity, resolve recipients
 * 3. Return aggregated set of all stakeholders (root + downstream)
 *
 * Extension Point: The downstreamStrategy parameter allows resolving any recipient category
 * (owners, followers, admins, etc.) for entities in the lineage. New entity types with special
 * lineage needs register EntityLineageResolver (no modification to this class needed).
 */
@Slf4j
public class LineageBasedDownstreamHandler implements DownstreamHandler {

  private final Map<String, EntityLineageResolver> lineageResolvers;
  private final RecipientResolutionStrategy downstreamStrategy;

  public LineageBasedDownstreamHandler(
      Map<String, EntityLineageResolver> lineageResolvers,
      RecipientResolutionStrategy downstreamStrategy) {
    this.lineageResolvers = lineageResolvers;
    this.downstreamStrategy = downstreamStrategy;
  }

  @Override
  public Set<Recipient> resolveDownstreamRecipients(
      SubscriptionAction action,
      SubscriptionDestination destination,
      ChangeEvent changeEvent,
      Integer maxDepth) {

    Set<String> visited = new HashSet<>();

    String entityType = changeEvent.getEntityType();

    // Step 1: Resolve recipients from the source entity itself
    Set<Recipient> sourceRecipients = downstreamStrategy.resolve(changeEvent, action, destination);
    Set<Recipient> allRecipients = new HashSet<>(sourceRecipients);

    // Step 2: Resolve source entity parent using ChangeEvent (handles deleted entities)
    EntityLineageResolver resolver =
        lineageResolvers.getOrDefault(entityType, lineageResolvers.get("*"));
    Set<EntityReference> parentRefs = resolver.resolveTraversalEntities(changeEvent);

    // Step 3: If parent exists, recurse and traverse lineage
    if (!parentRefs.isEmpty()) {
      parentRefs.forEach(
          parentRef -> {
            try {
              // Recursively resolve lineage for parent entity
              Set<Recipient> parentLineageRecipients =
                  resolveParentLineageRecipients(
                      parentRef.getId(),
                      parentRef.getType(),
                      visited,
                      action,
                      destination,
                      maxDepth);
              allRecipients.addAll(parentLineageRecipients);
            } catch (Exception e) {
              LOG.error(
                  "Failed to resolve downstream for parent {} {}",
                  parentRef.getType(),
                  parentRef.getId(),
                  e);
            }
          });
    }

    return allRecipients;
  }

  /**
   * Recursively resolves recipients from a parent entity and its downstream lineage.
   * Walks the parent chain and resolves recipients at each level.
   *
   * @param entityId parent entity ID
   * @param entityType parent entity type
   * @param visited set to track visited entities and prevent cycles
   * @param action subscription action
   * @param destination subscription destination
   * @param maxDepth maximum lineage depth to traverse
   * @return aggregated recipients from parent and downstream entities
   */
  private Set<Recipient> resolveParentLineageRecipients(
      UUID entityId,
      String entityType,
      Set<String> visited,
      SubscriptionAction action,
      SubscriptionDestination destination,
      Integer maxDepth) {

    Set<Recipient> allRecipients = new HashSet<>();

    try {
      String entityKey = createEntityKey(entityType, entityId);

      // Detect circular reference
      if (visited.contains(entityKey)) {
        LOG.warn("Detected circular reference cycle - stopping at {} {}", entityType, entityId);
        return allRecipients;
      }

      visited.add(entityKey);

      // Step 1: Resolve recipients from this parent entity
      Set<Recipient> parentRecipients =
          downstreamStrategy.resolve(entityId, entityType, action, destination);
      allRecipients.addAll(parentRecipients);

      // Step 2: Traverse lineage downstream from this parent
      LineageGraphExplorer lineageExplorer = new LineageGraphExplorer(Entity.getCollectionDAO());
      Set<EntityReference> downstreamEntities =
          lineageExplorer.findUniqueEntitiesDownstream(entityId, entityType, maxDepth);

      // Step 3: Resolve recipients from each downstream entity
      downstreamEntities.forEach(
          downstream -> {
            try {
              Set<Recipient> downstreamRecipients =
                  downstreamStrategy.resolve(
                      downstream.getId(), downstream.getType(), action, destination);
              allRecipients.addAll(downstreamRecipients);
            } catch (Exception e) {
              LOG.warn(
                  "Failed to resolve recipients for downstream {} {}",
                  downstream.getType(),
                  downstream.getId(),
                  e);
            }
          });

      // Step 4: Check if this parent entity has its own parent (recursive case)
      EntityLineageResolver resolver =
          lineageResolvers.getOrDefault(entityType, lineageResolvers.get("*"));
      Set<EntityReference> ancestorRefs = resolver.resolveTraversalEntities(entityId, entityType);

      // Step 5: If parent has parent, recursively resolve its lineage
      ancestorRefs.forEach(
          ancestorRef -> {
            try {
              // Only recurse if ancestor type differs (prevent same-type cycles)
              if (!ancestorRef.getType().equals(entityType)) {
                LOG.debug(
                    "Resolved {} {} to ancestor {} {}, recursively resolving",
                    entityType,
                    entityId,
                    ancestorRef.getType(),
                    ancestorRef.getId());

                Set<Recipient> ancestorLineageRecipients =
                    resolveParentLineageRecipients(
                        ancestorRef.getId(),
                        ancestorRef.getType(),
                        visited,
                        action,
                        destination,
                        maxDepth);
                allRecipients.addAll(ancestorLineageRecipients);
              }
            } catch (Exception e) {
              LOG.warn(
                  "Failed to resolve upstream lineage for ancestor {} {}",
                  ancestorRef.getType(),
                  ancestorRef.getId(),
                  e);
            }
          });

    } catch (Exception e) {
      LOG.error("Failed to resolve lineage recipients for {} {}", entityType, entityId, e);
    }

    return allRecipients;
  }

  /**
   * Recursively resolves an entity to its lineage-capable parent entities.
   * Handles multi-level parent chains with circular reference detection.
   *
   * Examples:
   * - TestCase → {Table} → {} (Table is lineage entity)
   * - Thread → {TestCase} → {Table} → {}
   * - TestSuite → {TestCase1, TestCase2} → {Table1, Table2} → {}
   *
   * @param entityId the entity to resolve
   * @param entityType the type of the entity
   * @param visited set of visited entities (type:id) to detect cycles
   * @return Set of lineage-capable parent entities, empty set if entity is lineage-capable
   */
  private Set<EntityReference> recursivelyResolveTraversalEntities(
      UUID entityId, String entityType, Set<String> visited) {

    Set<EntityReference> result = new HashSet<>();

    try {
      String entityKey = createEntityKey(entityType, entityId);

      // Detect circular reference
      if (visited.contains(entityKey)) {
        LOG.warn("Detected circular reference cycle - stopping at {} {}", entityType, entityId);
        return result; // Empty set = stop recursion
      }

      visited.add(entityKey);

      // Get resolver for this entity type
      EntityLineageResolver resolver =
          lineageResolvers.getOrDefault(entityType, lineageResolvers.get("*"));

      // Resolve parent entities (may be 0, 1, or many)
      Set<EntityReference> parentRefs = resolver.resolveTraversalEntities(entityId, entityType);

      // Base case: no parents means this entity is lineage-capable
      if (parentRefs.isEmpty()) {
        return result; // Empty = use original entity for lineage
      }

      // Recursive case: for each parent, recurse to find lineage-capable entities
      for (EntityReference parentRef : parentRefs) {

        // If parent type is same as current type, don't recurse (prevents same-type cycles)
        if (parentRef.getType().equals(entityType)) {
          result.add(parentRef);
          continue;
        }

        LOG.debug(
            "Resolved {} {} to parent {} {}, recursively resolving",
            entityType,
            entityId,
            parentRef.getType(),
            parentRef.getId());

        // Recursively resolve the parent - will eventually reach lineage-capable entities
        Set<EntityReference> resolvedAncestors =
            recursivelyResolveTraversalEntities(parentRef.getId(), parentRef.getType(), visited);

        // Use resolved ancestors if found, otherwise parent is lineage-capable
        if (!resolvedAncestors.isEmpty()) {
          result.addAll(resolvedAncestors);
        } else {
          result.add(parentRef);
        }
      }

    } catch (Exception e) {
      LOG.warn(
          "Failed to recursively resolve lineage entities for {} {}, using original entity",
          entityType,
          entityId,
          e);
    }

    return result;
  }

  /**
   * Creates a unique identifier for an entity combining type and ID.
   *
   * @param entityType the type of the entity
   * @param entityId the ID of the entity
   * @return unique key in format "type:id"
   */
  private String createEntityKey(String entityType, UUID entityId) {
    return entityType + ":" + entityId;
  }
}
