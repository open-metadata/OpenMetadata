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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;

/**
 * A destination's id is the server's: it names exactly one destination of one alert. A new
 * destination gets a fresh id whatever the request says. An update names a destination by an id
 * this alert stores, once; any other id was not issued for this alert, so the destination it marks
 * is matched as one sent without an id, by its position, and is stored with a fresh id if it
 * matches none.
 */
public final class DestinationIds {

  private DestinationIds() {}

  /** The destinations of a new alert are all new, so each gets an id of its own. */
  public static void assignNew(List<SubscriptionDestination> destinations) {
    listOrEmpty(destinations).forEach(destination -> destination.withId(UUID.randomUUID()));
  }

  /** Clears, in place, every id an update sends that this alert does not store, or repeats. */
  public static void forgetIdsNotIssuedHere(EventSubscription original, EventSubscription updated) {
    Set<UUID> stored =
        listOrEmpty(original.getDestinations()).stream()
            .map(SubscriptionDestination::getId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
    Set<UUID> named = new HashSet<>();
    for (SubscriptionDestination destination : listOrEmpty(updated.getDestinations())) {
      UUID id = destination.getId();
      boolean issuedHere = id != null && stored.contains(id) && named.add(id);
      if (!issuedHere) {
        destination.withId(null);
      }
    }
  }
}
