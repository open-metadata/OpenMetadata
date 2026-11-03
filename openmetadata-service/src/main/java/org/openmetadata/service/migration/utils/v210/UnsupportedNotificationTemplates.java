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

package org.openmetadata.service.migration.utils.v210;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.api.events.NotificationTemplateValidationRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationResponse;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.alerting.content.template.HandlebarsNotificationTemplateProcessor;
import org.openmetadata.service.alerting.content.template.NotificationTemplateProcessor;

/**
 * Names the stored notification templates that use constructs the template sandbox does not offer.
 * They are left as they are: the sandbox already keeps them from rendering those constructs, and
 * only their author can say what they meant. An admin should edit each one.
 * ADR:2026-11-03-user-notification-templates-render-in-a-closed-sandbox
 */
@Slf4j
public final class UnsupportedNotificationTemplates {

  private static final String STORED_TEMPLATES = "SELECT json FROM notification_template_entity";

  private UnsupportedNotificationTemplates() {}

  public static void logForReview(Handle handle) {
    NotificationTemplateProcessor processor = new HandlebarsNotificationTemplateProcessor();
    handle
        .createQuery(STORED_TEMPLATES)
        .map((result, context) -> result.getString("json"))
        .list()
        .stream()
        .map(json -> JsonUtils.readValue(json, NotificationTemplate.class))
        .forEach(template -> logIfUnsupported(processor, template));
  }

  static void logIfUnsupported(
      NotificationTemplateProcessor processor, NotificationTemplate template) {
    NotificationTemplateValidationResponse validation =
        processor.validate(
            new NotificationTemplateValidationRequest()
                .withTemplateBody(template.getTemplateBody())
                .withTemplateSubject(template.getTemplateSubject()));
    if (!Boolean.TRUE.equals(validation.getIsValid())) {
      LOG.warn(
          "Notification template {} uses constructs that notification templates do not support,"
              + " so alerts cannot render it; alerts that chose it render the system template"
              + " instead. Edit it to use it again. Body: {} Subject: {}",
          template.getFullyQualifiedName(),
          validation.getBodyError(),
          validation.getSubjectError());
    }
  }
}
