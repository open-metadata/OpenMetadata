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

package org.openmetadata.service.formatter.decorators;

import static org.openmetadata.service.events.subscription.AlertsRuleEvaluator.getEntity;
import static org.openmetadata.service.formatter.util.FormatterUtil.getFormattedMessages;
import static org.openmetadata.service.util.EmailUtil.getSmtpSettings;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.email.EmailMessage;
import org.openmetadata.service.resources.feeds.MessageParser;

public class EmailMessageDecorator implements MessageDecorator<EmailMessage> {
  @Override
  public String getBold() {
    return "<b>%s</b>";
  }

  @Override
  public String getLineBreak() {
    return " <br/> ";
  }

  @Override
  public String getAddMarker() {
    return "<b>";
  }

  @Override
  public String getAddMarkerClose() {
    return "</b>";
  }

  @Override
  public String getRemoveMarker() {
    return "<s>";
  }

  @Override
  public String getRemoveMarkerClose() {
    return "</s>";
  }

  @Override
  public String getEntityUrl(String entityType, String fqn) {
    return String.format(
        "<a href = '%s/%s/%s'>%s</a>", getSmtpSettings().getOpenMetadataUrl(), entityType, fqn.trim(), fqn.trim());
  }

  @Override
  public EmailMessage buildMessage(ChangeEvent event) {
    EmailMessage emailMessage = new EmailMessage();
    emailMessage.setUserName(event.getUserName());
    EntityInterface entityInterface = getEntity(event);
    if (event.getEntity() != null) {
      emailMessage.setUpdatedBy(event.getUserName());
      if (event.getEntityType().equals(Entity.QUERY)) {
        emailMessage.setEntityUrl(Entity.QUERY);
      } else {
        emailMessage.setEntityUrl(this.buildEntityUrl(event.getEntityType(), entityInterface));
      }
    }
    Map<MessageParser.EntityLink, String> messages =
        getFormattedMessages(this, event.getChangeDescription(), entityInterface);
    List<String> changeMessage = new ArrayList<>();
    for (Map.Entry<MessageParser.EntityLink, String> entry : messages.entrySet()) {
      changeMessage.add(entry.getValue());
    }
    emailMessage.setChangeMessage(changeMessage);
    return emailMessage;
  }
}
