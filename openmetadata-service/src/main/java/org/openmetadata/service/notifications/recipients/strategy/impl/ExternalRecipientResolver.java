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

import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.subscription.channels.Channels;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;

/**
 * Resolves static recipients configured directly in the subscription destination.
 *
 * For EXTERNAL destinations, recipients are explicitly configured and do not depend
 * on entity relationships. The receivers are already the final contact information
 * (email addresses or webhook URLs) and require no further resolution.
 */
@Slf4j
public class ExternalRecipientResolver implements RecipientResolutionStrategy {

  @Override
  public Set<Recipient> resolve(
      ChangeEvent event, SubscriptionAction action, SubscriptionDestination destination) {
    return resolveExternalRecipients(action, destination);
  }

  @Override
  public Set<Recipient> resolve(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination) {
    return resolveExternalRecipients(action, destination);
  }

  private Set<Recipient> resolveExternalRecipients(
      SubscriptionAction action, SubscriptionDestination destination) {
    Set<Recipient> recipients;
    try {
      recipients = Channels.required(destination).directory().configured(action, destination);
    } catch (IllegalArgumentException e) {
      LOG.error("Failed to resolve external recipients", e);
      recipients = Set.of();
    }
    return recipients;
  }

  @Override
  public SubscriptionDestination.SubscriptionCategory getCategory() {
    return SubscriptionDestination.SubscriptionCategory.EXTERNAL;
  }
}
