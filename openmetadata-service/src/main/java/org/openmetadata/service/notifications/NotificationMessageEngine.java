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
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.notifications.messages.NotificationMessage;

/**
 * Main orchestrator for the template processing pipeline.
 * Responsible for generating notification messages from change events using templates.
 * The engine is configured with a specific transformer for the target channel.
 */
public interface NotificationMessageEngine {
  /**
   * Generate notification message for the given event and subscription.
   *
   * @param event The change event that triggered the notification
   * @param subscription The event subscription containing template configuration
   * @return Channel-specific message implementing NotificationMessage
   */
  NotificationMessage generateMessage(ChangeEvent event, EventSubscription subscription);
}
