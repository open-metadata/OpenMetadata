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

import java.util.UUID;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.notifications.recipients.Recipients;

/**
 * Strategy for resolving recipients based on destination category.
 *
 * <p>Implementations are stateless and thread-safe. Each one handles one SubscriptionCategory and
 * answers with the recipients it found and the lookups that failed, so a failure never costs the
 * recipients that were found their message.
 */
public interface RecipientResolutionStrategy {
  /**
   * The recipients for the entity of a change event, read from the event's payload, which still
   * holds a deleted entity as it was.
   */
  Recipients resolve(
      ChangeEvent event, SubscriptionAction action, SubscriptionDestination destination);

  /** The recipients for an entity read from the store, for downstream resolution. */
  Recipients resolve(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination);

  SubscriptionDestination.SubscriptionCategory getCategory();
}
