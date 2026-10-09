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

package org.openmetadata.service.alerting.channel.feed;

import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.ACTIVITY_FEED;

import org.openmetadata.service.alerting.audience.AddressDirectory;
import org.openmetadata.service.alerting.channel.ComposedChannel;
import org.openmetadata.service.events.subscription.channels.Channel;
import org.openmetadata.service.events.subscription.channels.ConfigRules;

/** The activity feed inside the server: the destination is its own target and needs no setup. */
public final class FeedChannel {
  private FeedChannel() {}

  public static Channel create() {
    return new ComposedChannel(
        ACTIVITY_FEED.value(),
        null,
        null,
        AddressDirectory.NONE,
        ConfigRules.NONE,
        (alert, destination, renderer) -> new ActivityStreamPublisher(alert, destination));
  }
}
