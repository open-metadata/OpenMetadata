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
package org.openmetadata.service.alerting.content;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.alerting.content.render.ChannelRenderer;
import org.openmetadata.service.alerting.content.render.NotificationMessage;
import org.openmetadata.service.alerting.content.template.HandlebarsNotificationTemplateProcessor;
import org.openmetadata.service.alerting.content.template.NotificationTemplateProcessor;
import org.openmetadata.service.util.email.EmailUtil;

@Slf4j
public class HandlebarsNotificationMessageEngine implements NotificationMessageEngine {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final TemplateLookup templates;
  private final NotificationTemplateProcessor templateProcessor;

  public HandlebarsNotificationMessageEngine(TemplateLookup templates) {
    this.templates = templates;
    this.templateProcessor = new HandlebarsNotificationTemplateProcessor();
  }

  @Override
  public NotificationMessage generateMessage(
      ChangeEvent event, EventSubscription subscription, ChannelRenderer renderer) {

    // Resolve the template for this event
    NotificationTemplate template = resolveTemplate(event, subscription);

    return generateMessageWithTemplate(event, subscription, renderer, template);
  }

  @Override
  public NotificationMessage generateMessageWithTemplate(
      ChangeEvent event,
      EventSubscription subscription,
      ChannelRenderer renderer,
      NotificationTemplate template) {
    return format(renderWith(event, subscription, template), renderer);
  }

  /** The template that applies to the event, rendered to Markdown. No channel is involved yet. */
  public EventContent.Rendered render(ChangeEvent event, EventSubscription subscription) {
    return renderWith(event, subscription, resolveTemplate(event, subscription));
  }

  /** Markdown made once, in the format of the channel the renderer belongs to. */
  public NotificationMessage format(EventContent.Rendered content, ChannelRenderer renderer) {
    return renderer.render(content.body(), content.subject());
  }

  // From a copy of the event, so no template helper can change what a webhook sends or what the
  // delivered record stores.
  private EventContent.Rendered renderWith(
      ChangeEvent event, EventSubscription subscription, NotificationTemplate template) {
    ChangeEvent eventCopy = JsonUtils.deepCopy(event, ChangeEvent.class);
    Map<String, Object> context = buildEventContext(eventCopy, subscription);
    String body = templateProcessor.process(template.getTemplateBody(), context);
    String subject = null;
    if (template.getTemplateSubject() != null && !template.getTemplateSubject().isEmpty()) {
      subject = templateProcessor.process(template.getTemplateSubject(), context);
    }
    return new EventContent.Rendered(body, subject);
  }

  /** What a template may say about the server. Read from the settings, which a unit test lacks. */
  protected Map<String, Object> serverSettings() {
    Map<String, Object> settings = new HashMap<>();
    settings.put("baseUrl", EmailUtil.getOMBaseURL());
    settings.put("emailingEntity", EmailUtil.getSmtpSettings().getEmailingEntity());
    return settings;
  }

  private Map<String, Object> buildEventContext(ChangeEvent event, EventSubscription subscription) {
    Map<String, Object> context = new HashMap<>();
    context.put("event", event);
    Object rawEntity = event.getEntity();
    if (rawEntity instanceof String jsonString) {
      try {
        Map<String, Object> entityMap = MAPPER.readValue(jsonString, new TypeReference<>() {});
        context.put("entity", entityMap);
      } catch (Exception e) {
        context.put("entity", Map.of());
        LOG.error("Failed to parse entity JSON: {}", e.getMessage());
      }
    } else {
      // Already a Map or POJO
      context.put("entity", rawEntity);
    }
    context.putAll(serverSettings());
    context.put("publisherName", getDisplayNameOrFqn(subscription));
    return context;
  }

  private String getDisplayNameOrFqn(EventSubscription eventSubscription) {
    String displayName = eventSubscription.getDisplayName();
    return (CommonUtil.nullOrEmpty(displayName))
        ? eventSubscription.getFullyQualifiedName()
        : displayName;
  }

  private NotificationTemplate resolveTemplate(ChangeEvent event, EventSubscription subscription) {
    // 1. Check if subscription has custom template assigned
    EntityReference templateRef = subscription.getNotificationTemplate();
    if (templateRef != null) {
      try {
        NotificationTemplate customTemplate = templates.byId(templateRef.getId());
        if (customTemplate != null) {
          LOG.debug(
              "Using custom template {} for subscription {}",
              customTemplate.getName(),
              subscription.getName());
          return customTemplate;
        }
      } catch (Exception e) {
        LOG.warn(
            "Failed to load custom template {} for subscription {}, falling back to system template: {}",
            templateRef.getId(),
            subscription.getName(),
            e.getMessage());
      }
    }

    // 2. Fall back to system template resolution (existing logic)
    // Convert EventType to kebab-case for template naming
    // This handles multi-part camelCase: logicalTestCaseAdded -> logical-test-case-added
    String eventTypeKebab =
        event.getEventType().value().replaceAll("([a-z])([A-Z]+)", "$1-$2").toLowerCase();

    // Try entity-specific template: system-notification-{entityType}-{eventType}
    String entitySpecificTemplateName =
        String.format(
            "system-notification-%s-%s", event.getEntityType().toLowerCase(), eventTypeKebab);
    NotificationTemplate entitySpecificTemplate = templates.byName(entitySpecificTemplateName);
    if (entitySpecificTemplate != null) {
      return entitySpecificTemplate;
    }

    // Try generic event template: system-notification-{eventType}
    String genericTemplateName = String.format("system-notification-%s", eventTypeKebab);
    NotificationTemplate genericTemplate = templates.byName(genericTemplateName);
    if (genericTemplate != null) {
      return genericTemplate;
    }

    // Guaranteed fallback to default template
    NotificationTemplate defaultTemplate = templates.byName("system-notification-entity-default");

    if (defaultTemplate == null) {
      throw new IllegalStateException(
          "Critical error: Default notification template 'system-notification-entity-default' not found");
    }

    return defaultTemplate;
  }
}
