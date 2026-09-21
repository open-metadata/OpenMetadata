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

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.notifications.channels.ChannelRenderer;
import org.openmetadata.service.notifications.recipients.context.Recipient;

/** A channel found through the service loader, as one from another module would be. */
public final class RecordingChannels implements ChannelProvider {
  public static final String ID = "test.recording";
  public static final List<ChangeEvent> SENT = new CopyOnWriteArrayList<>();

  @Override
  public List<Channel> channels() {
    return List.of(new RecordingChannel());
  }

  private static final class RecordingChannel implements Channel {
    @Override
    public String id() {
      return ID;
    }

    @Override
    public Optional<ChannelRenderer> newRenderer() {
      return Optional.empty();
    }

    @Override
    public Optional<Transport> transport() {
      return Optional.empty();
    }

    @Override
    public AddressDirectory directory() {
      return AddressDirectory.NONE;
    }

    @Override
    public ConfigRules configRules() {
      throw new UnsupportedOperationException();
    }

    @Override
    public Destination<ChangeEvent> publisher(
        EventSubscription alert, SubscriptionDestination destination) {
      return new RecordingPublisher(alert, destination);
    }
  }

  private record RecordingPublisher(EventSubscription alert, SubscriptionDestination destination)
      implements Destination<ChangeEvent> {
    @Override
    public void sendMessage(ChangeEvent event, Set<Recipient> recipients) {
      SENT.add(event);
    }

    @Override
    public void sendTestMessage() {}

    @Override
    public boolean requiresRecipients() {
      return false;
    }

    @Override
    public SubscriptionDestination getSubscriptionDestination() {
      return destination;
    }

    @Override
    public EventSubscription getEventSubscriptionForDestination() {
      return alert;
    }

    @Override
    public void close() {}

    @Override
    public boolean getEnabled() {
      return true;
    }
  }
}
