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

package org.openmetadata.service.notifications;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.generic.GenericPublisher;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;

class ContentPreparationTest {
  private static final String SYSTEM_TEMPLATE = "system-notification-table-entity-updated";

  private final NotificationTemplateRepository templates =
      mock(NotificationTemplateRepository.class);
  private final EventSubscription alert =
      new EventSubscription().withId(UUID.randomUUID()).withName("an-alert");
  private final ChangeEvent event =
      new ChangeEvent()
          .withId(UUID.randomUUID())
          .withEntityType(Entity.TABLE)
          .withEntityId(UUID.randomUUID())
          .withEntityFullyQualifiedName("service.db.schema.orders")
          .withEventType(EventType.ENTITY_UPDATED)
          .withUserName("alice")
          .withTimestamp(1L);

  @BeforeEach
  void aSystemTemplateExists() {
    when(templates.findByNameOrNull(eq(SYSTEM_TEMPLATE), eq(Include.ALL)))
        .thenReturn(template("The {{event.entityType}} was changed by {{event.userName}}"));
  }

  @Test
  void threeChannelsRenderTheTemplateOnce() {
    HandlebarsNotificationMessageEngine engine = spy(engine());
    EventContent content = new EventContent(event, alert);

    for (SubscriptionType type :
        new SubscriptionType[] {
          SubscriptionType.SLACK, SubscriptionType.MS_TEAMS, SubscriptionType.G_CHAT
        }) {
      String message = JsonUtils.pojoToJson(engine.format(content.by(engine), destinationOf(type)));
      assertTrue(message.contains("was changed by alice"), type.value());
    }

    verify(engine, times(1)).render(any(), any());
    verify(templates, times(1)).findByNameOrNull(eq(SYSTEM_TEMPLATE), any());
  }

  @Test
  void webhookOnlyAlertNeverRendersATemplate() throws Exception {
    EventContent content = new EventContent(event, alert);
    SubscriptionDestination webhook =
        destinationOf(SubscriptionType.WEBHOOK)
            .withConfig(new Webhook().withEndpoint(URI.create("https://hooks.example.com/raw")));

    Object payload = new GenericPublisher(alert, webhook).prepare(event, content);

    assertFalse(content.isRendered());
    assertEquals(JsonUtils.pojoToJson(event), payload);
  }

  @Test
  void renderingCannotChangeTheWebhookPayload() {
    String before = JsonUtils.pojoToJson(event);

    new EventContent(event, alert).by(engine());

    assertEquals(before, JsonUtils.pojoToJson(event));
  }

  // A custom template that was deleted must never cost the notification.
  @Test
  void deletedCustomTemplateFallsBack() {
    UUID deleted = UUID.randomUUID();
    alert.withNotificationTemplate(
        new EntityReference().withId(deleted).withType(Entity.NOTIFICATION_TEMPLATE));

    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntity(eq(Entity.NOTIFICATION_TEMPLATE), eq(deleted), any(), any()))
          .thenThrow(EntityNotFoundException.byId(deleted.toString()));

      EventContent.Rendered rendered = engine().render(event, alert);

      assertTrue(rendered.body().contains("was changed by alice"));
    }
  }

  // Preview and test send go through the entry point delivery uses.
  @Test
  void previewEqualsDeliveredBody() {
    HandlebarsNotificationMessageEngine engine = engine();
    SubscriptionDestination slack = destinationOf(SubscriptionType.SLACK);
    NotificationTemplate template = templates.findByNameOrNull(SYSTEM_TEMPLATE, Include.ALL);

    String previewed =
        JsonUtils.pojoToJson(engine.generateMessageWithTemplate(event, alert, slack, template));
    String delivered =
        JsonUtils.pojoToJson(engine.format(new EventContent(event, alert).by(engine), slack));

    assertEquals(previewed, delivered);
  }

  @Test
  void attachmentProviderRunsOncePerEventAndAlert() {
    FixtureAttachmentProvider.TIMES_ASKED.set(0);
    EventContent content = new EventContent(reportEvent(EventType.ENTITY_CREATED), alert);

    for (int channel = 0; channel < 3; channel++) {
      assertEquals("report.pdf", content.attachment().orElseThrow().fileName());
    }

    assertEquals(1, FixtureAttachmentProvider.TIMES_ASKED.get());
  }

  @Test
  void providerReturnsNothingForAnotherEvent() {
    assertTrue(
        new EventContent(reportEvent(EventType.ENTITY_UPDATED), alert).attachment().isEmpty(),
        "an ordinary edit never carries a report");
    assertTrue(new EventContent(event, alert).attachment().isEmpty(), "no provider for a table");
  }

  private static ChangeEvent reportEvent(EventType eventType) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEntityType(FixtureAttachmentProvider.SOURCE_TYPE)
        .withEventType(eventType);
  }

  private HandlebarsNotificationMessageEngine engine() {
    return new HandlebarsNotificationMessageEngine(templates) {
      @Override
      protected Map<String, Object> serverSettings() {
        return Map.of("baseUrl", "http://localhost:8585", "emailingEntity", "OpenMetadata");
      }
    };
  }

  private static SubscriptionDestination destinationOf(SubscriptionType type) {
    return new SubscriptionDestination().withId(UUID.randomUUID()).withType(type);
  }

  private static NotificationTemplate template(String body) {
    return new NotificationTemplate()
        .withId(UUID.randomUUID())
        .withName(SYSTEM_TEMPLATE)
        .withTemplateSubject("A change")
        .withTemplateBody(body);
  }
}
