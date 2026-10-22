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

package org.openmetadata.service.events.consumer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.EMAIL;

import java.time.Duration;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.alerting.audience.EmailRecipient;
import org.openmetadata.service.alerting.channel.SendStatus;
import org.openmetadata.service.alerting.channel.email.EmailHtmlRenderer;
import org.openmetadata.service.alerting.channel.email.EmailMessage;
import org.openmetadata.service.alerting.channel.email.EmailPublisher;
import org.openmetadata.service.alerting.content.HandlebarsNotificationMessageEngine;
import org.openmetadata.service.config.AlertingConfiguration;
import org.openmetadata.service.util.email.EmailSender;

@Isolated
class EmailPublisherTickBudgetTest {
  private static final String RECIPIENT = "recipient@example.com";
  private static final EmailMessage MESSAGE =
      EmailMessage.builder().subject("subject").htmlContent("<p>body</p>").build();
  private final SubscriptionDestination destination =
      new SubscriptionDestination().withId(UUID.randomUUID()).withType(EMAIL).withEnabled(true);
  private AlertingSettings previous;

  @BeforeEach
  void beginNearTheEndOfATick() {
    previous = AlertingSettings.current();
    AlertingSettings.use(AlertingSettings.from(new AlertingConfiguration()));
    AtomicLong nanos = new AtomicLong();
    TickMemory.begin(new TickStopSignal(Duration.ofSeconds(60), nanos::get));
    nanos.set(Duration.ofSeconds(59).toNanos());
    SendStatus.take();
  }

  @AfterEach
  void restoreSettings() {
    TickMemory.end();
    SendStatus.take();
    AlertingSettings.use(previous);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  @Timeout(5)
  void pendingSmtpDeliveryFailsWithinTheRemainingTickBudget(boolean singleRecipient) {
    CompletableFuture<Void> outcome = new CompletableFuture<>();
    EmailPublisher publisher = publisher(outcome);
    ChangeEvent event = new ChangeEvent().withId(UUID.randomUUID()).withEntityType("table");
    EventPublisherException failure =
        assertThrows(
            EventPublisherException.class,
            () -> {
              if (singleRecipient) {
                publisher.sendTo(MESSAGE, new EmailRecipient(RECIPIENT));
              } else {
                publisher.sendMessage(event, Set.of(new EmailRecipient(RECIPIENT)));
              }
            });
    assertTrue(failure.getMessage().contains("did not answer within 1 seconds"));
    assertNoSuccess(singleRecipient);
    outcome.complete(null);
    assertNoSuccess(singleRecipient);
  }

  private void assertNoSuccess(boolean singleRecipient) {
    SubscriptionStatus sendStatus = SendStatus.take();
    if (sendStatus != null) {
      assertEquals(SubscriptionStatus.Status.FAILED, sendStatus.getStatus());
      assertNull(sendStatus.getLastSuccessfulAt());
    }
    if (singleRecipient) {
      assertNull(destination.getStatusDetails());
    } else {
      SubscriptionStatus status = (SubscriptionStatus) destination.getStatusDetails();
      assertEquals(SubscriptionStatus.Status.FAILED, status.getStatus());
      assertNull(status.getLastSuccessfulAt());
    }
  }

  private EmailPublisher publisher(CompletableFuture<Void> outcome) {
    EmailSender sender =
        new EmailSender() {
          @Override
          public boolean isEnabled() {
            return true;
          }

          @Override
          public CompletableFuture<Void> send(String to, String subject, String htmlContent) {
            return outcome;
          }
        };
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
}
