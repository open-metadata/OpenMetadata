/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.apps.bundles.changeEvent;

import java.util.Optional;
import java.util.Set;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.notifications.recipients.context.Recipient;

/**
 * A destination whose channel is not registered on this server. Nothing is resolved, rendered or
 * sent for it, and it is never sent through the channel of its type instead.
 */
@Slf4j
final class UnservedDestination implements Destination<ChangeEvent> {
  private final EventSubscription alert;
  @Getter private final SubscriptionDestination subscriptionDestination;
  private final String channelId;

  UnservedDestination(
      EventSubscription alert, SubscriptionDestination destination, String channelId) {
    this.alert = alert;
    this.subscriptionDestination = destination;
    this.channelId = channelId;
  }

  @Override
  public void sendMessage(ChangeEvent event, Set<Recipient> recipients) {
    LOG.debug("Destination {} not attempted: {}", subscriptionDestination.getId(), reason());
  }

  @Override
  public Optional<String> notAttemptedBecause() {
    return Optional.of(reason());
  }

  @Override
  public void sendTestMessage() throws EventPublisherException {
    throw new EventPublisherException(reason());
  }

  @Override
  public boolean requiresRecipients() {
    return false;
  }

  @Override
  public EventSubscription getEventSubscriptionForDestination() {
    return alert;
  }

  @Override
  public boolean getEnabled() {
    return Boolean.TRUE.equals(subscriptionDestination.getEnabled());
  }

  @Override
  public void close() {}

  private String reason() {
    return "The channel " + channelId + " is not registered on this server";
  }
}
