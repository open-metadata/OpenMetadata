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
package org.openmetadata.service.notifications.channels;

import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.exception.NotificationException;
import org.openmetadata.service.notifications.messages.NotificationMessage;

/**
 * Interface for channel-specific notification delivery.
 * Template-engine agnostic - works with any template engine output.
 *
 * @param <T> The specific message type that extends NotificationMessage
 */
public interface NotificationSender<T extends NotificationMessage> {
  /**
   * Send notification to the channel.
   *
   * @param message The channel-specific message object
   * @param subscription The event subscription with destination configuration
   * @throws NotificationException if sending fails
   */
  void send(T message, EventSubscription subscription) throws NotificationException;

  /**
   * Test the notification channel connectivity.
   *
   * @param subscription The event subscription to test
   * @return True if test successful
   */
  boolean testConnection(EventSubscription subscription);
}
