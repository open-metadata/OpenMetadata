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
import static org.openmetadata.service.util.SubscriptionUtil.getTargetsForAlert;

import java.util.Set;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.formatter.decorators.EmailMessageDecorator;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.EmailUtil;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class EmailPublisher implements Destination<ChangeEvent> {
  private final MessageDecorator<EmailMessage> emailDecorator = new EmailMessageDecorator();
  private final EmailAlertConfig emailAlertConfig;
  private final CollectionDAO daoCollection;

  @Getter private final SubscriptionDestination subscriptionDestination;

  public EmailPublisher(SubscriptionDestination subscription) {
    if (subscription.getType() == EMAIL) {
      this.subscriptionDestination = subscription;
      this.emailAlertConfig =
          JsonUtils.convertValue(subscription.getConfig(), EmailAlertConfig.class);
      this.daoCollection = Entity.getCollectionDAO();
    } else {
      throw new IllegalArgumentException("Email Alert Invoked with Illegal Type and Settings.");
    }
  }

  @Override
  public void sendMessage(ChangeEvent event) throws EventPublisherException {
    try {
      Set<String> receivers =
          getTargetsForAlert(emailAlertConfig, subscriptionDestination.getCategory(), EMAIL, event);
      EmailMessage emailMessage = emailDecorator.buildOutgoingMessage(event);
      for (String email : receivers) {
        EmailUtil.sendChangeEventMail(email, emailMessage);
      }
      setSuccessStatus(System.currentTimeMillis());
    } catch (Exception e) {
      setErrorStatus(System.currentTimeMillis(), 500, e.getMessage());
      String message =
          CatalogExceptionMessage.eventPublisherFailedToPublish(EMAIL, event, e.getMessage());
      LOG.error(message);
      throw new EventPublisherException(message, Pair.of(subscriptionDestination.getId(), event));
    }
  }

  @Override
  public boolean getEnabled() {
    return subscriptionDestination.getEnabled();
  }

  public void close() {
    LOG.debug("Email Publisher Stopped");
  }
}
