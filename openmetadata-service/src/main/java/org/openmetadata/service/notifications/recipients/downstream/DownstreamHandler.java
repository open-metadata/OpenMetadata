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

package org.openmetadata.service.notifications.recipients.downstream;

import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.service.notifications.recipients.context.Recipient;

/**
 * Handles downstream entity resolution for lineage-based notifications.
 *
 * When a subscription is configured with notifyDownstream=true, the handler resolves
 * recipients from entities that consume data from the affected entity (downstream in lineage).
 */
public interface DownstreamHandler {
  /**
   * Resolve recipients from downstream entities for lineage propagation.
   *
   * @param entityId the ID of the entity triggering the notification
   * @param entityType the type of the entity
   * @param action the subscription action
   * @param destination the subscription destination with type and configuration
   * @param maxDepth the maximum depth to traverse (null for unlimited with cycle protection)
   * @return set of recipients from downstream entities
   */
  Set<Recipient> resolveDownstreamRecipients(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination,
      Integer maxDepth);
}
