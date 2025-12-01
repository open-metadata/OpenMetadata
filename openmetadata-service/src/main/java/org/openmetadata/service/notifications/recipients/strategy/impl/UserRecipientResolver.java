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
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;

/**
 * Resolves users by name or ID.
 *
 * This resolver supports two modes:
 * 1. By name: looks up users from the action's receivers list by their usernames
 * 2. By ID: directly resolves users from a list of UUIDs (useful for relationship-based resolution)
 *
 * In both cases, it converts users to recipients with appropriate contact information.
 */
@Slf4j
public class UserRecipientResolver implements RecipientResolutionStrategy {

  @Override
  public Set<Recipient> resolve(
      ChangeEvent event, SubscriptionAction action, SubscriptionDestination destination) {
    return resolveUsersByName(action, destination);
  }

  @Override
  public Set<Recipient> resolve(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination) {
    return resolveUsersByName(action, destination);
  }

  private Set<Recipient> resolveUsersByName(
      SubscriptionAction action, SubscriptionDestination destination) {
    if (action.getReceivers() == null || action.getReceivers().isEmpty()) {
      return Collections.emptySet();
    }

    try {
      SubscriptionDestination.SubscriptionType notificationType = destination.getType();
      return action.getReceivers().stream()
          .map(
              userName ->
                  (User)
                      Entity.getEntityByName(
                          Entity.USER, userName, "id,profile,email", Include.NON_DELETED))
          .map(user -> Recipient.fromUser(user, notificationType))
          .collect(Collectors.toUnmodifiableSet());
    } catch (Exception e) {
      LOG.error("Failed to resolve user recipients", e);
      return Collections.emptySet();
    }
  }

  /**
   * Resolve users by their IDs.
   *
   * This method is used by relationship-based resolvers (OwnerRecipientResolver,
   * FollowerRecipientResolver) to convert EntityReferences (which have IDs) to Recipients.
   *
   * @param userIds list of user IDs to resolve
   * @param destination the subscription destination
   * @return set of resolved user recipients
   */
  public Set<Recipient> resolve(List<UUID> userIds, SubscriptionDestination destination) {
    if (userIds == null || userIds.isEmpty()) {
      return Collections.emptySet();
    }

    try {
      SubscriptionDestination.SubscriptionType notificationType = destination.getType();
      return userIds.stream()
          .map(
              userId ->
                  (User)
                      Entity.getEntity(
                          Entity.USER, userId, "id,profile,email", Include.NON_DELETED))
          .map(user -> Recipient.fromUser(user, notificationType))
          .filter(Objects::nonNull)
          .collect(Collectors.toUnmodifiableSet());
    } catch (Exception e) {
      LOG.error("Failed to resolve user recipients by IDs", e);
      return Collections.emptySet();
    }
  }

  @Override
  public SubscriptionDestination.SubscriptionCategory getCategory() {
    return SubscriptionDestination.SubscriptionCategory.USERS;
  }
}
