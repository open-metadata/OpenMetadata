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

import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.notifications.messages.NotificationMessage;

/**
 * Transforms canonical HTML to channel-specific message format.
 * Concrete implementations will be created for each channel (Slack, Email, Teams, GChat) in a separate task.
 *
 * @param <T> The specific message type that extends NotificationMessage
 */
public interface NotificationChannelTransformer<T extends NotificationMessage> {
  /**
   * Transform canonical HTML to channel-specific message object.
   *
   * @param canonicalHtml The processed template HTML output
   * @param subject The processed subject (optional, can be null)
   * @param event The change event for additional context if needed
   * @return Channel-specific message object
   */
  T transform(String canonicalHtml, String subject, ChangeEvent event);
}
