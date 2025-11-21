/*
 *  Copyright 2024 Collate
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
package org.openmetadata.service.notifications;

import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.notifications.channels.NotificationMessage;

/**
 * Main orchestrator for the template processing pipeline.
 * Responsible for generating notification messages from change events using templates.
 */
public interface NotificationMessageEngine {
  /**
   * Generate notification message for the given event, subscription and specific destination.
   *
   * @param event The change event that triggered the notification
   * @param subscription The event subscription containing template configuration
   * @param destination The specific destination to generate the message for
   * @return Channel-specific message implementing NotificationMessage
   */
  NotificationMessage generateMessage(
      ChangeEvent event, EventSubscription subscription, SubscriptionDestination destination);

  /**
   * Generate notification message using a specific template (for testing).
   * Bypasses template resolution and uses the provided template directly.
   * This method is primarily used for testing notification templates without storing them in the
   * database.
   *
   * @param event The ChangeEvent to render
   * @param subscription The EventSubscription context
   * @param destination The target destination
   * @param template The NotificationTemplate to use (not resolved from DB)
   * @return Rendered NotificationMessage for the destination type
   */
  NotificationMessage generateMessageWithTemplate(
      ChangeEvent event,
      EventSubscription subscription,
      SubscriptionDestination destination,
      NotificationTemplate template);
}
