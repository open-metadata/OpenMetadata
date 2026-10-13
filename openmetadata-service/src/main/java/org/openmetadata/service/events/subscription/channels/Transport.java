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

package org.openmetadata.service.events.subscription.channels;

import java.util.Optional;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.service.notifications.channels.NotificationMessage;

/** How a channel's messages leave the server. A transport owns whatever connections it uses. */
public interface Transport {
  /**
   * Sends one rendered message to what the destination's configuration names, and throws when it
   * was not delivered. It sends a destination being tried out, as a template's test send does, so
   * the configuration is judged as a submitted one.
   */
  void deliver(NotificationMessage message, SubscriptionDestination destination);

  /** Empty while it can send, otherwise the reason it cannot, such as a mail server switched off. */
  default Optional<String> unavailableBecause() {
    return Optional.empty();
  }

  /** Called once, when the server shuts down. */
  default void close() {}
}
