/*
 *  Copyright 2024 Collate
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
package org.openmetadata.service.notifications;

import java.util.List;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;
import org.openmetadata.service.notifications.messages.NotificationMessage;
import org.openmetadata.service.notifications.pipeline.NotificationChannelPipeline;
import org.openmetadata.service.notifications.pipeline.NotificationPipelineContext;
import org.openmetadata.service.notifications.pipeline.NotificationPipelineStep;

/**
 * Modified HandlebarsNotificationMessageEngine using pipeline architecture.
 */
public class HandlebarsNotificationMessageEngine implements NotificationMessageEngine {

  private final NotificationTemplateRepository templateRepository;
  private final List<NotificationPipelineStep> pipeline;

  public HandlebarsNotificationMessageEngine(
      NotificationTemplateRepository templateRepository, List<NotificationPipelineStep> pipeline) {
    this.templateRepository = templateRepository;
    this.pipeline = pipeline;
  }

  /**
   * Factory method to create engine for specific channel
   */
  public static HandlebarsNotificationMessageEngine createForChannel(
      NotificationTemplateRepository templateRepository,
      NotificationChannelPipeline channelPipeline) {

    return new HandlebarsNotificationMessageEngine(
        templateRepository, channelPipeline.buildPipeline());
  }

  @Override
  public NotificationMessage generateMessage(ChangeEvent event, EventSubscription subscription) {

    NotificationTemplate template = resolveTemplate(event, subscription);
    if (template == null) {
      throw new IllegalStateException("No template found for event type " + event.getEventType());
    }

    return processEvent(event, template);
  }

  private NotificationMessage processEvent(ChangeEvent event, NotificationTemplate template) {
    // Create deep copy of event to avoid modifying the original
    ChangeEvent eventCopy = JsonUtils.deepCopy(event, ChangeEvent.class);

    // Create initial context with copied event
    NotificationPipelineContext context = new NotificationPipelineContext(eventCopy, template);

    // Process through pipeline
    for (NotificationPipelineStep step : pipeline) {
      context = step.process(context);
    }

    // Return the final message directly
    return context.getMessage();
  }

  private NotificationTemplate resolveTemplate(ChangeEvent event, EventSubscription subscription) {
    // TODO: Custom template from EventSubscription - will be implemented in Section 9
    // if (subscription.getNotificationTemplate() != null) {
    //   return subscription.getNotificationTemplate();
    // }

    // 2. System template by entity type + event type
    String systemTemplateName =
        String.format(
            "system-notification-%s-%s",
            event.getEntityType().toLowerCase(), event.getEventType().name().toLowerCase());

    NotificationTemplate systemTemplate =
        templateRepository.findByNameOrNull(systemTemplateName, Include.ALL);
    if (systemTemplate != null) {
      return systemTemplate;
    }

    // 3. Default system template
    return templateRepository.findByNameOrNull("system-notification-default", Include.ALL);
  }
}
