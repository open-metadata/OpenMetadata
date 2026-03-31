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

package org.openmetadata.service.formatter.decorators;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.AnnouncementDetails;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskDetails;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.util.FeedUtils;

class MessageDecoratorTest {

  private final RecordingDecorator decorator = new RecordingDecorator();

  @Test
  void buildEntityUrlUsesEntitySpecificRoutesAndFallsBackToRepositoryLookup() {
    Table unresolvedTable =
        new Table().withId(UUID.randomUUID()).withFullyQualifiedName("").withName("orders");
    Table resolvedTable = new Table().withFullyQualifiedName("service.sales.orders");

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(
              () ->
                  Entity.getEntity(
                      Entity.TABLE, unresolvedTable.getId(), "id", Include.NON_DELETED))
          .thenReturn(resolvedTable);

      assertEquals(
          "table|service.sales.orders|", decorator.buildEntityUrl(Entity.TABLE, unresolvedTable));
    }

    TestCase testCase = new TestCase().withFullyQualifiedName("quality.row_count");

    assertEquals(
        "test-case|quality.row_count|test-case-results",
        decorator.buildEntityUrl(Entity.TEST_CASE, testCase));
    assertEquals(
        "glossary|Business.Term|",
        decorator.buildEntityUrl(
            Entity.GLOSSARY_TERM, new Table().withFullyQualifiedName("Business.Term")));
    assertEquals(
        "tags|PII|",
        decorator.buildEntityUrl(Entity.TAG, new Table().withFullyQualifiedName("PII.Sensitive")));
    assertEquals(
        "users|alice|",
        decorator.buildEntityUrl(Entity.USER, new Table().withFullyQualifiedName("alice")));
    assertEquals(
        "settings/members/teams|dataStewards|",
        decorator.buildEntityUrl(Entity.TEAM, new Table().withFullyQualifiedName("dataStewards")));
  }

  @Test
  void buildThreadUrlUsesActivityTabsAndSpecialEntityRoutes() {
    Table table = new Table().withFullyQualifiedName("service.sales.orders");
    TestCase testCase = new TestCase().withFullyQualifiedName("quality.row_count");

    assertEquals(
        "table|service.sales.orders|activity_feed/tasks",
        decorator.buildThreadUrl(ThreadType.Task, Entity.TABLE, table));
    assertEquals(
        "table|service.sales.orders|activity_feed/all",
        decorator.buildThreadUrl(ThreadType.Conversation, Entity.TABLE, table));
    assertEquals(
        "test-case|quality.row_count|issues",
        decorator.buildThreadUrl(ThreadType.Task, Entity.TEST_CASE, testCase));
    assertEquals(
        "glossary|Business.Term|activity_feed/all",
        decorator.buildThreadUrl(
            ThreadType.Conversation,
            Entity.GLOSSARY_TERM,
            new Table().withFullyQualifiedName("Business.Term")));
    assertEquals(
        "tags|PII|",
        decorator.buildThreadUrl(
            ThreadType.Conversation,
            Entity.TAG,
            new Table().withFullyQualifiedName("PII.Sensitive")));
  }

  @Test
  void getFqnForChangeEventEntityPrefersEventPayloadAndHandlesThreadFallbacks() {
    ChangeEvent directEvent =
        new ChangeEvent()
            .withEntityType(Entity.TABLE)
            .withEntityFullyQualifiedName("service.sales.orders");
    assertEquals("service.sales.orders", MessageDecorator.getFQNForChangeEventEntity(directEvent));

    Thread threadWithoutEntityRef = new Thread().withId(UUID.randomUUID());
    Table table = new Table().withFullyQualifiedName("service.sales.customers");

    ChangeEvent threadEventWithoutRef = new ChangeEvent().withEntityType(Entity.THREAD);
    ChangeEvent entityEvent = new ChangeEvent().withEntityType(Entity.TABLE);

    try (MockedStatic<AlertsRuleEvaluator> alerts = mockStatic(AlertsRuleEvaluator.class)) {
      alerts
          .when(() -> AlertsRuleEvaluator.getThreadEntity(threadEventWithoutRef))
          .thenReturn(threadWithoutEntityRef);
      alerts.when(() -> AlertsRuleEvaluator.getEntity(entityEvent)).thenReturn(table);

      assertEquals(
          threadWithoutEntityRef.getId().toString(),
          MessageDecorator.getFQNForChangeEventEntity(threadEventWithoutRef));
      assertEquals(
          "service.sales.customers", MessageDecorator.getFQNForChangeEventEntity(entityEvent));
    }
  }

  @Test
  void buildOutgoingMessageDispatchesToEntityOrThreadHandlers() {
    ChangeEvent entityEvent = new ChangeEvent().withEntityType(Entity.TABLE);
    ChangeEvent threadEvent = new ChangeEvent().withEntityType(Entity.THREAD);
    ChangeEvent unsupportedEvent = new ChangeEvent().withEntityType("unknown");

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getEntityList).thenReturn(Set.of(Entity.TABLE));

      assertEquals("entity", decorator.buildOutgoingMessage("publisher", entityEvent));
      assertEquals("thread", decorator.buildOutgoingMessage("publisher", threadEvent));
      assertThrows(
          IllegalArgumentException.class,
          () -> decorator.buildOutgoingMessage("publisher", unsupportedEvent));
    }
    assertEquals("test", decorator.buildOutgoingTestMessage());
  }

  @Test
  void replaceMarkersAndDiffFormattingWrapChangesWithConfiguredMarkup() {
    assertEquals(
        "alpha <ins>beta</ins>",
        decorator.replaceMarkers("alpha <!add>beta<!add>", "<!add>", "<ins>", "</ins>"));

    String diff = decorator.getPlaintextDiff("alpha", "beta");
    assertFalse(diff.isBlank());
    assertNotEquals("alpha", diff);
  }

  @Test
  void createEntityMessageBuildsHeadersForStandardQueryAndTestCaseEvents() {
    Table table = new Table().withFullyQualifiedName("service.sales.orders");
    ChangeEvent tableEvent =
        new ChangeEvent().withEntityType(Entity.TABLE).withEntity(table).withUserName("alice");

    ChangeEvent queryEvent =
        new ChangeEvent()
            .withEntityType(Entity.QUERY)
            .withEntity(Map.of("id", "query"))
            .withUserName("alice");

    TestCase testCase = new TestCase().withFullyQualifiedName("quality.row_count");
    ChangeEvent testCaseEvent =
        new ChangeEvent().withEntityType(Entity.TEST_CASE).withEntity(testCase).withUserName("bob");

    Thread first = new Thread().withMessage("First message");
    Thread second = new Thread().withMessage("Second message");

    try (MockedStatic<AlertsRuleEvaluator> alerts = mockStatic(AlertsRuleEvaluator.class);
        MockedStatic<FeedUtils> feedUtils = mockStatic(FeedUtils.class)) {
      alerts.when(() -> AlertsRuleEvaluator.getEntity(tableEvent)).thenReturn(table);
      alerts.when(() -> AlertsRuleEvaluator.getEntity(queryEvent)).thenReturn(table);
      alerts.when(() -> AlertsRuleEvaluator.getEntity(testCaseEvent)).thenReturn(testCase);
      feedUtils
          .when(() -> FeedUtils.getThreadWithMessage(decorator, tableEvent))
          .thenReturn(List.of(first, second));
      feedUtils
          .when(() -> FeedUtils.getThreadWithMessage(decorator, queryEvent))
          .thenReturn(List.of(first));
      feedUtils
          .when(() -> FeedUtils.getThreadWithMessage(decorator, testCaseEvent))
          .thenReturn(List.of(first));

      OutgoingMessage tableMessage = decorator.createEntityMessage("publisher", tableEvent);
      assertEquals(
          "[publisher] alice posted on table table|service.sales.orders|",
          tableMessage.getHeader());
      assertEquals("table|service.sales.orders|", tableMessage.getEntityUrl());
      assertEquals(List.of("First message", "Second message"), tableMessage.getMessages());

      OutgoingMessage queryMessage = decorator.createEntityMessage("publisher", queryEvent);
      assertEquals("[publisher] alice posted on query", queryMessage.getHeader());
      assertNull(queryMessage.getEntityUrl());

      OutgoingMessage testCaseMessage = decorator.createEntityMessage("publisher", testCaseEvent);
      assertTrue(testCaseMessage.getHeader().contains("posted on testSuite"));
    }
  }

  @Test
  void createThreadMessageBuildsConversationAndTaskPayloads() {
    Table table = new Table().withFullyQualifiedName("service.sales.orders");
    MessageDecoratorTest.RecordingDecorator decorator = new RecordingDecorator();

    Thread conversation =
        new Thread()
            .withType(ThreadType.Conversation)
            .withAbout("<#E::table::service.sales.orders>")
            .withCreatedBy("alice")
            .withMessage("Initial <#E::table::service.sales.orders>")
            .withPosts(
                List.of(new Post().withId(UUID.randomUUID()).withFrom("bob").withMessage("Reply")));

    ChangeEvent conversationEvent =
        new ChangeEvent().withEntityType(Entity.THREAD).withEventType(EventType.POST_CREATED);

    TaskDetails taskDetails =
        new TaskDetails()
            .withId(42)
            .withType(TaskType.RequestDescription)
            .withAssignees(
                List.of(new EntityReference().withType(Entity.TEAM).withName("dataStewards")))
            .withStatus(TaskStatus.Open);
    Thread task =
        new Thread()
            .withType(ThreadType.Task)
            .withAbout("<#E::table::service.sales.orders>")
            .withCreatedBy("alice")
            .withTask(taskDetails);
    ChangeEvent taskEvent =
        new ChangeEvent().withEntityType(Entity.THREAD).withEventType(EventType.THREAD_CREATED);

    try (MockedStatic<AlertsRuleEvaluator> alerts = mockStatic(AlertsRuleEvaluator.class);
        MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      alerts.when(() -> AlertsRuleEvaluator.getThread(conversationEvent)).thenReturn(conversation);
      alerts.when(() -> AlertsRuleEvaluator.getThread(taskEvent)).thenReturn(task);
      entity
          .when(
              () ->
                  Entity.getEntity(
                      any(org.openmetadata.service.resources.feeds.MessageParser.EntityLink.class),
                      eq(""),
                      eq(Include.ALL)))
          .thenReturn(table);
      entity
          .when(
              () ->
                  Entity.getEntity(
                      any(org.openmetadata.service.resources.feeds.MessageParser.EntityLink.class),
                      eq("id"),
                      eq(Include.ALL)))
          .thenReturn(table);

      OutgoingMessage conversationMessage =
          decorator.createThreadMessage("publisher", conversationEvent);
      assertEquals(
          "[publisher] @alice posted a message on asset table|service.sales.orders|activity_feed/all",
          conversationMessage.getHeader());
      assertEquals(
          List.of("@alice : Initial @service.sales.orders", "@bob : Reply"),
          conversationMessage.getMessages());

      OutgoingMessage taskMessage = decorator.createThreadMessage("publisher", taskEvent);
      assertEquals(
          "[publisher] @alice created a Task for table table|service.sales.orders|activity_feed/tasks",
          taskMessage.getHeader());
      assertEquals(
          List.of(
              "Task Type : RequestDescription",
              "Assignees : '@dataStewards'",
              "Current Status : Open"),
          taskMessage.getMessages());
    }
  }

  @Test
  void createThreadMessageCoversAnnouncementAndTaskResolutionEvents() {
    Table table = new Table().withFullyQualifiedName("service.sales.orders");
    RecordingDecorator decorator = new RecordingDecorator();

    Thread announcement =
        new Thread()
            .withType(ThreadType.Announcement)
            .withAbout("<#E::table::service.sales.orders>")
            .withCreatedBy("alice")
            .withUpdatedBy("bob")
            .withAnnouncement(
                new AnnouncementDetails()
                    .withDescription("Pipeline maintenance")
                    .withStartTime(1_735_689_600L)
                    .withEndTime(1_735_776_000L));
    ChangeEvent announcementCreated =
        new ChangeEvent().withEntityType(Entity.THREAD).withEventType(EventType.THREAD_CREATED);
    ChangeEvent announcementDeleted =
        new ChangeEvent().withEntityType(Entity.THREAD).withEventType(EventType.ENTITY_DELETED);

    TaskDetails taskDetails =
        new TaskDetails()
            .withId(84)
            .withType(TaskType.RequestDescription)
            .withAssignees(List.of(new EntityReference().withType(Entity.USER).withName("alice")))
            .withStatus(TaskStatus.Closed);
    Thread closedTask =
        new Thread()
            .withType(ThreadType.Task)
            .withAbout("<#E::table::service.sales.orders>")
            .withCreatedBy("alice")
            .withTask(taskDetails)
            .withPosts(List.of(new Post().withFrom("bob").withMessage("Resolved")));
    ChangeEvent taskClosed =
        new ChangeEvent().withEntityType(Entity.THREAD).withEventType(EventType.TASK_CLOSED);

    try (MockedStatic<AlertsRuleEvaluator> alerts = mockStatic(AlertsRuleEvaluator.class);
        MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      alerts
          .when(() -> AlertsRuleEvaluator.getThread(announcementCreated))
          .thenReturn(announcement);
      alerts
          .when(() -> AlertsRuleEvaluator.getThread(announcementDeleted))
          .thenReturn(announcement);
      alerts.when(() -> AlertsRuleEvaluator.getThread(taskClosed)).thenReturn(closedTask);
      entity
          .when(
              () ->
                  Entity.getEntity(
                      any(org.openmetadata.service.resources.feeds.MessageParser.EntityLink.class),
                      eq(""),
                      eq(Include.ALL)))
          .thenReturn(table);
      entity
          .when(
              () ->
                  Entity.getEntity(
                      any(org.openmetadata.service.resources.feeds.MessageParser.EntityLink.class),
                      eq("id"),
                      eq(Include.ALL)))
          .thenReturn(table);

      OutgoingMessage announcementMessage =
          decorator.createThreadMessage("publisher", announcementCreated);
      assertEquals(
          "[publisher] **@alice** posted an **Announcement**", announcementMessage.getHeader());
      assertTrue(announcementMessage.getMessages().getFirst().contains("Pipeline maintenance"));

      OutgoingMessage deletedAnnouncementMessage =
          decorator.createThreadMessage("publisher", announcementDeleted);
      assertEquals(
          "[publisher] **@bob** posted an update on  **Announcement**",
          deletedAnnouncementMessage.getHeader());
      assertEquals(
          List.of("Announcement Deleted: Pipeline maintenance"),
          deletedAnnouncementMessage.getMessages());

      OutgoingMessage closedTaskMessage = decorator.createThreadMessage("publisher", taskClosed);
      assertEquals(
          "[publisher] @alice closed Task with Id : 84 for Asset table|service.sales.orders|activity_feed/tasks",
          closedTaskMessage.getHeader());
      assertEquals(List.of("Current Status : Closed"), closedTaskMessage.getMessages());
    }
  }

  @Test
  void getThreadAssetsUrlReturnsEmptyWhenEntityLookupFails() {
    org.openmetadata.service.resources.feeds.MessageParser.EntityLink link =
        new org.openmetadata.service.resources.feeds.MessageParser.EntityLink(
            Entity.TABLE, "service.sales.orders");

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(() -> Entity.getEntity(link, "id", Include.ALL))
          .thenThrow(new IllegalStateException("boom"));

      assertEquals("", decorator.getThreadAssetsUrl(ThreadType.Task, link));
    }
  }

  @Test
  void dqTemplateDataBuildsSectionsFromFetchedTestCase() {
    String fqn = "service.sales.quality.row_count";
    TestCaseRepository repository = mock(TestCaseRepository.class);
    TestCase testCase =
        new TestCase()
            .withId(UUID.randomUUID())
            .withName("row_count")
            .withDisplayName("Row Count")
            .withFullyQualifiedName(fqn)
            .withOwners(
                List.of(new EntityReference().withType(Entity.USER).withName("dataSteward")))
            .withTags(List.of(new TagLabel().withTagFQN("Tier.Tier1")))
            .withTestDefinition(
                new EntityReference()
                    .withName("rowCountToEqual")
                    .withDescription("Checks the row count"))
            .withInspectionQuery("select count(*) from orders")
            .withParameterValues(
                List.of(new TestCaseParameterValue().withName("min").withValue("10")))
            .withTestCaseResult(
                new TestCaseResult().withResult("Row count failed").withSampleData("sample rows"))
            .withTestCaseStatus(TestCaseStatus.Failed);

    when(repository.getFields("*")).thenReturn(null);
    when(repository.getByName(isNull(), eq(fqn), any(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(testCase);

    ChangeEvent event =
        new ChangeEvent()
            .withEntityType(Entity.TEST_CASE)
            .withEntityFullyQualifiedName(fqn)
            .withUserName("alice")
            .withTimestamp(1_735_689_600_000L)
            .withEventType(EventType.ENTITY_UPDATED);
    OutgoingMessage outgoingMessage = new OutgoingMessage();
    outgoingMessage.setMessages(List.of("Test failed"));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TEST_CASE)).thenReturn(repository);

      Map<MessageDecorator.DQ_Template_Section, Map<Enum<?>, Object>> templateData =
          MessageDecorator.buildDQTemplateData(event, outgoingMessage);

      assertEquals(
          "Row Count",
          templateData
              .get(MessageDecorator.DQ_Template_Section.TEST_CASE_DETAILS)
              .get(MessageDecorator.DQ_TestCaseDetailsKeys.NAME));
      assertEquals(
          "select count(*) from orders",
          templateData
              .get(MessageDecorator.DQ_Template_Section.TEST_CASE_DETAILS)
              .get(MessageDecorator.DQ_TestCaseDetailsKeys.INSPECTION_QUERY));
      assertEquals(
          TestCaseStatus.Failed,
          templateData
              .get(MessageDecorator.DQ_Template_Section.TEST_CASE_RESULT)
              .get(MessageDecorator.DQ_TestCaseResultKeys.STATUS));
      assertEquals(
          "rowCountToEqual",
          templateData
              .get(MessageDecorator.DQ_Template_Section.TEST_DEFINITION)
              .get(MessageDecorator.DQ_TestDefinitionKeys.TEST_DEFINITION_NAME));
    }
  }

  @Test
  void dateFormattingUtilitiesHandleSecondsAndMilliseconds() {
    long epochMilli = 1_735_689_600_000L;
    String expected =
        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
            .withZone(ZoneId.systemDefault())
            .format(Instant.ofEpochMilli(epochMilli));

    assertEquals(expected, MessageDecorator.getDateStringEpochMilli(epochMilli));
    assertEquals(expected, MessageDecorator.getDateString(epochMilli / 1000));
  }

  private static class RecordingDecorator implements MessageDecorator<String> {

    @Override
    public String getBold() {
      return "<b>%s</b>";
    }

    @Override
    public String getBoldWithSpace() {
      return "<b>%s</b> ";
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
      return "entity";
    }

    @Override
    public String buildThreadMessage(String publisherName, ChangeEvent event) {
      return "thread";
    }

    @Override
    public String buildTestMessage() {
      return "test";
    }
  }
}
