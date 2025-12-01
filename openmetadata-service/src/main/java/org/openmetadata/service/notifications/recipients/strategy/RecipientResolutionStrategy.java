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

package org.openmetadata.service.notifications.recipients.strategy;

import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.notifications.recipients.context.Recipient;

/**
 * Strategy for resolving recipients based on destination category.
 *
 * Implementations are stateless and thread-safe. Each strategy handles resolution for
 * a specific SubscriptionCategory (EXTERNAL, OWNERS, FOLLOWERS, ADMINS, USERS, TEAMS,
 * ASSIGNEES, MENTIONS). Strategies are responsible for determining which recipients
 * should be notified for a given entity based on their specific logic.
 */
public interface RecipientResolutionStrategy {
  /**
   * Resolve recipients for an entity based on this strategy using ChangeEvent.
   *
   * Preferred method - uses entity snapshot from ChangeEvent payload, handles deleted entities safely.
   * When an entity is deleted, the payload still contains the entity data at the time of deletion.
   *
   * @param event the change event containing entity data and metadata
   * @param action the subscription action containing configuration
   * @param destination the subscription destination with type and configuration
   * @return a set of resolved recipients (empty if none apply)
   */
  Set<Recipient> resolve(
      ChangeEvent event, SubscriptionAction action, SubscriptionDestination destination);

  /**
   * Resolve recipients for an entity based on this strategy by ID and type.
   *
   * Used for downstream recipient resolution where only EntityReference is available.
   * Note: This method fetches from repository, may return empty for deleted entities.
   *
   * @param entityId the UUID of the entity triggering the notification
   * @param entityType the type of the entity (e.g., "table", "testcase")
   * @param action the subscription action containing configuration
   * @param destination the subscription destination with type and configuration
   * @return a set of resolved recipients (empty if none apply)
   */
  Set<Recipient> resolve(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination);

  /**
   * Get the category this strategy handles.
   *
   * @return the SubscriptionCategory this strategy implements
   */
  SubscriptionDestination.SubscriptionCategory getCategory();
}
