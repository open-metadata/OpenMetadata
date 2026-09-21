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

package org.openmetadata.service.events.subscription.targets;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiFunction;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.notifications.recipients.context.Recipient;

/**
 * Turns the destinations of one channel into the targets of one event. It walks destinations in
 * the order the alert declares them, so two candidates with one identity are one target, sent
 * with what the first of them was configured with. Sending walks targets, never destinations, so
 * there is no loop in which to send twice.
 */
@Slf4j
public final class TargetResolver {
  /** @param failedLookups why a destination's recipients could not be looked up, by destination */
  public record Resolved(List<Target> targets, Map<UUID, String> failedLookups) {}

  private final BiFunction<ChangeEvent, SubscriptionDestination, ? extends Iterable<Recipient>>
      recipientsOf;

  public TargetResolver(
      BiFunction<ChangeEvent, SubscriptionDestination, ? extends Iterable<Recipient>>
          recipientsOf) {
    this.recipientsOf = recipientsOf;
  }

  public Resolved resolve(ChangeEvent event, List<SubscriptionDestination> ofOneChannel) {
    Map<Object, Target> targets = new LinkedHashMap<>();
    Map<UUID, String> failedLookups = new LinkedHashMap<>();
    for (SubscriptionDestination destination : ofOneChannel) {
      if (!Boolean.FALSE.equals(destination.getEnabled())) {
        addTargetsOf(event, destination, targets, failedLookups);
      }
    }
    return new Resolved(List.copyOf(targets.values()), Map.copyOf(failedLookups));
  }

  /** For a channel whose destinations are their own targets. */
  public static Resolved themselves(List<SubscriptionDestination> ofOneChannel) {
    List<Target> targets =
        ofOneChannel.stream()
            .filter(destination -> !Boolean.FALSE.equals(destination.getEnabled()))
            .map(Target::ofItself)
            .toList();
    return new Resolved(targets, Map.of());
  }

  private void addTargetsOf(
      ChangeEvent event,
      SubscriptionDestination destination,
      Map<Object, Target> targets,
      Map<UUID, String> failedLookups) {
    try {
      for (Recipient recipient : inAStableOrder(recipientsOf.apply(event, destination))) {
        Target known = targets.get(recipient.identity());
        if (known == null) {
          targets.put(recipient.identity(), Target.of(recipient, destination));
        } else {
          known.alsoProducedBy(destination);
        }
      }
    } catch (RuntimeException e) {
      LOG.warn("Recipients of destination {} could not be looked up", destination.getId(), e);
      failedLookups.put(destination.getId(), String.valueOf(e.getMessage()));
    }
  }

  // Resolvers answer with sets, and a tick must send in the same order every time it runs.
  private static List<Recipient> inAStableOrder(Iterable<Recipient> recipients) {
    List<Recipient> ordered = new ArrayList<>();
    recipients.forEach(ordered::add);
    ordered.sort(Comparator.comparing(recipient -> recipient.identity().toString()));
    return ordered;
  }
}
