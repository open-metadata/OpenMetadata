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

package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mockStatic;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

/**
 * {@code filterByTableNameTestCaseBelongsTo} scopes an observability alert to the tests of named
 * tables. It answers one question: does this event concern a test case whose parent table is listed?
 *
 * <p>Two ways it used to get that wrong, both because it never resolved the parent table. It read
 * {@code entityFQN}, which is {@code <table>.<column>} for a column-level test, so column tests never
 * matched their own table. And it returned {@code true} for any non-test-case event, so a conversation
 * on a test case was delivered whatever table it belonged to (#31330).
 */
class AlertsRuleEvaluatorTableFilterTest {

  private static final String TABLE_A = "service.db.schema.orders";
  private static final String TABLE_B = "service.db.schema.shipments";
  private static final UUID TEST_CASE_ID = UUID.randomUUID();

  // ---------- test-case events: the parent table must be resolved, not assumed ----------

  @Test
  void columnLevelTestCase_matchesItsParentTable() {
    assertTrue(matchesTable(columnTestCase(TABLE_A), TABLE_A));
  }

  @Test
  void columnLevelTestCase_doesNotMatchAnotherTable() {
    assertFalse(matchesTable(columnTestCase(TABLE_A), TABLE_B));
  }

  @Test
  void tableLevelTestCase_stillMatchesItsTable() {
    assertTrue(matchesTable(tableTestCase(TABLE_A), TABLE_A));
    assertFalse(matchesTable(tableTestCase(TABLE_A), TABLE_B));
  }

  @Test
  void tableSharingAPrefixIsNotAMatch() {
    TestCase testCase = tableTestCase("service.db.schema.customer_archive");
    assertFalse(matchesTable(testCase, "service.db.schema.customer"));
  }

  @Test
  void unparseableEntityLink_fallsBackToEntityFqnInsteadOfThrowing() {
    TestCase testCase =
        new TestCase()
            .withId(TEST_CASE_ID)
            .withName("tc")
            .withEntityLink("not-an-entity-link")
            .withEntityFQN(TABLE_A);
    assertDoesNotThrow(() -> matchesTable(testCase, TABLE_A));
    assertTrue(matchesTable(testCase, TABLE_A));
  }

  // ---------- #31330: an event the filter cannot evaluate must not mean "deliver" ----------

  @Test
  void nonTestCaseEntityEvent_doesNotMatch() {
    ChangeEvent event =
        new ChangeEvent()
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityType(Entity.TABLE)
            .withEntity(new Table().withName("t").withFullyQualifiedName(TABLE_A));
    assertFalse(
        new AlertsRuleEvaluator(event).filterByTableNameTestCaseBelongsTo(List.of(TABLE_A)));
  }

  @Test
  void conversationOnTestCaseOfListedTable_matches() {
    AlertsRuleEvaluator evaluator = new AlertsRuleEvaluator(conversationAbout(testCaseRef()));
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      stubTestCaseRead(entityMock, columnTestCase(TABLE_A));
      assertTrue(evaluator.filterByTableNameTestCaseBelongsTo(List.of(TABLE_A)));
    }
  }

  @Test
  void conversationOnTestCaseOfAnotherTable_doesNotMatch() {
    AlertsRuleEvaluator evaluator = new AlertsRuleEvaluator(conversationAbout(testCaseRef()));
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      stubTestCaseRead(entityMock, tableTestCase(TABLE_B));
      assertFalse(evaluator.filterByTableNameTestCaseBelongsTo(List.of(TABLE_A)));
    }
  }

  @Test
  void conversationWhoseTestCaseNoLongerResolves_doesNotMatch() {
    AlertsRuleEvaluator evaluator = new AlertsRuleEvaluator(conversationAbout(testCaseRef()));
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      stubTestCaseRead(entityMock, null);
      assertFalse(evaluator.filterByTableNameTestCaseBelongsTo(List.of(TABLE_A)));
    }
  }

  @Test
  void conversationAboutANonTestCaseEntity_doesNotMatch() {
    EntityReference tableRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.TABLE)
            .withFullyQualifiedName(TABLE_A);
    AlertsRuleEvaluator evaluator = new AlertsRuleEvaluator(conversationAbout(tableRef));
    assertFalse(evaluator.filterByTableNameTestCaseBelongsTo(List.of(TABLE_A)));
  }

  @Test
  void conversationWithoutASubject_doesNotMatch() {
    AlertsRuleEvaluator evaluator = new AlertsRuleEvaluator(conversationAbout(null));
    assertFalse(evaluator.filterByTableNameTestCaseBelongsTo(List.of(TABLE_A)));
  }

  // ---------- fixtures ----------

  /** What the repository actually writes for a column test: entityFQN carries the column. */
  private static TestCase columnTestCase(String tableFqn) {
    return new TestCase()
        .withId(TEST_CASE_ID)
        .withName("tc")
        .withEntityLink(String.format("<#E::table::%s::columns::id>", tableFqn))
        .withEntityFQN(tableFqn + ".id");
  }

  private static TestCase tableTestCase(String tableFqn) {
    return new TestCase()
        .withId(TEST_CASE_ID)
        .withName("tc")
        .withEntityLink(String.format("<#E::table::%s>", tableFqn))
        .withEntityFQN(tableFqn);
  }

  /** The evaluator resolves the payload class through the registry the runtime populates at boot. */
  private static boolean matchesTable(TestCase testCase, String listedTableFqn) {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entityMock
          .when(() -> Entity.getEntityClassFromType(Entity.TEST_CASE))
          .thenReturn(TestCase.class);
      return new AlertsRuleEvaluator(testCaseEvent(testCase))
          .filterByTableNameTestCaseBelongsTo(List.of(listedTableFqn));
    }
  }

  private static ChangeEvent testCaseEvent(TestCase testCase) {
    return new ChangeEvent()
        .withEventType(EventType.ENTITY_UPDATED)
        .withEntityType(Entity.TEST_CASE)
        .withEntityId(testCase.getId())
        .withEntity(testCase);
  }

  private static EntityReference testCaseRef() {
    return new EntityReference()
        .withId(TEST_CASE_ID)
        .withType(Entity.TEST_CASE)
        .withFullyQualifiedName(TABLE_A + ".tc");
  }

  private static ChangeEvent conversationAbout(EntityReference subject) {
    Conversation conversation =
        new Conversation()
            .withId(UUID.randomUUID())
            .withMessage("look at this")
            .withEntityRef(subject);
    return new ChangeEvent()
        .withEventType(EventType.THREAD_CREATED)
        .withEntityType(Entity.CONVERSATION)
        .withEntity(conversation);
  }

  private static void stubTestCaseRead(MockedStatic<Entity> entityMock, TestCase stored) {
    entityMock
        .when(
            () ->
                Entity.getEntityOrNull(any(EntityReference.class), eq(""), eq(Include.NON_DELETED)))
        .thenReturn(stored);
  }
}
