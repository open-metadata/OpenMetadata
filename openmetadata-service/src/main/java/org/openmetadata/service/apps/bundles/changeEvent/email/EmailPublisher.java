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
import org.openmetadata.service.notifications.channels.NotificationMessage;
import org.openmetadata.service.notifications.channels.email.EmailMessage;
import org.openmetadata.service.notifications.recipients.context.EmailRecipient;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.util.email.EmailUtil;

@Slf4j
public class EmailPublisher implements Destination<ChangeEvent> {
  private final HandlebarsNotificationMessageEngine messageEngine;
  private final EmailAlertConfig emailAlertConfig;

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
    } else {
      throw new IllegalArgumentException("Email Alert Invoked with Illegal Type and Settings.");
    }
  }

  @Override
  public void sendMessage(ChangeEvent event, Set<Recipient> recipients)
      throws EventPublisherException {
    try {
      // Generate message using Handlebars
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

      // Send email to each recipient
      for (String receiver : receivers) {
        EmailUtil.sendNotificationEmail(
            receiver, emailMessage.getSubject(), emailMessage.getHtmlContent());
      }

      setSuccessStatus(System.currentTimeMillis());
    } catch (Exception e) {
      setErrorStatus(System.currentTimeMillis(), 500, e.getMessage());
      String message =
          CatalogExceptionMessage.eventPublisherFailedToPublish(EMAIL, event, e.getMessage());
      LOG.error(message);
      throw new EventPublisherException(
          CatalogExceptionMessage.eventPublisherFailedToPublish(EMAIL, e.getMessage()),
          Pair.of(subscriptionDestination.getId(), event));
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
}
