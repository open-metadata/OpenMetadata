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

package org.openmetadata.service.apps.bundles.changeEvent.generic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.Response;
import java.net.URI;
import java.util.Set;
import java.util.UUID;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.notifications.recipients.context.WebhookRecipient;

class GenericPublisherTest {

  @Test
  void sendMessageAttachesChangeEventWhenWebhookDeliveryFails() throws Exception {
    UUID destinationId = UUID.randomUUID();
    Webhook webhook = new Webhook().withEndpoint(URI.create("https://hooks.example.com/dead"));
    SubscriptionDestination destination =
        new SubscriptionDestination()
            .withId(destinationId)
            .withType(WEBHOOK)
            .withTimeout(10)
            .withReadTimeout(12)
            .withEnabled(true)
            .withConfig(webhook);
    EventSubscription eventSubscription =
        new EventSubscription().withId(UUID.randomUUID()).withName("test-alert");
    ChangeEvent event = new ChangeEvent().withId(UUID.randomUUID()).withEntityType("table");

    Response.StatusType statusInfo = mock(Response.StatusType.class);
    when(statusInfo.getReasonPhrase()).thenReturn("Not Found");
    Response response = mock(Response.class);
    when(response.getStatus()).thenReturn(404);
    when(response.getStatusInfo()).thenReturn(statusInfo);
    when(response.getStringHeaders()).thenReturn(new MultivaluedHashMap<>());
    when(response.hasEntity()).thenReturn(false);
    when(response.getMediaType()).thenReturn(null);

    Invocation.Builder builder = mock(Invocation.Builder.class);
    when(builder.post(any())).thenReturn(response);
    WebhookRecipient recipient = mock(WebhookRecipient.class);
    when(recipient.getConfiguredRequest(any(), any())).thenReturn(builder);

    GenericPublisher publisher = new GenericPublisher(eventSubscription, destination);

    EventPublisherException exception =
        assertThrows(
            EventPublisherException.class, () -> publisher.sendMessage(event, Set.of(recipient)));

    // Without the pair, AbstractEventConsumer.handleFailedEvent bails out and never records the
    // failed event (logging "Change Event with Subscription is null ...").
    Pair<UUID, ChangeEvent> changeEventWithSubscription =
        exception.getChangeEventWithSubscription();
    assertNotNull(changeEventWithSubscription);
    assertEquals(destinationId, changeEventWithSubscription.getLeft());
    assertSame(event, changeEventWithSubscription.getRight());
  }
}
