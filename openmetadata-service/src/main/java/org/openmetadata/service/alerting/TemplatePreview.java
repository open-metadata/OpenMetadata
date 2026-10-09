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

package org.openmetadata.service.alerting;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.events.NotificationTemplateRenderRequest;
import org.openmetadata.schema.api.events.NotificationTemplateRenderResponse;
import org.openmetadata.schema.api.events.NotificationTemplateSendRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationResponse;
import org.openmetadata.schema.api.events.TemplateRenderResult;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.alerting.content.TemplateLookup;
import org.openmetadata.service.events.subscription.channels.Channel;
import org.openmetadata.service.events.subscription.channels.Channels;
import org.openmetadata.service.events.subscription.channels.builtin.BuiltInChannels;
import org.openmetadata.service.notifications.HandlebarsNotificationMessageEngine;
import org.openmetadata.service.notifications.channels.ChannelRenderer;
import org.openmetadata.service.notifications.channels.NotificationMessage;
import org.openmetadata.service.notifications.channels.email.EmailMessage;
import org.openmetadata.service.notifications.template.NotificationTemplateProcessor;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsNotificationTemplateProcessor;
import org.openmetadata.service.notifications.template.testing.EntityFixtureLoader;
import org.openmetadata.service.notifications.template.testing.MockChangeEventFactory;
import org.openmetadata.service.notifications.template.testing.MockChangeEventRegistry;

/**
 * A template tried before it is saved: rendered on a sample event, as the email channel renders
 * it, or sent on a sample event to destinations the user names.
 */
@Slf4j
public final class TemplatePreview {
  private final NotificationTemplateProcessor templateProcessor;
  private final MockChangeEventFactory mockChangeEventFactory;
  private final HandlebarsNotificationMessageEngine messageEngine;

  public TemplatePreview(TemplateLookup templates) {
    this.templateProcessor = new HandlebarsNotificationTemplateProcessor();
    this.mockChangeEventFactory =
        new MockChangeEventFactory(new MockChangeEventRegistry(new EntityFixtureLoader()));
    this.messageEngine = new HandlebarsNotificationMessageEngine(templates);
  }

  /**
   * Renders a template with mock data using HandlebarsNotificationMessageEngine.
   * Called by the REST endpoint for rendering preview.
   *
   * @param request The render request with template and resource info
   * @return The render response with validation and rendering results
   */
  public NotificationTemplateRenderResponse render(NotificationTemplateRenderRequest request) {
    NotificationTemplateValidationResponse validationResponse =
        templateProcessor.validate(
            new NotificationTemplateValidationRequest()
                .withTemplateBody(request.getTemplateBody())
                .withTemplateSubject(request.getTemplateSubject()));

    if (!validationResponse.getIsValid()) {
      return new NotificationTemplateRenderResponse()
          .withValidation(validationResponse)
          .withRender(null);
    }

    ChangeEvent mockEvent =
        mockChangeEventFactory.create(request.getResource(), request.getEventType());

    NotificationTemplate testTemplate =
        new NotificationTemplate()
            .withId(UUID.randomUUID())
            .withName("test-template")
            .withTemplateSubject(request.getTemplateSubject())
            .withTemplateBody(request.getTemplateBody());

    EventSubscription testSubscription =
        new EventSubscription()
            .withId(UUID.randomUUID())
            .withName("test-subscription")
            .withDisplayName("Test Notification");

    TemplateRenderResult renderResult =
        renderWithMessageEngine(
            mockEvent, testSubscription, BuiltInChannels.previewRenderer(), testTemplate);

    return new NotificationTemplateRenderResponse()
        .withValidation(validationResponse)
        .withRender(renderResult);
  }

  private TemplateRenderResult renderWithMessageEngine(
      ChangeEvent event,
      EventSubscription subscription,
      ChannelRenderer renderer,
      NotificationTemplate template) {
    try {
      EmailMessage emailMessage =
          (EmailMessage)
              messageEngine.generateMessageWithTemplate(event, subscription, renderer, template);

      return new TemplateRenderResult()
          .withSubject(emailMessage.getSubject())
          .withBody(emailMessage.getHtmlContent());

    } catch (Exception e) {
      String errorMessage = "Failed to render template: " + e.getMessage();
      LOG.error(errorMessage, e);
      return new TemplateRenderResult().withSubject("").withBody("");
    }
  }

  /**
   * Validates and sends a template to specified destinations.
   * Called by the REST endpoint for send testing.
   *
   * @param request The send request with template, resource, eventType, and destinations
   * @return The validation response (delivery errors logged server-side only)
   */
  public NotificationTemplateValidationResponse send(NotificationTemplateSendRequest request) {
    NotificationTemplateRenderRequest renderRequest = request.getRenderRequest();

    NotificationTemplateValidationRequest validationRequest =
        new NotificationTemplateValidationRequest()
            .withTemplateBody(renderRequest.getTemplateBody())
            .withTemplateSubject(renderRequest.getTemplateSubject());

    NotificationTemplateValidationResponse validation =
        templateProcessor.validate(validationRequest);

    if (!validation.getIsValid()) {
      return validation;
    }

    validateExternalDestinations(request.getDestinations());

    ChangeEvent mockEvent =
        mockChangeEventFactory.create(renderRequest.getResource(), renderRequest.getEventType());

    NotificationTemplate testTemplate =
        new NotificationTemplate()
            .withId(UUID.randomUUID())
            .withName("test-template")
            .withTemplateSubject(renderRequest.getTemplateSubject())
            .withTemplateBody(renderRequest.getTemplateBody());

    EventSubscription testSubscription =
        new EventSubscription()
            .withId(UUID.randomUUID())
            .withName("test-notification")
            .withDisplayName("Test Notification Template");

    for (SubscriptionDestination dest : request.getDestinations()) {
      try {
        sendToDestination(mockEvent, testSubscription, dest, testTemplate);
        LOG.info("Successfully sent test notification to {} destination", dest.getType());
      } catch (Exception e) {
        LOG.error(
            "Failed to send test notification to {} destination: {}",
            dest.getType(),
            e.getMessage(),
            e);
      }
    }

    return validation;
  }

  private void validateExternalDestinations(List<SubscriptionDestination> destinations) {
    for (SubscriptionDestination dest : destinations) {
      if (dest.getCategory() != SubscriptionDestination.SubscriptionCategory.EXTERNAL) {
        throw new IllegalArgumentException(
            "Only external destinations (Email, Slack, Teams, GChat, Webhook) are supported.");
      }
    }
  }

  private void sendToDestination(
      ChangeEvent event,
      EventSubscription subscription,
      SubscriptionDestination destination,
      NotificationTemplate template) {

    Channel channel = Channels.required(destination);
    ChannelRenderer renderer =
        channel
            .renderer()
            .orElseThrow(
                () ->
                    new IllegalArgumentException(
                        "Unsupported destination type: " + destination.getType()));
    NotificationMessage message =
        messageEngine.generateMessageWithTemplate(event, subscription, renderer, template);

    channel
        .transport()
        .orElseThrow(
            () ->
                new IllegalArgumentException(
                    "Unsupported destination type: " + destination.getType()))
        .deliver(message, destination);
  }
}
