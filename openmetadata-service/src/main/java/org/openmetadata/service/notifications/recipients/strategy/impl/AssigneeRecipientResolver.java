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
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;

/**
 * Resolves assignees from task threads.
 *
 * This resolver extracts assignees from task-based notifications and converts them
 * to recipients with appropriate contact information.
 */
@Slf4j
public class AssigneeRecipientResolver implements RecipientResolutionStrategy {

  private final UserRecipientResolver userResolver;
  private final TeamRecipientResolver teamResolver;

  public AssigneeRecipientResolver(
      UserRecipientResolver userResolver, TeamRecipientResolver teamResolver) {
    this.userResolver = userResolver;
    this.teamResolver = teamResolver;
  }

  @Override
  public Set<Recipient> resolve(
      ChangeEvent event, SubscriptionAction action, SubscriptionDestination destination) {

    if (!Entity.THREAD.equalsIgnoreCase(event.getEntityType())) {
      LOG.warn(
          "AssigneeRecipientResolver called with non-thread entity: {}", event.getEntityType());
      return Collections.emptySet();
    }

    try {
      Thread thread = AlertsRuleEvaluator.getThread(event);
      return resolveAssigneesFromThread(thread, destination);

    } catch (Exception e) {
      LOG.error("Failed to resolve assignees for thread {}", event.getEntityId(), e);
      return Collections.emptySet();
    }
  }

  @Override
  public Set<Recipient> resolve(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination) {

    if (!Entity.THREAD.equalsIgnoreCase(entityType)) {
      LOG.warn("AssigneeRecipientResolver called with non-thread entity: {}", entityType);
      return Collections.emptySet();
    }

    try {
      Thread thread = Entity.getFeedRepository().get(entityId);
      return resolveAssigneesFromThread(thread, destination);

    } catch (Exception e) {
      LOG.error("Failed to resolve assignees for thread {}", entityId, e);
      return Collections.emptySet();
    }
  }

  private Set<Recipient> resolveAssigneesFromThread(
      Thread thread, SubscriptionDestination destination) {
    if (thread == null || thread.getTask() == null) {
      return Collections.emptySet();
    }

    List<EntityReference> assignees = thread.getTask().getAssignees();
    if (assignees == null || assignees.isEmpty()) {
      return Collections.emptySet();
    }

    Set<Recipient> recipients = new HashSet<>();

    List<UUID> userIds =
        assignees.stream()
            .filter(e -> Entity.USER.equalsIgnoreCase(e.getType()))
            .map(EntityReference::getId)
            .collect(Collectors.toList());

    List<UUID> teamIds =
        assignees.stream()
            .filter(e -> Entity.TEAM.equalsIgnoreCase(e.getType()))
            .map(EntityReference::getId)
            .collect(Collectors.toList());

    if (!userIds.isEmpty()) {
      recipients.addAll(userResolver.resolve(userIds, destination));
    }

    if (!teamIds.isEmpty()) {
      recipients.addAll(teamResolver.resolve(teamIds, destination));
    }

    return recipients;
  }

  @Override
  public SubscriptionDestination.SubscriptionCategory getCategory() {
    return SubscriptionDestination.SubscriptionCategory.ASSIGNEES;
  }
}
