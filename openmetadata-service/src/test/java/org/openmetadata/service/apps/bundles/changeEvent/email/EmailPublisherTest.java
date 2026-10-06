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

package org.openmetadata.service.apps.bundles.changeEvent.email;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.EMAIL;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.notifications.NotificationMessageEngine;
import org.openmetadata.service.notifications.channels.email.EmailMessage;
import org.openmetadata.service.notifications.recipients.context.EmailRecipient;
import org.openmetadata.service.util.email.EmailSender;

class EmailPublisherTest {

  @Test
  void sendMessagePropagatesAsyncDeliveryFailure() {
    UUID destinationId = UUID.randomUUID();
    EventSubscription subscription =
        new EventSubscription().withId(UUID.randomUUID()).withName("email-alert");
    SubscriptionDestination destination =
        new SubscriptionDestination()
            .withId(destinationId)
            .withType(EMAIL)
            .withEnabled(true)
            .withConfig(new EmailAlertConfig().withReceivers(Set.of("recipient@example.com")));
    ChangeEvent event = new ChangeEvent().withId(UUID.randomUUID()).withEntityType("table");
    EmailMessage message =
        EmailMessage.builder().subject("subject").htmlContent("<p>body</p>").build();
    NotificationMessageEngine messageEngine = mock(NotificationMessageEngine.class);
    when(messageEngine.generateMessage(event, subscription, destination)).thenReturn(message);

    EmailSender emailSender = mock(EmailSender.class);
    when(emailSender.isEnabled()).thenReturn(true);
    when(emailSender.send("recipient@example.com", "subject", "<p>body</p>"))
        .thenReturn(CompletableFuture.failedFuture(new RuntimeException("SMTP unavailable")));
    EmailPublisher publisher =
        new EmailPublisher(subscription, destination, messageEngine, emailSender);

    EventPublisherException exception =
        assertThrows(
            EventPublisherException.class,
            () ->
                publisher.sendMessage(event, Set.of(new EmailRecipient("recipient@example.com"))));

    assertNotNull(exception.getChangeEventWithSubscription());
    assertEquals(destinationId, exception.getChangeEventWithSubscription().getLeft());
    assertSame(event, exception.getChangeEventWithSubscription().getRight());
    SubscriptionStatus status = (SubscriptionStatus) destination.getStatusDetails();
    assertEquals(SubscriptionStatus.Status.FAILED, status.getStatus());
    assertNull(status.getLastSuccessfulAt());
    assertEquals("SMTP unavailable", status.getLastFailedReason());
    assertTrue(exception.getMessage().contains("SMTP unavailable"));
    assertFalse(exception.getMessage().contains("CompletionException"));
  }
}
