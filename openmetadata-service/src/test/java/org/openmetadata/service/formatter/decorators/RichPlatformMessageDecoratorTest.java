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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.LatestResult;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.gchat.GChatMessage;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage;
import org.openmetadata.service.apps.bundles.changeEvent.slack.SlackMessage;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.util.FeedUtils;

class RichPlatformMessageDecoratorTest {

  private static final long FIXED_TIME = 1_735_689_600_000L;

  @Test
  void slackBuildEntityMessageHandlesQueryEventsWithoutEntityLink() {
    SlackMessageDecorator decorator = new SlackMessageDecorator();
    ChangeEvent event =
        new ChangeEvent()
            .withEntityType(Entity.QUERY)
            .withEntity(Map.of("id", "query-1"))
            .withEntityFullyQualifiedName("service.sales.orders.query")
            .withEventType(EventType.ENTITY_UPDATED)
            .withUserName("alice")
            .withTimestamp(FIXED_TIME);

    try (MockedStatic<AlertsRuleEvaluator> alerts = mockStatic(AlertsRuleEvaluator.class);
        MockedStatic<FeedUtils> feedUtils = mockStatic(FeedUtils.class)) {
      alerts.when(() -> AlertsRuleEvaluator.getEntity(event)).thenReturn(new Table());
      feedUtils
          .when(() -> FeedUtils.getThreadWithMessage(decorator, event))
          .thenReturn(List.of(new Thread().withMessage("Query text changed")));

      SlackMessage message =
          assertDoesNotThrow(() -> decorator.buildEntityMessage("publisher", event));
      String json = JsonUtils.pojoToJson(message);

      assertTrue(json.contains("Query text changed"));
      assertFalse(json.contains("Access data:"));
    }
  }

  @Test
  void teamsBuildEntityMessageHandlesQueryEventsWithoutEntityLink() {
    MSTeamsMessageDecorator decorator = new MSTeamsMessageDecorator();
    ChangeEvent event =
        new ChangeEvent()
            .withEntityType(Entity.QUERY)
            .withEntity(Map.of("id", "query-1"))
            .withEntityFullyQualifiedName("service.sales.orders.query")
            .withEventType(EventType.ENTITY_UPDATED)
            .withUserName("alice")
            .withTimestamp(FIXED_TIME);

    try (MockedStatic<AlertsRuleEvaluator> alerts = mockStatic(AlertsRuleEvaluator.class);
        MockedStatic<FeedUtils> feedUtils = mockStatic(FeedUtils.class)) {
      alerts.when(() -> AlertsRuleEvaluator.getEntity(event)).thenReturn(new Table());
      feedUtils
          .when(() -> FeedUtils.getThreadWithMessage(decorator, event))
          .thenReturn(List.of(new Thread().withMessage("Query text changed")));

      TeamsMessage message =
          assertDoesNotThrow(() -> decorator.buildEntityMessage("publisher", event));
      String json = JsonUtils.pojoToJson(message);

      assertEquals("message", message.getType());
      assertTrue(json.contains("Query text changed"));
      assertFalse(json.contains("View Data"));
    }
  }

  @Test
  void slackBuildEntityMessageAddsViewLinkWhenEntityUrlIsAvailable() throws Exception {
    SlackMessageDecorator decorator = new SlackMessageDecorator();
    ChangeEvent event =
        new ChangeEvent()
            .withEntityType(Entity.TABLE)
            .withEntityFullyQualifiedName("service.sales.orders")
            .withEventType(EventType.ENTITY_UPDATED)
            .withUserName("alice")
            .withTimestamp(FIXED_TIME);
    OutgoingMessage outgoingMessage = new OutgoingMessage();
    outgoingMessage.setMessages(List.of("Owner changed"));
    outgoingMessage.setEntityUrl(
        "<https://openmetadata.example/table/service.sales.orders|orders>");

    java.lang.reflect.Method method =
        SlackMessageDecorator.class.getDeclaredMethod(
            "createGeneralChangeEventMessage", ChangeEvent.class, OutgoingMessage.class);
    method.setAccessible(true);

    SlackMessage message = (SlackMessage) method.invoke(decorator, event, outgoingMessage);
    String json = JsonUtils.pojoToJson(message);

    assertTrue(json.contains("Owner changed"));
    assertTrue(
        json.contains(
            "Access data: <https://openmetadata.example/table/service.sales.orders|View>"));
  }

  @Test
  void teamsBuildEntityMessageAddsViewLinkWhenEntityUrlIsAvailable() throws Exception {
    MSTeamsMessageDecorator decorator = new MSTeamsMessageDecorator();
    ChangeEvent event =
        new ChangeEvent()
            .withEntityType(Entity.TABLE)
            .withEntityFullyQualifiedName("service.sales.orders")
            .withEventType(EventType.ENTITY_UPDATED)
            .withUserName("alice")
            .withTimestamp(FIXED_TIME);
    OutgoingMessage outgoingMessage = new OutgoingMessage();
    outgoingMessage.setMessages(List.of("Owner changed"));
    outgoingMessage.setEntityUrl(
        "[orders](https://openmetadata.example/table/service.sales.orders)");

    java.lang.reflect.Method method =
        MSTeamsMessageDecorator.class.getDeclaredMethod(
            "createGeneralChangeEventMessage",
            String.class,
            ChangeEvent.class,
            OutgoingMessage.class);
    method.setAccessible(true);

    TeamsMessage message =
        (TeamsMessage) method.invoke(decorator, "publisher", event, outgoingMessage);
    String json = JsonUtils.pojoToJson(message);

    assertTrue(json.contains("Owner changed"));
    assertTrue(
        json.contains("[View Data](https://openmetadata.example/table/service.sales.orders)"));
  }

  @Test
  void slackCreatesDQTemplateAttachmentWithResultSections() {
    SlackMessageDecorator decorator = new SlackMessageDecorator();
    ChangeEvent event = testCaseEvent();
    OutgoingMessage outgoingMessage = dqOutgoingMessage();
    TestCase testCase = createTestCase();
    TestCaseRepository repository = mockTestCaseRepository(testCase);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TEST_CASE)).thenReturn(repository);

      SlackMessage message = decorator.createDQTemplateMessage(event, outgoingMessage);
      String json = JsonUtils.pojoToJson(message);

      assertEquals("#ffcc00", message.getAttachments().getFirst().getColor());
      assertTrue(json.contains("Row Count"));
      assertTrue(json.contains("Failed :x:"));
      assertTrue(json.contains("[min: 10]"));
      assertTrue(json.contains("select count(*) from orders"));
      assertTrue(
          json.contains(
              "Access data: <https://openmetadata.example/test-case/service.sales.quality.row_count/test-case-results|View>"));
    }
  }

  @Test
  void slackCreatesDataContractTemplateWithStatusColor() {
    SlackMessageDecorator decorator = new SlackMessageDecorator();
    ChangeEvent event =
        new ChangeEvent()
            .withEntityType(Entity.DATA_CONTRACT)
            .withEntityFullyQualifiedName("service.sales.orders.contract")
            .withEventType(EventType.ENTITY_UPDATED)
            .withUserName("alice")
            .withTimestamp(FIXED_TIME);
    OutgoingMessage outgoingMessage = new OutgoingMessage();
    outgoingMessage.setMessages(List.of("Contract execution failed"));
    outgoingMessage.setEntityUrl(
        "<https://openmetadata.example/table/service.sales.orders/contract|service.sales.orders>");

    DataContract contract =
        new DataContract()
            .withId(UUID.randomUUID())
            .withName("orders_contract")
            .withDescription("Ensures order schema stays stable")
            .withFullyQualifiedName("service.sales.orders.contract")
            .withOwners(
                List.of(new EntityReference().withType(Entity.USER).withName("dataSteward")))
            .withEntity(
                new EntityReference()
                    .withType(Entity.TABLE)
                    .withId(UUID.randomUUID())
                    .withFullyQualifiedName("service.sales.orders"))
            .withLatestResult(
                new LatestResult()
                    .withStatus(ContractExecutionStatus.Failed)
                    .withMessage("Schema drift detected")
                    .withTimestamp(FIXED_TIME));
    contract.setTags(List.of(new TagLabel().withName("Tier1")));

    try (MockedStatic<AlertsRuleEvaluator> alerts = mockStatic(AlertsRuleEvaluator.class)) {
      alerts.when(() -> AlertsRuleEvaluator.getEntity(event)).thenReturn(contract);

      SlackMessage message = decorator.createDataContractTemplateMessage(event, outgoingMessage);
      String json = JsonUtils.pojoToJson(message);

      assertEquals("#ff0000", message.getAttachments().getFirst().getColor());
      assertTrue(json.contains("orders_contract"));
      assertTrue(json.contains("Schema drift detected"));
      assertTrue(json.contains("Failed :x:"));
      assertTrue(
          json.contains(
              "Access data: <https://openmetadata.example/table/service.sales.orders/contract|View>"));
    }
  }

  @Test
  void gchatCreatesDQTemplateWithStructuredSections() {
    GChatMessageDecorator decorator = new GChatMessageDecorator();
    ChangeEvent event = testCaseEvent();
    OutgoingMessage outgoingMessage = dqOutgoingMessage();
    TestCase testCase = createTestCase();
    TestCaseRepository repository = mockTestCaseRepository(testCase);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TEST_CASE)).thenReturn(repository);

      GChatMessage message = decorator.createDQTemplate("publisher", event, outgoingMessage);
      String json = JsonUtils.pojoToJson(message);

      assertTrue(json.contains("TEST CASE RESULT"));
      assertTrue(json.contains("Failed ❌"));
      assertTrue(json.contains("Parameter Value:"));
      assertTrue(json.contains("[min: 10]"));
      assertTrue(json.contains("TEST DEFINITION"));
    }
  }

  @Test
  void teamsCreatesDQAdaptiveCardPayload() throws Exception {
    MSTeamsMessageDecorator decorator = new MSTeamsMessageDecorator();
    TestCase testCase = createTestCase();
    ChangeEvent event = testCaseEvent();
    OutgoingMessage outgoingMessage = new OutgoingMessage();
    outgoingMessage.setMessages(List.of("Threshold exceeded"));
    outgoingMessage.setEntityUrl(
        "[service.sales.quality.row_count](https://openmetadata.example/test-case/service.sales.quality.row_count/test-case-results)");
    TestCaseRepository repository = mockTestCaseRepository(testCase);
    java.lang.reflect.Method method =
        MSTeamsMessageDecorator.class.getDeclaredMethod(
            "createDQMessage", ChangeEvent.class, OutgoingMessage.class);
    method.setAccessible(true);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TEST_CASE)).thenReturn(repository);

      TeamsMessage message = (TeamsMessage) method.invoke(decorator, event, outgoingMessage);
      String json = JsonUtils.pojoToJson(message);

      assertEquals("message", message.getType());
      assertTrue(json.contains("Test Case Result"));
      assertTrue(json.contains("Threshold exceeded"));
      assertTrue(json.contains("Parameter Values:"));
      assertTrue(json.contains("[min: 10]"));
      assertTrue(
          json.contains(
              "[View Data](https://openmetadata.example/test-case/service.sales.quality.row_count/test-case-results)"));
    }
  }

  private static ChangeEvent testCaseEvent() {
    return new ChangeEvent()
        .withEntityType(Entity.TEST_CASE)
        .withEntityFullyQualifiedName("service.sales.quality.row_count")
        .withEventType(EventType.ENTITY_UPDATED)
        .withUserName("alice")
        .withTimestamp(FIXED_TIME);
  }

  private static OutgoingMessage dqOutgoingMessage() {
    OutgoingMessage outgoingMessage = new OutgoingMessage();
    outgoingMessage.setMessages(List.of("Threshold exceeded"));
    outgoingMessage.setEntityUrl(
        "<https://openmetadata.example/test-case/service.sales.quality.row_count/test-case-results|service.sales.quality.row_count>");
    return outgoingMessage;
  }

  private static TestCase createTestCase() {
    return new TestCase()
        .withId(UUID.randomUUID())
        .withName("row_count")
        .withDisplayName("Row Count")
        .withFullyQualifiedName("service.sales.quality.row_count")
        .withOwners(List.of(new EntityReference().withType(Entity.USER).withName("dataSteward")))
        .withTags(List.of(new TagLabel().withName("Tier1")))
        .withTestDefinition(
            new EntityReference()
                .withName("rowCountToEqual")
                .withDescription("Checks the row count"))
        .withInspectionQuery("select count(*) from orders")
        .withParameterValues(List.of(new TestCaseParameterValue().withName("min").withValue("10")))
        .withTestCaseResult(
            new TestCaseResult().withResult("Threshold exceeded").withSampleData("sample rows"))
        .withTestCaseStatus(TestCaseStatus.Failed);
  }

  private static TestCaseRepository mockTestCaseRepository(TestCase testCase) {
    TestCaseRepository repository = mock(TestCaseRepository.class);
    when(repository.getFields("*")).thenReturn(null);
    when(repository.getByName(
            isNull(),
            eq(testCase.getFullyQualifiedName()),
            any(),
            eq(Include.NON_DELETED),
            eq(false)))
        .thenReturn(testCase);
    return repository;
  }
}
