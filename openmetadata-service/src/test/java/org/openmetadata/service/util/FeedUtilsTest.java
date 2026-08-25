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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
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
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.util.FormatterUtil;

class FeedUtilsTest {

  private final TestDecorator decorator = new TestDecorator();

  @Test
  void getThreadWithMessageReturnsEmptyForNullThreadAndUnsupportedEvents() {
    assertTrue(FeedUtils.getThreadWithMessage(decorator, null).isEmpty());
    assertTrue(
        FeedUtils.getThreadWithMessage(decorator, new ChangeEvent().withEntityType(Entity.TABLE))
            .isEmpty());

    ChangeEvent threadEvent =
        new ChangeEvent()
            .withEntityType(Entity.THREAD)
            .withEntity(new Thread().withType(ThreadType.Conversation));
    ChangeEvent unsupportedEvent =
        new ChangeEvent()
            .withEntityType("custom")
            .withEntity(new Table().withId(UUID.randomUUID()));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getEntityList).thenReturn(Set.of(Entity.TABLE));

      assertTrue(FeedUtils.getThreadWithMessage(decorator, threadEvent).isEmpty());
      assertTrue(FeedUtils.getThreadWithMessage(decorator, unsupportedEvent).isEmpty());
    }
  }

  @Test
  void getThreadWithMessageBuildsEntityLifecycleCards() {
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

      Thread createdThread = FeedUtils.getThreadWithMessage(decorator, created).getFirst();
      assertEquals(Thread.CardStyle.ENTITY_CREATED, createdThread.getCardStyle());
      assertEquals("Created **table**: `service.sales.orders`", createdThread.getMessage());
      assertEquals(List.of(domainId), createdThread.getDomains());
      assertEquals("table|service.sales.orders|", createdThread.getEntityUrlLink());
      assertSame(
          table, ((EntityInfo) createdThread.getFeedInfo().getEntitySpecificInfo()).getEntity());

      Thread softDeletedThread = FeedUtils.getThreadWithMessage(decorator, softDeleted).getFirst();
      assertEquals(Thread.CardStyle.ENTITY_SOFT_DELETED, softDeletedThread.getCardStyle());
      assertEquals(
          "Soft deleted **table**: `service.sales.orders`", softDeletedThread.getMessage());

      Thread deletedThread = FeedUtils.getThreadWithMessage(decorator, deleted).getFirst();
      assertEquals(Thread.CardStyle.ENTITY_DELETED, deletedThread.getCardStyle());
      assertEquals(
          "Permanently Deleted **table**: `service.sales.orders`", deletedThread.getMessage());

      Thread logicalTestCaseThread =
          FeedUtils.getThreadWithMessage(decorator, logicalTestCaseAdded).getFirst();
      assertEquals(Thread.CardStyle.LOGICAL_TEST_CASE_ADDED, logicalTestCaseThread.getCardStyle());
      assertEquals(
          "Added Logical Test Cases to **table**: `service.sales.orders`",
          logicalTestCaseThread.getMessage());
    }
  }

  @Test
  void getThreadWithMessageDelegatesFormattedChangesAndSkipsMissingDescriptions() {
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

    List<Thread> updatedThreads = List.of(new Thread().withMessage("updated"));
    List<Thread> changedThreads = List.of(new Thread().withMessage("changed"));

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
                      eq(decorator), any(Thread.class), same(updatedDescription)))
          .thenReturn(updatedThreads);
      formatterUtil
          .when(
              () ->
                  FormatterUtil.getFormattedMessages(
                      eq(decorator), any(Thread.class), same(changedFieldsDescription)))
          .thenReturn(changedThreads);

      assertSame(updatedThreads, FeedUtils.getThreadWithMessage(decorator, updatedEvent));
      assertSame(changedThreads, FeedUtils.getThreadWithMessage(decorator, changedFieldsEvent));
      assertTrue(FeedUtils.getThreadWithMessage(decorator, missingDescriptionEvent).isEmpty());
    }
  }

  @Test
  void getThreadBuildsSystemGeneratedThreadAndMapsDomains() {
    UUID domainId = UUID.randomUUID();
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("service.sales.orders")
            .withDomains(List.of(new EntityReference().withId(domainId)));

    Thread thread =
        FeedUtils.getThread(
            decorator, table, "<#E::table::service.sales.orders>", Entity.TABLE, "alice");

    assertEquals("alice", thread.getCreatedBy());
    assertEquals("alice", thread.getUpdatedBy());
    assertEquals(Thread.GeneratedBy.SYSTEM, thread.getGeneratedBy());
    assertEquals("<#E::table::service.sales.orders>", thread.getAbout());
    assertEquals("table|service.sales.orders|", thread.getEntityUrlLink());
    assertEquals(List.of(domainId), thread.getDomains());
    assertNull(thread.getReactions().stream().findFirst().orElse(null));
    assertTrue(thread.getThreadTs() > 0);
    assertTrue(thread.getUpdatedAt() > 0);
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
