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

package org.openmetadata.service.formatter.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.mockStatic;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.EntityInfo;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.openmetadata.service.formatter.decorators.MessageDecorator;

class ActivityMessageFormatterTest {

  private final TestDecorator decorator = new TestDecorator();

  @Test
  void returnsEmptyForMissingEntitiesAndUnsupportedTypes() {
    assertTrue(ActivityMessageFormatter.format(decorator, null).isEmpty());
    assertTrue(
        ActivityMessageFormatter.format(decorator, new ChangeEvent().withEntityType(Entity.TABLE))
            .isEmpty());

    ChangeEvent unsupportedEvent =
        new ChangeEvent()
            .withEntityType("custom")
            .withEntity(new Table().withId(UUID.randomUUID()));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getEntityList).thenReturn(Set.of(Entity.TABLE));

      assertTrue(ActivityMessageFormatter.format(decorator, unsupportedEvent).isEmpty());
    }
  }

  @Test
  void buildsEntityLifecycleMessages() {
    UUID domainId = UUID.randomUUID();
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("service.sales.orders")
            .withDomains(List.of(new EntityReference().withId(domainId)));

    ChangeEvent created = eventFor(table, EventType.ENTITY_CREATED);
    ChangeEvent softDeleted = eventFor(table, EventType.ENTITY_SOFT_DELETED);
    ChangeEvent deleted = eventFor(table, EventType.ENTITY_DELETED);
    ChangeEvent logicalTestCaseAdded = eventFor(table, EventType.LOGICAL_TEST_CASE_ADDED);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<AlertsRuleEvaluator> alerts = mockStatic(AlertsRuleEvaluator.class)) {
      entity.when(Entity::getEntityList).thenReturn(Set.of(Entity.TABLE));
      alerts.when(() -> AlertsRuleEvaluator.getEntity(created)).thenReturn(table);
      alerts.when(() -> AlertsRuleEvaluator.getEntity(softDeleted)).thenReturn(table);
      alerts.when(() -> AlertsRuleEvaluator.getEntity(deleted)).thenReturn(table);
      alerts.when(() -> AlertsRuleEvaluator.getEntity(logicalTestCaseAdded)).thenReturn(table);

      FormattedMessage createdMessage =
          ActivityMessageFormatter.format(decorator, created).getFirst();
      assertEquals(FormattedMessage.CardStyle.ENTITY_CREATED, createdMessage.getCardStyle());
      assertEquals("Created **table**: `service.sales.orders`", createdMessage.getMessage());
      assertEquals(List.of(domainId), createdMessage.getDomains());
      assertEquals("table|service.sales.orders|", createdMessage.getEntityUrlLink());
      assertSame(
          table, ((EntityInfo) createdMessage.getFeedInfo().getEntitySpecificInfo()).getEntity());

      FormattedMessage softDeletedMessage =
          ActivityMessageFormatter.format(decorator, softDeleted).getFirst();
      assertEquals(
          FormattedMessage.CardStyle.ENTITY_SOFT_DELETED, softDeletedMessage.getCardStyle());
      assertEquals(
          "Soft deleted **table**: `service.sales.orders`", softDeletedMessage.getMessage());

      FormattedMessage deletedMessage =
          ActivityMessageFormatter.format(decorator, deleted).getFirst();
      assertEquals(FormattedMessage.CardStyle.ENTITY_DELETED, deletedMessage.getCardStyle());
      assertEquals(
          "Permanently Deleted **table**: `service.sales.orders`", deletedMessage.getMessage());

      FormattedMessage logicalTestCaseMessage =
          ActivityMessageFormatter.format(decorator, logicalTestCaseAdded).getFirst();
      assertEquals(
          FormattedMessage.CardStyle.LOGICAL_TEST_CASE_ADDED,
          logicalTestCaseMessage.getCardStyle());
      assertEquals(
          "Added Logical Test Cases to **table**: `service.sales.orders`",
          logicalTestCaseMessage.getMessage());
    }
  }

  @Test
  void delegatesStructuredChangesAndSkipsMissingDescriptions() {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("service.sales.orders");
    ChangeDescription updatedDescription = new ChangeDescription();
    ChangeDescription changedFieldsDescription = new ChangeDescription();
    ChangeEvent updatedEvent =
        eventFor(table, EventType.ENTITY_UPDATED).withChangeDescription(updatedDescription);
    ChangeEvent changedFieldsEvent =
        eventFor(table, EventType.ENTITY_FIELDS_CHANGED)
            .withChangeDescription(changedFieldsDescription);
    ChangeEvent missingDescriptionEvent = eventFor(table, EventType.ENTITY_FIELDS_CHANGED);
    List<FormattedMessage> updatedMessages = List.of(new FormattedMessage().withMessage("updated"));
    List<FormattedMessage> changedMessages = List.of(new FormattedMessage().withMessage("changed"));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<AlertsRuleEvaluator> alerts = mockStatic(AlertsRuleEvaluator.class);
        MockedStatic<FormatterUtil> formatterUtil = mockStatic(FormatterUtil.class)) {
      entity.when(Entity::getEntityList).thenReturn(Set.of(Entity.TABLE));
      alerts.when(() -> AlertsRuleEvaluator.getEntity(updatedEvent)).thenReturn(table);
      alerts.when(() -> AlertsRuleEvaluator.getEntity(changedFieldsEvent)).thenReturn(table);
      alerts.when(() -> AlertsRuleEvaluator.getEntity(missingDescriptionEvent)).thenReturn(table);
      formatterUtil
          .when(
              () ->
                  FormatterUtil.getFormattedMessages(
                      eq(decorator), any(FormattedMessage.class), same(updatedDescription)))
          .thenReturn(updatedMessages);
      formatterUtil
          .when(
              () ->
                  FormatterUtil.getFormattedMessages(
                      eq(decorator), any(FormattedMessage.class), same(changedFieldsDescription)))
          .thenReturn(changedMessages);

      assertSame(updatedMessages, ActivityMessageFormatter.format(decorator, updatedEvent));
      assertSame(changedMessages, ActivityMessageFormatter.format(decorator, changedFieldsEvent));
      assertTrue(ActivityMessageFormatter.format(decorator, missingDescriptionEvent).isEmpty());
    }
  }

  private static ChangeEvent eventFor(Table table, EventType eventType) {
    return new ChangeEvent()
        .withEntityType(Entity.TABLE)
        .withEntity(table)
        .withEventType(eventType)
        .withUserName("alice");
  }

  private static final class TestDecorator implements MessageDecorator<String> {
    @Override
    public String getBold() {
      return "**";
    }

    @Override
    public String getBoldWithSpace() {
      return "** ";
    }

    @Override
    public String getLineBreak() {
      return "\n";
    }

    @Override
    public String getAddMarker() {
      return "<ins>";
    }

    @Override
    public String getAddMarkerClose() {
      return "</ins>";
    }

    @Override
    public String getRemoveMarker() {
      return "<del>";
    }

    @Override
    public String getRemoveMarkerClose() {
      return "</del>";
    }

    @Override
    public String getEntityUrl(String prefix, String fqn, String additionalInput) {
      return prefix + "|" + fqn + "|" + additionalInput;
    }

    @Override
    public String buildEntityMessage(String publisherName, ChangeEvent event) {
      return null;
    }

    @Override
    public String buildThreadMessage(String publisherName, ChangeEvent event) {
      return null;
    }

    @Override
    public String buildTestMessage() {
      return "test";
    }
  }
}
