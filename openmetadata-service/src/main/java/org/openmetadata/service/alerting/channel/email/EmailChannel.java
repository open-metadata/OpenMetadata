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

import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.EMAIL;

import org.openmetadata.service.alerting.channel.Channel;
import org.openmetadata.service.alerting.channel.ComposedChannel;

/** Mail to people and teams, rendered as HTML and sent through the configured mail server. */
public final class EmailChannel {
  public static final String ID = EMAIL.value();

  private EmailChannel() {}

  public static Channel create() {
    return new ComposedChannel(
        ID,
        EmailHtmlRenderer::new,
        new SmtpTransport(),
        new Mailboxes(),
        new EmailConfigRules(),
        (alert, destination, renderer) ->
            new EmailPublisher(alert, destination, EmailConfigRules.stored(destination), renderer));
  }
}
