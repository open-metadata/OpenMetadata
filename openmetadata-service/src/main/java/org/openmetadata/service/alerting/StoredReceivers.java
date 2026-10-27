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

package org.openmetadata.service.alerting;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.service.alerting.channel.ChannelResolution;
import org.openmetadata.service.alerting.channel.ConfigRules;

/**
 * The receiver lists an alert stored, so a save is refused only for a list it grows past the limit.
 * Each stored list is kept once: first by the destination that sends it again under its own id,
 * then, since a PUT carries no ids and every destination of one gets a new id, by a destination
 * under another id. So sending an alert again never makes its stored lists look new, and copying a
 * list past the limit into a second destination is still refused.
 */
@Slf4j
final class StoredReceivers {
  private final Map<UUID, Set<String>> byId = new HashMap<>();
  private final Map<Set<String>, Integer> unclaimed = new HashMap<>();

  private StoredReceivers() {}

  static StoredReceivers of(EventSubscription alert) {
    StoredReceivers stored = new StoredReceivers();
    if (alert != null) {
      listOrEmpty(alert.getDestinations()).forEach(stored::add);
    }
    return stored;
  }

  /**
   * The receivers a user typed into the destination, the only ones each send goes to as written.
   * A destination of users or teams names who to find instead, however many people that is, so it
   * holds none here. A configuration a channel cannot read holds none either; destination
   * validation refuses it when it is new.
   */
  static Set<String> of(SubscriptionDestination destination) {
    Set<String> receivers = Set.of();
    try {
      receivers = ConfigRules.configuredByTheUser(destination) ? readBy(destination) : Set.of();
    } catch (IllegalArgumentException unreadable) {
      LOG.debug("Destination {} holds no receivers it can read", destination.getId(), unreadable);
    }
    return receivers;
  }

  /** How many receivers each sent destination already held, in the order they were sent. */
  List<Long> heldBy(List<SubscriptionDestination> sent) {
    List<Long> held = new ArrayList<>();
    List<Integer> underAnotherId = new ArrayList<>();
    for (int index = 0; index < sent.size(); index++) {
      Set<String> receivers = of(sent.get(index));
      boolean keepsItsOwn = receivers.equals(byId.get(sent.get(index).getId()));
      if (keepsItsOwn) {
        claim(receivers);
      } else {
        underAnotherId.add(index);
      }
      held.add(keepsItsOwn ? (long) receivers.size() : 0L);
    }
    underAnotherId.forEach(index -> held.set(index, heldUnderAnotherId(sent.get(index))));
    return held;
  }

  private long heldUnderAnotherId(SubscriptionDestination destination) {
    Set<String> receivers = of(destination);
    return claim(receivers)
        ? receivers.size()
        : byId.getOrDefault(destination.getId(), Set.of()).size();
  }

  private void add(SubscriptionDestination destination) {
    Set<String> receivers = of(destination);
    if (destination.getId() != null) {
      byId.put(destination.getId(), receivers);
    }
    unclaimed.merge(receivers, 1, Integer::sum);
  }

  private boolean claim(Set<String> receivers) {
    int left = unclaimed.getOrDefault(receivers, 0);
    boolean claimed = left > 0;
    if (claimed) {
      unclaimed.put(receivers, left - 1);
    }
    return claimed;
  }

  private static Set<String> readBy(SubscriptionDestination destination) {
    Set<String> receivers =
        ChannelResolution.of(destination)
            .channel()
            .map(channel -> channel.configRules().receiversOf(destination))
            .map(SubscriptionAction::getReceivers)
            .orElse(null);
    return receivers == null ? Set.of() : receivers;
  }
}
