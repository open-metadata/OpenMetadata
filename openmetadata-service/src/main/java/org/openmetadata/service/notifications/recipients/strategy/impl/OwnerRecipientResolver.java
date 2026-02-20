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

package org.openmetadata.service.notifications.recipients.strategy.impl;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;

/**
 * Resolves entity owners with inherited ownership support.
 *
 * This resolver handles ownership inheritance which is critical for TestCase and other
 * entities that inherit ownership from their parent entities. When fetched with the "owners"
 * field parameter, Entity.getEntity() automatically resolves inherited ownership.
 *
 * Delegates user and team ID-based resolution to UserRecipientResolver and
 * TeamRecipientResolver to avoid code duplication.
 */
@Slf4j
public class OwnerRecipientResolver implements RecipientResolutionStrategy {

  private final UserRecipientResolver userResolver;
  private final TeamRecipientResolver teamResolver;

  public OwnerRecipientResolver(
      UserRecipientResolver userResolver, TeamRecipientResolver teamResolver) {
    this.userResolver = userResolver;
    this.teamResolver = teamResolver;
  }

  @Override
  public Set<Recipient> resolve(
      ChangeEvent event, SubscriptionAction action, SubscriptionDestination destination) {

    try {
      String entityType = event.getEntityType();

      // Special handling for Thread entities
      if (Entity.THREAD.equalsIgnoreCase(entityType)) {
        Thread thread = AlertsRuleEvaluator.getThread(event);
        if (thread == null) {
          return Collections.emptySet();
        }
        return resolveOwnersFromThread(thread, destination);
      }

      // Standard handling for other entities
      EntityInterface entity = AlertsRuleEvaluator.getEntity(event);
      if (entity == null) {
        return Collections.emptySet();
      }
      return resolveOwnersFromEntity(entity, destination);
    } catch (Exception e) {
      LOG.warn(
          "Failed to resolve owners for event entity {} {}",
          event.getEntityType(),
          event.getEntityId(),
          e);
      return Collections.emptySet();
    }
  }

  @Override
  public Set<Recipient> resolve(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination) {

    try {
      // Special handling for Thread entities
      if (Entity.THREAD.equalsIgnoreCase(entityType)) {
        Thread thread = Entity.getFeedRepository().get(entityId);
        return resolveOwnersFromThread(thread, destination);
      }

      // Standard handling for other entities
      EntityInterface entity =
          Entity.getEntity(
              entityType,
              entityId,
              "owners", // This parameter triggers ownership inheritance
              Include.NON_DELETED);
      return resolveOwnersFromEntity(entity, destination);

    } catch (Exception e) {
      LOG.warn("Failed to resolve owners for entity {} {}", entityType, entityId, e);
      return Collections.emptySet();
    }
  }

  private @NotNull Set<Recipient> resolveOwnersFromThread(
      Thread thread, SubscriptionDestination destination) {
    Set<Recipient> recipients = new HashSet<>();

    if (thread == null) {
      return recipients;
    }

    // 1. Thread owner is the creator - fetch user by name
    if (thread.getCreatedBy() != null) {
      try {
        User creator =
            Entity.getEntityByName(
                Entity.USER, thread.getCreatedBy(), "id,profile,email", Include.NON_DELETED);
        if (creator != null) {
          recipients.add(Recipient.fromUser(creator, destination.getType()));
        }
      } catch (Exception e) {
        LOG.debug("Thread creator user not found: {}", thread.getCreatedBy(), e);
      }
    }

    // 2. Also resolve owners from the parent entity (what the thread is about)
    if (thread.getEntityRef() != null) {
      try {
        EntityInterface parentEntity =
            Entity.getEntity(
                thread.getEntityRef().getType(),
                thread.getEntityRef().getId(),
                "owners",
                Include.NON_DELETED);
        if (parentEntity != null && parentEntity.getOwners() != null) {
          recipients.addAll(resolveEntityReferences(parentEntity.getOwners(), destination));
        }
      } catch (Exception e) {
        LOG.debug("Failed to resolve parent entity owners for thread", e);
      }
    }

    return recipients;
  }

  private @NotNull Set<Recipient> resolveOwnersFromEntity(
      EntityInterface entity, SubscriptionDestination destination) {
    if (entity == null || entity.getOwners() == null) {
      return Collections.emptySet();
    }

    return resolveEntityReferences(entity.getOwners(), destination);
  }

  /**
   * Resolve entity references (users and teams) to recipients.
   *
   * Delegates to UserRecipientResolver and TeamRecipientResolver to handle the actual
   * conversion from IDs to Recipients, avoiding code duplication.
   *
   * @param entityReferences list of entity references to resolve
   * @param destination the subscription destination
   * @return set of resolved recipients
   */
  private Set<Recipient> resolveEntityReferences(
      List<EntityReference> entityReferences, SubscriptionDestination destination) {

    Set<Recipient> recipients = new HashSet<>();

    // Extract user IDs and resolve via UserRecipientResolver
    List<UUID> userIds =
        entityReferences.stream()
            .filter(e -> Entity.USER.equalsIgnoreCase(e.getType()))
            .map(EntityReference::getId)
            .toList();
    if (!userIds.isEmpty()) {
      recipients.addAll(userResolver.resolve(userIds, destination));
    }

    // Extract team IDs and resolve via TeamRecipientResolver
    List<UUID> teamIds =
        entityReferences.stream()
            .filter(e -> Entity.TEAM.equalsIgnoreCase(e.getType()))
            .map(EntityReference::getId)
            .toList();
    if (!teamIds.isEmpty()) {
      recipients.addAll(teamResolver.resolve(teamIds, destination));
    }

    return recipients;
  }

  @Override
  public SubscriptionDestination.SubscriptionCategory getCategory() {
    return SubscriptionDestination.SubscriptionCategory.OWNERS;
  }
}
