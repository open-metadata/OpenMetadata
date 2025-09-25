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

package org.openmetadata.service.notifications.decorator;

import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.notifications.template.NotificationTemplateProcessor;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsNotificationTemplateProcessor;
import org.openmetadata.service.util.SeedDataPathResolver;
import org.openmetadata.service.util.email.EmailUtil;

/**
 * Email-specific decorator that adds HTML envelope wrapping.
 * Only applied to email channel, other channels bypass decoration.
 */
@Slf4j
public class EmailNotificationMessageDecorator implements NotificationMessageDecorator {

  private final NotificationTemplate emailEnvelope;
  private final NotificationTemplateProcessor templateProcessor;

  public EmailNotificationMessageDecorator() {
    this.emailEnvelope = loadEmailEnvelopeFromResources();
    this.templateProcessor = new HandlebarsNotificationTemplateProcessor();
  }

  private NotificationTemplate loadEmailEnvelopeFromResources() {
    // Use SPI to determine the path for email envelope
    String envelopePath = SeedDataPathResolver.resolveEmailEnvelopePath();

    try {
      // Load the specific envelope file (similar to how EntityRepository loads seed data)
      String json =
          CommonUtil.getResourceAsStream(
              EmailNotificationMessageDecorator.class.getClassLoader(), envelopePath);

      return JsonUtils.readValue(json, NotificationTemplate.class);
    } catch (Exception e) {
      LOG.warn(
          "Could not load email envelope from {}, emails will be sent without wrapper",
          envelopePath,
          e);
      return null;
    }
  }

  @Override
  public String decorate(String htmlContent, String subject, ChangeEvent event) {
    // If no envelope available, return content as-is
    if (emailEnvelope == null) {
      return htmlContent;
    }

    Map<String, Object> envelopeContext = new HashMap<>();

    // Hardcode logo URL for OpenMetadata (can be overridden by commercial version)
    envelopeContext.put("logoUrl", "https://i.imgur.com/7fn1VBe.png");
    envelopeContext.put("content", htmlContent);

    // Get organization name from SMTP settings
    String organizationName = EmailUtil.getSmtpSettings().getEmailingEntity();
    envelopeContext.put("organizationName", organizationName);

    // Process the envelope template with the content
    return templateProcessor.process(emailEnvelope.getTemplateBody(), envelopeContext);
  }
}
