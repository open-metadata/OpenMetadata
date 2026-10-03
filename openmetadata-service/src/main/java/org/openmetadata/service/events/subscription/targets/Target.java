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
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.service.notifications.recipients.context.Recipient;

/**
 * What a message is sent to: one address, reached once per event however many destinations lead
 * to it. The destination that produced it first supplies the configuration it is sent with, and
 * every destination that produced it shares its outcome.
 */
public final class Target {
  private final Object identity;
  private final Recipient recipient;
  private final String name;
  private final List<UUID> origins = new ArrayList<>();

  private Target(Object identity, Recipient recipient, String name, UUID firstOrigin) {
    this.identity = identity;
    this.recipient = recipient;
    this.name = name;
    this.origins.add(firstOrigin);
  }

  static Target of(Recipient recipient, SubscriptionDestination origin) {
    return new Target(recipient.identity(), recipient, recipient.name(), origin.getId());
  }

  /** For a channel that delivers inside the server, whose destination is its own target. */
  static Target ofItself(SubscriptionDestination destination) {
    return new Target(
        destination.getId(), null, destination.getType().value(), destination.getId());
  }

  void alsoProducedBy(SubscriptionDestination destination) {
    if (!origins.contains(destination.getId())) {
      origins.add(destination.getId());
    }
  }

  public Object identity() {
    return identity;
  }

  /** Null for a destination that is its own target. */
  public Recipient recipient() {
    return recipient;
  }

  /** The user or team reached, for a status a person reads. Never an address. */
  public String name() {
    return name;
  }

  /** The destination it is sent through, which is the one that produced it first. */
  public UUID sentThrough() {
    return origins.getFirst();
  }

  public List<UUID> origins() {
    return List.copyOf(origins);
  }
}
