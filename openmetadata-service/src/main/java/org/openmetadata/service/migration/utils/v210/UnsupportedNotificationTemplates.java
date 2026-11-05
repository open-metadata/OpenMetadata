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

import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.api.events.NotificationTemplateValidationRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationResponse;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.alerting.content.template.HandlebarsNotificationTemplateProcessor;
import org.openmetadata.service.alerting.content.template.NotificationTemplateProcessor;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;

/**
 * Handles the stored notification templates that use constructs the template sandbox does not
 * offer. A system template is the last template an alert can fall back to, so one that cannot
 * render is reset to its packaged default, as the Reset action does; the edit stays in the
 * template's version history. A user template is left as it is and named in the log: alerts that
 * chose it render the system template until its author edits it.
 * ADR:2026-11-03-user-notification-templates-render-in-a-closed-sandbox
 */
@Slf4j
public final class UnsupportedNotificationTemplates {

  private static final String STORED_TEMPLATES = "SELECT json FROM notification_template_entity";

  private final NotificationTemplateProcessor processor;
  private final Consumer<NotificationTemplate> resetToDefault;

  UnsupportedNotificationTemplates(
      NotificationTemplateProcessor processor, Consumer<NotificationTemplate> resetToDefault) {
    this.processor = processor;
    this.resetToDefault = resetToDefault;
  }

  public static void review(Handle handle) {
    UnsupportedNotificationTemplates templates =
        new UnsupportedNotificationTemplates(
            new HandlebarsNotificationTemplateProcessor(),
            UnsupportedNotificationTemplates::resetStoredTemplate);
    handle
        .createQuery(STORED_TEMPLATES)
        .map((result, context) -> result.getString("json"))
        .list()
        .forEach(json -> templates.review(JsonUtils.readValue(json, NotificationTemplate.class)));
  }

  // The repository is looked up only when a template has to be reset.
  private static void resetStoredTemplate(NotificationTemplate stored) {
    NotificationTemplateRepository repository =
        (NotificationTemplateRepository) Entity.getEntityRepository(Entity.NOTIFICATION_TEMPLATE);
    repository.resetToDefault(repository.get(null, stored.getId(), repository.getFields("*")));
  }

  void review(NotificationTemplate template) {
    NotificationTemplateValidationResponse validation = validate(template);
    boolean isSupported = Boolean.TRUE.equals(validation.getIsValid());
    boolean isSystemTemplate = ProviderType.SYSTEM.equals(template.getProvider());
    if (!isSupported && isSystemTemplate) {
      resetSystemTemplate(template, validation);
    }
    if (!isSupported && !isSystemTemplate) {
      LOG.warn(
          "Notification template {} uses constructs that notification templates do not support,"
              + " so alerts cannot render it; alerts that chose it render the system template"
              + " instead. Edit it to use it again. Body: {} Subject: {}",
          template.getFullyQualifiedName(),
          validation.getBodyError(),
          validation.getSubjectError());
    }
  }

  private void resetSystemTemplate(
      NotificationTemplate template, NotificationTemplateValidationResponse validation) {
    try {
      resetToDefault.accept(template);
      LOG.warn(
          "System notification template {} used constructs that notification templates do not"
              + " support, so it was reset to its default; the edited version is kept in its"
              + " version history. Body: {} Subject: {}",
          template.getFullyQualifiedName(),
          validation.getBodyError(),
          validation.getSubjectError());
    } catch (IllegalArgumentException e) {
      LOG.error(
          "System notification template {} uses constructs that notification templates do not"
              + " support and could not be reset to its default: {}. Edit it to use it again.",
          template.getFullyQualifiedName(),
          e.getMessage());
    }
  }

  private NotificationTemplateValidationResponse validate(NotificationTemplate template) {
    return processor.validate(
        new NotificationTemplateValidationRequest()
            .withTemplateBody(template.getTemplateBody())
            .withTemplateSubject(template.getTemplateSubject()));
  }
}
