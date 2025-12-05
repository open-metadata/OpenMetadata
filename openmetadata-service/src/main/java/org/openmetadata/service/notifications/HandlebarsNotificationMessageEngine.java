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

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;
import org.openmetadata.service.notifications.channels.ChannelRenderer;
import org.openmetadata.service.notifications.channels.NotificationMessage;
import org.openmetadata.service.notifications.channels.email.EmailHtmlRenderer;
import org.openmetadata.service.notifications.channels.gchat.GChatCardRenderer;
import org.openmetadata.service.notifications.channels.slack.SlackBlockKitRenderer;
import org.openmetadata.service.notifications.channels.teams.TeamsAdaptiveCardRenderer;
import org.openmetadata.service.notifications.template.NotificationTemplateProcessor;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsNotificationTemplateProcessor;
import org.openmetadata.service.util.email.EmailUtil;

@Slf4j
public class HandlebarsNotificationMessageEngine implements NotificationMessageEngine {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final NotificationTemplateRepository templateRepository;
  private final NotificationTemplateProcessor templateProcessor;
  private final Map<SubscriptionDestination.SubscriptionType, ChannelRenderer> channelRenderers;

  public HandlebarsNotificationMessageEngine(NotificationTemplateRepository templateRepository) {
    this.templateRepository = templateRepository;
    this.templateProcessor = new HandlebarsNotificationTemplateProcessor();
    this.channelRenderers = initializeChannelRenderers();
  }

  private Map<SubscriptionDestination.SubscriptionType, ChannelRenderer>
      initializeChannelRenderers() {
    Map<SubscriptionDestination.SubscriptionType, ChannelRenderer> renderers =
        new EnumMap<>(SubscriptionDestination.SubscriptionType.class);

    renderers.put(SubscriptionDestination.SubscriptionType.EMAIL, new EmailHtmlRenderer());
    renderers.put(SubscriptionDestination.SubscriptionType.SLACK, SlackBlockKitRenderer.create());
    renderers.put(
        SubscriptionDestination.SubscriptionType.MS_TEAMS, TeamsAdaptiveCardRenderer.create());
    renderers.put(SubscriptionDestination.SubscriptionType.G_CHAT, GChatCardRenderer.create());

    return renderers;
  }

  @Override
  public NotificationMessage generateMessage(
      ChangeEvent event, EventSubscription subscription, SubscriptionDestination destination) {

    // Resolve the template for this event
    NotificationTemplate template = resolveTemplate(event, subscription);

    return generateMessageWithTemplate(event, subscription, destination, template);
  }

  @Override
  public NotificationMessage generateMessageWithTemplate(
      ChangeEvent event,
      EventSubscription subscription,
      SubscriptionDestination destination,
      NotificationTemplate template) {

    // Create deep copy of event to avoid modifying the original
    ChangeEvent eventCopy = JsonUtils.deepCopy(event, ChangeEvent.class);

    // Phase 1: Render Handlebars template to Markdown
    Map<String, Object> context = buildEventContext(eventCopy, subscription);
    String markdownContent = templateProcessor.process(template.getTemplateBody(), context);
    String markdownSubject = null;

    if (template.getTemplateSubject() != null && !template.getTemplateSubject().isEmpty()) {
      markdownSubject = templateProcessor.process(template.getTemplateSubject(), context);
    }

    // Phase 2: Convert Markdown to channel-specific format
    ChannelRenderer renderer = channelRenderers.get(destination.getType());
    if (renderer == null) {
      throw new IllegalArgumentException("Unsupported destination type: " + destination.getType());
    }

    // Let the renderer handle markdown parsing and conversion
    return renderer.render(markdownContent, markdownSubject);
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
    context.put("baseUrl", EmailUtil.getOMBaseURL());
    context.put("publisherName", getDisplayNameOrFqn(subscription));
    context.put("emailingEntity", EmailUtil.getSmtpSettings().getEmailingEntity());
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
        NotificationTemplate customTemplate =
            Entity.getEntity(Entity.NOTIFICATION_TEMPLATE, templateRef.getId(), "", Include.ALL);
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
    NotificationTemplate entitySpecificTemplate =
        templateRepository.findByNameOrNull(entitySpecificTemplateName, Include.ALL);
    if (entitySpecificTemplate != null) {
      return entitySpecificTemplate;
    }

    // Try generic event template: system-notification-{eventType}
    String genericTemplateName = String.format("system-notification-%s", eventTypeKebab);
    NotificationTemplate genericTemplate =
        templateRepository.findByNameOrNull(genericTemplateName, Include.ALL);
    if (genericTemplate != null) {
      return genericTemplate;
    }

    // Guaranteed fallback to default template
    NotificationTemplate defaultTemplate =
        templateRepository.findByNameOrNull("system-notification-entity-default", Include.ALL);

    if (defaultTemplate == null) {
      throw new IllegalStateException(
          "Critical error: Default notification template 'system-notification-entity-default' not found");
    }

    return defaultTemplate;
  }
}
