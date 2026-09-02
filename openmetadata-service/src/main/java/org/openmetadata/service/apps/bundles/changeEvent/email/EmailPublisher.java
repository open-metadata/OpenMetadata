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

package org.openmetadata.service.apps.bundles.changeEvent.email;

import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.EMAIL;

import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.TestDestinationStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;
import org.openmetadata.service.notifications.HandlebarsNotificationMessageEngine;
import org.openmetadata.service.notifications.NotificationMessageEngine;
import org.openmetadata.service.notifications.channels.NotificationMessage;
import org.openmetadata.service.notifications.channels.email.EmailMessage;
import org.openmetadata.service.notifications.recipients.context.EmailRecipient;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.util.email.EmailUtil;

@Slf4j
public class EmailPublisher implements Destination<ChangeEvent> {
  private final NotificationMessageEngine messageEngine;
  private final EmailAlertConfig emailAlertConfig;
  private final EmailSender emailSender;

  @Getter private final SubscriptionDestination subscriptionDestination;
  private final EventSubscription eventSubscription;

  public EmailPublisher(
      EventSubscription eventSubscription, SubscriptionDestination subscriptionDestination) {
    if (subscriptionDestination.getType() == EMAIL) {
      this.eventSubscription = eventSubscription;
      this.subscriptionDestination = subscriptionDestination;
      this.emailAlertConfig =
          JsonUtils.convertValue(subscriptionDestination.getConfig(), EmailAlertConfig.class);
      this.messageEngine =
          new HandlebarsNotificationMessageEngine(
              (NotificationTemplateRepository)
                  Entity.getEntityRepository(Entity.NOTIFICATION_TEMPLATE));
      this.emailSender = new DefaultEmailSender();
    } else {
      throw new IllegalArgumentException("Email Alert Invoked with Illegal Type and Settings.");
    }
  }

  EmailPublisher(
      EventSubscription eventSubscription,
      SubscriptionDestination subscriptionDestination,
      NotificationMessageEngine messageEngine,
      EmailSender emailSender) {
    if (subscriptionDestination.getType() == EMAIL) {
      this.eventSubscription = eventSubscription;
      this.subscriptionDestination = subscriptionDestination;
      this.emailAlertConfig =
          JsonUtils.convertValue(subscriptionDestination.getConfig(), EmailAlertConfig.class);
      this.messageEngine = messageEngine;
      this.emailSender = emailSender;
    } else {
      throw new IllegalArgumentException("Email Alert Invoked with Illegal Type and Settings.");
    }
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
      NotificationMessage message =
          messageEngine.generateMessage(event, eventSubscription, subscriptionDestination);
      EmailMessage emailMessage = (EmailMessage) message;

      // Convert type-agnostic Recipient objects to email addresses
      Set<String> receivers =
          recipients.stream()
              .filter(EmailRecipient.class::isInstance)
              .map(EmailRecipient.class::cast)
              .map(EmailRecipient::getEmail)
              .filter(Objects::nonNull)
              .collect(Collectors.toSet());

      CompletableFuture<?>[] deliveryFutures =
          receivers.stream()
              .map(
                  receiver ->
                      emailSender.send(
                          receiver, emailMessage.getSubject(), emailMessage.getHtmlContent()))
              .toArray(CompletableFuture<?>[]::new);

      CompletableFuture.allOf(deliveryFutures).join();

      setSuccessStatus(System.currentTimeMillis());
    } catch (RuntimeException e) {
      String failureReason = getFailureReason(e);
      setErrorStatus(System.currentTimeMillis(), 500, failureReason);
      String message =
          CatalogExceptionMessage.eventPublisherFailedToPublish(EMAIL, event, failureReason);
      LOG.error(message);
      throw new EventPublisherException(
          CatalogExceptionMessage.eventPublisherFailedToPublish(EMAIL, failureReason),
          Pair.of(subscriptionDestination.getId(), event));
    }
  }

  private static String getFailureReason(RuntimeException exception) {
    Throwable failure = exception;
    while (failure instanceof CompletionException && failure.getCause() != null) {
      failure = failure.getCause();
    }
    String message = failure.getMessage();
    return message == null || message.isBlank() ? failure.getClass().getSimpleName() : message;
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
      String message = CatalogExceptionMessage.eventPublisherFailedToPublish(EMAIL, e.getMessage());
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

  interface EmailSender {
    boolean isEnabled();

    CompletableFuture<Void> send(String to, String subject, String htmlContent);
  }

  private static final class DefaultEmailSender implements EmailSender {
    @Override
    public boolean isEnabled() {
      return Boolean.TRUE.equals(EmailUtil.getSmtpSettings().getEnableSmtpServer());
    }

    @Override
    public CompletableFuture<Void> send(String to, String subject, String htmlContent) {
      return EmailUtil.sendNotificationEmailAsync(to, subject, htmlContent);
    }
  }
}
