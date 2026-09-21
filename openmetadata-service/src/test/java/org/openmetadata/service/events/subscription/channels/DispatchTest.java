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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.apps.bundles.changeEvent.AlertFactory;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.channels.builtin.BuiltInChannels;

class DispatchTest {
  private final EventSubscription alert = new EventSubscription().withId(UUID.randomUUID());
  private final SubscriptionDestination destination =
      BuiltInChannels.previewDestination().withId(UUID.randomUUID()).withEnabled(true);
  private final String type = destination.getType().value();

  @BeforeEach
  void forgetWhatWasSent() {
    RecordingChannels.SENT.clear();
  }

  @Test
  void typeDecidesWhenNothingIsDeclared() {
    ChannelResolution served = ChannelResolution.of(destination, Map.of());

    assertEquals(type, served.channelId());
    assertTrue(served.channel().isPresent());
  }

  @Test
  void declaredChannelServesItsType() throws EventPublisherException {
    ChangeEvent event = new ChangeEvent().withId(UUID.randomUUID());
    Map<String, String> declared = Map.of(type, RecordingChannels.ID);

    Destination<ChangeEvent> publisher = AlertFactory.getAlert(alert, destination, declared);
    publisher.sendMessage(event, Set.of());

    assertEquals(RecordingChannels.ID, ChannelResolution.of(destination, declared).channelId());
    assertEquals(1, RecordingChannels.SENT.size());
    assertEquals(event.getId(), RecordingChannels.SENT.getFirst().getId());
  }

  // A destination meant for one channel must never go out through the channel of its type.
  @Test
  void declaredChannelThatIsNotRegisteredIsNotAttempted() throws EventPublisherException {
    Map<String, String> declared = Map.of(type, "not.registered.here");

    ChannelResolution served = ChannelResolution.of(destination, declared);
    Destination<ChangeEvent> publisher = AlertFactory.getAlert(alert, destination, declared);
    publisher.sendMessage(new ChangeEvent().withId(UUID.randomUUID()), Set.of());

    assertTrue(served.channel().isEmpty());
    assertFalse(publisher.requiresRecipients());
    assertTrue(RecordingChannels.SENT.isEmpty());
    assertThrows(EventPublisherException.class, publisher::sendTestMessage);
  }
}
