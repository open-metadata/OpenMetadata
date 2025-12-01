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
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;

/**
 * Resolves teams by name or ID.
 *
 * This resolver supports two modes:
 * 1. By name: looks up teams from the action's receivers list by their team names
 * 2. By ID: directly resolves teams from a list of UUIDs (useful for relationship-based resolution)
 *
 * In both cases, it converts teams to recipients with appropriate contact information.
 */
@Slf4j
public class TeamRecipientResolver implements RecipientResolutionStrategy {

  @Override
  public Set<Recipient> resolve(
      ChangeEvent event, SubscriptionAction action, SubscriptionDestination destination) {
    return resolveTeamsByName(action, destination);
  }

  @Override
  public Set<Recipient> resolve(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination) {
    return resolveTeamsByName(action, destination);
  }

  private Set<Recipient> resolveTeamsByName(
      SubscriptionAction action, SubscriptionDestination destination) {
    if (action.getReceivers() == null || action.getReceivers().isEmpty()) {
      return Collections.emptySet();
    }

    try {
      SubscriptionDestination.SubscriptionType notificationType = destination.getType();
      return action.getReceivers().stream()
          .map(
              teamName ->
                  (Team)
                      Entity.getEntityByName(
                          Entity.TEAM, teamName, "id,profile,email", Include.NON_DELETED))
          .map(team -> Recipient.fromTeam(team, notificationType))
          .collect(Collectors.toUnmodifiableSet());
    } catch (Exception e) {
      LOG.error("Failed to resolve team recipients", e);
      return Collections.emptySet();
    }
  }

  /**
   * Resolve teams by their IDs.
   *
   * This method is used by relationship-based resolvers (OwnerRecipientResolver,
   * FollowerRecipientResolver) to convert EntityReferences (which have IDs) to Recipients.
   *
   * Note: Fetches with "id,profile,email" fields to ensure profile is available for webhook
   * extraction.
   *
   * @param teamIds list of team IDs to resolve
   * @param destination the subscription destination
   * @return set of resolved team recipients
   */
  public Set<Recipient> resolve(List<UUID> teamIds, SubscriptionDestination destination) {
    if (teamIds == null || teamIds.isEmpty()) {
      return Collections.emptySet();
    }

    try {
      SubscriptionDestination.SubscriptionType notificationType = destination.getType();
      return teamIds.stream()
          .map(
              teamId ->
                  (Team)
                      Entity.getEntity(
                          Entity.TEAM, teamId, "id,profile,email", Include.NON_DELETED))
          .map(team -> Recipient.fromTeam(team, notificationType))
          .filter(Objects::nonNull)
          .collect(Collectors.toUnmodifiableSet());
    } catch (Exception e) {
      LOG.error("Failed to resolve team recipients by IDs", e);
      return Collections.emptySet();
    }
  }

  @Override
  public SubscriptionDestination.SubscriptionCategory getCategory() {
    return SubscriptionDestination.SubscriptionCategory.TEAMS;
  }
}
