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

package org.openmetadata.service.alerting.channel.email;

import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.TestDestinationStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.alerting.audience.EmailRecipient;
import org.openmetadata.service.alerting.audience.Recipient;
import org.openmetadata.service.alerting.channel.Destination;
import org.openmetadata.service.alerting.channel.IsolatedSends;
import org.openmetadata.service.alerting.content.EventContent;
import org.openmetadata.service.alerting.content.HandlebarsNotificationMessageEngine;
import org.openmetadata.service.alerting.content.render.ChannelRenderer;
import org.openmetadata.service.events.consumer.AlertingSettings;
import org.openmetadata.service.events.consumer.EventPublisherException;
import org.openmetadata.service.events.consumer.TickMemory;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;
import org.openmetadata.service.util.email.DefaultEmailSender;
import org.openmetadata.service.util.email.EmailSender;
import org.openmetadata.service.util.email.EmailUtil;

@Slf4j
public class EmailPublisher implements Destination<ChangeEvent> {
  private final HandlebarsNotificationMessageEngine messageEngine;
  private final ChannelRenderer renderer;
  private final EmailAlertConfig emailAlertConfig;
  private final EmailSender emailSender;

  public record Dependencies(
      HandlebarsNotificationMessageEngine messageEngine,
      ChannelRenderer renderer,
      EmailSender emailSender) {}

  @Getter private final SubscriptionDestination subscriptionDestination;
  private final EventSubscription eventSubscription;

  public EmailPublisher(
      EventSubscription eventSubscription,
      SubscriptionDestination subscriptionDestination,
      EmailAlertConfig emailAlertConfig,
      ChannelRenderer renderer) {
    this(
        eventSubscription,
        subscriptionDestination,
        emailAlertConfig,
        new Dependencies(
            new HandlebarsNotificationMessageEngine(
                (NotificationTemplateRepository)
                    Entity.getEntityRepository(Entity.NOTIFICATION_TEMPLATE)),
            renderer,
            new DefaultEmailSender()));
  }

  public EmailPublisher(
      EventSubscription eventSubscription,
      SubscriptionDestination subscriptionDestination,
      EmailAlertConfig emailAlertConfig,
      Dependencies dependencies) {
    this.eventSubscription = eventSubscription;
    this.subscriptionDestination = subscriptionDestination;
    this.emailAlertConfig = emailAlertConfig;
    this.renderer = dependencies.renderer();
    this.messageEngine = dependencies.messageEngine();
    this.emailSender = dependencies.emailSender();
  }

  @Override
  public void sendMessage(ChangeEvent event, Set<Recipient> recipients)
      throws EventPublisherException {
    if (!emailSender.isEnabled()) {
      LOG.debug(
          "Skipping email notification for subscription [{}]: SMTP is not enabled",
          eventSubscription.getName());
      return;
    }
    try {
      EmailMessage emailMessage = prepare(event);

      // Convert type-agnostic Recipient objects to email addresses
      Set<String> receivers =
          recipients.stream()
              .filter(EmailRecipient.class::isInstance)
              .map(EmailRecipient.class::cast)
              .map(EmailRecipient::getEmail)
              .filter(Objects::nonNull)
              .collect(Collectors.toSet());

      IsolatedSends.sendToEach(receivers, this, receiver -> deliverEmail(receiver, emailMessage));

      setSuccessStatus(System.currentTimeMillis());
    } catch (RuntimeException | EventPublisherException e) {
      throw deliveryFailure(event, e);
    }
  }

  private EventPublisherException deliveryFailure(ChangeEvent event, Exception failure) {
    String reason = failure.getMessage();
    setErrorStatus(System.currentTimeMillis(), 500, reason);
    LOG.error(
        CatalogExceptionMessage.eventPublisherFailedToPublish(
            subscriptionDestination.getType(), event, reason));
    return new EventPublisherException(
        CatalogExceptionMessage.eventPublisherFailedToPublish(
            subscriptionDestination.getType(), reason),
        Pair.of(subscriptionDestination.getId(), event));
  }

  private void deliverEmail(String receiver, EmailMessage message) throws EventPublisherException {
    CompletableFuture<Void> outcome =
        emailSender.send(receiver, message.getSubject(), message.getHtmlContent());
    if (AlertingSettings.current().sending().awaitEmailOutcome()) {
      EmailOutcome.await(outcome, TickMemory.timeLeft());
    }
  }

  // Rendered once for an event, whatever the number of mailboxes it is sent to.
  @Override
  public EmailMessage prepare(ChangeEvent event) {
    return prepare(event, new EventContent(event, eventSubscription));
  }

  @Override
  public EmailMessage prepare(ChangeEvent event, EventContent content) {
    return (EmailMessage) messageEngine.format(content.by(messageEngine), renderer);
  }

  @Override
  public void sendTo(Object prepared, Recipient recipient) throws EventPublisherException {
    if (recipient instanceof EmailRecipient mailbox) {
      deliverEmail(mailbox.getEmail(), (EmailMessage) prepared);
      setSuccessStatus(System.currentTimeMillis());
    }
  }

  @Override
  public void sendTestMessage() throws EventPublisherException {
    try {
      Set<String> receivers = emailAlertConfig.getReceivers();
      EmailUtil.testConnection();

      for (String email : receivers) {
        EmailUtil.sendTestEmail(email, false);
      }
      setSuccessStatus(System.currentTimeMillis());
      this.setStatusForTestDestination(
          TestDestinationStatus.Status.SUCCESS, 200, System.currentTimeMillis());
    } catch (Exception e) {
      this.setStatusForTestDestination(
          TestDestinationStatus.Status.FAILED, 500, System.currentTimeMillis());
      String message =
          CatalogExceptionMessage.eventPublisherFailedToPublish(
              subscriptionDestination.getType(), e.getMessage());
      LOG.error(message);
      throw new EventPublisherException(message);
    }
  }

  @Override
  public EventSubscription getEventSubscriptionForDestination() {
    return eventSubscription;
  }

  @Override
  public boolean getEnabled() {
    return subscriptionDestination.getEnabled();
  }

  public void close() {
    LOG.debug("Email Publisher Stopped");
  }
}
