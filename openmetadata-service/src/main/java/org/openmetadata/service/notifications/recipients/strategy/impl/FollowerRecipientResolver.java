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
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;

/**
 * Resolves entity followers.
 *
 * This resolver extracts followers from entities that support the followers relationship
 * and converts them to recipients with appropriate contact information.
 *
 * Delegates user and team ID-based resolution to UserRecipientResolver and
 * TeamRecipientResolver to avoid code duplication.
 */
@Slf4j
public class FollowerRecipientResolver implements RecipientResolutionStrategy {

  private final UserRecipientResolver userResolver;
  private final TeamRecipientResolver teamResolver;

  public FollowerRecipientResolver(
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
        return resolveFollowersFromThread(thread, destination);
      }

      // Standard handling for other entities
      EntityInterface entity = AlertsRuleEvaluator.getEntity(event);
      return resolveFollowersFromEntity(entity, destination);
    } catch (Exception e) {
      LOG.warn(
          "Failed to resolve followers for event entity {} {}",
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
        return resolveFollowersFromThread(thread, destination);
      }

      // Standard handling for other entities
      EntityInterface entity =
          Entity.getEntity(entityType, entityId, "followers", Include.NON_DELETED);
      return resolveFollowersFromEntity(entity, destination);

    } catch (Exception e) {
      LOG.warn("Failed to resolve followers for {} {}", entityType, entityId, e);
      return Collections.emptySet();
    }
  }

  private @NotNull Set<Recipient> resolveFollowersFromThread(
      Thread thread, SubscriptionDestination destination) {
    if (thread == null || thread.getEntityRef() == null) {
      return Collections.emptySet();
    }

    // For threads, resolve followers from the referenced entity
    EntityInterface referencedEntity =
        Entity.getEntity(
            thread.getEntityRef().getType(),
            thread.getEntityRef().getId(),
            "followers",
            Include.NON_DELETED);
    return resolveFollowersFromEntity(referencedEntity, destination);
  }

  private @NotNull Set<Recipient> resolveFollowersFromEntity(
      EntityInterface entity, SubscriptionDestination destination) {
    if (entity == null || entity.getFollowers() == null) {
      return Collections.emptySet();
    }

    return resolveEntityReferences(entity.getFollowers(), destination);
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
    return SubscriptionDestination.SubscriptionCategory.FOLLOWERS;
  }
}
