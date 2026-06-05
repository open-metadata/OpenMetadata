package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.CompiledRule;

class AlertUtilTest {

  @Test
  void testConvertInputListToString_withSingleQuotes() {
    List<String> input = List.of("Jake's test bundle");
    String result = AlertUtil.convertInputListToString(input);
    assertEquals("'Jake''s test bundle'", result);
  }

  @Test
  void testConvertInputListToString_multipleSingleQuotes() {
    List<String> input = List.of("It's Jake's test");
    String result = AlertUtil.convertInputListToString(input);
    assertEquals("'It''s Jake''s test'", result);
  }

  @Test
  void testConvertInputListToString_multipleValuesWithQuotes() {
    List<String> input = List.of("Jake's bundle", "Mary's suite");
    String result = AlertUtil.convertInputListToString(input);
    assertEquals("'Jake''s bundle','Mary''s suite'", result);
  }

  @Test
  void testConvertInputListToString_noQuotes() {
    List<String> input = List.of("normal_name", "another_name");
    String result = AlertUtil.convertInputListToString(input);
    assertEquals("'normal_name','another_name'", result);
  }

  @Test
  void testConvertInputListToString_emptyList() {
    String result = AlertUtil.convertInputListToString(List.of());
    assertEquals("", result);
  }

  @Test
  void testConvertInputListToString_nullList() {
    String result = AlertUtil.convertInputListToString(null);
    assertEquals("", result);
  }

  @Test
  void testConvertInputListToString_singleValue() {
    List<String> input = List.of("single_value");
    String result = AlertUtil.convertInputListToString(input);
    assertEquals("'single_value'", result);
  }

  @Test
  void testConvertInputListToString_onlyQuote() {
    List<String> input = List.of("'");
    String result = AlertUtil.convertInputListToString(input);
    assertEquals("''''", result);
  }

  @Test
  void testConvertInputListToString_consecutiveQuotes() {
    List<String> input = List.of("test''value");
    String result = AlertUtil.convertInputListToString(input);
    assertEquals("'test''''value'", result);
  }

  // ---- shouldTriggerAlert: null / "all" resource ----------------------------

  @Test
  void shouldTriggerAlert_nullConfig_returnsTrue() {
    ChangeEvent event = entityChangeEvent("table");
    assertTrue(AlertUtil.shouldTriggerAlert(event, null));
  }

  @Test
  void shouldTriggerAlert_allResource_returnsTrue() {
    ChangeEvent event = entityChangeEvent("glossaryTerm");
    FilteringRules config = filteringRules("all");
    assertTrue(AlertUtil.shouldTriggerAlert(event, config));
  }

  // ---- shouldTriggerAlert: entity change events ----------------------------

  @Test
  void shouldTriggerAlert_entityEvent_matchingResource_returnsTrue() {
    ChangeEvent event = entityChangeEvent("glossaryTerm");
    FilteringRules config = filteringRules("glossaryTerm");
    assertTrue(AlertUtil.shouldTriggerAlert(event, config));
  }

  @Test
  void shouldTriggerAlert_entityEvent_nonMatchingResource_returnsFalse() {
    ChangeEvent event = entityChangeEvent("table");
    FilteringRules config = filteringRules("glossaryTerm");
    assertFalse(AlertUtil.shouldTriggerAlert(event, config));
  }

  // ---- shouldTriggerAlert: thread-type resource ("conversation" etc.) ------

  @Test
  void shouldTriggerAlert_conversationThread_conversationResource_returnsTrue() {
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withType(ThreadType.Conversation)
            .withEntityRef(glossaryTermRef());
    ChangeEvent event = threadChangeEvent(thread, EventType.THREAD_CREATED);
    FilteringRules config = filteringRules("conversation");
    assertTrue(AlertUtil.shouldTriggerAlert(event, config));
  }

  @Test
  void shouldTriggerAlert_taskThread_conversationResource_returnsFalse() {
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withType(ThreadType.Task)
            .withEntityRef(glossaryTermRef());
    ChangeEvent event = threadChangeEvent(thread, EventType.TASK_CREATED);
    FilteringRules config = filteringRules("conversation");
    assertFalse(AlertUtil.shouldTriggerAlert(event, config));
  }

  @Test
  void shouldTriggerAlert_taskThread_taskResource_returnsTrue() {
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withType(ThreadType.Task)
            .withEntityRef(glossaryTermRef());
    ChangeEvent event = threadChangeEvent(thread, EventType.TASK_CREATED);
    FilteringRules config = filteringRules("task");
    assertTrue(AlertUtil.shouldTriggerAlert(event, config));
  }

  @Test
  void shouldTriggerAlert_announcementThread_announcementResource_returnsTrue() {
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withType(ThreadType.Announcement)
            .withEntityRef(new EntityReference().withId(UUID.randomUUID()).withType("table"));
    ChangeEvent event = threadChangeEvent(thread, EventType.THREAD_CREATED);
    FilteringRules config = filteringRules("announcement");
    assertTrue(AlertUtil.shouldTriggerAlert(event, config));
  }

  // ---- shouldTriggerAlert: entity-type resource for thread events ----------
  // These are the bug cases: thread events on a GlossaryTerm should fire
  // when the subscription resource is "glossaryTerm", not just "conversation".

  @Test
  void shouldTriggerAlert_conversationOnGlossaryTerm_glossaryTermResource_returnsTrue() {
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withType(ThreadType.Conversation)
            .withEntityRef(glossaryTermRef());
    ChangeEvent event = threadChangeEvent(thread, EventType.THREAD_CREATED);
    FilteringRules config = filteringRules("glossaryTerm");
    assertTrue(AlertUtil.shouldTriggerAlert(event, config));
  }

  @Test
  void shouldTriggerAlert_threadUpdateOnGlossaryTerm_glossaryTermResource_returnsTrue() {
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withType(ThreadType.Conversation)
            .withEntityRef(glossaryTermRef());
    ChangeEvent event = threadChangeEvent(thread, EventType.THREAD_UPDATED);
    FilteringRules config = filteringRules("glossaryTerm");
    assertTrue(AlertUtil.shouldTriggerAlert(event, config));
  }

  @Test
  void shouldTriggerAlert_postCreatedOnGlossaryTerm_glossaryTermResource_returnsTrue() {
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withType(ThreadType.Conversation)
            .withEntityRef(glossaryTermRef());
    ChangeEvent event = threadChangeEvent(thread, EventType.POST_CREATED);
    FilteringRules config = filteringRules("glossaryTerm");
    assertTrue(AlertUtil.shouldTriggerAlert(event, config));
  }

  @Test
  void shouldTriggerAlert_threadOnTable_glossaryTermResource_returnsFalse() {
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withType(ThreadType.Conversation)
            .withEntityRef(new EntityReference().withId(UUID.randomUUID()).withType("table"));
    ChangeEvent event = threadChangeEvent(thread, EventType.THREAD_CREATED);
    FilteringRules config = filteringRules("glossaryTerm");
    assertFalse(AlertUtil.shouldTriggerAlert(event, config));
  }

  @Test
  void shouldTriggerAlert_threadOnTable_tableResource_returnsTrue() {
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withType(ThreadType.Conversation)
            .withEntityRef(new EntityReference().withId(UUID.randomUUID()).withType("table"));
    ChangeEvent event = threadChangeEvent(thread, EventType.THREAD_CREATED);
    FilteringRules config = filteringRules("table");
    assertTrue(AlertUtil.shouldTriggerAlert(event, config));
  }

  @Test
  void shouldTriggerAlert_threadWithNullEntityRef_entityTypeResource_returnsFalse() {
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withType(ThreadType.Conversation)
            .withEntityRef(null);
    ChangeEvent event = threadChangeEvent(thread, EventType.THREAD_CREATED);
    FilteringRules config = filteringRules("glossaryTerm");
    assertFalse(AlertUtil.shouldTriggerAlert(event, config));
  }

  // ---- evaluateAlertConditions: compile-once cache --------------------------

  @Test
  void evaluateAlertConditionsCompilesEachConditionOnce() {
    // Unique condition isolates this test from the shared static cache.
    EventFilterRule rule = includeRule("matchAnySource({'src-" + UUID.randomUUID() + "'})");
    ChangeEvent event = entityChangeEvent("table");

    try (MockedStatic<CompiledRule> compiledRule =
        mockStatic(CompiledRule.class, CALLS_REAL_METHODS)) {
      AlertUtil.evaluateAlertConditions(event, List.of(rule));
      AlertUtil.evaluateAlertConditions(event, List.of(rule));
      AlertUtil.evaluateAlertConditions(event, List.of(rule));

      compiledRule.verify(() -> CompiledRule.parseExpression(anyString()), times(1));
    }
  }

  @Test
  void evaluateAlertConditionsReusesCompiledExpressionPerEvent() {
    EventFilterRule rule = includeRule("matchAnyEventType({'entityUpdated'})");

    ChangeEvent updated = entityChangeEvent("table"); // ENTITY_UPDATED
    assertTrue(AlertUtil.evaluateAlertConditions(updated, List.of(rule)));

    ChangeEvent created =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEventType(EventType.ENTITY_CREATED)
            .withEntityType("table");
    assertFalse(AlertUtil.evaluateAlertConditions(created, List.of(rule)));
  }

  // ---- helpers ---------------------------------------------------------------

  private static EventFilterRule includeRule(String condition) {
    return new EventFilterRule()
        .withName("rule")
        .withEffect(ArgumentsInput.Effect.INCLUDE)
        .withCondition(condition);
  }

  private static ChangeEvent entityChangeEvent(String entityType) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(EventType.ENTITY_UPDATED)
        .withEntityType(entityType);
  }

  private static ChangeEvent threadChangeEvent(Thread thread, EventType eventType) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(eventType)
        .withEntityType(Entity.THREAD)
        .withEntity(thread);
  }

  private static FilteringRules filteringRules(String resource) {
    return new FilteringRules()
        .withResources(List.of(resource))
        .withRules(Collections.emptyList())
        .withActions(Collections.emptyList());
  }

  private static EntityReference glossaryTermRef() {
    return new EntityReference().withId(UUID.randomUUID()).withType("glossaryTerm");
  }
}
