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

package org.openmetadata.service.alerting.channel.email;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.EMAIL;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.alerting.audience.EmailRecipient;
import org.openmetadata.service.alerting.channel.SendStatus;
import org.openmetadata.service.alerting.content.HandlebarsNotificationMessageEngine;
import org.openmetadata.service.events.consumer.AlertingSettings;
import org.openmetadata.service.events.consumer.EventPublisherException;
import org.openmetadata.service.util.email.EmailSender;

@Isolated
class EmailPublisherTest {
  private static final String RECIPIENT = "recipient@example.com";
  private static final String OTHER_RECIPIENT = "other@example.com";
  private static final String SMTP_FAILURE = "550 mailbox unavailable";
  private static final EmailMessage MESSAGE =
      EmailMessage.builder().subject("subject").htmlContent("<p>body</p>").build();

  private final SubscriptionDestination destination =
      new SubscriptionDestination().withId(UUID.randomUUID()).withType(EMAIL).withEnabled(true);
  private final ChangeEvent event =
      new ChangeEvent().withId(UUID.randomUUID()).withEntityType("table");
  private AlertingSettings previous;

  @BeforeEach
  void awaitSmtpOutcome() {
    previous = AlertingSettings.current();
    AlertingSettings.use(previous.withSending(new AlertingSettings.Sending(false, true, 1)));
    SendStatus.take();
  }

  @AfterEach
  void restoreSettings() {
    AlertingSettings.use(previous);
    SendStatus.take();
  }

  @Test
  void sendMessagePropagatesAsyncDeliveryFailure() {
    EmailPublisher publisher = publisher(new RecordingSender(true, Set.of(RECIPIENT)));
    EventPublisherException failure =
        assertThrows(
            EventPublisherException.class,
            () -> publisher.sendMessage(event, Set.of(new EmailRecipient(RECIPIENT))));

    assertEquals(destination.getId(), failure.getChangeEventWithSubscription().getLeft());
    assertSame(event, failure.getChangeEventWithSubscription().getRight());
    SubscriptionStatus status = (SubscriptionStatus) destination.getStatusDetails();
    assertEquals(SubscriptionStatus.Status.FAILED, status.getStatus());
    assertNull(status.getLastSuccessfulAt());
    assertTrue(status.getLastFailedReason().contains(SMTP_FAILURE));
    assertFalse(failure.getMessage().contains("CompletionException"));
  }

  @Test
  void oneFailedMailboxDoesNotSilenceOtherRecipients() {
    RecordingSender sender = new RecordingSender(true, Set.of(RECIPIENT));
    EmailPublisher publisher = publisher(sender);
    assertThrows(
        EventPublisherException.class,
        () ->
            publisher.sendMessage(
                event, Set.of(new EmailRecipient(RECIPIENT), new EmailRecipient(OTHER_RECIPIENT))));
    assertEquals(Set.of(RECIPIENT, OTHER_RECIPIENT), Set.copyOf(sender.delivered));
    assertEquals(
        SubscriptionStatus.Status.FAILED,
        ((SubscriptionStatus) destination.getStatusDetails()).getStatus());
  }

  @Test
  void successfulSmtpDeliveryRecordsSuccess() throws EventPublisherException {
    publisher(new RecordingSender(true, Set.of()))
        .sendMessage(event, Set.of(new EmailRecipient(RECIPIENT)));
    SubscriptionStatus status = (SubscriptionStatus) destination.getStatusDetails();
    assertEquals(SubscriptionStatus.Status.ACTIVE, status.getStatus());
    assertNotNull(status.getLastSuccessfulAt());
  }

  @Test
  void sendToPropagatesSmtpFailureBeforeRecordingSuccess() {
    EmailPublisher publisher = publisher(new RecordingSender(true, Set.of(RECIPIENT)));
    EventPublisherException failure =
        assertThrows(
            EventPublisherException.class,
            () -> publisher.sendTo(MESSAGE, new EmailRecipient(RECIPIENT)));
    assertTrue(failure.getMessage().contains(SMTP_FAILURE));
    assertNull(destination.getStatusDetails());
    assertNull(SendStatus.take());
  }

  @Test
  void sendToRecordsSuccessfulSmtpOutcome() throws EventPublisherException {
    publisher(new RecordingSender(true, Set.of())).sendTo(MESSAGE, new EmailRecipient(RECIPIENT));
    assertEquals(
        SubscriptionStatus.Status.ACTIVE,
        ((SubscriptionStatus) destination.getStatusDetails()).getStatus());
  }

  @Test
  void disabledSmtpDoesNotRecordSuccess() throws EventPublisherException {
    RecordingSender sender = new RecordingSender(false, Set.of());
    publisher(sender).sendMessage(event, Set.of(new EmailRecipient(RECIPIENT)));
    assertTrue(sender.delivered.isEmpty());
    assertNull(destination.getStatusDetails());
  }

  @Test
  void disabledOutcomeWaitingPreservesConfiguredFireAndForget() throws EventPublisherException {
    AlertingSettings.use(previous.withSending(AlertingSettings.Sending.AS_BEFORE));
    publisher(new RecordingSender(true, Set.of(RECIPIENT)))
        .sendMessage(event, Set.of(new EmailRecipient(RECIPIENT)));
    assertEquals(
        SubscriptionStatus.Status.ACTIVE,
        ((SubscriptionStatus) destination.getStatusDetails()).getStatus());
  }

  private EmailPublisher publisher(EmailSender sender) {
    return new EmailPublisher(
        new EventSubscription().withId(UUID.randomUUID()).withName("email-alert"),
        destination,
        new EmailAlertConfig().withReceivers(Set.of(RECIPIENT)),
        new EmailPublisher.Dependencies(
            new HandlebarsNotificationMessageEngine(null), new EmailHtmlRenderer(), sender)) {
      @Override
      public EmailMessage prepare(ChangeEvent ignored) {
        return MESSAGE;
      }
    };
  }

  private static final class RecordingSender implements EmailSender {
    private final boolean enabled;
    private final Set<String> rejected;
    private final List<String> delivered = new ArrayList<>();

    private RecordingSender(boolean enabled, Set<String> rejected) {
      this.enabled = enabled;
      this.rejected = rejected;
    }

    @Override
    public boolean isEnabled() {
      return enabled;
    }

    @Override
    public CompletableFuture<Void> send(String to, String subject, String htmlContent) {
      delivered.add(to);
      return rejected.contains(to)
          ? CompletableFuture.failedFuture(new IllegalStateException(SMTP_FAILURE))
          : CompletableFuture.completedFuture(null);
    }
  }
}
