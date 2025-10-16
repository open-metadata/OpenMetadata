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
}
