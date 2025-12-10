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
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.notifications.recipients.context.Recipient;

/**
 * Handles downstream entity resolution for lineage-based notifications.
 *
 * When a subscription is configured with notifyDownstream=true, the handler resolves
 * recipients from entities that consume data from the affected entity (downstream in lineage).
 *
 * The handler uses the ChangeEvent payload to safely handle both deleted and existing entities,
 * extracting the entity snapshot captured at event time.
 */
public interface DownstreamHandler {
  /**
   * Resolve recipients from downstream entities for lineage propagation using ChangeEvent.
   *
   * Uses the entity snapshot from the ChangeEvent payload, which allows this method to work
   * correctly for deleted entities (where the repository no longer has the entity data).
   *
   * @param action the subscription action
   * @param destination the subscription destination with type and configuration
   * @param changeEvent the ChangeEvent containing entity snapshot and ID/type information
   * @param maxDepth the maximum depth to traverse (null for unlimited with cycle protection)
   * @return set of recipients from downstream entities
   */
  Set<Recipient> resolveDownstreamRecipients(
      SubscriptionAction action,
      SubscriptionDestination destination,
      ChangeEvent changeEvent,
      Integer maxDepth);
}
