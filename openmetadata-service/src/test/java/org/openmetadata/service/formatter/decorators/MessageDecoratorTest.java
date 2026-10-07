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
import static org.mockito.Mockito.mockStatic;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;

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
  void getFqnForChangeEventEntityPrefersEventPayloadAndHandlesConversationFallbacks() {
    ChangeEvent directEvent =
        new ChangeEvent()
            .withEntityType(Entity.TABLE)
            .withEntityFullyQualifiedName("service.sales.orders");
    assertEquals("service.sales.orders", MessageDecorator.getFQNForChangeEventEntity(directEvent));

    Conversation conversationWithoutEntityRef =
        new Conversation().withId(UUID.randomUUID()).withAbout("<#E::table::missing>");
    Table table = new Table().withFullyQualifiedName("service.sales.customers");

    ChangeEvent conversationEventWithoutRef =
        new ChangeEvent()
            .withEntityType(Entity.CONVERSATION)
            .withEntity(conversationWithoutEntityRef);
    ChangeEvent entityEvent = new ChangeEvent().withEntityType(Entity.TABLE);

    try (MockedStatic<AlertsRuleEvaluator> alerts = mockStatic(AlertsRuleEvaluator.class)) {
      alerts
          .when(() -> AlertsRuleEvaluator.getConversation(conversationEventWithoutRef))
          .thenReturn(conversationWithoutEntityRef);
      alerts.when(() -> AlertsRuleEvaluator.getEntity(entityEvent)).thenReturn(table);

      assertEquals(
          conversationWithoutEntityRef.getId().toString(),
          MessageDecorator.getFQNForChangeEventEntity(conversationEventWithoutRef));
      assertEquals(
          "service.sales.customers", MessageDecorator.getFQNForChangeEventEntity(entityEvent));
    }
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
    public String buildTestMessage() {
      return "test";
    }
  }
}
