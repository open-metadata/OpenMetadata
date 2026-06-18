package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.service.Entity;

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
    ChangeEvent event = threadChangeEvent(thread, EventType.TASK_RESOLVED);
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
    ChangeEvent event = threadChangeEvent(thread, EventType.TASK_RESOLVED);
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

  // ---- observability triggers must not fire on thread events ----------------
  // A trigger is a positive predicate. shouldTriggerAlert routes a thread about
  // an entity to that entity's alert (#28122), but a thread carries no test or
  // pipeline signal, so the trigger must reject it — otherwise a threadUpdated
  // leaks into a testCase "status = Failed" observability alert.

  @Test
  void matchTestResult_threadEventAboutTestCase_returnsFalse() {
    ChangeEvent event = threadUpdatedEvent(testCaseRef());
    assertFalse(new AlertsRuleEvaluator(event).matchTestResult(List.of("Failed")));
  }

  @Test
  void matchPipelineState_threadEvent_returnsFalse() {
    ChangeEvent event = threadUpdatedEvent(testCaseRef());
    assertFalse(new AlertsRuleEvaluator(event).matchPipelineState(List.of("Failed")));
  }

  @Test
  void matchIngestionPipelineState_threadEvent_returnsFalse() {
    ChangeEvent event = threadUpdatedEvent(testCaseRef());
    assertFalse(new AlertsRuleEvaluator(event).matchIngestionPipelineState(List.of("failed")));
  }

  @Test
  void matchTestResult_testCaseFailedResult_returnsTrue() {
    FieldChange resultChange =
        new FieldChange()
            .withName("testCaseResult")
            .withNewValue(new TestCaseResult().withTestCaseStatus(TestCaseStatus.Failed));
    ChangeEvent event =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityType(Entity.TEST_CASE)
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(List.of(resultChange))
                    .withFieldsAdded(Collections.emptyList()));
    assertTrue(new AlertsRuleEvaluator(event).matchTestResult(List.of("Failed")));
  }

  // ---- end-to-end (checkIfChangeEventIsAllowed): no regression across --------
  // INCLUDE/EXCLUDE triggers. A thread event must never reach an observability
  // alert's trigger: for an EXCLUDE trigger the "abstain" boolean would otherwise
  // flip and DELIVER the thread. Real results must still behave correctly.

  @Test
  void allowed_testCase_includeTrigger_thread_notDelivered() {
    assertFalse(
        AlertUtil.checkIfChangeEventIsAllowed(
            threadUpdatedEvent(ref(Entity.TEST_CASE)),
            observabilityRules(
                "testCase", ArgumentsInput.Effect.INCLUDE, "matchTestResult({'Failed'})")));
  }

  @Test
  void allowed_testCase_excludeTrigger_thread_notDelivered() {
    assertFalse(
        AlertUtil.checkIfChangeEventIsAllowed(
            threadUpdatedEvent(ref(Entity.TEST_CASE)),
            observabilityRules(
                "testCase", ArgumentsInput.Effect.EXCLUDE, "matchTestResult({'Failed'})")));
  }

  @Test
  void allowed_pipeline_excludeTrigger_thread_notDelivered() {
    assertFalse(
        AlertUtil.checkIfChangeEventIsAllowed(
            threadUpdatedEvent(ref(Entity.PIPELINE)),
            observabilityRules(
                "pipeline", ArgumentsInput.Effect.EXCLUDE, "matchPipelineState({'Failed'})")));
  }

  @Test
  void allowed_ingestionPipeline_excludeTrigger_thread_notDelivered() {
    assertFalse(
        AlertUtil.checkIfChangeEventIsAllowed(
            threadUpdatedEvent(ref(Entity.INGESTION_PIPELINE)),
            observabilityRules(
                "ingestionPipeline",
                ArgumentsInput.Effect.EXCLUDE,
                "matchIngestionPipelineState({'failed'})")));
  }

  @Test
  void allowed_testCase_includeTrigger_failedResult_delivered() {
    assertTrue(
        AlertUtil.checkIfChangeEventIsAllowed(
            testCaseResultEvent(TestCaseStatus.Failed),
            observabilityRules(
                "testCase", ArgumentsInput.Effect.INCLUDE, "matchTestResult({'Failed'})")));
  }

  @Test
  void allowed_testCase_includeTrigger_successResult_notDelivered() {
    assertFalse(
        AlertUtil.checkIfChangeEventIsAllowed(
            testCaseResultEvent(TestCaseStatus.Success),
            observabilityRules(
                "testCase", ArgumentsInput.Effect.INCLUDE, "matchTestResult({'Failed'})")));
  }

  @Test
  void allowed_testCase_excludeTrigger_failedResult_notDelivered() {
    assertFalse(
        AlertUtil.checkIfChangeEventIsAllowed(
            testCaseResultEvent(TestCaseStatus.Failed),
            observabilityRules(
                "testCase", ArgumentsInput.Effect.EXCLUDE, "matchTestResult({'Failed'})")));
  }

  @Test
  void allowed_notificationThreadOnEntity_stillDelivered() {
    // #28122 preserved: notification alerts (no trigger actions) still get thread events.
    FilteringRules notif =
        new FilteringRules()
            .withResources(List.of("glossaryTerm"))
            .withRules(Collections.emptyList())
            .withActions(Collections.emptyList());
    assertTrue(
        AlertUtil.checkIfChangeEventIsAllowed(threadUpdatedEvent(ref("glossaryTerm")), notif));
  }

  // ---- helpers ---------------------------------------------------------------

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

  private static ChangeEvent threadUpdatedEvent(EntityReference parent) {
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withType(ThreadType.Conversation)
            .withEntityRef(parent);
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(EventType.THREAD_UPDATED)
        .withEntityType(Entity.THREAD)
        .withEntity(thread)
        .withChangeDescription(new ChangeDescription());
  }

  private static EntityReference testCaseRef() {
    return new EntityReference().withId(UUID.randomUUID()).withType(Entity.TEST_CASE);
  }

  private static EntityReference ref(String type) {
    return new EntityReference().withId(UUID.randomUUID()).withType(type);
  }

  private static FilteringRules observabilityRules(
      String resource, ArgumentsInput.Effect effect, String condition) {
    EventFilterRule action =
        new EventFilterRule()
            .withName("trigger")
            .withEffect(effect)
            .withCondition(condition)
            .withPrefixCondition(ArgumentsInput.PrefixCondition.AND);
    return new FilteringRules()
        .withResources(List.of(resource))
        .withRules(Collections.emptyList())
        .withActions(List.of(action));
  }

  private static ChangeEvent testCaseResultEvent(TestCaseStatus status) {
    FieldChange resultChange =
        new FieldChange()
            .withName("testCaseResult")
            .withNewValue(new TestCaseResult().withTestCaseStatus(status));
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(EventType.ENTITY_UPDATED)
        .withEntityType(Entity.TEST_CASE)
        .withChangeDescription(
            new ChangeDescription()
                .withFieldsUpdated(List.of(resultChange))
                .withFieldsAdded(Collections.emptyList()));
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
