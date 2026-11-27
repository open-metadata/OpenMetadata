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

package org.openmetadata.service.alerting.channel;

import org.openmetadata.schema.type.ChangeEvent;

/**
 * Sends an event through an alert's channels, as the tick does for every event it reads. A consumer
 * that makes its own work is handed one for its tick, and what it sends goes through the same
 * channels, with the same isolation and the same health, as an event alert's changes do.
 */
public interface ChannelDelivery {
  /**
   * Sends the event through every enabled destination of the alert, channel by channel, and never
   * throws for a send. Each destination's health is written when the tick ends.
   */
  Delivery deliver(ChangeEvent event);
}
