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

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.openmetadata.service.notifications.recipients.Lookup;
import org.openmetadata.service.notifications.recipients.Recipients;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;

/** Resolves the assignees of a task, users and teams, as recipients. */
@Slf4j
public class AssigneeRecipientResolver implements RecipientResolutionStrategy {

  private final UserRecipientResolver users;
  private final TeamRecipientResolver teams;

  public AssigneeRecipientResolver(UserRecipientResolver users, TeamRecipientResolver teams) {
    this.users = users;
    this.teams = teams;
  }

  @Override
  public Recipients resolve(
      ChangeEvent event, SubscriptionAction action, SubscriptionDestination destination) {
    return isTask(event.getEntityType())
        ? assigneesOf(
            Lookup.of(
                "the task of event " + event.getId(), () -> AlertsRuleEvaluator.getTask(event)),
            destination)
        : Recipients.none();
  }

  @Override
  public Recipients resolve(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination) {
    return isTask(entityType)
        ? assigneesOf(
            Lookup.of(
                "task " + entityId,
                () ->
                    Entity.<Task>getEntity(
                        Entity.TASK, entityId, "assignees", Include.NON_DELETED)),
            destination)
        : Recipients.none();
  }

  private Recipients assigneesOf(Lookup<Task> task, SubscriptionDestination destination) {
    return Recipients.from(
        task, found -> Principals.of(found.getAssignees(), users, teams, destination));
  }

  private static boolean isTask(String entityType) {
    boolean task = Entity.TASK.equalsIgnoreCase(entityType);
    if (!task) {
      LOG.warn("Assignees asked for an entity that has none: {}", entityType);
    }
    return task;
  }

  @Override
  public SubscriptionDestination.SubscriptionCategory getCategory() {
    return SubscriptionDestination.SubscriptionCategory.ASSIGNEES;
  }
}
