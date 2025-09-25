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

package org.openmetadata.service.notifications.decorator;

import org.openmetadata.schema.type.ChangeEvent;

/**
 * Interface for decorating notification HTML content before channel transformation.
 * This allows for channel-specific preprocessing without modifying core components.
 */
public interface NotificationMessageDecorator {
  /**
   * Decorate the HTML content before it's passed to the transformer.
   *
   * @param htmlContent The rendered template HTML
   * @param subject The rendered subject (optional)
   * @param event The change event for context
   * @return Decorated HTML content
   */
  String decorate(String htmlContent, String subject, ChangeEvent event);
}
