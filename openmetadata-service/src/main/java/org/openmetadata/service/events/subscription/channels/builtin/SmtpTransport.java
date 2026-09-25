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

package org.openmetadata.service.events.subscription.channels.builtin;

import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.events.subscription.channels.Transport;
import org.openmetadata.service.notifications.channels.NotificationMessage;
import org.openmetadata.service.notifications.channels.email.EmailMessage;
import org.openmetadata.service.util.email.EmailUtil;

final class SmtpTransport implements Transport {
  @Override
  public void deliver(NotificationMessage message, SubscriptionDestination destination) {
    EmailMessage email = (EmailMessage) message;
    EmailAlertConfig config =
        JsonUtils.convertValue(destination.getConfig(), EmailAlertConfig.class);
    for (String receiver : config.getReceivers()) {
      EmailUtil.sendNotificationEmail(receiver, email.getSubject(), email.getHtmlContent());
    }
  }
}
